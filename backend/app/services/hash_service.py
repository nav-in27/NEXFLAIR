import hashlib
from typing import List

class HashService:
    @staticmethod
    def calculate_sha256(file_bytes: bytes) -> str:
        """Calculates standard SHA-256 digest of raw file binary payload."""
        hasher = hashlib.sha256()
        hasher.update(file_bytes)
        return hasher.hexdigest()

    @staticmethod
    def calculate_merkle_root(hashes: List[str]) -> str:
        """Constructs Merkle tree root hash from a list of leaf hashes."""
        if not hashes:
            return hashlib.sha256(b"").hexdigest()
        
        current_level = [h for h in hashes]
        
        while len(current_level) > 1:
            next_level = []
            if len(current_level) % 2 != 0:
                current_level.append(current_level[-1])
                
            for i in range(0, len(current_level), 2):
                combined = (current_level[i] + current_level[i + 1]).encode('utf-8')
                parent_hash = hashlib.sha256(combined).hexdigest()
                next_level.append(parent_hash)
                
            current_level = next_level
            
        return current_level[0]

    @staticmethod
    def calculate_block_hash(block_index: int, previous_hash: str, sha256_hash: str, timestamp_str: str) -> str:
        """Calculates block hash chaining previous block hash with payload hash."""
        data = f"{block_index}:{previous_hash}:{sha256_hash}:{timestamp_str}".encode('utf-8')
        return hashlib.sha256(data).hexdigest()
