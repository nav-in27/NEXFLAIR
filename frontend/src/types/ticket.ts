export type TicketStatus = 
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'PENDING_VERIFICATION'
  | 'VERIFIED'
  | 'HUMAN_REVIEW'
  | 'SUSPICIOUS'
  | 'CLOSURE_NOT_VERIFIED'
  | 'CITIZEN_CONFIRMED'
  | 'CITIZEN_DISPUTE'
  | 'CLOSED';

export interface WardBrief {
  id: string;
  ward_number: number;
  name: string;
  zone: string;
}

export interface WorkerBrief {
  id: string;
  worker_code: string;
  full_name: string;
  email: string;
}

export interface TicketEvidenceBrief {
  id: string;
  evidence_type: string;
  source_type: string;
  file_path: string;
  uploaded_at: string;
}

export interface Ticket {
  id: string;
  ticket_number: string;
  complaint_type: string;
  title: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  accuracy_meters?: number;
  location_captured_at?: string;
  location_source?: string;
  location_status?: string;
  ward_id: string;
  assigned_worker_id?: string;
  worker_start_latitude?: number;
  worker_start_longitude?: number;
  worker_start_accuracy?: number;
  worker_start_timestamp?: string;
  status: TicketStatus;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  created_at: string;
  updated_at: string;
  ward?: WardBrief;
  assigned_worker?: WorkerBrief;
  evidences?: TicketEvidenceBrief[];
}

export interface CreateTicketPayload {
  complaint_type: string;
  title: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  accuracy_meters?: number;
  captured_at?: string;
  location_source?: string;
  location_status?: string;
  ward_id?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface ReviewQueueItem {
  ticket_id: string;
  ticket_number: string;
  complaint_type: string;
  title: string;
  status: TicketStatus;
  worker_id?: string;
  worker_name?: string;
  ward_name?: string;
  integrity_score?: number;
  decision?: string;
  primary_concern?: string;
  created_at: string;
  verification_session_id?: string;
  before_image_url?: string;
  after_image_url?: string;
  detailed_result?: any;
}

export interface ReviewActionPayload {
  action: 'APPROVE_CLOSURE' | 'REQUEST_REVERIFICATION' | 'REOPEN_TICKET';
  comments?: string;
}

export interface CitizenTrackResult {
  ticket_id: string;
  ticket_number: string;
  complaint_type: string;
  title: string;
  description?: string;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
  ward_name?: string;
  before_image_url?: string;
  resolution_image_url?: string;
  resolution_date?: string;
}


