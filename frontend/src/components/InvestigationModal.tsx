import { useEffect, useState } from 'react';
import { ReviewQueueItem } from '../types/ticket';
import { submitReviewAction } from '../services/ticketApi';

interface InvestigationModalProps {
  item: ReviewQueueItem;
  token: string;
  onClose: () => void;
  onActionComplete: () => void;
}

export default function InvestigationModal({
  item,
  token,
  onClose,
  onActionComplete,
}: InvestigationModalProps) {
  const [comments, setComments] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [evidenceData, setEvidenceData] = useState<any>(null);
  const [loadingEvidence, setLoadingEvidence] = useState<boolean>(true);



  useEffect(() => {
    async function loadEvidence() {
      try {
        const resp = await fetch(`/api/tickets/${item.ticket_id}/evidence`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.ok) {
          const data = await resp.json();
          setEvidenceData(data);
        }
      } catch (err) {
        console.error('Failed to load evidence for investigation', err);
      } finally {
        setLoadingEvidence(false);
      }
    }
    loadEvidence();
  }, [item.ticket_id, token]);

  const handleAction = async (action: 'APPROVE_CLOSURE' | 'REQUEST_REVERIFICATION' | 'REOPEN_TICKET') => {
    setSubmitting(true);
    setActionError(null);
    try {
      await submitReviewAction(item.ticket_id, { action, comments }, token);
      onActionComplete();
    } catch (err: any) {
      setActionError(err.message || 'Failed to submit review decision');
    } finally {
      setSubmitting(false);
    }
  };

  // Resolve before / after evidence items
  const beforeItem = evidenceData?.find((e: any) => e.evidence_type === 'BEFORE');
  const afterItem = evidenceData?.find((e: any) => e.evidence_type === 'AFTER' || e.evidence_type === 'LIVE');

  const beforeUrl = beforeItem ? `/uploads/${beforeItem.file_path.replace(/^.*[\\\/]/, '')}` : null;
  const afterUrl = afterItem ? `/uploads/${afterItem.file_path.replace(/^.*[\\\/]/, '')}` : null;

  // Visualization URLs
  const sceneVizUrl = item.verification_session_id
    ? `/uploads/visualizations/scene_match_${item.verification_session_id}.png`
    : null;
  const hazardVizUrl = item.verification_session_id
    ? `/uploads/visualizations/hazard_change_${item.verification_session_id}.png`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between sticky top-0 z-10">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-bold text-amber-400 bg-amber-950/50 px-3 py-1 rounded-md border border-amber-800/50">
                {item.ticket_number}
              </span>
              <span className="text-xs font-bold text-slate-300">{item.complaint_type}</span>
              {loadingEvidence && <span className="text-xs text-sky-400 font-mono animate-pulse">Syncing evidence...</span>}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Title: <span className="text-slate-200">{item.title}</span> | Assigned: <span className="text-slate-200">{item.worker_name}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          {actionError && (
            <div className="p-4 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-sm">
              ⚠️ {actionError}
            </div>
          )}

          {/* Primary Concern / Explanation Banner */}
          <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-800/50 text-amber-200 space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-400">Primary Concern & Explanation</div>
            <p className="text-sm leading-relaxed">{item.primary_concern || 'Requires manual verification inspection.'}</p>
          </div>

          {/* Visual Evidence Section */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
              📸 Visual Evidence Payload
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* BEFORE Image */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-slate-400 flex items-center justify-between">
                  <span>BEFORE Image</span>
                  {beforeItem && <span className="text-[10px] font-mono text-slate-500">{beforeItem.captured_at ? new Date(beforeItem.captured_at).toLocaleTimeString() : 'Uploaded'}</span>}
                </div>
                {beforeUrl ? (
                  <img
                    src={beforeUrl}
                    alt="BEFORE evidence"
                    className="w-full h-48 object-cover rounded-xl border border-slate-800"
                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-full h-48 rounded-xl bg-slate-900 border border-dashed border-slate-800 flex items-center justify-center text-xs text-slate-500">
                    No BEFORE Evidence
                  </div>
                )}
              </div>

              {/* VERIFICATION Image */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-slate-400 flex items-center justify-between">
                  <span>VERIFICATION Image</span>
                  {afterItem && (
                    <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${afterItem.source_type === 'LIVE_CAMERA' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'}`}>
                      {afterItem.source_type || 'UPLOAD'}
                    </span>
                  )}
                </div>
                {afterUrl ? (
                  <img
                    src={afterUrl}
                    alt="VERIFICATION evidence"
                    className="w-full h-48 object-cover rounded-xl border border-slate-800"
                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-full h-48 rounded-xl bg-slate-900 border border-dashed border-slate-800 flex items-center justify-center text-xs text-slate-500">
                    No VERIFICATION Evidence
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Engine Visualizations */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
              🔬 Engine Visualizations
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Scene Consistency Keypoint Match Visualization */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-indigo-400">Keypoint Match Visualization (LoFTR / ORB)</div>
                {sceneVizUrl ? (
                  <img
                    src={sceneVizUrl}
                    alt="Keypoint match visualization"
                    className="w-full h-48 object-contain rounded-xl bg-slate-900 border border-slate-800"
                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-full h-48 rounded-xl bg-slate-900 border border-dashed border-slate-800 flex items-center justify-center text-xs text-slate-500">
                    Visualization Pending
                  </div>
                )}
              </div>

              {/* Hazard Change Mask Overlay */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-cyan-400">Hazard Mask Overlay (Stagnant Water Reduction)</div>
                {hazardVizUrl ? (
                  <img
                    src={hazardVizUrl}
                    alt="Hazard mask overlay"
                    className="w-full h-48 object-contain rounded-xl bg-slate-900 border border-slate-800"
                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-full h-48 rounded-xl bg-slate-900 border border-dashed border-slate-800 flex items-center justify-center text-xs text-slate-500">
                    Visualization Pending
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Metadata & Spatial/Temporal Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="font-bold text-slate-400 uppercase tracking-wider">📍 Spatial & GPS Info</div>
              <div className="flex justify-between border-b border-slate-900 pb-1">
                <span className="text-slate-500">Ward:</span>
                <span className="font-semibold text-slate-200">{item.ward_name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-900 pb-1">
                <span className="text-slate-500">Complaint GPS:</span>
                <span className="font-mono text-slate-300">12.9716 N, 77.5946 E</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Evidence GPS:</span>
                <span className="font-mono text-slate-300">12.9718 N, 77.5948 E</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="font-bold text-slate-400 uppercase tracking-wider">⏱️ Timeline</div>
              <div className="flex justify-between border-b border-slate-900 pb-1">
                <span className="text-slate-500">Ticket Created:</span>
                <span className="text-slate-300">{new Date(item.created_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Verification Session:</span>
                <span className="font-mono text-slate-400">{item.verification_session_id || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Reviewer Action Controls */}
          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              ✍️ Reviewer Decision & Comments
            </h4>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Add reviewer notes / justification (optional)..."
              rows={3}
              className="w-full px-4 py-3 text-sm bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                disabled={submitting}
                onClick={() => handleAction('APPROVE_CLOSURE')}
                className="py-3 px-4 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                ✅ Approve Closure
              </button>
              <button
                disabled={submitting}
                onClick={() => handleAction('REQUEST_REVERIFICATION')}
                className="py-3 px-4 rounded-xl font-bold text-sm bg-amber-600 hover:bg-amber-500 text-white transition shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                ⚠️ Request Re-verification
              </button>
              <button
                disabled={submitting}
                onClick={() => handleAction('REOPEN_TICKET')}
                className="py-3 px-4 rounded-xl font-bold text-sm bg-rose-600 hover:bg-rose-500 text-white transition shadow-lg shadow-rose-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                🚨 Reopen Ticket
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
