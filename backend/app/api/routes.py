import os
import uuid
import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.models.evidence import get_db, EvidenceRecord
from app.schemas.evidence import (
    EvidenceUploadResponse,
    EvidenceVerifyRequest,
    VerificationResponse,
    LedgerResponse,
    LedgerBlockResponse
)
from app.services.hash_service import HashService
from app.services.forensic_service import ForensicService
from app.services.ledger_service import LedgerService
from app.config import settings

router = APIRouter()

@router.post("/evidence/upload", response_model=EvidenceUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_evidence(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Ingests digital civic evidence, computes cryptographic hashes (SHA-256 + Merkle tree root),
    performs Error Level Analysis (ELA) and EXIF extraction, and records in immutable DB chain.
    """
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
        
    if len(file_bytes) > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File exceeds maximum allowed size of {settings.MAX_FILE_SIZE_MB}MB.")
        
    evidence_id = str(uuid.uuid4())
    filename = file.filename or "evidence.bin"
    file_ext = filename.split(".")[-1].lower() if "." in filename else "bin"
    
    # 1. Compute SHA-256 payload hash
    sha256_hash = HashService.calculate_sha256(file_bytes)
    
    # Check if duplicate file payload already exists in ledger
    existing_record = db.query(EvidenceRecord).filter(EvidenceRecord.sha256_hash == sha256_hash).first()
    if existing_record:
        return existing_record

    # 2. Extract EXIF metadata & perform Error Level Analysis (ELA)
    exif_data = ForensicService.extract_exif_metadata(file_bytes)
    ela_error, ela_bytes = ForensicService.analyze_image_ela(file_bytes)
    
    # 3. Calculate holistic integrity score
    integrity_score, integrity_status, is_tampered = ForensicService.calculate_integrity_score(
        file_ext, ela_error, exif_data
    )
    
    # Save original file and ELA image visualization
    file_save_name = f"{evidence_id}_{filename}"
    file_save_path = os.path.join(settings.UPLOAD_DIR, file_save_name)
    with open(file_save_path, "wb") as f:
        f.write(file_bytes)
        
    ela_url = None
    if ela_bytes:
        ela_save_name = f"ela_{evidence_id}.png"
        ela_save_path = os.path.join(settings.UPLOAD_DIR, ela_save_name)
        with open(ela_save_path, "wb") as f:
            f.write(ela_bytes)
        ela_url = f"/uploads/{ela_save_name}"
        
    # 4. Chain in Immutable Ledger Block
    prev_hash, block_index = LedgerService.get_latest_block_hash_and_index(db)
    
    # Calculate Merkle Root with all existing hashes + current hash
    all_existing_hashes = [r.sha256_hash for r in db.query(EvidenceRecord.sha256_hash).all()]
    all_existing_hashes.append(sha256_hash)
    merkle_root = HashService.calculate_merkle_root(all_existing_hashes)

    record = EvidenceRecord(
        id=evidence_id,
        filename=filename,
        file_type=file_ext,
        file_size_bytes=len(file_bytes),
        sha256_hash=sha256_hash,
        merkle_root=merkle_root,
        integrity_score=integrity_score,
        integrity_status=integrity_status,
        is_tampered=is_tampered,
        ela_mean_error=ela_error,
        ela_result_image_url=ela_url,
        exif_metadata=exif_data.get("raw_tags"),
        capture_date=exif_data.get("capture_date"),
        device_model=exif_data.get("device_model"),
        editing_software=exif_data.get("editing_software"),
        block_index=block_index,
        previous_block_hash=prev_hash,
        created_at=datetime.datetime.utcnow()
    )
    
    db.add(record)
    db.commit()
    db.refresh(record)
    
    return record


@router.post("/evidence/verify", response_model=VerificationResponse)
async def verify_evidence(
    payload: EvidenceVerifyRequest,
    db: Session = Depends(get_db)
):
    """
    Verifies an evidence item's integrity against the cryptographic ledger using SHA-256 hash or evidence ID.
    """
    record = None
    if payload.sha256_hash:
        record = db.query(EvidenceRecord).filter(EvidenceRecord.sha256_hash == payload.sha256_hash).first()
    elif payload.evidence_id:
        record = db.query(EvidenceRecord).filter(EvidenceRecord.id == payload.evidence_id).first()
    else:
        raise HTTPException(status_code=400, detail="Provide either sha256_hash or evidence_id.")
        
    if not record:
        return VerificationResponse(
            is_authentic=False,
            status="NOT_FOUND",
            message="No matching civic evidence record found in the audit ledger.",
            record=None
        )
        
    is_chain_valid, _ = LedgerService.verify_chain_integrity(db)
    
    return VerificationResponse(
        is_authentic=is_chain_valid and not record.is_tampered,
        status=record.integrity_status,
        message="Cryptographic proof verified against audit ledger." if not record.is_tampered else "Evidence flagged with potential tampering anomalies.",
        record=record
    )


@router.get("/evidence/{evidence_id}", response_model=EvidenceUploadResponse)
async def get_evidence_by_id(
    evidence_id: str,
    db: Session = Depends(get_db)
):
    """Fetches detailed evidence record by ID."""
    record = db.query(EvidenceRecord).filter(EvidenceRecord.id == evidence_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Evidence record not found.")
    return record


@router.get("/audit/ledger", response_model=LedgerResponse)
async def get_audit_ledger(
    db: Session = Depends(get_db)
):
    """Fetches full evidence transaction ledger and chain validity state."""
    is_valid, records = LedgerService.verify_chain_integrity(db)
    
    blocks = [
        LedgerBlockResponse(
            block_index=r.block_index,
            id=r.id,
            filename=r.filename,
            sha256_hash=r.sha256_hash,
            previous_block_hash=r.previous_block_hash,
            integrity_score=r.integrity_score,
            integrity_status=r.integrity_status,
            created_at=r.created_at
        )
        for r in records
    ]
    
    return LedgerResponse(
        total_records=len(records),
        is_chain_valid=is_valid,
        blocks=blocks
    )
