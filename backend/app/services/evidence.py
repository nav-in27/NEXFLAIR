import io
import os
import hashlib
from typing import Tuple
from PIL import Image
from fastapi import HTTPException, status

ALLOWED_MIME_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB limit

def compute_sha256_hash(file_bytes: bytes) -> str:
    """Generates cryptographic SHA-256 hash string for byte payload."""
    return hashlib.sha256(file_bytes).hexdigest()

def compute_perceptual_hash(image: Image.Image) -> str:
    """
    Computes an 8x8 average perceptual hash (aHash) hex string using Pillow.
    Resizes image to 8x8 grayscale, computes mean brightness, and creates 64-bit binary hash.
    """
    try:
        # Convert image to 8x8 grayscale
        resized = image.convert("L").resize((8, 8), Image.Resampling.LANCZOS)
        pixels = list(resized.getdata())
        avg = sum(pixels) / len(pixels)
        
        # Build 64-bit binary representation based on average pixel threshold
        bits = "".join(["1" if p > avg else "0" for p in pixels])
        
        # Convert 64-bit binary string into 16-character hex string
        hex_str = f"{int(bits, 2):016x}"
        return hex_str
    except Exception:
        return "0000000000000000"

def validate_evidence_file(file_bytes: bytes, filename: str, content_type: str) -> Tuple[int, int, str]:
    """
    Strictly validates uploaded evidence file:
    - MIME type & file extension
    - Maximum 10MB payload size
    - Image dimension and corruption check via Pillow
    Returns (width, height, image_format) or raises HTTP 400.
    """
    # 1. Validate File Size
    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes)."
        )

    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds maximum allowed limit of 10MB (Uploaded: {len(file_bytes) / (1024*1024):.2f}MB)."
        )

    # 2. Validate File Extension
    ext = os.path.splitext(filename.lower())[1]
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file extension '{ext}'. Allowed extensions: {', '.join(ALLOWED_EXTENSIONS)}."
        )

    # 3. Validate MIME Type
    clean_mime = content_type.lower().split(";")[0].strip()
    if clean_mime not in ALLOWED_MIME_TYPES and clean_mime != "application/octet-stream":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported MIME type '{content_type}'. Allowed types: image/jpeg, image/png, image/webp."
        )

    # 4. Validate Image Dimensions & Corruption
    try:
        image = Image.open(io.BytesIO(file_bytes))
        image.verify()  # Verify image integrity
        
        # Re-open image for dimension extraction after verify()
        image = Image.open(io.BytesIO(file_bytes))
        width, height = image.size
        img_format = image.format or "JPEG"
        
        if width <= 0 or height <= 0:
            raise ValueError("Invalid image dimensions.")

        return width, height, img_format
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid or corrupted image file payload. Error: {str(e)}"
        )
