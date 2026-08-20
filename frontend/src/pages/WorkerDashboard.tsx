import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { HardHat, MapPin, CheckCircle, LogOut } from 'lucide-react';
import { TicketListPage } from './TicketListPage';
import { fetchTickets } from '../services/ticketApi';

export const WorkerDashboard: React.FC = () => {
  const { user, token, logout } = useAuth();
  const [assignedCount, setAssignedCount] = useState<number>(0);

  useEffect(() => {
    if (token) {
      fetchTickets(token).then((t) => setAssignedCount(t.length)).catch(() => {});
    }
  }, [token]);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-fade-in">
      
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 border border-sky-500/30 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <HardHat className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Field Worker Operations Portal</h1>
            <p className="text-xs text-slate-400">Authenticated: {user?.full_name} ({user?.email})</p>
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

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel rounded-xl p-5 border border-slate-800 space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Assigned Ward</span>
          <p className="text-xl font-bold text-sky-300 font-mono flex items-center space-x-1.5">
            <MapPin className="w-4 h-4 text-sky-400" />
            <span>Ward 101</span>
          </p>
        </div>

        <div className="glass-panel rounded-xl p-5 border border-slate-800 space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Assigned Duty Tickets</span>
          <p className="text-xl font-bold text-emerald-300 font-mono">{assignedCount} Tickets</p>
        </div>

        <div className="glass-panel rounded-xl p-5 border border-slate-800 space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Field Status</span>
          <p className="text-xl font-bold text-emerald-300 font-mono flex items-center space-x-1">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>ACTIVE DUTY</span>
          </p>
        </div>
      </div>

      {/* Assigned Tickets */}
      <div className="pt-2">
        <TicketListPage />
      </div>

    </div>
  );
};
