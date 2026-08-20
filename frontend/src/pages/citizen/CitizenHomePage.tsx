import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowRight, CheckCircle, MapPin, Camera, Lock, Search } from 'lucide-react';
import EvidenceViewer from '../../components/EvidenceViewer';

export const CitizenHomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans">
      
      {/* HERO SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 grid lg:grid-cols-12 gap-12 items-center">
        
        {/* Left Column: Hero Content */}
        <div className="lg:col-span-6 space-y-6">
          
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold tracking-wide uppercase font-mono">
            <Shield className="w-3.5 h-3.5 text-blue-600" />
            <span>Civic Evidence Integrity Platform</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 leading-tight">
            Proof of resolution before complaint closure.
          </h1>

          <p className="text-base text-slate-600 leading-relaxed max-w-xl font-normal">
            MEIKAAN establishes an immutable cryptographic chain of custody for municipal public works. 
            Before any citizen complaint is marked resolved, resolution evidence is rigorously verified against the original scene.
          </p>

          {/* Direct CTA Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => navigate('/report')}
              className="btn-primary"
            >
              <span>Report a Civic Issue</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => navigate('/track')}
              className="btn-secondary"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>Track Complaint Status</span>
            </button>
          </div>

          {/* 3 Quick Assurance Bullets */}
          <div className="pt-4 border-t border-slate-200 grid grid-cols-3 gap-4 text-xs text-slate-600">
            <div>
              <span className="font-semibold text-slate-900 block">GPS Telemetry</span>
              <span className="text-[11px] text-slate-500">Spatial radius validation</span>
            </div>
            <div>
              <span className="font-semibold text-slate-900 block">Scene Match</span>
              <span className="text-[11px] text-slate-500">Geometric correspondence</span>
            </div>
            <div>
              <span className="font-semibold text-slate-900 block">Tamper-Proof</span>
              <span className="text-[11px] text-slate-500">SHA-256 evidence hashing</span>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Evidence Viewer Showcase */}
        <div className="lg:col-span-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 px-1 font-mono">
              <span>LIVE VERIFICATION DEMO</span>
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                VERIFIED CLOSURE
              </span>
            </div>
            <EvidenceViewer
              caseNumber="MK-10482"
              beforeTimestamp="2026-08-19 09:14 UTC"
              afterTimestamp="2026-08-20 14:32 UTC"
              deviceInfo="Field Terminal #42 • Live Camera"
              hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
              latitude={13.0031}
              longitude={77.5643}
              statusBadge="VERIFIED CLOSURE"
            />
          </div>
        </div>
      </section>

      {/* THREE-STEP PROCESS SECTION */}
      <section className="bg-white border-t border-slate-200 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">System Workflow</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              How civic accountability works
            </h2>
            <p className="text-sm text-slate-600">
              A transparent 3-step pipeline guaranteeing that physical repairs happen before cases are archived.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            
            {/* Step 1 */}
            <div className="civic-card p-6 space-y-4">
              <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 font-mono font-bold text-xs">
                01
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  Citizen Report
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Citizen reports a defect (pothole, water leak, debris) with real-time location telemetry and initial photo evidence.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="civic-card p-6 space-y-4">
              <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 font-mono font-bold text-xs">
                02
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-amber-600" />
                  Field Resolution
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Assigned municipal worker completes the physical repair on-site and captures live camera evidence with verified GPS coordinates.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="civic-card p-6 space-y-4">
              <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 font-mono font-bold text-xs">
                03
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-600" />
                  Evidence Verification
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  The engine evaluates spatial proximity, scene geometric correspondence, defect reduction, and cryptographic freshness before authorizing case closure.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* CIVIC IMPACT STATS */}
      <section className="border-t border-slate-200 py-12 bg-[#f8fafc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="civic-card p-5">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 block font-mono">100%</span>
            <span className="text-xs text-slate-500 mt-1 block">Verifiable Audit Trail</span>
          </div>
          <div className="civic-card p-5">
            <span className="text-2xl sm:text-3xl font-extrabold text-blue-700 block font-mono">6 Gates</span>
            <span className="text-xs text-slate-500 mt-1 block">Forensic Integrity Checks</span>
          </div>
          <div className="civic-card p-5">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-700 block font-mono">&lt; 150ms</span>
            <span className="text-xs text-slate-500 mt-1 block">Verification Pipeline</span>
          </div>
          <div className="civic-card p-5">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 block font-mono">SHA-256</span>
            <span className="text-xs text-slate-500 mt-1 block">Cryptographic Fingerprinting</span>
          </div>
        </div>
      </section>

    </div>
  );
};

export default CitizenHomePage;
