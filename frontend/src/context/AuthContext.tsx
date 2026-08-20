import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserProfile, LoginCredentials } from '../types/auth';
import { loginApi, getMeApi } from '../services/authApi';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<UserProfile>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('meikaan_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function initAuth() {
      if (token) {
        try {
          const profile = await getMeApi(token);
          setUser(profile);
        } catch {
          logout();
        }
      }
      setIsLoading(false);
    }
    initAuth();
  }, [token]);

  const login = async (credentials: LoginCredentials): Promise<UserProfile> => {
    setIsLoading(true);
    try {
      const data = await loginApi(credentials);
      localStorage.setItem('meikaan_token', data.access_token);
      setToken(data.access_token);
      setUser(data.user);
      return data.user;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('meikaan_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
