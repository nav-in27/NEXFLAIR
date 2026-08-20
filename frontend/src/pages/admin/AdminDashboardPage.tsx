import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, FileText, Clock, Activity, Loader2, RefreshCw, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { fetchTickets } from '../../services/ticketApi';
import { Ticket } from '../../types/ticket';

export const AdminDashboardPage: React.FC = () => {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const loadAdminData = async () => {
    if (!token) return;
    setIsLoading(true);
    setError('');

    try {
      const data = await fetchTickets(token);
      setTickets(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load admin metrics.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, [token]);

  const totalComplaints = tickets.length;
  const pendingVerification = tickets.filter(t => t.status === 'PENDING_VERIFICATION').length;
  const humanReview = tickets.filter(t => t.status === 'HUMAN_REVIEW').length;
  const suspiciousCount = tickets.filter(t => t.status === 'SUSPICIOUS' || t.status === 'CITIZEN_DISPUTE').length;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
              Municipal Administration
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
              Command Overview
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Executive Operations Console
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/tickets')}
            className="btn-primary"
          >
            <span>All Complaints Registry</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={loadAdminData}
            className="btn-secondary px-3"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-md text-rose-700 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={loadAdminData} className="text-xs font-bold underline">Retry</button>
        </div>
      )}

      {/* 4 SUMMARY METRIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="civic-card p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total Intake</span>
            <FileText className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono block">{totalComplaints}</span>
          <span className="text-[11px] text-slate-400 block font-mono">Logged across all wards</span>
        </div>

        <div className="civic-card p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Pending Evidence</span>
            <Clock className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <span className="text-2xl sm:text-3xl font-extrabold text-amber-700 font-mono block">{pendingVerification}</span>
          <span className="text-[11px] text-slate-400 block font-mono">Field works active</span>
        </div>

        <div className="civic-card p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Auditor Queue</span>
            <Activity className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <span className="text-2xl sm:text-3xl font-extrabold text-blue-700 font-mono block">{humanReview}</span>
          <span className="text-[11px] text-slate-400 block font-mono">Flagged for verification</span>
        </div>

        <div className="civic-card p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Disputed / Flagged</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <span className="text-2xl sm:text-3xl font-extrabold text-rose-700 font-mono block">{suspiciousCount}</span>
          <span className="text-[11px] text-slate-400 block font-mono">Citizen disputes & flags</span>
        </div>
      </div>

      {/* RECENT COMPLAINTS TABLE & WARD STATUS */}
      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* Recent Cases */}
        <div className="lg:col-span-2 civic-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Recent Complaints Registry
            </h2>
            <button onClick={() => navigate('/tickets')} className="text-xs text-blue-700 hover:underline font-semibold font-mono">
              View All Registry →
            </button>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-600" />
              <span className="text-xs font-mono">Loading registry items...</span>
            </div>
          ) : tickets.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-mono">No active complaints logged yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 font-mono text-[11px] border-b border-slate-200/80">
                    <th className="pb-2 font-medium">TICKET</th>
                    <th className="pb-2 font-medium">CATEGORY</th>
                    <th className="pb-2 font-medium">WARD</th>
                    <th className="pb-2 font-medium text-right">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tickets.slice(0, 6).map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 font-mono font-bold text-slate-900">#{t.ticket_number}</td>
                      <td className="py-3 font-medium text-slate-700">{t.complaint_type.replace('_', ' ')}</td>
                      <td className="py-3 text-slate-500 font-mono text-[11px]">{t.ward?.name || 'Central Ward'}</td>
                      <td className="py-3 text-right">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                          ['VERIFIED', 'CITIZEN_CONFIRMED', 'CLOSED'].includes(t.status)
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : t.status === 'CITIZEN_DISPUTE'
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}>
                          {t.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Ward Operations Overview */}
        <div className="civic-card p-6 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Ward Capacity Status
            </h2>
            <span className="text-[11px] text-slate-400 font-mono">Real-time municipal telemetry</span>
          </div>

          <div className="space-y-3">
            <div className="bg-slate-50 p-3.5 rounded-md border border-slate-200 flex items-center justify-between text-xs">
              <div>
                <span className="font-semibold text-slate-900 block">Ward 101 — Central Civic</span>
                <span className="text-[10px] text-slate-400 font-mono block">Central Zone</span>
              </div>
              <span className="font-mono text-xs font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                12 Active
              </span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-md border border-slate-200 flex items-center justify-between text-xs">
              <div>
                <span className="font-semibold text-slate-900 block">Ward 102 — Northern Metro</span>
                <span className="text-[10px] text-slate-400 font-mono block">North Zone</span>
              </div>
              <span className="font-mono text-xs font-bold text-emerald-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                8 Active
              </span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-md border border-slate-200 flex items-center justify-between text-xs">
              <div>
                <span className="font-semibold text-slate-900 block">Ward 14 — Malleshwaram</span>
                <span className="text-[10px] text-slate-400 font-mono block">West Zone</span>
              </div>
              <span className="font-mono text-xs font-bold text-amber-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                15 Active
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminDashboardPage;
