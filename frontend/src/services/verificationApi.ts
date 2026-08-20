import { VerificationSession, VerificationSubmitPayload } from '../types/verification';

export async function startVerificationApi(
  ticketId: string,
  token: string
): Promise<VerificationSession> {
  const response = await fetch('/api/verification/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ ticket_id: ticketId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Failed to start verification session.' }));
    throw new Error(errorData.detail || 'Could not start verification session.');
  }

  return response.json();
}

export async function submitVerificationApi(
  payload: VerificationSubmitPayload,
  token: string
): Promise<VerificationSession> {
  const formData = new FormData();
  formData.append('file', payload.file);
  formData.append('source_type', payload.source_type);

  if (payload.latitude !== undefined && payload.latitude !== null) formData.append('latitude', payload.latitude.toString());
  if (payload.longitude !== undefined && payload.longitude !== null) formData.append('longitude', payload.longitude.toString());
  if (payload.accuracy_meters !== undefined && payload.accuracy_meters !== null) formData.append('accuracy_meters', payload.accuracy_meters.toString());
  if (payload.location_source) formData.append('location_source', payload.location_source);

  const response = await fetch(`/api/verification/${payload.session_id}/submit`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Failed to submit verification evidence.' }));
    throw new Error(errorData.detail || 'Verification submission failed.');
  }

  return response.json();
}

export async function getVerificationSessionApi(
  sessionId: string,
  token: string
): Promise<VerificationSession> {
  const response = await fetch(`/api/verification/${sessionId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch verification session.');
  }

  return response.json();
}
