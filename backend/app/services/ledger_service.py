from sqlalchemy.orm import Session
from app.models.evidence import EvidenceRecord
from app.services.hash_service import HashService
from typing import List, Tuple

class LedgerService:
    GENESIS_PREVIOUS_HASH = "0000000000000000000000000000000000000000000000000000000000000000"

    @classmethod
    def get_latest_block_hash_and_index(cls, db: Session) -> Tuple[str, int]:
        """Fetches the latest block in the database to link the new block."""
        latest = db.query(EvidenceRecord).order_by(EvidenceRecord.block_index.desc()).first()
        if not latest:
            return cls.GENESIS_PREVIOUS_HASH, 1
        
        # Calculate current latest block hash
        latest_block_hash = HashService.calculate_block_hash(
            latest.block_index,
            latest.previous_block_hash,
            latest.sha256_hash,
            latest.created_at.isoformat()
        )
        return latest_block_hash, latest.block_index + 1

    @classmethod
    def verify_chain_integrity(cls, db: Session) -> Tuple[bool, List[EvidenceRecord]]:
        """Scans all evidence records sequentially to verify cryptographic chain integrity."""
        records = db.query(EvidenceRecord).order_by(EvidenceRecord.block_index.asc()).all()
        if not records:
            return True, []

        expected_prev_hash = cls.GENESIS_PREVIOUS_HASH
        
        for record in records:
            if record.previous_block_hash != expected_prev_hash:
                return False, records
                
            expected_prev_hash = HashService.calculate_block_hash(
                record.block_index,
                record.previous_block_hash,
                record.sha256_hash,
                record.created_at.isoformat()
            )
            
        return True, records
