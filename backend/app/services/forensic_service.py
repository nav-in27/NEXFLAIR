import os
import io
import math
from typing import Dict, Any, Tuple, Optional
from PIL import Image, ImageChops, ImageEnhance, ImageStat
import numpy as np

class ForensicService:
    @staticmethod
    def analyze_image_ela(image_bytes: bytes, quality: int = 95, scale: int = 15) -> Tuple[float, Optional[bytes]]:
        """
        Performs Error Level Analysis (ELA) on an image binary.
        Returns: (ela_mean_error score, ela_visualization_bytes)
        """
        try:
            original = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            
            # Save temporary recompressed image in memory
            recompressed_buffer = io.BytesIO()
            original.save(recompressed_buffer, 'JPEG', quality=quality)
            recompressed_buffer.seek(0)
            recompressed = Image.open(recompressed_buffer).convert("RGB")
            
            # Compute absolute error diff
            ela_image = ImageChops.difference(original, recompressed)
            
            # Enhance error visibility
            extrema = ela_image.getextrema()
            max_diff = max([ex[1] for ex in extrema]) if extrema else 1
            if max_diff == 0:
                max_diff = 1
                
            scale_factor = 255.0 / max_diff
            ela_enhanced = ImageEnhance.Brightness(ela_image).enhance(scale_factor)
            
            # Calculate statistical mean error & variance score
            stat = ImageStat.Stat(ela_image)
            mean_error = sum(stat.mean) / len(stat.mean)
            
            # Convert ELA enhanced image to PNG bytes for frontend display
            output_buffer = io.BytesIO()
            ela_enhanced.save(output_buffer, format="PNG")
            ela_result_bytes = output_buffer.getvalue()
            
            return round(mean_error, 2), ela_result_bytes

        except Exception as e:
            # Fallback for non-JPEG/unsupported images
            return 0.0, None

    @staticmethod
    def extract_exif_metadata(image_bytes: bytes) -> Dict[str, Any]:
        """
        Extracts EXIF metadata tags, GPS coordinates, device info, and editing software signatures.
        """
        metadata = {
            "has_exif": False,
            "capture_date": None,
            "device_model": None,
            "editing_software": None,
            "gps_latitude": None,
            "gps_longitude": None,
            "raw_tags": {}
        }
        
        try:
            image = Image.open(io.BytesIO(image_bytes))
            exif_data = image._getexif()
            
            if not exif_data:
                return metadata
                
            metadata["has_exif"] = True
            
            # Common EXIF tag IDs
            # 271: Make, 272: Model, 305: Software, 306: DateTime, 36867: DateTimeOriginal
            for tag_id, value in exif_data.items():
                if tag_id == 272 or tag_id == 271:
                    metadata["device_model"] = str(value).strip()
                elif tag_id == 305:
                    metadata["editing_software"] = str(value).strip()
                elif tag_id == 306 or tag_id == 36867:
                    metadata["capture_date"] = str(value).strip()
                    
                # Format raw tags safely
                if isinstance(value, (int, float, str)):
                    metadata["raw_tags"][str(tag_id)] = value
                    
            # Check for suspicious editing software tags (Photoshop, GIMP, Canva, Lightroom)
            if metadata["editing_software"]:
                sw_lower = metadata["editing_software"].lower()
                for edit_tool in ["photoshop", "gimp", "canva", "lightroom", "pixelmator", "snapseed"]:
                    if edit_tool in sw_lower:
                        metadata["is_edited_flag"] = True
                        break
                        
            return metadata

        except Exception:
            return metadata

    @classmethod
    def calculate_integrity_score(
        cls, 
        file_type: str, 
        ela_mean_error: float, 
        exif_info: Dict[str, Any]
    ) -> Tuple[float, str, bool]:
        """
        Calculates holistic evidence integrity score (0 - 100).
        Returns: (integrity_score, integrity_status, is_tampered)
        """
        score = 100.0
        is_tampered = False
        
        # ELA Penalty (Normal expected JPEG noise ~ 1.0 to 12.0. Spikes > 20.0 indicate local edits)
        if ela_mean_error > 25.0:
            score -= 40.0
            is_tampered = True
        elif ela_mean_error > 15.0:
            score -= 20.0
            
        # Software editing penalty
        if exif_info.get("editing_software"):
            score -= 25.0
            is_tampered = True
            
        # Missing EXIF penalty for image files (indicates stripped metadata or screenshot)
        if file_type.lower() in ["jpg", "jpeg", "png"] and not exif_info.get("has_exif"):
            score -= 10.0
            
        score = max(0.0, min(100.0, score))
        
        if score >= 85.0:
            status = "VERIFIED"
        elif score >= 60.0:
            status = "SUSPECT"
        else:
            status = "TAMPERED"
            
        return score, status, is_tampered
