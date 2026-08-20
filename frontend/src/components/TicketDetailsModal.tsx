import React, { useState } from 'react';
import { Ticket, TicketStatus } from '../types/ticket';
import { VerificationSession } from '../types/verification';
import { TicketStatusBadge } from './TicketStatusBadge';
import { EvidenceGallery } from './EvidenceGallery';
import { EvidenceUploadModal } from './EvidenceUploadModal';
import { ActiveVerificationModal } from './ActiveVerificationModal';
import { X, MapPin, Calendar, HardHat, ShieldCheck, RefreshCw, AlertCircle, Upload, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { updateTicketStatus } from '../services/ticketApi';
import { startVerificationApi } from '../services/verificationApi';

interface Props {
  ticket: Ticket;
  onClose: () => void;
  onRefresh: () => void;
}

export const TicketDetailsModal: React.FC<Props> = ({ ticket, onClose, onRefresh }) => {
  const { token, user } = useAuth();
  const [selectedStatus, setSelectedStatus] = useState<TicketStatus>(ticket.status);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isStartingVerification, setIsStartingVerification] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [activeSession, setActiveSession] = useState<VerificationSession | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const statuses: TicketStatus[] = [
    'OPEN',
    'ASSIGNED',
    'IN_PROGRESS',
    'PENDING_VERIFICATION',
    'VERIFIED',
    'HUMAN_REVIEW',
    'SUSPICIOUS',
    'CLOSED'
  ];

  const handleUpdateStatus = async () => {
    if (!token) return;
    setIsUpdating(true);
    setErrorMsg(null);
    try {
      await updateTicketStatus(ticket.id, selectedStatus, token);
      onRefresh();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Failed to update status.');
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResolveTicketClick = async () => {
    if (!token) return;
    setIsStartingVerification(true);
    setErrorMsg(null);
    try {
      const session = await startVerificationApi(ticket.id, token);
      setActiveSession(session);
      onRefresh();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Could not initiate active verification session.');
      }
    } finally {
      setIsStartingVerification(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="glass-panel w-full max-w-3xl rounded-3xl border border-slate-800 p-6 sm:p-8 space-y-6 shadow-2xl relative my-8 max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-6 top-6 p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-2 pr-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30">
              {ticket.ticket_number}
            </span>
            <TicketStatusBadge status={ticket.status} />
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              {ticket.complaint_type}
            </span>
          </div>

          <h2 className="text-xl font-bold text-white tracking-tight">{ticket.title}</h2>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Resolve Ticket Action Banner */}
        {user?.role === 'FIELD_WORKER' && ticket.status !== 'CLOSED' && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/50 via-slate-900 to-sky-950/50 border border-emerald-500/30 flex items-center justify-between gap-4 shadow-lg">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-emerald-300 flex items-center space-x-1">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Ready to Resolve Grievance?</span>
              </span>
              <p className="text-[11px] text-slate-300">
                Clicking <strong>RESOLVE TICKET</strong> initiates an Active Verification Session challenge.
              </p>
            </div>

            <button
              onClick={handleResolveTicketClick}
              disabled={isStartingVerification}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-500/20 transition-all flex items-center space-x-1.5 whitespace-nowrap disabled:opacity-40"
            >
              {isStartingVerification ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle className="w-3.5 h-3.5" />
              )}
              <span>RESOLVE TICKET</span>
            </button>
          </div>
        )}

        {/* Specs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs">
          
          <div className="space-y-1">
            <span className="text-slate-400 font-semibold block text-[11px]">Location & Ward</span>
            <div className="text-slate-200 flex items-center space-x-1.5 font-medium">
              <MapPin className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
              <span>{ticket.ward ? `${ticket.ward.name} (Zone: ${ticket.ward.zone})` : 'N/A'}</span>
            </div>
            {ticket.latitude && ticket.longitude && (
              <span className="font-mono text-[10px] text-slate-400 block pt-0.5">
                GPS: {ticket.latitude}, {ticket.longitude}
              </span>
            )}
          </div>

          <div className="space-y-1">
            <span className="text-slate-400 font-semibold block text-[11px]">Assigned Field Officer</span>
            <div className="text-slate-200 flex items-center space-x-1.5 font-medium">
              <HardHat className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span>{ticket.assigned_worker ? `${ticket.assigned_worker.full_name} (${ticket.assigned_worker.worker_code})` : 'Unassigned'}</span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-slate-400 font-semibold block text-[11px]">Priority Level</span>
            <span className="font-mono font-bold text-amber-400">{ticket.priority}</span>
          </div>

          <div className="space-y-1">
            <span className="text-slate-400 font-semibold block text-[11px]">Logged At</span>
            <div className="text-slate-300 font-mono text-[11px] flex items-center space-x-1">
              <Calendar className="w-3 h-3 text-slate-500" />
              <span>{new Date(ticket.created_at).toLocaleString()}</span>
            </div>
          </div>

        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-bold text-slate-300">Grievance Description</h4>
          <p className="text-xs text-slate-400 bg-slate-900/40 p-3.5 rounded-xl border border-slate-800 leading-relaxed">
            {ticket.description || 'No detailed description provided.'}
          </p>
        </div>

        {/* Evidence Management Section */}
        <div className="pt-4 border-t border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white flex items-center space-x-1.5">
              <Upload className="w-4 h-4 text-sky-400" />
              <span>Ticket Evidence Files</span>
            </h4>

            <button
              onClick={() => setShowUploadModal(true)}
              className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition-all flex items-center space-x-1"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Evidence</span>
            </button>
          </div>

          <EvidenceGallery ticketId={ticket.id} onRefreshTrigger={refreshTrigger} />
        </div>

        {/* Status Update Controls */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <h4 className="text-xs font-bold text-white flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-sky-400" />
            <span>Update Workflow Status</span>
          </h4>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as TicketStatus)}
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
            >
              {statuses.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>

            <button
              onClick={handleUpdateStatus}
              disabled={isUpdating || selectedStatus === ticket.status}
              className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition-all disabled:opacity-40 flex items-center space-x-1.5"
            >
              {isUpdating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>Save Status</span>
            </button>
          </div>
        </div>

        {/* Evidence Upload Modal Overlay */}
        {showUploadModal && (
          <EvidenceUploadModal
            ticketId={ticket.id}
            onClose={() => setShowUploadModal(false)}
            onRefresh={() => {
              setRefreshTrigger((prev) => prev + 1);
              onRefresh();
            }}
          />
        )}

        {/* Active Verification Challenge Overlay */}
        {activeSession && (
          <ActiveVerificationModal
            ticket={ticket}
            session={activeSession}
            onClose={() => setActiveSession(null)}
            onRefresh={() => {
              setRefreshTrigger((prev) => prev + 1);
              onRefresh();
            }}
          />
        )}

      </div>
    </div>
  );
};
