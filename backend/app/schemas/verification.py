from pydantic import BaseModel
from typing import Optional, List, Dict
import datetime

class VerificationStartRequest(BaseModel):
    ticket_id: str

class VerificationStatus(BaseModel):
    status: str
    score: Optional[float] = None
    accuracy_meters: Optional[float] = None
    distance_meters: Optional[float] = None
    tolerance_meters: Optional[float] = None

class VerificationDetailedResult(BaseModel):
    decision: str
    evidence_quality: float
    location: VerificationStatus
    scene: VerificationStatus
    issue: VerificationStatus
    temporal: VerificationStatus
    resolution: VerificationStatus
    reason: str


class SignalDetailItem(BaseModel):
    signal_name: str
    signal_value: str
    confidence: float

class VerificationSessionResponse(BaseModel):
    id: str
    ticket_id: str
    worker_id: str
    challenge_type: str
    challenge_text: str
    status: str
    started_at: datetime.datetime
    expires_at: datetime.datetime
    completed_at: Optional[datetime.datetime] = None
    integrity_score: Optional[float] = None
    integrity_status: Optional[str] = None
    detailed_result: Optional[VerificationDetailedResult] = None
    signals: List[SignalDetailItem] = []

    class Config:
        from_attributes = True


class SceneSignalItem(BaseModel):
    signal_name: str
    signal_value: str
    confidence: float


class SceneAnalysisResponse(BaseModel):
    session_id: str
    keypoints_before: int
    keypoints_after: int
    matches: int
    valid_matches: int
    match_ratio: float
    scene_score: float
    method_used: str
    inference_time_ms: float
    visualization_url: Optional[str] = None
    error: Optional[str] = None
    signals: List[SceneSignalItem] = []


class HazardSignalItem(BaseModel):
    signal_name: str
    signal_value: str
    confidence: float


class HazardAnalysisResponse(BaseModel):
    session_id: str
    hazard_type: str
    before_hazard_area: int
    after_hazard_area: int
    hazard_reduction_percentage: float
    hazard_resolution_score: float
    confidence: float
    method_used: str
    inference_time_ms: float
    requires_human_review: bool
    review_reason: Optional[str] = None
    visualization_url: Optional[str] = None
    error: Optional[str] = None
    signals: List[HazardSignalItem] = []


class FreshnessSignalItem(BaseModel):
    signal_name: str
    signal_value: str
    confidence: float


class FreshnessAnalysisResponse(BaseModel):
    session_id: str
    freshness_score: float
    reuse_detected: bool
    is_exact_duplicate: bool
    is_near_duplicate: bool
    is_suspiciously_old: bool
    missing_capture_timestamp: bool
    matched_evidence_id: Optional[str] = None
    explanation: str
    inference_time_ms: float
    signals: List[FreshnessSignalItem] = []


class SpatialTemporalSignalItem(BaseModel):
    signal_name: str
    signal_value: str
    confidence: float


class SpatialTemporalAnalysisResponse(BaseModel):
    session_id: str
    spatial_score: float
    distance_meters: Optional[float] = None
    observed_speed_kmh: Optional[float] = None
    is_spatio_temporal_anomaly: bool
    low_confidence: bool
    confidence: float
    explanation: str
    inference_time_ms: float
    signals: List[SpatialTemporalSignalItem] = []


class QualitySignalItem(BaseModel):
    signal_name: str
    signal_value: str
    confidence: float


class QualityAnalysisResponse(BaseModel):
    session_id: str
    quality_score: float
    quality_flags: List[str] = []
    explanation: str
    human_review_required: bool
    review_reason: Optional[str] = None
    width: int
    height: int
    blur_score: float
    brightness_score: float
    inference_time_ms: float
    signals: List[QualitySignalItem] = []


class FusionSignalItem(BaseModel):
    signal_name: str
    signal_value: str
    confidence: float


class FinalizeVerificationResponse(BaseModel):
    session_id: str
    overall_score: float
    confidence: float
    decision: str  # VERIFIED, HUMAN_REVIEW, SUSPICIOUS
    explanation: str
    detailed_result: Optional[VerificationDetailedResult] = None
    inference_time_ms: float
    sub_scores: Dict[str, float] = {}
    signals: List[FusionSignalItem] = []





