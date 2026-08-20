import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, CheckCircle2, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { fetchReviewQueue } from '../../services/ticketApi';
import { ReviewQueueItem } from '../../types/ticket';

export const ReviewerDashboardPage: React.FC = () => {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [queueItems, setQueueItems] = useState<ReviewQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const loadReviewQueue = async () => {
    if (!token) return;
    setIsLoading(true);
    setError('');

    try {
      const data = await fetchReviewQueue(token);
      setQueueItems(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch review queue.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReviewQueue();
  }, [token]);

  return (
    <div className="min-h-screen bg-[#fcfcfd] text-slate-900 p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Civic Audit & Review Portal</span>
          <h1 className="font-serif text-3xl font-extrabold text-slate-900 tracking-tight">Review Queue</h1>
        </div>

        <button
          onClick={loadReviewQueue}
          className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-200 shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Queue
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={loadReviewQueue} className="text-xs font-bold underline">Retry</button>
        </div>
      )}

      {/* Review Queue Cards */}
      {isLoading ? (
        <div className="p-16 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-slate-900" />
          <span className="text-xs font-medium">Loading cases requiring human audit...</span>
        </div>
      ) : queueItems.length === 0 ? (
        <div className="p-16 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
          <div className="text-lg font-bold text-slate-900 font-serif">Review Queue All Clear!</div>
          <div className="text-xs text-slate-500">No pending verification flags or citizen disputes require manual audit.</div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {queueItems.map((item) => {
            const score = item.integrity_score != null ? Math.round(item.integrity_score) : null;
            return (
              <div
                key={item.ticket_id}
                className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-slate-600">#{item.ticket_number}</span>
                    <span className={`px-3 py-0.5 rounded-full text-xs font-bold ${
                      item.status === 'CITIZEN_DISPUTE'
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                      {item.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="font-bold text-slate-900 text-base">{item.title}</div>

                  {/* Integrity Score Badge */}
                  <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                    <div className="text-center shrink-0 pr-4 border-r border-slate-200">
                      <span className="text-[10px] text-slate-500 block font-semibold uppercase">Integrity</span>
                      <span className={`text-xl font-extrabold ${score == null ? 'text-slate-400' : score >= 80 ? 'text-emerald-700' : score >= 60 ? 'text-amber-700' : 'text-rose-700'}`}>
                        {score != null ? `${score}/100` : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">Primary Concern</span>
                      <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed font-medium">
                        {item.primary_concern || 'Requires manual reviewer audit.'}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => navigate(`/reviewer/investigate/${item.ticket_id}`)}
                  className="w-full py-3 bg-[#0b1d30] hover:bg-[#162e48] text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>INVESTIGATE CASE</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ReviewerDashboardPage;
