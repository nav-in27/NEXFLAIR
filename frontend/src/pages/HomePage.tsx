import React from 'react';
import { NavLink } from 'react-router-dom';
import { Sparkles, Crown, ShieldCheck, ArrowRight, Layers, Lock } from 'lucide-react';

export const HomePage: React.FC = () => {
  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 animate-fade-in py-4">
      
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-bold tracking-wider uppercase">
          <Layers className="w-4 h-4" />
          <span>MEIKAAN — Civic Evidence Integrity Engine v1.0</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight">
          Civic Evidence Verification & Analytics Engine
        </h1>

        <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
          Automated multi-engine verification platform mathematically proving municipal closure evidence before grievance resolution.
        </p>

        {/* Primary CTA Buttons */}
        <div className="pt-4 flex flex-wrap justify-center gap-4">
          <NavLink
            to="/investigate"
            className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/20 transition-all flex items-center space-x-2.5 transform active:scale-98"
          >
            <Sparkles className="w-5 h-5" />
            <span>Launch Hackathon Demo Screen (/investigate)</span>
            <ArrowRight className="w-4 h-4" />
          </NavLink>

          <NavLink
            to="/admin/dashboard"
            className="px-6 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-100 border border-slate-700 font-bold text-sm shadow-lg transition-all flex items-center space-x-2.5"
          >
            <Crown className="w-5 h-5 text-indigo-400" />
            <span>Admin Analytics Portal (/admin/dashboard)</span>
          </NavLink>
        </div>
      </div>

      {/* Primary Portal Navigation Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        
        {/* Card 1: Hackathon Demo */}
        <NavLink
          to="/investigate"
          className="glass-panel rounded-3xl p-6 border border-amber-500/40 bg-amber-950/10 hover:border-amber-400 transition-all group space-y-3"
        >
          <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 w-fit border border-amber-500/20 group-hover:scale-110 transition-transform">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-black text-white">🔬 Hackathon Demo Screen</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Primary judging screen displaying side-by-side evidence, LoFTR keypoint feature matching, puddle hazard mask reduction, and 7-signal score breakdown.
          </p>
          <div className="text-xs font-mono font-bold text-amber-400 flex items-center gap-1 pt-2">
            <span>Explore Demo Mode</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </NavLink>

        {/* Card 2: Admin Dashboard */}
        <NavLink
          to="/admin/dashboard"
          className="glass-panel rounded-3xl p-6 border border-indigo-500/40 bg-indigo-950/10 hover:border-indigo-400 transition-all group space-y-3"
        >
          <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 w-fit border border-indigo-500/20 group-hover:scale-110 transition-transform">
            <Crown className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-black text-white">📊 Admin Operations Portal</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Real database analytics: Ward suspicious rates, Verification Risk Indicators, Review Queue, All Tickets, and System Audit Logs ledger.
          </p>
          <div className="text-xs font-mono font-bold text-indigo-400 flex items-center gap-1 pt-2">
            <span>View Admin Analytics</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </NavLink>

        {/* Card 3: Review Queue */}
        <NavLink
          to="/verification-queue"
          className="glass-panel rounded-3xl p-6 border border-emerald-500/40 bg-emerald-950/10 hover:border-emerald-400 transition-all group space-y-3"
        >
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 w-fit border border-emerald-500/20 group-hover:scale-110 transition-transform">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-black text-white">🛡️ Review Queue & Audit</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Manual inspection workspace for municipal reviewers to approve closure, request re-verification, or reopen tickets.
          </p>
          <div className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1 pt-2">
            <span>Inspect Review Queue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </NavLink>

      </div>

      {/* Login Quick Switch Banner */}
      <div className="glass-panel rounded-3xl p-6 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Lock className="w-4 h-4 text-sky-400" />
            Role-Based Authentication Access
          </h4>
          <p className="text-xs text-slate-400">
            Pre-configured accounts: Admin (<code className="text-sky-300">admin@meikaan.gov</code>), Reviewer (<code className="text-emerald-300">reviewer@meikaan.gov</code>), Field Worker (<code className="text-amber-300">worker@meikaan.gov</code>).
          </p>
        </div>
        <NavLink
          to="/login"
          className="px-5 py-2.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-xs font-bold transition-all whitespace-nowrap"
        >
          Sign In Page (/login)
        </NavLink>
      </div>

    </div>
  );
};
