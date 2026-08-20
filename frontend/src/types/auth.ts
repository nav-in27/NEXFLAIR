export type UserRole = 'ADMIN' | 'FIELD_WORKER' | 'REVIEWER';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: UserProfile;
}

export interface LoginCredentials {
  email: string;
  password: string;
}
