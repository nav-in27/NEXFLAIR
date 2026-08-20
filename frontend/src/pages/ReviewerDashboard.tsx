import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { SearchCheck, LogOut } from 'lucide-react';
import { TicketListPage } from './TicketListPage';
import ReviewQueue from '../components/ReviewQueue';
import { fetchTickets } from '../services/ticketApi';

export const ReviewerDashboard: React.FC = () => {
  const { user, token, logout } = useAuth();
  const [totalCount, setTotalCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'queue' | 'all'>('queue');

  useEffect(() => {
    if (token) {
      fetchTickets(token).then((t) => setTotalCount(t.length)).catch(() => {});
    }
  }, [token]);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-fade-in">
      
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <SearchCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Civic Audit & Verification Review Portal</h1>
            <p className="text-xs text-slate-400">Authenticated: {user?.full_name} ({user?.email}) — Total System Tickets: {totalCount}</p>
          </div>
        </div>


        <button
          onClick={logout}
          className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center space-x-2 transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-3 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('queue')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center space-x-2 ${
            activeTab === 'queue'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
          }`}
        >
          <span>🛡️ Review Queue</span>
        </button>

        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center space-x-2 ${
            activeTab === 'all'
              ? 'bg-sky-500 text-slate-950 shadow-lg shadow-sky-500/20'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
          }`}
        >
          <span>📋 All Tickets</span>
        </button>
      </div>

      {/* View Content */}
      {activeTab === 'queue' ? (
        token && <ReviewQueue token={token} />
      ) : (
        <TicketListPage />
      )}

    </div>
  );
};

