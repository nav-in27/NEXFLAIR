import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types/auth';
import { ShieldAlert, Loader2 } from 'lucide-react';

interface RequireAuthProps {
  children: React.ReactElement;
  allowedRoles?: UserRole[];
}

export const RequireAuth: React.FC<RequireAuthProps> = ({ children, allowedRoles }) => {
  const { user, token, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
        <p className="text-xs font-mono text-slate-400">Verifying security token...</p>
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 glass-panel rounded-2xl border border-rose-500/30 text-center space-y-4">
        <div className="inline-flex p-3 rounded-2xl bg-rose-500/10 text-rose-400">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">403 Access Forbidden</h2>
        <p className="text-xs text-slate-400">
          Your account role (<strong className="text-slate-200">{user.role}</strong>) does not have authorization to access this page. Required role: <strong className="text-sky-400">{allowedRoles.join(', ')}</strong>.
        </p>
      </div>
    );
  }

  return children;
};
