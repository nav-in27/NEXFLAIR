import pytest
from app.services.hash_service import HashService
from app.services.forensic_service import ForensicService
from PIL import Image
import io

def test_sha256_hash_calculation():
    payload = b"MEIKAAN Civic Evidence Test Payload 2026"
    digest = HashService.calculate_sha256(payload)
    assert len(digest) == 64
    assert digest == HashService.calculate_sha256(payload)

def test_merkle_root_calculation():
    hashes = [
        "a" * 64,
        "b" * 64,
        "c" * 64
    ]
    merkle_root = HashService.calculate_merkle_root(hashes)
    assert len(merkle_root) == 64
    assert merkle_root != hashes[0]

def test_forensic_ela_analysis():
    # Create test JPEG image in memory
    img = Image.new("RGB", (100, 100), color="blue")
    img_bytes_io = io.BytesIO()
    img.save(img_bytes_io, format="JPEG")
    img_bytes = img_bytes_io.getvalue()

    ela_error, ela_bytes = ForensicService.analyze_image_ela(img_bytes)
    assert isinstance(ela_error, float)
    assert ela_error >= 0.0
    assert ela_bytes is not None

def test_integrity_score_calculation():
    score, status_str, is_tampered = ForensicService.calculate_integrity_score(
        file_type="jpg",
        ela_mean_error=2.5,
        exif_info={"has_exif": True, "editing_software": None}
    )
    assert score == 100.0
    assert status_str == "VERIFIED"
    assert not is_tampered

    # Edited test
    score_tampered, status_tampered, is_tampered_flag = ForensicService.calculate_integrity_score(
        file_type="jpg",
        ela_mean_error=35.0,
        exif_info={"has_exif": True, "editing_software": "Adobe Photoshop"}
    )
    assert score_tampered < 60.0
    assert status_tampered == "TAMPERED"
    assert is_tampered_flag is True
