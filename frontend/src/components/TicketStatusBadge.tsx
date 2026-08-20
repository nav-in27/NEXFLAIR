import React from 'react';
import { TicketStatus } from '../types/ticket';
import { Clock, UserCheck, Play, ShieldAlert, CheckCircle2, Eye, AlertOctagon, CheckSquare } from 'lucide-react';

interface Props {
  status: TicketStatus;
}

export const TicketStatusBadge: React.FC<Props> = ({ status }) => {
  switch (status) {
    case 'OPEN':
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200">
          <Clock className="w-3 h-3 text-slate-500" />
          <span>OPEN</span>
        </span>
      );
    case 'ASSIGNED':
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-slate-100 text-slate-800 border border-slate-200">
          <UserCheck className="w-3 h-3 text-slate-600" />
          <span>ASSIGNED</span>
        </span>
      );
    case 'IN_PROGRESS':
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          <Play className="w-3 h-3 text-amber-600" />
          <span>IN PROGRESS</span>
        </span>
      );
    case 'PENDING_VERIFICATION':
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-blue-50 text-blue-800 border border-blue-200">
          <ShieldAlert className="w-3 h-3 text-blue-600" />
          <span>PENDING VERIFICATION</span>
        </span>
      );
    case 'VERIFIED':
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>VERIFIED</span>
        </span>
      );
    case 'HUMAN_REVIEW':
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-purple-50 text-purple-800 border border-purple-200">
          <Eye className="w-3 h-3 text-purple-600" />
          <span>HUMAN REVIEW</span>
        </span>
      );
    case 'SUSPICIOUS':
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-rose-50 text-rose-800 border border-rose-200">
          <AlertOctagon className="w-3 h-3 text-rose-600" />
          <span>SUSPICIOUS</span>
        </span>
      );
    case 'CLOSED':
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-slate-100 text-slate-600 border border-slate-200">
          <CheckSquare className="w-3 h-3 text-slate-500" />
          <span>CLOSED</span>
        </span>
      );
    default:
      return <span className="text-xs font-mono text-slate-500">{status}</span>;
  }
};

export default TicketStatusBadge;
