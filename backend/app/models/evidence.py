from sqlalchemy import Column, String, Integer, Float, DateTime, JSON, Text, Boolean, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import datetime
from app.config import settings

Base = declarative_base()

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class EvidenceRecord(Base):
    __tablename__ = "evidence_records"

    id = Column(String(36), primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    
    # Cryptographic Hashes
    sha256_hash = Column(String(64), unique=True, index=True, nullable=False)
    merkle_root = Column(String(64), nullable=False)
    
    # Forensic Scores & Status
    integrity_score = Column(Float, nullable=False)  # 0.0 to 100.0
    integrity_status = Column(String(50), nullable=False)  # VERIFIED, SUSPECT, TAMPERED
    is_tampered = Column(Boolean, default=False)
    
    # Computer Vision & ELA analysis details
    ela_mean_error = Column(Float, nullable=True)
    ela_result_image_url = Column(String(512), nullable=True)
    
    # Metadata & EXIF
    exif_metadata = Column(JSON, nullable=True)
    capture_date = Column(String(100), nullable=True)
    gps_latitude = Column(Float, nullable=True)
    gps_longitude = Column(Float, nullable=True)
    device_model = Column(String(100), nullable=True)
    editing_software = Column(String(100), nullable=True)
    
    # Timestamps & Ledger
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    block_index = Column(Integer, nullable=False, index=True)
    previous_block_hash = Column(String(64), nullable=False)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
