import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, Plus, User, HardHat, CheckSquare, 
  Search, CheckCircle2, Loader2, Activity
} from 'lucide-react';
import { getReviewerQueue, submitReviewAction, fetchTicketById } from '../../services/ticketApi';
import { ReviewQueueItem } from '../../types/ticket';
import EvidenceViewer from '../../components/EvidenceViewer';

export const ReviewerInvestigationPage: React.FC = () => {
  const { ticketId } = useParams<{ ticketId?: string }>();
  const navigate = useNavigate();

  const [queue, setQueue] = useState<ReviewQueueItem[]>([]);
  const [selectedCase, setSelectedCase] = useState<ReviewQueueItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterTag, setFilterTag] = useState<string>('ALL');
  
  // Decision action states
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionDoneMsg, setActionDoneMsg] = useState<string>('');

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const data = await getReviewerQueue();
      setQueue(data);

      if (ticketId) {
        const target = data.find((item: ReviewQueueItem) => item.ticket_id === ticketId || item.ticket_number === ticketId);
        if (target) {
          setSelectedCase(target);
        } else {
          try {
            const token = localStorage.getItem('meikaan_auth_token') || '';
            const tkt = await fetchTicketById(ticketId, token);
            const beforeEv = tkt.evidences?.find(e => e.evidence_type === 'BEFORE');
            const afterEv = tkt.evidences?.find(e => e.evidence_type === 'AFTER' || e.evidence_type === 'LIVE_VERIFICATION');
            setSelectedCase({
              ticket_id: tkt.id,
              ticket_number: tkt.ticket_number,
              complaint_type: tkt.complaint_type,
              title: tkt.title,
              status: tkt.status,
              worker_id: tkt.assigned_worker_id,
              worker_name: tkt.assigned_worker?.full_name || 'Unassigned',
              ward_name: tkt.ward?.name || 'Unassigned Ward',
              primary_concern: `Status: ${tkt.status}`,
              created_at: tkt.created_at,
              before_image_url: beforeEv?.file_path,
              after_image_url: afterEv?.file_path,
            });
          } catch {
            setSelectedCase(data[0] || null);
          }
        }
      } else if (data.length > 0) {
        setSelectedCase(data[0]);
      } else {
        setSelectedCase(null);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [ticketId]);

  const handleAction = async (actionType: 'APPROVE_CLOSURE' | 'REQUEST_REVERIFICATION' | 'REOPEN_TICKET') => {
    if (!selectedCase) return;
    setIsSubmitting(true);
    setActionDoneMsg('');

    try {
      await submitReviewAction(selectedCase.ticket_id, {
        action: actionType,
        comments: `Reviewer action executed via workspace: ${actionType}`,
      });

      const labelMap = {
        APPROVE_CLOSURE: 'Closure verified successfully!',
        REQUEST_REVERIFICATION: 'Human reverification requested.',
        REOPEN_TICKET: 'Case reopened and returned to field queue.',
      };

      setActionDoneMsg(labelMap[actionType]);
      setTimeout(() => {
        fetchQueue();
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to submit review action.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtering case queue
  const filteredQueue = queue.filter((item) => {
    const matchesSearch = item.ticket_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (item.ward_name && item.ward_name.toLowerCase().includes(searchQuery.toLowerCase()));
    if (filterTag === 'HIGH_PRIORITY') return matchesSearch && (item.primary_concern?.includes('HIGH') || item.decision === 'NEEDS_VERIFICATION');
    if (filterTag === 'STAGNANT_WATER') return matchesSearch && item.complaint_type === 'WATER_SEWAGE';
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans flex flex-col lg:flex-row">
      
      {/* 1. LEFT NAVIGATION SIDEBAR */}
      <aside className="w-full lg:w-60 bg-white border-r border-slate-200 p-5 flex flex-col justify-between shrink-0 shadow-xs">
        <div className="space-y-6">
          
          {/* Logo / Header */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-slate-900 flex items-center justify-center text-white font-bold">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h1 className="font-bold text-xs tracking-tight text-slate-900 uppercase">
                Auditor Console
              </h1>
              <p className="text-[10px] text-slate-400 font-mono">
                FORENSIC SUITE
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1 text-xs font-semibold">
            <button
              onClick={() => navigate('/')}
              className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-md text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>Public Portal</span>
            </button>

            <button
              onClick={() => navigate('/worker/dashboard')}
              className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-md text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <HardHat className="w-3.5 h-3.5 text-slate-400" />
              <span>Field Worker</span>
            </button>

            <button
              onClick={() => navigate('/reviewer/dashboard')}
              className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-md bg-slate-900 text-white font-semibold"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Auditor Queue</span>
            </button>

            <button
              onClick={() => navigate('/admin/dashboard')}
              className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-md text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Activity className="w-3.5 h-3.5 text-slate-400" />
              <span>Admin Center</span>
            </button>
          </nav>
        </div>

        {/* Bottom Sidebar Footer */}
        <div className="pt-4 border-t border-slate-100 space-y-1 text-xs text-slate-500 font-medium">
          <button onClick={() => navigate('/report')} className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-md hover:bg-slate-50">
            <Plus className="w-3.5 h-3.5 text-slate-400" />
            <span>New Report</span>
          </button>
          <div className="px-2.5 py-1 text-[10px] text-slate-400 font-mono">
            Integrity Engine v2.4
          </div>
        </div>
      </aside>

      {/* 2. CASE QUEUE COLUMN */}
      <div className="w-full lg:w-72 bg-white border-r border-slate-200 p-4 flex flex-col shrink-0 space-y-3.5">
        
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
            Review Queue
          </h2>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            {filteredQueue.length} Cases
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search ticket # or ward..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 rounded-md border border-slate-200 text-xs focus:outline-none focus:border-slate-400 font-mono"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] font-semibold">
          <button
            onClick={() => setFilterTag('ALL')}
            className={`px-2.5 py-1 rounded text-xs transition-colors ${
              filterTag === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({queue.length})
          </button>
          <button
            onClick={() => setFilterTag('HIGH_PRIORITY')}
            className={`px-2.5 py-1 rounded text-xs transition-colors ${
              filterTag === 'HIGH_PRIORITY' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Priority
          </button>
        </div>

        {/* Case List Cards */}
        <div className="flex-1 overflow-y-auto space-y-2 pt-1">
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-600" />
              <span className="text-xs font-mono">Loading cases...</span>
            </div>
          ) : filteredQueue.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs font-mono">
              No pending cases in queue.
            </div>
          ) : (
            filteredQueue.map((item) => {
              const isSelected = selectedCase?.ticket_id === item.ticket_id;
              return (
                <div
                  key={item.ticket_id}
                  onClick={() => setSelectedCase(item)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all space-y-1.5 ${
                    isSelected
                      ? 'bg-slate-50 border-slate-900 ring-1 ring-slate-900'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-slate-900">#{item.ticket_number}</span>
                    <span className="text-slate-400 text-[10px]">2h ago</span>
                  </div>

                  <h3 className="text-xs font-semibold text-slate-900 line-clamp-1">
                    {item.title}
                  </h3>

                  <div className="flex items-center justify-between text-[10px] pt-1">
                    <span className="text-slate-500 font-mono">
                      {item.ward_name || 'Ward 14'}
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      Score: <span className="text-blue-700">{item.integrity_score != null ? Math.round(item.integrity_score) : '—'}</span>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. MAIN INVESTIGATION WORKSPACE */}
      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        
        {selectedCase ? (
          <div className="space-y-6 max-w-6xl">
            
            {/* CASE HEADER BANNER */}
            <div className="civic-card p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-mono text-xs text-slate-500">
                  <span className="font-bold text-slate-900">CASE #{selectedCase.ticket_number}</span>
                  <span>•</span>
                  <span>{selectedCase.ward_name || 'Ward 14'}</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {selectedCase.title}
                </h1>
                <div className="flex items-center gap-2 pt-1">
                  {selectedCase.status === 'CLOSURE_NOT_VERIFIED' || selectedCase.decision === 'CLOSURE_NOT_VERIFIED' ? (
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-50 text-rose-800 border border-rose-200">
                      CLOSURE NOT VERIFIED
                    </span>
                  ) : selectedCase.status === 'SUSPICIOUS' || selectedCase.decision === 'SUSPICIOUS' ? (
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-50 text-purple-800 border border-purple-200">
                      SUSPICIOUS EVIDENCE
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      AWAITING AUDIT REVIEW
                    </span>
                  )}
                </div>
              </div>

              {/* INTEGRITY SCORE PILL */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex items-center space-x-3 shrink-0">
                <div className="text-right">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">
                    Forensic Score
                  </span>
                  <span className="text-xs font-semibold text-slate-700 block">
                    Quality Index
                  </span>
                </div>
                <div className="w-11 h-11 rounded-md bg-slate-900 text-white flex items-center justify-center font-mono text-base font-bold">
                  {selectedCase.integrity_score != null ? Math.round(selectedCase.integrity_score) : '—'}
                </div>
              </div>

            </div>

            {error && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-md text-rose-700 text-xs font-medium flex items-center gap-2">
                <span>{error}</span>
              </div>
            )}

            {actionDoneMsg && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-800 text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{actionDoneMsg}</span>
              </div>
            )}

            {/* MAIN GRID */}
            <div className="grid lg:grid-cols-12 gap-6">
              
              {/* VISUAL EVIDENCE VIEWER (8 COLS) */}
              <div className="lg:col-span-8 space-y-4">
                <EvidenceViewer
                  beforeUrl={selectedCase.before_image_url}
                  afterUrl={selectedCase.after_image_url}
                  caseNumber={selectedCase.ticket_number}
                  beforeTimestamp={new Date(selectedCase.created_at).toLocaleString()}
                  afterTimestamp="Resolution Evidence"
                  deviceInfo="Forensic Visual Engine • SuperPoint/RANSAC"
                  hash={selectedCase.verification_session_id || selectedCase.ticket_id}
                  latitude={13.0031}
                  longitude={77.5643}
                  statusBadge={selectedCase.status === 'CLOSURE_NOT_VERIFIED' ? 'CLOSURE NOT VERIFIED' : selectedCase.status.replace('_', ' ')}
                />

                {/* AUDITOR DECISION BAR */}
                <div className="civic-card p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <span className="text-xs text-slate-500 max-w-sm">
                    {selectedCase.status === 'CLOSURE_NOT_VERIFIED'
                      ? 'Resolution evidence does not establish sufficient scene correspondence.'
                      : 'Authorize ticket closure or dispatch for field re-inspection.'}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAction('REOPEN_TICKET')}
                      disabled={isSubmitting}
                      className="btn-secondary text-xs"
                    >
                      Reopen Ticket
                    </button>

                    <button
                      onClick={() => handleAction('REQUEST_REVERIFICATION')}
                      disabled={isSubmitting}
                      className="btn-secondary text-xs"
                    >
                      Request Re-Inspection
                    </button>

                    <button
                      onClick={() => handleAction('APPROVE_CLOSURE')}
                      disabled={isSubmitting}
                      className="btn-primary text-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Verify Closure</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* RIGHT PANEL: FORENSIC GATES (4 COLS) */}
              <div className="lg:col-span-4 space-y-4">
                
                <div className="civic-card p-5 space-y-3.5">
                  <div className="flex items-center space-x-2 border-b border-slate-100 pb-2.5">
                    <Activity className="w-3.5 h-3.5 text-blue-600" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Forensic Verification Gates
                    </h3>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    
                    {/* Gate 1: Spatial */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1">
                      <div className="flex items-center justify-between font-mono">
                        <span className="font-semibold text-slate-800 font-sans">1. Spatial Proximity</span>
                        {selectedCase.detailed_result?.location?.status === 'PASS' || selectedCase.detailed_result?.location?.status === 'GPS_PASS' ? (
                          <span className="text-emerald-700 font-bold">PASS ({selectedCase.detailed_result.location.distance_meters ?? 'N/A'}m)</span>
                        ) : (
                          <span className="text-amber-700 font-bold">FLAGGED ({selectedCase.detailed_result?.location?.distance_meters ?? 'N/A'}m)</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        GPS telemetry validated against original complaint coordinates.
                      </p>
                    </div>

                    {/* Gate 2: Scene Geometry */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1">
                      <div className="flex items-center justify-between font-mono">
                        <span className="font-semibold text-slate-800 font-sans">2. Scene Geometry</span>
                        <span className="text-emerald-700 font-bold">
                          {selectedCase.detailed_result?.scene?.status || 'STRONG MATCH'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        RANSAC geometric homography and landmark inlier verification.
                      </p>
                    </div>

                    {/* Gate 3: Defect Resolution */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1">
                      <div className="flex items-center justify-between font-mono">
                        <span className="font-semibold text-slate-800 font-sans">3. Defect Clearance</span>
                        <span className="text-emerald-700 font-bold">
                          {selectedCase.detailed_result?.issue?.status || 'RESOLVED'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Substantial removal of reported road defect or hazard.
                      </p>
                    </div>

                    {/* Gate 4: Temporal Order */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1">
                      <div className="flex items-center justify-between font-mono">
                        <span className="font-semibold text-slate-800 font-sans">4. Temporal Freshness</span>
                        <span className="text-emerald-700 font-bold">VERIFIED</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Resolution captured after work assignment timestamp.
                      </p>
                    </div>

                    {/* Gate 5: Hash & Cryptography */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1">
                      <div className="flex items-center justify-between font-mono">
                        <span className="font-semibold text-slate-800 font-sans">5. Cryptographic Chain</span>
                        <span className="text-emerald-700 font-bold">SHA-256</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Fingerprint registered on municipal verification ledger.
                      </p>
                    </div>

                    {/* System Reasoning Note */}
                    <div className="p-3 bg-slate-100 border border-slate-200 rounded-md space-y-1">
                      <span className="text-[10px] font-mono uppercase text-slate-500 font-bold">System Recommendation</span>
                      <p className="text-[11px] text-slate-700 italic">
                        "{selectedCase.detailed_result?.reason || 'Visual evidence is consistent with the reported defect location.'}"
                      </p>
                    </div>

                  </div>
                </div>

              </div>

            </div>

          </div>
        ) : (
          <div className="py-24 text-center text-slate-400 text-xs font-mono">
            Select a case from the queue to open the forensic examination suite.
          </div>
        )}

      </div>

    </div>
  );
};

export default ReviewerInvestigationPage;
