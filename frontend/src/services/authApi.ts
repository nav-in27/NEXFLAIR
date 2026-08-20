import { LoginCredentials, TokenResponse, UserProfile } from '../types/auth';

export async function loginApi(credentials: LoginCredentials): Promise<TokenResponse> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Login authentication failed.' }));
    throw new Error(errorData.detail || 'Authentication failed. Please check credentials.');
  }

  return response.json();
}

export async function getMeApi(token: string): Promise<UserProfile> {
  const response = await fetch('/api/auth/me', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Session expired or invalid token.');
  }

  return response.json();
}
