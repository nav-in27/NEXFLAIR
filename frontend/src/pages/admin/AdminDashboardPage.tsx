import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, FileText, Clock, Activity, Loader2, RefreshCw } from 'lucide-react';
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
    <div className="min-h-screen bg-[#fcfcfd] text-slate-900 p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Municipal Operations Management</span>
          <h1 className="font-serif text-3xl font-extrabold text-slate-900 tracking-tight">Admin Console</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/tickets')}
            className="px-4 py-2.5 bg-[#0b1d30] hover:bg-[#162e48] text-white rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            All Complaints
          </button>
          <button
            onClick={loadAdminData}
            className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={loadAdminData} className="text-xs font-bold underline">Retry</button>
        </div>
      )}

      {/* TOP 4 SUMMARY METRIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>Total Complaints</span>
            <FileText className="w-4 h-4 text-slate-700" />
          </div>
          <span className="text-3xl font-extrabold text-slate-900">{totalComplaints}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Logged across municipal wards</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>Pending Verification</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <span className="text-3xl font-extrabold text-amber-700">{pendingVerification}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Resolution evidence uploaded</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>Human Review</span>
            <Activity className="w-4 h-4 text-purple-600" />
          </div>
          <span className="text-3xl font-extrabold text-purple-700">{humanReview}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Flagged for auditor decision</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>Suspicious / Disputed</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <span className="text-3xl font-extrabold text-rose-700">{suspiciousCount}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Citizen disputes & anomalies</span>
        </div>
      </div>

      {/* RECENT CASES TABLE & WARD OVERVIEW */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Cases */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Recent Complaints</h3>
            <button onClick={() => navigate('/tickets')} className="text-xs text-[#0b1d30] hover:underline font-bold">
              View All →
            </button>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-900" />
              <span className="text-xs font-medium">Loading complaints...</span>
            </div>
          ) : tickets.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">No active complaints logged yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-200 pb-2">
                    <th className="py-2">Reference</th>
                    <th className="py-2">Category</th>
                    <th className="py-2">Ward</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tickets.slice(0, 5).map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="py-3 font-mono font-bold text-slate-900">#{t.ticket_number}</td>
                      <td className="py-3 font-semibold text-slate-800">{t.complaint_type.replace('_', ' ')}</td>
                      <td className="py-3 text-slate-600">{t.ward?.name || 'Central Ward'}</td>
                      <td className="py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          ['VERIFIED', 'CITIZEN_CONFIRMED', 'CLOSED'].includes(t.status)
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : t.status === 'CITIZEN_DISPUTE'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
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

        {/* Ward Overview Sidebar Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-3">
            Ward Overview
          </h3>

          <div className="space-y-3">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 block">Ward 101 — Central Civic</span>
                <span className="text-[10px] text-slate-500 block">Central Zone</span>
              </div>
              <span className="text-xs font-bold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                12 Active
              </span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 block">Ward 102 — Northern Metro</span>
                <span className="text-[10px] text-slate-500 block">North Zone</span>
              </div>
              <span className="text-xs font-bold text-emerald-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                8 Active
              </span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 block">Ward 14 — Malleshwaram</span>
                <span className="text-[10px] text-slate-500 block">West Zone</span>
              </div>
              <span className="text-xs font-bold text-amber-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
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
