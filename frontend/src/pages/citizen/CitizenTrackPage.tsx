import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, CheckCircle2, AlertTriangle, Loader2, ThumbsUp, ThumbsDown } from 'lucide-react';
import { trackCitizenTicket, confirmCitizenResolution, disputeCitizenResolution } from '../../services/ticketApi';
import { CitizenTrackResult } from '../../types/ticket';
import EvidenceViewer from '../../components/EvidenceViewer';

export const CitizenTrackPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const ticketQuery = searchParams.get('ticket') || 'MK-10482';
  const [searchInput, setSearchInput] = useState<string>(ticketQuery);
  const [ticketData, setTicketData] = useState<CitizenTrackResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  
  // Dispute state
  const [showDisputeForm, setShowDisputeForm] = useState<boolean>(false);
  const [disputeReason, setDisputeReason] = useState<string>('');
  const [disputeSubmitting, setDisputeSubmitting] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string>('');

  const isResolved = !!ticketData && ['VERIFIED', 'CITIZEN_CONFIRMED', 'CLOSED'].includes(ticketData.status);
  const isAssignmentVisible = !!ticketData && ticketData.status !== 'OPEN';
  const isInspectionComplete = !!ticketData && ['VERIFIED', 'HUMAN_REVIEW', 'SUSPICIOUS', 'CLOSED', 'CITIZEN_CONFIRMED', 'CITIZEN_DISPUTE', 'CLOSURE_NOT_VERIFIED'].includes(ticketData.status);
  const inspectionLabel = !ticketData
    ? 'Inspection Pending'
    : ticketData.status === 'IN_PROGRESS' || ticketData.status === 'PENDING_VERIFICATION'
      ? 'Inspection In Progress'
      : isInspectionComplete
        ? 'Inspection Completed'
        : 'Inspection Pending';

  const fetchTicket = async (ticketNum: string) => {
    setLoading(true);
    setError('');
    setFeedbackMsg('');
    try {
      const res = await trackCitizenTicket(ticketNum);
      setTicketData(res);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ticket not found. Please check your ticket number.');
      setTicketData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ticketQuery) {
      fetchTicket(ticketQuery);
    } else {
      setLoading(false);
    }
  }, [ticketQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setSearchParams({ ticket: searchInput.trim() });
    }
  };

  const handleConfirmResolution = async () => {
    if (!ticketData) return;
    try {
      await confirmCitizenResolution(ticketData.ticket_number);
      setFeedbackMsg('Thank you! Resolution confirmed successfully.');
      fetchTicket(ticketData.ticket_number);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not submit confirmation.');
    }
  };

  const handleSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketData || !disputeReason.trim()) return;
    setDisputeSubmitting(true);
    try {
      await disputeCitizenResolution(ticketData.ticket_number, disputeReason);
      setFeedbackMsg('Complaint reopened. Case transferred back to review team.');
      setShowDisputeForm(false);
      fetchTicket(ticketData.ticket_number);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to file dispute.');
    } finally {
      setDisputeSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans pb-20">
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        
        {/* TOP SEARCH BAR */}
        <div className="civic-card p-4 max-w-xl mx-auto">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                placeholder="Enter Complaint Number (e.g. MK-10482)"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="civic-input pl-10"
              />
            </div>
            <button
              type="submit"
              className="btn-primary shrink-0"
            >
              <span>Track</span>
            </button>
          </form>
        </div>

        {loading ? (
          <div className="py-20 text-center space-y-3">
            <Loader2 className="w-6 h-6 text-slate-700 animate-spin mx-auto" />
            <p className="text-xs text-slate-500 font-mono">Retrieving verification audit trail...</p>
          </div>
        ) : error ? (
          <div className="max-w-md mx-auto civic-card p-6 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
            <h3 className="text-base font-bold text-slate-900">Complaint Not Found</h3>
            <p className="text-xs text-slate-500">{error}</p>
          </div>
        ) : ticketData ? (
          <div className="space-y-6">
            
            {/* TICKET HEADER BAR */}
            <div className="civic-card p-6 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-mono text-xs text-slate-500">
                  <span className="font-bold text-slate-900">TICKET #{ticketData.ticket_number}</span>
                  <span>•</span>
                  <span>{ticketData.ward_name || 'Ward 14'}</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {ticketData.title}
                </h1>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-md text-xs font-mono font-semibold flex items-center gap-1.5 ${
                  ['VERIFIED', 'CITIZEN_CONFIRMED', 'CLOSED'].includes(ticketData.status)
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : ticketData.status === 'CITIZEN_DISPUTE'
                    ? 'bg-rose-50 text-rose-800 border border-rose-200'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>STATUS: {ticketData.status.replace('_', ' ')}</span>
                </span>
              </div>
            </div>

            {feedbackMsg && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-800 text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{feedbackMsg}</span>
              </div>
            )}

            {/* MAIN CONTENT GRID */}
            <div className="grid lg:grid-cols-12 gap-6 items-start">
              
              {/* LEFT: RESOLUTION TIMELINE (4 COLS) */}
              <div className="lg:col-span-4 civic-card p-6 space-y-6">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Resolution Timeline
                  </h2>
                  <span className="text-[11px] text-slate-400 font-mono">Chain of custody logs</span>
                </div>

                <div className="relative pl-5 space-y-6 border-l border-slate-200 text-xs">
                  
                  {/* Step 1: Reported */}
                  <div className="relative">
                    <div className="absolute -left-[27px] top-0.5 w-3.5 h-3.5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[8px] font-bold">
                      ✓
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 block">
                        {new Date(ticketData.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}, 09:14 AM
                      </span>
                      <span className="font-semibold text-slate-900 block mt-0.5">
                        Reported by Citizen
                      </span>
                    </div>
                  </div>

                  {/* Step 2: Assigned */}
                  <div className="relative">
                    <div className={`absolute -left-[27px] top-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold ${
                      isAssignmentVisible ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {isAssignmentVisible ? '✓' : '2'}
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 block">
                        {isAssignmentVisible ? new Date(ticketData.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Pending assignment'}
                      </span>
                      <span className="font-semibold text-slate-900 block mt-0.5">
                        {isAssignmentVisible ? 'Assigned to Ward Officer' : 'Awaiting Ward Assignment'}
                      </span>
                    </div>
                  </div>

                  {/* Step 3: Inspection Completed */}
                  <div className="relative">
                    <div className={`absolute -left-[27px] top-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold ${
                      isInspectionComplete ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {isInspectionComplete ? '✓' : '3'}
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 block">
                        {inspectionLabel}
                      </span>
                      <span className="font-semibold text-slate-900 block mt-0.5">
                        {inspectionLabel}
                      </span>
                    </div>
                  </div>

                  {/* Step 4: Marked as Resolved */}
                  <div className="relative">
                    <div className={`absolute -left-[27px] top-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold ${
                      isResolved ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {isResolved ? '✓' : '4'}
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 block">
                        {ticketData.resolution_date ? new Date(ticketData.resolution_date).toLocaleString() : 'Pending resolution'}
                      </span>
                      <span className={`font-semibold block mt-0.5 ${isResolved ? 'text-slate-900' : 'text-slate-400'}`}>
                        {isResolved ? 'Marked as Resolved' : 'Awaiting Resolution'}
                      </span>
                    </div>
                  </div>

                </div>
              </div>

              {/* RIGHT: VISUAL EVIDENCE VIEWER (8 COLS) */}
              <div className="lg:col-span-8 space-y-6">
                <EvidenceViewer
                  beforeUrl={ticketData.before_image_url}
                  afterUrl={ticketData.resolution_image_url}
                  caseNumber={ticketData.ticket_number}
                  beforeTimestamp={new Date(ticketData.created_at).toLocaleString()}
                  afterTimestamp={ticketData.resolution_date ? new Date(ticketData.resolution_date).toLocaleString() : 'Pending resolution'}
                  deviceInfo="Inspector-Cam V2 • GPS Verified"
                  hash="a8f9...3b2c"
                  statusBadge={ticketData.status}
                />

                {/* CITIZEN CONFIRMATION & DISPUTE SECTION */}
                <div className="civic-card p-6 space-y-4">
                  {showDisputeForm ? (
                    <form onSubmit={handleSubmitDispute} className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                          Reopen & File Citizen Dispute
                        </h4>
                        <button
                          type="button"
                          onClick={() => setShowDisputeForm(false)}
                          className="text-xs text-slate-500 hover:text-slate-800"
                        >
                          Cancel
                        </button>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Describe what is still defective:
                        </label>
                        <textarea
                          rows={3}
                          required
                          placeholder="Explain why this resolution is incomplete or inaccurate..."
                          value={disputeReason}
                          onChange={(e) => setDisputeReason(e.target.value)}
                          className="civic-input resize-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={disputeSubmitting}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-md transition-colors"
                      >
                        {disputeSubmitting ? 'Submitting Dispute...' : 'Submit Dispute & Reopen Case'}
                      </button>
                    </form>
                  ) : (
                    <div className="space-y-3">
                      <div className="border-b border-slate-100 pb-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                          Citizen Verification Feedback
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Confirm whether the physical repair matches the reported issue at {ticketData.ward_name || 'Ward 14'}.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <button
                          onClick={handleConfirmResolution}
                          className="btn-primary"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          <span>Confirm Resolution</span>
                        </button>

                        <button
                          onClick={() => setShowDisputeForm(true)}
                          className="btn-secondary"
                        >
                          <ThumbsDown className="w-3.5 h-3.5 text-rose-600" />
                          <span>Dispute & Reopen</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

              </div>

            </div>

          </div>
        ) : null}

      </main>

    </div>
  );
};

export default CitizenTrackPage;
