import { useEffect, useState } from 'react';
import { ReviewQueueItem } from '../types/ticket';
import { fetchReviewQueue } from '../services/ticketApi';
import { TicketStatusBadge } from './TicketStatusBadge';
import InvestigationModal from './InvestigationModal';


interface ReviewQueueProps {
  token: string;
}

export default function ReviewQueue({ token }: ReviewQueueProps) {
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ReviewQueueItem | null>(null);

  const loadQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchReviewQueue(token);
      setItems(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load Review Queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, [token]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span className="p-2 rounded-lg bg-amber-500/20 text-amber-400">🛡️</span>
            Human Review Queue
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Cases flagged by the verification engines requiring manual inspection and approval.
          </p>
        </div>
        <button
          onClick={loadQueue}
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition border border-slate-700 flex items-center gap-2"
        >
          🔄 Refresh Queue
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/50 border border-red-800 text-red-300 text-sm">
          🚨 {error}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-400 text-sm">
          <div className="inline-block animate-spin text-2xl mb-2">⚙️</div>
          <p>Loading Review Queue cases...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-2xl">
          <div className="text-4xl mb-3">✅</div>
          <h3 className="text-lg font-semibold text-slate-200">Review Queue Clear</h3>
          <p className="text-slate-400 text-sm mt-1">
            No tickets currently require manual review.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {items.map((item) => {
            const scoreColor =
              (item.integrity_score ?? 0) >= 90
                ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60'
                : (item.integrity_score ?? 0) >= 70
                ? 'text-amber-400 bg-amber-950/60 border-amber-800/60'
                : 'text-rose-400 bg-rose-950/60 border-rose-800/60';

            return (
              <div
                key={item.ticket_id}
                className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-amber-400 bg-amber-950/40 px-2.5 py-1 rounded-md border border-amber-800/40">
                      {item.ticket_number}
                    </span>
                    <TicketStatusBadge status={item.status} />
                    <span className="text-xs text-slate-400">
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-white">{item.title}</h3>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
                    <span>👷 <strong className="text-slate-200">{item.worker_name}</strong></span>
                    <span>📍 <strong className="text-slate-200">{item.ward_name}</strong></span>
                    <span>🚨 Category: <strong className="text-slate-200">{item.complaint_type}</strong></span>
                  </div>

                  {item.primary_concern && (
                    <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 font-sans leading-relaxed">
                      💬 <span className="text-slate-400 font-mono">Primary Concern:</span> {item.primary_concern}
                    </div>
                  )}
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                  {item.integrity_score !== undefined && item.integrity_score !== null && (
                    <div className={`p-3 rounded-xl border text-center font-mono ${scoreColor}`}>
                      <div className="text-2xl font-black">{item.integrity_score.toFixed(1)}</div>
                      <div className="text-[10px] uppercase font-bold tracking-wider mt-0.5">Integrity Score</div>
                    </div>
                  )}

                  <button
                    onClick={() => setSelectedItem(item)}
                    className="w-full md:w-auto px-5 py-3 rounded-xl font-bold text-sm bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2"
                  >
                    🔍 Investigate Case
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedItem && (
        <InvestigationModal
          item={selectedItem}
          token={token}
          onClose={() => setSelectedItem(null)}
          onActionComplete={() => {
            setSelectedItem(null);
            loadQueue();
          }}
        />
      )}
    </div>
  );
}
