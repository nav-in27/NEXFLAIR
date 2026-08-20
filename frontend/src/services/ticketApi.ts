import { Ticket, CreateTicketPayload, TicketStatus } from '../types/ticket';

function getAuthHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

export async function fetchTickets(token: string): Promise<Ticket[]> {
  const response = await fetch('/api/tickets', {
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch tickets.');
  }

  return response.json();
}

export async function fetchTicketById(id: string, token: string): Promise<Ticket> {
  const response = await fetch(`/api/tickets/${id}`, {
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch ticket details.');
  }

  return response.json();
}

export async function createTicket(payload: CreateTicketPayload, token: string): Promise<Ticket> {
  const response = await fetch('/api/tickets', {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Failed to create ticket.');
  }

  return response.json();
}

export async function assignWorkerToTicket(ticketId: string, workerId: string, token: string): Promise<Ticket> {
  const response = await fetch(`/api/tickets/${ticketId}/assign`, {
    method: 'PATCH',
    headers: getAuthHeaders(token),
    body: JSON.stringify({ assigned_worker_id: workerId }),
  });

  if (!response.ok) {
    throw new Error('Failed to assign worker to ticket.');
  }

  return response.json();
}

export async function updateTicketStatus(ticketId: string, status: TicketStatus, token: string): Promise<Ticket> {
  const response = await fetch(`/api/tickets/${ticketId}/status`, {
    method: 'PATCH',
    headers: getAuthHeaders(token),
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw new Error('Failed to update ticket status.');
  }

  return response.json();
}

export async function fetchReviewQueue(token?: string) {
  const authToken = token || localStorage.getItem('meikaan_auth_token') || '';
  const response = await fetch('/api/tickets/review-queue', {
    headers: getAuthHeaders(authToken),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch review queue.');
  }

  return response.json();
}

export const getReviewerQueue = fetchReviewQueue;

export async function submitReviewAction(
  ticketId: string,
  payload: { action: 'APPROVE_CLOSURE' | 'REQUEST_REVERIFICATION' | 'REOPEN_TICKET'; comments?: string },
  token?: string
) {
  const authToken = token || localStorage.getItem('meikaan_auth_token') || '';
  const response = await fetch(`/api/tickets/${ticketId}/review`, {
    method: 'POST',
    headers: getAuthHeaders(authToken),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to submit review action.');
  }

  return response.json();
}

export async function startWorkerTaskApi(
  ticketId: string,
  payload: {
    latitude?: number;
    longitude?: number;
    accuracy_meters?: number;
    captured_at?: string;
    location_source?: string;
  },
  token: string
): Promise<Ticket> {
  const response = await fetch(`/api/tickets/${ticketId}/start-task`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to start task location capture.');
  }

  return response.json();
}

export async function createPublicCitizenReport(payload: {
  complaint_type: string;
  description: string;
  latitude?: number;
  longitude?: number;
  accuracy_meters?: number;
  captured_at?: string;
  location_source?: string;
  location_status?: string;
  ward_id?: string;
  photo_base64?: string;
}) {
  const response = await fetch('/api/tickets/public', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to submit citizen report.');
  }

  return response.json();
}

export async function createCitizenReport(payload: {
  complaint_type: string;
  description: string;
  latitude?: number;
  longitude?: number;
  accuracy_meters?: number;
  captured_at?: string;
  location_source?: string;
  location_status?: string;
  ward_id?: string;
  photo_base64?: string;
}) {
  const response = await fetch('/api/tickets/public', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to submit citizen report.');
  }

  return response.json();
}

export async function trackCitizenTicket(reference: string) {
  const cleanRef = encodeURIComponent(reference.trim());
  const response = await fetch(`/api/tickets/public/track/${cleanRef}`);

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Complaint not found. Please check your reference ID.');
  }

  return response.json();
}

export async function confirmCitizenResolution(reference: string) {
  const cleanRef = encodeURIComponent(reference.trim());
  const response = await fetch(`/api/tickets/public/${cleanRef}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to confirm resolution.');
  }

  return response.json();
}

export async function disputeCitizenResolution(reference: string, reason: string, evidenceBase64?: string) {
  const cleanRef = encodeURIComponent(reference.trim());
  const response = await fetch(`/api/tickets/public/${cleanRef}/dispute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, evidence_base64: evidenceBase64 }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to submit dispute.');
  }

  return response.json();
}


