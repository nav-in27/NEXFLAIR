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
    <div className="min-h-screen bg-[#f9fafb] text-slate-900 font-sans pb-20">
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        
        {/* SEARCH BAR TOP */}
        <form onSubmit={handleSearchSubmit} className="max-w-xl mx-auto flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
            <input
              type="text"
              placeholder="Search Complaint # (e.g. MK-10482)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#0047bb] shadow-2xs"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-3 bg-[#0047bb] hover:bg-[#003ca0] text-white text-xs font-bold rounded-xl transition-all shadow-xs"
          >
            Track
          </button>
        </form>

        {loading ? (
          <div className="py-20 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-[#0047bb] animate-spin mx-auto" />
            <p className="text-xs text-slate-500 font-mono">Retrieving verification audit trail...</p>
          </div>
        ) : error ? (
          <div className="max-w-md mx-auto p-6 bg-white border border-slate-200 rounded-2xl text-center space-y-3 shadow-sm">
            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
            <h3 className="text-base font-bold text-slate-900">Complaint Not Found</h3>
            <p className="text-xs text-slate-500">{error}</p>
          </div>
        ) : ticketData ? (
          <div className="space-y-8">
            
            {/* PAGE HEADER */}
            <div className="space-y-2 border-b border-slate-200 pb-6">
              <span className="text-xs font-bold font-mono text-slate-400 uppercase tracking-widest">
                COMPLAINT #{ticketData.ticket_number}
              </span>
              <h1 className="font-serif text-3xl sm:text-4xl font-bold text-slate-950">
                {ticketData.title}, {ticketData.ward_name || 'Ward 14'}
              </h1>
              <div className="pt-2 flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                  ['VERIFIED', 'CITIZEN_CONFIRMED', 'CLOSED'].includes(ticketData.status)
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : ticketData.status === 'CITIZEN_DISPUTE'
                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Status: {ticketData.status.replace('_', ' ')}</span>
                </span>
              </div>
            </div>

            {feedbackMsg && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{feedbackMsg}</span>
              </div>
            )}

            {/* MAIN CONTENT: RESOLUTION JOURNEY LEFT (4 COLS) VS VISUAL EVIDENCE RIGHT (8 COLS) */}
            <div className="grid lg:grid-cols-12 gap-8 items-start">
              
              {/* LEFT: RESOLUTION JOURNEY TIMELINE */}
              <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
                  Resolution Journey
                </h3>

                <div className="relative pl-6 space-y-6 border-l-2 border-slate-200">
                  
                  {/* Step 1: Reported */}
                  <div className="relative">
                    <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-[#0047bb] border-2 border-white ring-2 ring-blue-100 flex items-center justify-center text-[9px] text-white font-bold">
                      ✓
                    </div>
                    <div>
                      <span className="text-[11px] font-mono text-slate-400 block">
                        {new Date(ticketData.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}, 09:14 AM
                      </span>
                      <span className="text-xs font-bold text-slate-900 block mt-0.5">
                        Reported by Citizen
                      </span>
                    </div>
                  </div>

                  {/* Step 2: Assigned */}
                  <div className="relative">
                    <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-[#0047bb] border-2 border-white ring-2 ring-blue-100 flex items-center justify-center text-[9px] text-white font-bold">
                      ✓
                    </div>
                  <div>
                    <span className="text-[11px] font-mono text-slate-400 block">
                      {isAssignmentVisible ? new Date(ticketData.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Pending assignment'}
                    </span>
                    <span className="text-xs font-bold text-slate-900 block mt-0.5">
                      {isAssignmentVisible ? 'Assigned to Field Team' : 'Awaiting Ward Assignment'}
                    </span>
                  </div>
                </div>

                  {/* Step 3: Inspection Completed */}
                  <div className="relative">
                    <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-[#0047bb] border-2 border-white ring-2 ring-blue-100 flex items-center justify-center text-[9px] text-white font-bold">
                      ✓
                    </div>
                  <div>
                    <span className="text-[11px] font-mono text-slate-400 block">
                      {inspectionLabel}
                    </span>
                    <span className="text-xs font-bold text-slate-900 block mt-0.5">
                      {inspectionLabel}
                    </span>
                  </div>
                </div>

                  {/* Step 4: Marked as Resolved */}
                  <div className="relative">
                    <div className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                      ['VERIFIED', 'CITIZEN_CONFIRMED', 'CLOSED'].includes(ticketData.status)
                        ? 'bg-emerald-600 text-white ring-2 ring-emerald-100'
                        : 'bg-slate-300 text-slate-600'
                    }`}>
                      {['VERIFIED', 'CITIZEN_CONFIRMED', 'CLOSED'].includes(ticketData.status) ? '✓' : '4'}
                    </div>
                    <div>
                      <span className="text-[11px] font-mono text-slate-400 block">
                        {ticketData.resolution_date ? new Date(ticketData.resolution_date).toLocaleString() : 'Pending resolution'}
                      </span>
                      <span className={`text-xs font-bold block mt-0.5 ${
                        isResolved
                          ? 'text-slate-900'
                          : 'text-slate-400'
                      }`}>
                        {isResolved ? 'Marked as Resolved' : 'Awaiting Resolution'}
                      </span>
                    </div>
                  </div>

                </div>
              </div>

              {/* RIGHT: VISUAL EVIDENCE VIEWER */}
              <div className="lg:col-span-8 space-y-6">
                <EvidenceViewer
                  beforeUrl={ticketData.before_image_url}
                  afterUrl={ticketData.resolution_image_url}
                  caseNumber={ticketData.ticket_number}
                  beforeTimestamp={new Date(ticketData.created_at).toLocaleString()}
                  afterTimestamp={ticketData.resolution_date ? new Date(ticketData.resolution_date).toLocaleString() : 'Pending resolution'}
                  deviceInfo="Inspector-Cam V2"
                  hash="a8f9...3b2c"
                  statusBadge={ticketData.status}
                />

                {/* BOTTOM RESOLUTION CONFIRMATION / DISPUTE BAR */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                  
                  {showDisputeForm ? (
                    <form onSubmit={handleSubmitDispute} className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <h4 className="text-sm font-bold text-slate-900">Reopen & File Dispute</h4>
                        <button
                          type="button"
                          onClick={() => setShowDisputeForm(false)}
                          className="text-xs text-slate-400 hover:text-slate-700 font-semibold"
                        >
                          Cancel
                        </button>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          What is still wrong?
                        </label>
                        <textarea
                          rows={3}
                          required
                          placeholder="Describe why this issue is not fully addressed..."
                          value={disputeReason}
                          onChange={(e) => setDisputeReason(e.target.value)}
                          className="w-full p-3 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#0047bb]"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={disputeSubmitting}
                        className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
                      >
                        {disputeSubmitting ? 'Filing Dispute...' : 'Submit Dispute & Reopen'}
                      </button>
                    </form>
                  ) : (
                    <div className="text-center space-y-3">
                      <h3 className="font-serif text-xl font-bold text-slate-950">
                        Is the issue actually resolved?
                      </h3>
                      <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
                        Please confirm if the stagnant water issue at {ticketData.ward_name || 'Ward 14'} has been fully addressed based on your observation.
                      </p>

                      <div className="flex items-center justify-center gap-4 pt-2">
                        <button
                          onClick={handleConfirmResolution}
                          className="px-6 py-3 bg-[#0047bb] hover:bg-[#003ca0] text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2"
                        >
                          <ThumbsUp className="w-4 h-4" />
                          <span>Yes, it's resolved</span>
                        </button>

                        <button
                          onClick={() => setShowDisputeForm(true)}
                          className="px-6 py-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-all shadow-2xs flex items-center gap-2"
                        >
                          <ThumbsDown className="w-4 h-4 text-rose-600" />
                          <span>No, it's still there</span>
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
