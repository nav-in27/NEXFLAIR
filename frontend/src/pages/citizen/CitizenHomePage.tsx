import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight, AlertOctagon, EyeOff, FileText } from 'lucide-react';
import EvidenceViewer from '../../components/EvidenceViewer';

export const CitizenHomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f9fafb] text-slate-900 flex flex-col font-sans">
      
      {/* HERO SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-20 grid lg:grid-cols-12 gap-12 items-center">
        
        {/* Left Column: Hero Copy & Actions */}
        <div className="lg:col-span-6 space-y-6">
          
          {/* Eyebrow Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold tracking-wide uppercase">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>CIVIC INTEGRITY SYSTEM</span>
          </div>

          {/* Large Headline */}
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-950 uppercase leading-none">
            PROOF BEFORE CLOSURE.
          </h1>

          {/* Supporting Text */}
          <p className="text-base text-slate-600 leading-relaxed font-normal max-w-xl">
            MeiKaan verifies the evidence behind civic resolutions. We replace assumptions with forensic clarity, ensuring every reported issue is demonstrably solved before the case is closed.
          </p>

          {/* Action Buttons */}
          <div className="flex items-center space-x-4 pt-2">
            <button
              onClick={() => navigate('/report')}
              className="px-6 py-3.5 bg-[#0047bb] hover:bg-[#003ca0] text-white text-xs font-bold rounded-lg transition-all shadow-md flex items-center gap-2"
            >
              <span>Start Verification</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => navigate('/track')}
              className="px-6 py-3.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold rounded-lg transition-all shadow-2xs"
            >
              View Demo
            </button>
          </div>
        </div>

        {/* Right Column: Large Before / After Evidence Image Card */}
        <div className="lg:col-span-6">
          <EvidenceViewer
            caseNumber="MK-2024-892A"
            beforeTimestamp="Oct 12, 09:14 AM"
            afterTimestamp="Oct 14, 04:45 PM"
            deviceInfo="Inspector-Cam V2"
            hash="a7b89f21c...c43"
            latitude={40.7128}
            longitude={-74.0060}
            statusBadge="VERIFIED CLOSURE"
          />
        </div>
      </section>

      {/* LANDING PAGE SECTION: MARKED RESOLVED DOESN'T ALWAYS MEAN RESOLVED */}
      <section className="bg-white border-t border-slate-200 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Marked resolved doesn't always mean resolved.
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed font-medium">
              The gap between a closed ticket and a fixed problem erodes civic trust. MEIKAAN bridges this gap with irrefutable visual proof.
            </p>
          </div>

          {/* 3 Conceptual Cards */}
          <div className="grid md:grid-cols-3 gap-6">
            
            {/* Card 1: Premature Closure */}
            <div className="bg-[#fcfdfe] border border-slate-200/90 rounded-2xl p-8 space-y-4 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                <AlertOctagon className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Premature Closure
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                30% of civic issues are marked resolved before actual physical work is completed, relying on assumption rather than evidence.
              </p>
            </div>

            {/* Card 2: Blind Verification */}
            <div className="bg-[#fcfdfe] border border-slate-200/90 rounded-2xl p-8 space-y-4 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <EyeOff className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Blind Verification
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Without visual pairing, oversight relies entirely on manual auditing, leading to resource drain and delayed corrections.
              </p>
            </div>

            {/* Card 3: The Forensic Deficit */}
            <div className="bg-[#fcfdfe] border border-slate-200/90 rounded-2xl p-8 space-y-4 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                The Forensic Deficit
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Lack of immutable metadata (location, time, device) makes existing "after" photos vulnerable to reuse and manipulation.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-auto bg-white border-t border-slate-200 py-8 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 rounded bg-[#0047bb] flex items-center justify-center text-white text-[10px] font-bold">
              M
            </div>
            <span className="font-bold text-slate-700">MEIKAAN Civic Integrity System</span>
          </div>
          <p>© 2026 MEIKAAN. Proof Before Closure.</p>
        </div>
      </footer>

    </div>
  );
};

export default CitizenHomePage;
