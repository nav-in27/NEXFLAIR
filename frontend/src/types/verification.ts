export interface VerificationSignalItem {
  signal_name: string;
  signal_value: string;
  confidence: number;
}

export interface VerificationStatus {
  status: string;
  score?: number;
  accuracy_meters?: number;
  distance_meters?: number;
  tolerance_meters?: number;
}

export interface VerificationDetailedResult {
  decision: string;
  evidence_quality: number;
  location: VerificationStatus;
  scene: VerificationStatus;
  issue: VerificationStatus;
  temporal: VerificationStatus;
  resolution: VerificationStatus;
  reason: string;
}

export interface VerificationSession {
  id: string;
  ticket_id: string;
  worker_id: string;
  challenge_type: string;
  challenge_text: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED' | 'COMPLETED' | 'FAILED';
  started_at: string;
  expires_at: string;
  completed_at?: string;
  // Verification result fields returned by backend after finalize
  integrity_score?: number;
  integrity_status?: string;
  detailed_result?: VerificationDetailedResult;
  signals?: VerificationSignalItem[];
}

export interface VerificationSubmitPayload {
  session_id: string;
  file: File;
  source_type: 'LIVE_CAMERA' | 'UPLOAD';
  latitude?: number;
  longitude?: number;
  accuracy_meters?: number;
  location_source?: string;
}
