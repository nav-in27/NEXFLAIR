import os
import uuid
from abc import ABC, abstractmethod
from typing import Tuple
from fastapi import HTTPException, status
from app.core.config import settings

class BaseStorageProvider(ABC):
    @abstractmethod
    def save_file(self, file_bytes: bytes, original_filename: str, content_type: str) -> Tuple[str, str]:
        """Saves file and returns (relative_path, storage_key)."""
        pass

    @abstractmethod
    def get_file_path(self, relative_path: str) -> str:
        """Resolves readable absolute file path or URL."""
        pass

    @abstractmethod
    def delete_file(self, relative_path: str) -> bool:
        """Deletes file from storage."""
        pass

class LocalStorageProvider(BaseStorageProvider):
    def __init__(self, base_dir: str = None):
        if base_dir is None:
            backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
            base_dir = os.path.join(backend_dir, "uploads", "evidence")
        
        self.base_dir = os.path.abspath(base_dir)
        os.makedirs(self.base_dir, exist_ok=True)

    def _sanitize_filename(self, filename: str) -> str:
        """Protects against path traversal attacks."""
        basename = os.path.basename(filename)
        sanitized = "".join(c for c in basename if c.isalnum() or c in (".", "_", "-"))
        if not sanitized or ".." in sanitized:
            sanitized = f"evidence_{uuid.uuid4().hex[:8]}.bin"
        return sanitized

    def save_file(self, file_bytes: bytes, original_filename: str, content_type: str) -> Tuple[str, str]:
        sanitized = self._sanitize_filename(original_filename)
        ext = os.path.splitext(sanitized)[1].lower()
        unique_filename = f"{uuid.uuid4()}{ext}"
        
        target_path = os.path.abspath(os.path.join(self.base_dir, unique_filename))

        # Strict path traversal security validation
        if not target_path.startswith(self.base_dir):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Security Violation: Invalid file path traversal attempt detected."
            )

        with open(target_path, "wb") as f:
            f.write(file_bytes)

        relative_path = f"/uploads/evidence/{unique_filename}"
        return relative_path, unique_filename

    def get_file_path(self, relative_path: str) -> str:
        backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        clean_path = relative_path.lstrip("/\\")
        abs_path = os.path.abspath(os.path.join(backend_dir, clean_path))
        
        if not abs_path.startswith(backend_dir):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Security Violation: Access outside upload directory denied."
            )
        return abs_path

    def delete_file(self, relative_path: str) -> bool:
        try:
            abs_path = self.get_file_path(relative_path)
            if os.path.exists(abs_path):
                os.remove(abs_path)
                return True
        except Exception:
            pass
        return False

class S3StorageProvider(BaseStorageProvider):
    def __init__(self, bucket_name: str = "meikaan-evidence"):
        self.bucket_name = bucket_name

    def save_file(self, file_bytes: bytes, original_filename: str, content_type: str) -> Tuple[str, str]:
        unique_key = f"evidence/{uuid.uuid4()}_{original_filename}"
        # Stub implementation compatible with boto3 S3 put_object
        return f"s3://{self.bucket_name}/{unique_key}", unique_key

    def get_file_path(self, relative_path: str) -> str:
        return f"https://{self.bucket_name}.s3.amazonaws.com/{relative_path}"

    def delete_file(self, relative_path: str) -> bool:
        return True

def get_storage_provider() -> BaseStorageProvider:
    # Use LocalStorageProvider for development
    return LocalStorageProvider()

import hashlib

def _calculate_file_hash(file_path: str) -> str:
    hash_sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_sha256.update(chunk)
    return hash_sha256.hexdigest()

def get_verification_image_pair(db, session_id: str) -> Tuple[str, str, bool]:
    """
    Robustly fetches the EXACT BEFORE image and AFTER image.
    Computes SHA-256 hashes to explicitly confirm they are different physical files.
    Returns: (before_path, after_path, is_duplicate)
    """
    from app.models.entities import VerificationSession, TicketEvidence, EvidenceType
    
    session = db.query(VerificationSession).filter(VerificationSession.id == session_id).first()
    if not session:
        raise ValueError(f"Verification session {session_id} not found.")

    before_ev = db.query(TicketEvidence).filter(
        TicketEvidence.ticket_id == session.ticket_id,
        TicketEvidence.evidence_type == EvidenceType.BEFORE.value,
    ).order_by(TicketEvidence.created_at.asc()).first()

    after_ev = db.query(TicketEvidence).filter(
        TicketEvidence.ticket_id == session.ticket_id,
        TicketEvidence.verification_session_id == session_id,
    ).first()

    if not before_ev or not after_ev:
        raise ValueError("Missing BEFORE or AFTER evidence images.")

    storage = get_storage_provider()
    before_path = storage.get_file_path(before_ev.file_path)
    after_path = storage.get_file_path(after_ev.file_path)

    before_hash = _calculate_file_hash(before_path)
    after_hash = _calculate_file_hash(after_path)
    
    is_duplicate = (before_hash == after_hash)

    return before_path, after_path, is_duplicate
