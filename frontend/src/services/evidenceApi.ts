import { EvidenceItem, UploadEvidencePayload } from '../types/evidence';

export async function uploadEvidenceApi(
  payload: UploadEvidencePayload,
  token: string
): Promise<EvidenceItem> {
  const formData = new FormData();
  formData.append('file', payload.file);
  formData.append('evidence_type', payload.evidence_type);
  formData.append('source_type', payload.source_type);

  if (payload.latitude) formData.append('latitude', payload.latitude.toString());
  if (payload.longitude) formData.append('longitude', payload.longitude.toString());

  const response = await fetch(`/api/tickets/${payload.ticket_id}/evidence`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Evidence upload failed.' }));
    throw new Error(errorData.detail || 'Failed to upload evidence file.');
  }

  return response.json();
}

export async function fetchTicketEvidenceApi(
  ticketId: string,
  token: string
): Promise<EvidenceItem[]> {
  const response = await fetch(`/api/tickets/${ticketId}/evidence`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch evidence list for ticket.');
  }

  return response.json();
}
