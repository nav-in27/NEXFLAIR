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
        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
          <Clock className="w-3.5 h-3.5" />
          <span>OPEN</span>
        </span>
      );
    case 'ASSIGNED':
      return (
        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/30">
          <UserCheck className="w-3.5 h-3.5" />
          <span>ASSIGNED</span>
        </span>
      );
    case 'IN_PROGRESS':
      return (
        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
          <Play className="w-3.5 h-3.5 animate-pulse" />
          <span>IN PROGRESS</span>
        </span>
      );
    case 'PENDING_VERIFICATION':
      return (
        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>PENDING VERIFICATION</span>
        </span>
      );
    case 'VERIFIED':
      return (
        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>VERIFIED</span>
        </span>
      );
    case 'HUMAN_REVIEW':
      return (
        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
          <Eye className="w-3.5 h-3.5" />
          <span>HUMAN REVIEW</span>
        </span>
      );
    case 'SUSPICIOUS':
      return (
        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
          <AlertOctagon className="w-3.5 h-3.5" />
          <span>SUSPICIOUS</span>
        </span>
      );
    case 'CLOSED':
      return (
        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/30">
          <CheckSquare className="w-3.5 h-3.5" />
          <span>CLOSED</span>
        </span>
      );
    default:
      return <span className="text-xs font-mono text-slate-400">{status}</span>;
  }
};
