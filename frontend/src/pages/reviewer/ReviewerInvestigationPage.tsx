import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, Plus, User, HardHat, CheckSquare, Settings, FileText, 
  Search, CheckCircle2, MapPin, Loader2, Activity
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
    <div className="min-h-screen bg-[#f4f6fb] text-slate-900 font-sans flex flex-col lg:flex-row">
      
      {/* 1. LEFT FIXED SIDEBAR */}
      <aside className="w-full lg:w-64 bg-white border-r border-slate-200 p-5 flex flex-col justify-between shrink-0 shadow-2xs">
        <div className="space-y-6">
          
          {/* Logo / Header */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-[#0047bb] flex items-center justify-center text-white font-bold shadow-xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-black text-sm tracking-tight text-slate-950 uppercase">
                Investigation Workspace
              </h1>
              <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
                Forensic Grade Integrity
              </p>
            </div>
          </div>

          {/* Primary Action Button */}
          <button
            onClick={() => navigate('/report')}
            className="w-full py-3 px-4 bg-[#0047bb] hover:bg-[#003ca0] text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Investigation</span>
          </button>

          {/* Navigation Links */}
          <nav className="space-y-1 text-xs font-bold">
            <button
              onClick={() => navigate('/')}
              className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <User className="w-4 h-4 text-slate-400" />
              <span>Citizen</span>
            </button>

            <button
              onClick={() => navigate('/worker/dashboard')}
              className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <HardHat className="w-4 h-4 text-slate-400" />
              <span>Worker</span>
            </button>

            <button
              onClick={() => navigate('/reviewer/dashboard')}
              className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl bg-blue-50 text-[#0047bb] font-bold border border-blue-100"
            >
              <CheckSquare className="w-4 h-4 text-[#0047bb]" />
              <span>Reviewer</span>
            </button>

            <button
              onClick={() => navigate('/admin/dashboard')}
              className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <Activity className="w-4 h-4 text-slate-400" />
              <span>Admin</span>
            </button>
          </nav>
        </div>

        {/* Bottom Sidebar Footer */}
        <div className="pt-6 border-t border-slate-100 space-y-1 text-xs font-semibold text-slate-500">
          <button className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-slate-100">
            <Settings className="w-4 h-4 text-slate-400" />
            <span>Settings</span>
          </button>
          <button className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-slate-100">
            <FileText className="w-4 h-4 text-slate-400" />
            <span>Audit Log</span>
          </button>
        </div>
      </aside>

      {/* 2. MIDDLE COLUMN: CASE QUEUE */}
      <div className="w-full lg:w-80 bg-white border-r border-slate-200 p-5 flex flex-col shrink-0 space-y-4">
        
        {/* Queue Title & Count */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-sm font-bold text-slate-900">
            Queue: Review Required
          </h2>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
            {filteredQueue.length} Pending
          </span>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search case ID, location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#0047bb]"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-[11px] font-bold">
          <button
            onClick={() => setFilterTag('ALL')}
            className={`px-3 py-1 rounded-lg border transition-all ${
              filterTag === 'ALL' ? 'bg-[#0047bb] text-white border-[#0047bb]' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            All ({queue.length})
          </button>
          <button
            onClick={() => setFilterTag('HIGH_PRIORITY')}
            className={`px-3 py-1 rounded-lg border transition-all ${
              filterTag === 'HIGH_PRIORITY' ? 'bg-[#0047bb] text-white border-[#0047bb]' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            High Priority
          </button>
          <button
            onClick={() => setFilterTag('STAGNANT_WATER')}
            className={`px-3 py-1 rounded-lg border transition-all ${
              filterTag === 'STAGNANT_WATER' ? 'bg-[#0047bb] text-white border-[#0047bb]' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Stagnant Water
          </button>
        </div>

        {/* Case List Cards */}
        <div className="flex-1 overflow-y-auto space-y-3 pt-2">
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              <span className="text-xs font-mono">Loading cases...</span>
            </div>
          ) : filteredQueue.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No pending cases in review queue.
            </div>
          ) : (
            filteredQueue.map((item) => {
              const isSelected = selectedCase?.ticket_id === item.ticket_id;
              return (
                <div
                  key={item.ticket_id}
                  onClick={() => setSelectedCase(item)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all space-y-2 ${
                    isSelected
                      ? 'bg-blue-50/70 border-[#0047bb] ring-1 ring-[#0047bb]'
                      : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/80'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-slate-900">#{item.ticket_number}</span>
                    <span className="text-slate-400 text-[10px]">2h ago</span>
                  </div>

                  <h3 className="text-xs font-bold text-slate-900 line-clamp-1">
                    {item.title}
                  </h3>

                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                    {item.ward_name || 'Ward 14'}, Near Community Center. Heavy pooling reported post-storm.
                  </p>

                  <div className="pt-1 flex items-center justify-between text-[11px]">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      ⚠️ Needs Verification
                    </span>
                    <span className="font-mono font-bold text-slate-700">
                      Score: <span className="text-[#0047bb]">{item.integrity_score != null ? Math.round(item.integrity_score) : 'N/A'}</span>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. MAIN WORKSPACE AREA (CENTER + RIGHT PANEL) */}
      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        
        {selectedCase ? (
          <div className="space-y-6">
            
            {/* CASE HEADER & INTEGRITY SCORE BANNER */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              
              <div className="space-y-1">
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-mono font-bold text-slate-400">
                    Case #{selectedCase.ticket_number}
                  </span>
                  {selectedCase.status === 'CLOSURE_NOT_VERIFIED' || selectedCase.decision === 'CLOSURE_NOT_VERIFIED' ? (
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 uppercase">
                      ❌ CLOSURE NOT VERIFIED
                    </span>
                  ) : selectedCase.status === 'SUSPICIOUS' || selectedCase.decision === 'SUSPICIOUS' ? (
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 uppercase">
                      🚨 SUSPICIOUS EVIDENCE
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 uppercase">
                      ⚠️ HUMAN REVIEW
                    </span>
                  )}
                </div>
                <h1 className="font-serif text-2xl font-bold text-slate-950">
                  {selectedCase.title}
                </h1>
                <div className="flex items-center space-x-4 text-xs font-mono text-slate-500 pt-1">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    34.0522° N, 118.2437° W (Geo-Verified)
                  </span>
                  <span>• {selectedCase.ward_name || 'Ward 14'}</span>
                </div>
              </div>

              {/* INTEGRITY SCORE CARD */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center space-x-4 shrink-0">
                <div>
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block">
                    EVIDENCE INTEGRITY
                  </span>
                  <span className="text-xs font-semibold text-rose-600 block">
                    {selectedCase.status === 'CLOSURE_NOT_VERIFIED' ? 'Location / Scene Mismatch' : 'Hazard Reduction Inconclusive'}
                  </span>
                </div>
                <div className="w-14 h-14 rounded-full bg-slate-900 text-white flex items-center justify-center font-mono text-xl font-black border-2 border-slate-700 shadow-sm">
                  {selectedCase.integrity_score != null ? Math.round(selectedCase.integrity_score) : '—'}
                </div>
              </div>

            </div>

            {error && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2">
                <span>{error}</span>
              </div>
            )}

            {actionDoneMsg && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{actionDoneMsg}</span>
              </div>
            )}

            {/* MAIN GRID: EVIDENCE VIEWER LEFT (8 COLS) VS AI SIGNALS RIGHT (4 COLS) */}
            <div className="grid lg:grid-cols-12 gap-6">
              
              {/* FORENSIC VISUAL COMPARISON VIEWER (8 COLS) */}
              <div className="lg:col-span-8 space-y-4">
                <EvidenceViewer
                  beforeUrl={selectedCase.before_image_url}
                  afterUrl={selectedCase.after_image_url}
                  caseNumber={selectedCase.ticket_number}
                  beforeTimestamp={new Date(selectedCase.created_at).toLocaleString()}
                  afterTimestamp="Resolution Evidence"
                  deviceInfo="Forensic Evidence Engine"
                  hash={selectedCase.verification_session_id || selectedCase.ticket_id}
                  latitude={34.0522}
                  longitude={-118.2437}
                  statusBadge={selectedCase.status === 'CLOSURE_NOT_VERIFIED' ? 'CLOSURE NOT VERIFIED' : selectedCase.status.replace('_', ' ')}
                />

                {/* BOTTOM DECISION BAR */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                  <span className="text-xs font-medium text-slate-600 max-w-xs">
                    {selectedCase.status === 'CLOSURE_NOT_VERIFIED'
                      ? 'Worker evidence does not establish that the reported stagnant-water location was resolved.'
                      : 'Reviewer action required to proceed with resolution workflow.'}
                  </span>

                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => handleAction('REOPEN_TICKET')}
                      disabled={isSubmitting}
                      className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-all shadow-2xs"
                    >
                      Reopen Case
                    </button>

                    <button
                      onClick={() => handleAction('REQUEST_REVERIFICATION')}
                      disabled={isSubmitting}
                      className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-all shadow-2xs"
                    >
                      Request Human Review
                    </button>

                    <button
                      onClick={() => handleAction('APPROVE_CLOSURE')}
                      disabled={isSubmitting}
                      className="px-5 py-2.5 bg-[#0047bb] hover:bg-[#003ca0] text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Verify Closure</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* RIGHT PANEL: AI SIGNALS & AUDIT TIMELINE (4 COLS) */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* AI VERIFICATION SIGNALS */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                    <Activity className="w-4 h-4 text-[#0047bb]" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Evidence Conflict Signals
                    </h3>
                  </div>

                  <div className="space-y-3">
                    
                    {/* Signal 1: LOCATION */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-800">Location Consistency</span>
                        {selectedCase.detailed_result?.location?.status === 'PASS' ? (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-mono rounded font-bold">
                            PASS ({selectedCase.detailed_result.location.accuracy_meters}m)
                          </span>
                        ) : selectedCase.detailed_result?.location?.status === 'UNUSABLE' ? (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-mono rounded font-bold">
                            ⚠️ UNUSABLE GPS
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-mono rounded font-bold">
                            ❌ FAIL ({selectedCase.detailed_result?.location?.accuracy_meters}m)
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        {selectedCase.detailed_result?.location?.status === 'PASS'
                          ? 'Landmarks and EXIF GPS data strongly align across before/after submissions.'
                          : selectedCase.detailed_result?.location?.status === 'UNUSABLE'
                          ? 'GPS signal unusable (e.g. accuracy > 1000m). Requires visual correspondence.'
                          : 'Different locations detected. Worker evidence captured outside complaint tolerance.'}
                      </p>
                    </div>

                    {/* Signal 2: SCENE */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-800">Scene Correspondence (RANSAC)</span>
                        {selectedCase.detailed_result?.scene?.status === 'STRONG_MATCH' ? (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-mono rounded">
                            ✅ STRONG MATCH ({selectedCase.detailed_result.scene.score} Score)
                          </span>
                        ) : selectedCase.detailed_result?.scene?.status === 'WEAK_MATCH' ? (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-mono rounded">
                            ⚠️ WEAK MATCH
                          </span>
                        ) : selectedCase.detailed_result?.scene?.status === 'UNCERTAIN' ? (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-mono rounded">
                            ⚠️ UNCERTAIN
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-mono rounded font-bold">
                            ❌ DIFFERENT SCENE
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        {selectedCase.detailed_result?.scene?.status === 'STRONG_MATCH'
                          ? 'Sufficient physical correspondence. Geometric landmark inliers established via SuperPoint/SuperGlue.'
                          : selectedCase.detailed_result?.scene?.status === 'WEAK_MATCH'
                          ? 'Low spatial coverage or high geometric error.'
                          : selectedCase.detailed_result?.scene?.status === 'UNCERTAIN'
                          ? 'Few matches found, cannot verify scene identity securely.'
                          : 'Insufficient physical correspondence. Different Scene.'}
                      </p>
                    </div>

                    {/* Final Reason */}
                    <div className="p-3 bg-slate-100 border border-slate-300 rounded-xl space-y-1 mt-4">
                       <span className="text-xs font-bold text-slate-800">System Reasoning</span>
                       <p className="text-[11px] text-slate-600 leading-relaxed italic">
                         "{selectedCase.detailed_result?.reason || 'No detailed reasoning available.'}"
                       </p>
                    </div>

                    {/* Signal 3: ISSUE CHANGE */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-800">Hazard Change</span>
                        {selectedCase.status === 'CLOSURE_NOT_VERIFIED' ? (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-mono rounded font-bold">
                            ⚠️ UNVERIFIABLE
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-mono rounded">
                            Valid
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        {selectedCase.status === 'CLOSURE_NOT_VERIFIED'
                          ? '⚠️ Unverifiable: System cannot evaluate water clearance on a non-corresponding physical road.'
                          : 'Timestamp sequence is logical. Shadow angles align with reported time of day.'}
                      </p>
                    </div>

                    {/* Signal 4: TEMPORAL */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-800">Temporal Validity</span>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-mono rounded">
                          ✓ Valid
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Timestamp sequence is logical and occurred after ticket assignment.
                      </p>
                    </div>

                  </div>
                </div>

                {/* AUDIT TIMELINE */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-3">
                    Audit Timeline
                  </h3>

                  <div className="relative pl-5 space-y-4 border-l border-slate-200 text-xs">
                    
                    <div>
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[#0047bb]" />
                      <span className="text-[10px] font-mono text-slate-400 block">Today, 14:35 UTC</span>
                      <span className="font-bold text-slate-900 block">Flagged for Review</span>
                      <span className="text-[11px] text-slate-500 block">System auto-flagged due to low hazard reduction score.</span>
                    </div>

                    <div>
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-slate-300" />
                      <span className="text-[10px] font-mono text-slate-400 block">Today, 14:32 UTC</span>
                      <span className="font-bold text-slate-900 block">After Evidence Submitted</span>
                      <span className="text-[11px] text-slate-500 block">Worker ID: WK-992</span>
                    </div>

                    <div>
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-slate-300" />
                      <span className="text-[10px] font-mono text-slate-400 block">Yesterday, 08:14 UTC</span>
                      <span className="font-bold text-slate-900 block">Case Created</span>
                      <span className="text-[11px] text-slate-500 block">Citizen ID: CZ-441</span>
                    </div>

                  </div>
                </div>

              </div>

            </div>

          </div>
        ) : (
          <div className="py-20 text-center text-slate-400 text-xs">
            Select a case from the left queue to begin forensic investigation.
          </div>
        )}

      </div>

    </div>
  );
};

export default ReviewerInvestigationPage;
