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
    <div className="w-full max-w-md mx-auto my-8 sm:my-12 animate-fade-in">
      
      {/* Login Card */}
      <div className="glass-panel rounded-3xl p-8 sm:p-10 border border-slate-800 space-y-6 shadow-2xl">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 shadow-lg shadow-sky-500/20 text-white mb-1">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Civic Authentication</h1>
          <p className="text-xs text-slate-400">MEIKAAN Evidence Integrity Portal</p>
        </div>

        {/* Demo Account Quick Selector Chips */}
        <div className="space-y-2 pt-2 border-t border-slate-800/80">
          <label className="text-[11px] font-semibold text-slate-400 font-mono uppercase tracking-wider block text-center">
            Quick Fill Demo Accounts:
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => fillDemoAccount('admin@meikaan.gov', 'Admin@123')}
              className="px-2.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-[11px] font-semibold text-indigo-300 transition-all truncate"
            >
              👑 Admin
            </button>
            <button
              type="button"
              onClick={() => fillDemoAccount('worker@meikaan.gov', 'Worker@123')}
              className="px-2.5 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-[11px] font-semibold text-sky-300 transition-all truncate"
            >
              👷 Worker
            </button>
            <button
              type="button"
              onClick={() => fillDemoAccount('reviewer@meikaan.gov', 'Reviewer@123')}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-[11px] font-semibold text-emerald-300 transition-all truncate"
            >
              🔍 Reviewer
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Email Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">Civic Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="officer@meikaan.gov"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">Password</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-sky-500/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 mt-4"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authenticating Credentials...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Sign In to MEIKAAN</span>
              </>
            )}
          </button>

        </form>

        <p className="text-[11px] text-slate-500 text-center font-mono">
          JWT Bearer Auth • Password Hashed via Bcrypt
        </p>

      </div>
    </div>
  );
};
