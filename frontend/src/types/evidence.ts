export type EvidenceType = 'BEFORE' | 'AFTER' | 'LIVE_VERIFICATION';
export type SourceType = 'UPLOAD' | 'LIVE_CAMERA';

export interface EvidenceItem {
  id: string;
  ticket_id: string;
  evidence_type: EvidenceType;
  source_type: SourceType;
  file_path: string;
  file_type: string;
  sha256_hash: string;
  perceptual_hash?: string;
  captured_at?: string;
  uploaded_at: string;
  latitude?: number;
  longitude?: number;
  width?: number;
  height?: number;
  file_size_bytes?: number;
  verification_session_id?: string;
}

export interface UploadEvidencePayload {
  ticket_id: string;
  file: File;
  evidence_type: EvidenceType;
  source_type: SourceType;
  latitude?: number;
  longitude?: number;
}
