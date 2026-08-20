import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Lock, Mail, Eye, EyeOff, AlertCircle, Loader2, KeyRound } from 'lucide-react';
import { UserRole } from '../types/auth';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fillDemoAccount = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMessage(null);
  };

  const handleRedirectByRole = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        navigate('/admin/dashboard', { replace: true });
        break;
      case 'FIELD_WORKER':
        navigate('/worker/dashboard', { replace: true });
        break;
      case 'REVIEWER':
        navigate('/reviewer/dashboard', { replace: true });
        break;
      default:
        navigate('/', { replace: true });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter both email address and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const userProfile = await login({ email: email.trim(), password });
      handleRedirectByRole(userProfile.role);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Authentication failed. Please check credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto my-12 px-4 animate-fade-in">
      
      {/* Login Card */}
      <div className="civic-card p-8 sm:p-10 space-y-6 shadow-sm">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center mx-auto mb-2 shadow-xs">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Staff Authentication</h1>
          <p className="text-xs text-slate-500">MEIKAAN Evidence Integrity Portal</p>
        </div>

        {/* Demo Account Quick Selector Chips */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <label className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider block text-center">
            Quick Fill Demo Accounts:
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => fillDemoAccount('admin@meikaan.gov', 'Admin@123')}
              className="px-2.5 py-1.5 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[11px] font-mono font-semibold text-slate-700 transition-colors truncate"
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => fillDemoAccount('worker@meikaan.gov', 'Worker@123')}
              className="px-2.5 py-1.5 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[11px] font-mono font-semibold text-slate-700 transition-colors truncate"
            >
              Field Worker
            </button>
            <button
              type="button"
              onClick={() => fillDemoAccount('reviewer@meikaan.gov', 'Reviewer@123')}
              className="px-2.5 py-1.5 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[11px] font-mono font-semibold text-slate-700 transition-colors truncate"
            >
              Auditor
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Email Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">Civic Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="officer@meikaan.gov"
                className="civic-input pl-9 font-mono text-xs"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">Password</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="civic-input pl-9 pr-10 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full btn-primary py-2.5 text-xs font-semibold"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <span>Sign In to Console</span>
            )}
          </button>
        </form>

        {/* Security Assurance Footer */}
        <div className="pt-3 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400 font-mono flex items-center justify-center gap-1.5">
            <Lock className="w-3 h-3 text-slate-400" />
            <span>Encrypted Session • Multi-Role Access</span>
          </p>
        </div>

      </div>

    </div>
  );
};
