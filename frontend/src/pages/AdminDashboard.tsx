import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Crown, LogOut, RefreshCw, FileText, Building, Users } from 'lucide-react';
import { TicketListPage } from './TicketListPage';
import ReviewQueue from '../components/ReviewQueue';

interface DashboardMetrics {
  total_tickets: number;
  pending_verification: number;
  verified: number;
  human_review: number;
  suspicious: number;
  closed: number;
  average_integrity_score: number;
  verification_distribution: Record<string, number>;
  ward_suspicious_rates: Array<{
    ward_name: string;
    total_tickets: number;
    suspicious_tickets: number;
    suspicious_rate_pct: number;
  }>;
  suspicious_closure_trend: Array<{
    date: string;
    suspicious_count: number;
  }>;
}

interface WardAnalyticItem {
  ward_id: string;
  ward_number: number;
  ward_name: string;
  zone: string;
  total_tickets: number;
  verified: number;
  human_review: number;
  suspicious: number;
  suspicious_percentage: number;
}

interface WorkerRiskIndicator {
  worker_id: string;
  worker_code: string;
  worker_name: string;
  email: string;
  total_tickets: number;
  verified: number;
  human_review: number;
  suspicious: number;
  average_integrity_score: number;
  evidence_reuse_flags: number;
  temporal_anomalies: number;
}

interface AuditLogRecord {
  id: string;
  user_email: string;
  user_name: string;
  action: string;
  resource: string;
  details: any;
  timestamp: string;
}

export const AdminDashboard: React.FC = () => {
  const { user, token, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'queue' | 'tickets' | 'wards' | 'workers' | 'audit'>('dashboard');

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [wardData, setWardData] = useState<WardAnalyticItem[]>([]);
  const [workerRiskData, setWorkerRiskData] = useState<WorkerRiskIndicator[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchAnalytics = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [dashRes, wardRes, workerRes, auditRes] = await Promise.all([
        fetch('/api/analytics/dashboard', { headers }),
        fetch('/api/analytics/wards', { headers }),
        fetch('/api/analytics/workers', { headers }),
        fetch('/api/analytics/audit', { headers }),
      ]);

      if (dashRes.ok) setMetrics(await dashRes.json());
      if (wardRes.ok) setWardData(await wardRes.json());
      if (workerRes.ok) setWorkerRiskData(await workerRes.json());
      if (auditRes.ok) setAuditLogs(await auditRes.json());
    } catch (e) {
      console.error('Failed to fetch admin analytics data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [token]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 border border-indigo-500/30 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Crown className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">System Admin Operations & Analytics Portal</h1>
            <p className="text-xs text-slate-400">Authenticated Administrator: {user?.full_name} ({user?.email})</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchAnalytics}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 text-sky-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync Analytics</span>
          </button>

          <button
            onClick={logout}
            className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center space-x-2 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Navigation Bar / Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {[
          { id: 'dashboard', label: '📊 Dashboard Overview', color: 'bg-indigo-500 text-slate-950' },
          { id: 'queue', label: '🛡️ Review Queue', color: 'bg-amber-500 text-slate-950' },
          { id: 'tickets', label: '📋 All Tickets', color: 'bg-sky-500 text-slate-950' },
          { id: 'wards', label: '🏛️ Ward Analytics', color: 'bg-emerald-500 text-slate-950' },
          { id: 'workers', label: '🚨 Verification Risk Indicators', color: 'bg-purple-500 text-slate-950' },
          { id: 'audit', label: '🔒 System Audit Logs', color: 'bg-cyan-500 text-slate-950' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? `${tab.color} shadow-lg`
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Top Real-time Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Total Tickets</span>
              <p className="text-3xl font-black text-white font-mono">{metrics?.total_tickets ?? 0}</p>
            </div>

            <div className="glass-panel rounded-2xl p-5 border border-amber-800/40 bg-amber-950/20 space-y-1">
              <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block">Pending Verification</span>
              <p className="text-3xl font-black text-amber-300 font-mono">{metrics?.pending_verification ?? 0}</p>
            </div>

            <div className="glass-panel rounded-2xl p-5 border border-emerald-800/40 bg-emerald-950/20 space-y-1">
              <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">Verified</span>
              <p className="text-3xl font-black text-emerald-300 font-mono">{metrics?.verified ?? 0}</p>
            </div>

            <div className="glass-panel rounded-2xl p-5 border border-purple-800/40 bg-purple-950/20 space-y-1">
              <span className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider block">Human Review</span>
              <p className="text-3xl font-black text-purple-300 font-mono">{metrics?.human_review ?? 0}</p>
            </div>

            <div className="glass-panel rounded-2xl p-5 border border-rose-800/40 bg-rose-950/20 space-y-1">
              <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider block">Suspicious</span>
              <p className="text-3xl font-black text-rose-300 font-mono">{metrics?.suspicious ?? 0}</p>
            </div>
          </div>

          {/* Average Integrity & Distribution Panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Status Distribution */}
            <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                📈 Verification Status Distribution
              </h3>

              <div className="space-y-3 font-mono text-xs">
                {metrics?.verification_distribution &&
                  Object.entries(metrics.verification_distribution).map(([status, count]) => {
                    const pct = metrics.total_tickets > 0 ? Math.round((count / metrics.total_tickets) * 100) : 0;
                    return (
                      <div key={status} className="space-y-1">
                        <div className="flex justify-between text-slate-300">
                          <span>{status}</span>
                          <span className="font-bold">{count} ({pct}%)</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
                          <div
                            className={`h-full ${
                              status === 'VERIFIED' ? 'bg-emerald-500' : status === 'HUMAN_REVIEW' ? 'bg-purple-500' : status === 'SUSPICIOUS' ? 'bg-rose-500' : 'bg-sky-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Average Integrity Score Indicator */}
            <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col justify-between space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  🎯 System Integrity Score
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Overall weighted average confidence across all multi-engine verification signals.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-1">
                <div className="text-5xl font-black text-emerald-400 font-mono">
                  {metrics?.average_integrity_score ?? 85.0} / 100
                </div>
                <div className="text-xs text-slate-400 uppercase tracking-widest font-bold">
                  Systemwide Average Integrity
                </div>
              </div>

              <div className="text-xs text-slate-400 leading-relaxed bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                🔒 All scores are calculated deterministically via Scene, Hazard, Live Capture, Spatial, Temporal, Freshness, and Quality engines without random numbers.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REVIEW QUEUE */}
      {activeTab === 'queue' && token && <ReviewQueue token={token} />}

      {/* TAB 3: TICKETS */}
      {activeTab === 'tickets' && <TicketListPage />}

      {/* TAB 4: WARD ANALYTICS */}
      {activeTab === 'wards' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Building className="w-5 h-5 text-emerald-400" />
              Ward Level Risk Breakdown
            </h2>
            <span className="text-xs text-slate-400 font-mono">Calculated from live tickets</span>
          </div>

          <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Ward</th>
                  <th className="px-6 py-4">Zone</th>
                  <th className="px-6 py-4 text-center">Total Tickets</th>
                  <th className="px-6 py-4 text-center">Verified</th>
                  <th className="px-6 py-4 text-center">Human Review</th>
                  <th className="px-6 py-4 text-center">Suspicious</th>
                  <th className="px-6 py-4 text-right">Suspicious %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {wardData.map((w) => (
                  <tr key={w.ward_id} className="hover:bg-slate-900/50 transition">
                    <td className="px-6 py-4 font-bold text-white">Ward {w.ward_number} - {w.ward_name}</td>
                    <td className="px-6 py-4 text-slate-400">{w.zone}</td>
                    <td className="px-6 py-4 text-center text-slate-200 font-bold">{w.total_tickets}</td>
                    <td className="px-6 py-4 text-center text-emerald-400 font-bold">{w.verified}</td>
                    <td className="px-6 py-4 text-center text-purple-400 font-bold">{w.human_review}</td>
                    <td className="px-6 py-4 text-center text-rose-400 font-bold">{w.suspicious}</td>
                    <td className="px-6 py-4 text-right font-bold">
                      <span className={`px-2 py-1 rounded-md ${w.suspicious_percentage > 20 ? 'bg-rose-950 text-rose-400 border border-rose-800' : 'bg-slate-900 text-slate-300'}`}>
                        {w.suspicious_percentage.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: WORKER VERIFICATION RISK INDICATORS */}
      {activeTab === 'workers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" />
                Verification Risk Indicators
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Aggregated field worker evidence signals, duplicate payload flags, and spatio-temporal anomalies.
              </p>
            </div>
          </div>

          <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Worker</th>
                  <th className="px-6 py-4">Worker Code</th>
                  <th className="px-6 py-4 text-center">Total Tickets</th>
                  <th className="px-6 py-4 text-center">Verified</th>
                  <th className="px-6 py-4 text-center">Review</th>
                  <th className="px-6 py-4 text-center">Suspicious</th>
                  <th className="px-6 py-4 text-center">Avg Integrity Score</th>
                  <th className="px-6 py-4 text-center">Evidence Reuse Flags</th>
                  <th className="px-6 py-4 text-right">Temporal Anomalies</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {workerRiskData.map((wk) => (
                  <tr key={wk.worker_id} className="hover:bg-slate-900/50 transition">
                    <td className="px-6 py-4 font-bold text-white font-sans">{wk.worker_name}</td>
                    <td className="px-6 py-4 text-amber-400 font-bold">{wk.worker_code}</td>
                    <td className="px-6 py-4 text-center text-slate-200 font-bold">{wk.total_tickets}</td>
                    <td className="px-6 py-4 text-center text-emerald-400 font-bold">{wk.verified}</td>
                    <td className="px-6 py-4 text-center text-purple-400 font-bold">{wk.human_review}</td>
                    <td className="px-6 py-4 text-center text-rose-400 font-bold">{wk.suspicious}</td>
                    <td className="px-6 py-4 text-center text-emerald-300 font-bold">{wk.average_integrity_score.toFixed(1)}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded font-bold ${wk.evidence_reuse_flags > 0 ? 'bg-rose-950 text-rose-400 border border-rose-800' : 'text-slate-400'}`}>
                        {wk.evidence_reuse_flags}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`px-2 py-0.5 rounded font-bold ${wk.temporal_anomalies > 0 ? 'bg-amber-950 text-amber-400 border border-amber-800' : 'text-slate-400'}`}>
                        {wk.temporal_anomalies}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            System Audit Ledger Logs
          </h2>

          <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4">Actor Email</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4">Resource</th>
                  <th className="px-6 py-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/50 transition">
                    <td className="px-6 py-4 text-slate-400 text-[11px]">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="px-6 py-4 text-indigo-300 font-sans font-semibold">{log.user_email}</td>
                    <td className="px-6 py-4 font-bold text-amber-400">{log.action}</td>
                    <td className="px-6 py-4 text-sky-400">{log.resource}</td>
                    <td className="px-6 py-4 text-slate-300 font-sans text-[11px]">{JSON.stringify(log.details)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
