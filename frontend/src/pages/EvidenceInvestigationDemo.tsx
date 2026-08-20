import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, RotateCcw, Sparkles, Filter } from 'lucide-react';

interface ScenarioPayload {
  scenario_id: string;
  title: string;
  subtitle: string;
  ticket_number: string;
  ticket_code_display: string;
  complaint_type: string;
  ward_name: string;
  before_image_url: string;
  verification_image_url: string;
  scene_viz_url: string;
  hazard_viz_url: string;
  scene_consistency: number;
  before_hazard_area_px: number;
  after_hazard_area_px: number;
  visual_reduction_pct: number;
  signals: {
    scene: number;
    hazard: number;
    live_capture: number;
    spatial: number;
    temporal: number;
    freshness: number;
    quality: number;
  };
  overall_score: number;
  decision: string;
  explanation: string;
}

export const EvidenceInvestigationDemo: React.FC = () => {
  const [scenarios, setScenarios] = useState<ScenarioPayload[]>([]);
  const [activeScenarioId, setActiveScenarioId] = useState<string>('GENUINE_RESOLUTION');
  const [data, setData] = useState<ScenarioPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  useEffect(() => {
    async function loadScenarios() {
      try {
        const resp = await fetch('/api/tickets/demo-scenarios');
        if (resp.ok) {
          const list = await resp.json();
          setScenarios(list);
          if (list.length > 0) {
            setData(list[0]);
          }
        }
      } catch (err) {
        console.error('Failed to load demo scenarios', err);
      } finally {
        setLoading(false);
      }
    }
    loadScenarios();
  }, []);

  const handleSelectScenario = (scId: string) => {
    setActiveScenarioId(scId);
    const found = scenarios.find((s) => s.scenario_id === scId);
    if (found) {
      setData(found);
    }
  };

  const handleReviewAction = (action: string) => {
    if (action === 'APPROVE') {
      setActionFeedback(`✅ TICKET ${data?.ticket_code_display || '#4821'} APPROVED & CLOSED SUCCESSFULLY`);
    } else if (action === 'REQUEST_REVERIFICATION') {
      setActionFeedback('⚠️ RE-VERIFICATION REQUESTED FROM FIELD WORKER');
    } else if (action === 'REOPEN') {
      setActionFeedback('🚨 TICKET REOPENED FOR RE-EVALUATION');
    }
    setTimeout(() => setActionFeedback(null), 5000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400 font-sans">
        <div className="text-center space-y-3">
          <div className="inline-block animate-spin text-3xl">⚙️</div>
          <p className="text-sm font-semibold tracking-wider">Loading Hackathon Evidence Investigation Engine...</p>
        </div>
      </div>
    );
  }

  const decisionBadgeStyle =
    data?.decision === 'VERIFIED'
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-500/10'
      : data?.decision === 'HUMAN_REVIEW'
      ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-purple-500/10'
      : 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-rose-500/10';

  const scoreTextColor =
    (data?.overall_score ?? 0) >= 90
      ? 'text-emerald-400'
      : (data?.overall_score ?? 0) >= 70
      ? 'text-purple-400'
      : 'text-rose-400';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 sm:p-8 flex justify-center">
      <div className="w-full max-w-5xl space-y-6">

        {/* Action Toast Feedback */}
        {actionFeedback && (
          <div className="sticky top-4 z-50 p-4 rounded-2xl bg-emerald-950 border border-emerald-500 text-emerald-200 font-bold text-center text-sm shadow-2xl animate-fade-in flex items-center justify-center gap-3">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <span>{actionFeedback}</span>
          </div>
        )}

        {/* DETERMINISTIC SCENARIO SWITCHER CONTROL BAR FOR PRESENTER */}
        <div className="rounded-3xl bg-slate-900/90 border border-amber-500/40 p-5 space-y-3 shadow-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              DETERMINISTIC HACKATHON DEMO MODE SCENARIOS
            </span>
            <span className="text-[10px] font-mono text-slate-400">Select scenario to present live verification pipeline</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {[
              { id: 'GENUINE_RESOLUTION', label: '1. Genuine Resolution', color: 'border-emerald-500/50 text-emerald-400' },
              { id: 'WRONG_LOCATION', label: '2. Wrong Location', color: 'border-rose-500/50 text-rose-400' },
              { id: 'NO_RESOLUTION', label: '3. No Resolution', color: 'border-amber-500/50 text-amber-400' },
              { id: 'REPLAYED_EVIDENCE', label: '4. Replayed Evidence', color: 'border-rose-500/50 text-rose-400' },
              { id: 'SPATIO_TEMPORAL_ANOMALY', label: '5. Speed Anomaly', color: 'border-rose-500/50 text-rose-400' },
              { id: 'LOW_QUALITY_EVIDENCE', label: '6. Low Quality', color: 'border-purple-500/50 text-purple-400' },
            ].map((sc) => (
              <button
                key={sc.id}
                onClick={() => handleSelectScenario(sc.id)}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all text-center border ${
                  activeScenarioId === sc.id
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20 font-black'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                }`}
              >
                {sc.label}
              </button>
            ))}
          </div>
        </div>

        {/* HEADER BLOCK */}
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 md:p-8 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-2xl font-black text-amber-400 bg-amber-950/60 px-4 py-1.5 rounded-xl border border-amber-800/60 tracking-wider">
                {data?.ticket_code_display || 'TKT #4821'}
              </span>
              <span className="px-3 py-1 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 font-bold text-xs uppercase tracking-wider">
                {data?.complaint_type || 'STAGNANT WATER'}
              </span>
              <span className="px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold text-xs uppercase tracking-wider">
                {data?.ward_name || 'WARD 14'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-2 font-semibold">
              {data?.title} — <span className="text-slate-300">{data?.subtitle}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest">
              Pipeline Active
            </span>
          </div>
        </div>

        {/* BEFORE & VERIFICATION EVIDENCE PAIR */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* BEFORE CARD */}
          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                📷 BEFORE EVIDENCE
              </span>
              <span className="text-[10px] font-mono text-slate-500">Complaint Scene</span>
            </div>
            <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 aspect-video">
              <img
                src={data?.before_image_url || '/uploads/evidence/demo_before_a.jpg'}
                alt="BEFORE Complaint Evidence"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* VERIFICATION CARD */}
          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                📸 VERIFICATION EVIDENCE
              </span>
              <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                LIVE CAMERA CAPTURE
              </span>
            </div>
            <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 aspect-video">
              <img
                src={data?.verification_image_url || '/uploads/evidence/demo_clean_a.jpg'}
                alt="VERIFICATION Evidence"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* VISUAL MATCH ANALYSIS SECTION */}
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 md:p-8 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-4">
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                🔬 VISUAL MATCH ANALYSIS
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                SuperPoint + LightGlue Keypoint Feature Matching & Geometric Inlier Extraction
              </p>
            </div>
            <div className="flex items-center gap-2 font-mono">
              <span className="text-xs text-slate-400 uppercase font-bold">Scene Consistency:</span>
              <span className={`text-xl font-black px-3 py-1 rounded-xl border ${data?.scene_consistency && data.scene_consistency >= 70 ? 'text-emerald-400 bg-emerald-950/80 border-emerald-800/60' : 'text-rose-400 bg-rose-950/80 border-rose-800/60'}`}>
                {data?.scene_consistency ?? 94} / 100
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden">
            <img
              src={data?.scene_viz_url || '/uploads/visualizations/demo_match_genuine.png'}
              alt="Feature Match Visualization"
              className="w-full max-h-72 object-contain bg-slate-950"
            />
          </div>
        </div>

        {/* HAZARD CHANGE SECTION */}
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 md:p-8 space-y-5 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-4">
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                🌊 HAZARD CHANGE
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Stagnant Water Surface Mask Segmentation & Pixel Area Reduction Calculation
              </p>
            </div>
            <div className="font-mono text-right">
              <span className="text-xs text-slate-400 uppercase font-bold block">Visual Reduction</span>
              <span className={`text-2xl font-black ${data?.visual_reduction_pct && data.visual_reduction_pct >= 70 ? 'text-cyan-400' : 'text-amber-400'}`}>
                {data?.visual_reduction_pct ?? 83.2}%
              </span>
            </div>
          </div>

          {/* Area Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-center">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="text-[11px] text-slate-400 uppercase font-bold">Before Hazard Area</div>
              <div className="text-2xl font-black text-rose-400 mt-1">{data?.before_hazard_area_px?.toLocaleString() ?? '12,500'} px</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="text-[11px] text-slate-400 uppercase font-bold">After Hazard Area</div>
              <div className="text-2xl font-black text-emerald-400 mt-1">{data?.after_hazard_area_px?.toLocaleString() ?? '2,100'} px</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950 border border-cyan-900/50 bg-cyan-950/20">
              <div className="text-[11px] text-cyan-400 uppercase font-bold">Visual Reduction</div>
              <div className="text-2xl font-black text-cyan-300 mt-1">{data?.visual_reduction_pct ?? 83.2}%</div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden">
            <img
              src={data?.hazard_viz_url || '/uploads/visualizations/demo_hazard_genuine.png'}
              alt="Hazard Mask Visualization"
              className="w-full max-h-72 object-contain bg-slate-950"
            />
          </div>
        </div>

        {/* EVIDENCE SIGNALS BREAKDOWN */}
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 md:p-8 space-y-4 shadow-xl">
          <h3 className="text-base font-black text-white uppercase tracking-wider border-b border-slate-800/80 pb-4 flex items-center gap-2">
            ⚡ EVIDENCE SIGNALS BREAKDOWN
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 font-mono text-center">
            {[
              { name: 'Scene', val: data?.signals.scene ?? 94, color: 'text-indigo-400' },
              { name: 'Hazard', val: data?.signals.hazard ?? 91, color: 'text-cyan-400' },
              { name: 'Live Evidence', val: data?.signals.live_capture ?? 97, color: 'text-emerald-400' },
              { name: 'Spatial', val: data?.signals.spatial ?? 89, color: 'text-amber-400' },
              { name: 'Temporal', val: data?.signals.temporal ?? 93, color: 'text-purple-400' },
              { name: 'Freshness', val: data?.signals.freshness ?? 98, color: 'text-sky-400' },
              { name: 'Quality', val: data?.signals.quality ?? 95, color: 'text-emerald-300' },
            ].map((sig) => (
              <div key={sig.name} className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400 truncate">{sig.name}</span>
                <span className={`text-2xl font-black ${sig.color} mt-2`}>{sig.val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CIVIC EVIDENCE INTEGRITY FINAL SCORE BADGE */}
        <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 p-8 text-center space-y-4 shadow-2xl">
          <div className="text-xs font-black uppercase tracking-widest text-slate-400">
            CIVIC EVIDENCE INTEGRITY
          </div>

          <div className={`text-6xl md:text-7xl font-black font-mono tracking-tight ${scoreTextColor}`}>
            {data?.overall_score ?? 93} <span className="text-2xl text-slate-500 font-bold">/ 100</span>
          </div>

          <div className={`inline-block px-8 py-2.5 rounded-full border text-lg font-black tracking-widest uppercase shadow-lg ${decisionBadgeStyle}`}>
            {data?.decision ?? 'VERIFIED'}
          </div>
        </div>

        {/* EXPLANATION BOX */}
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 md:p-8 space-y-2 shadow-xl">
          <div className="text-xs font-black uppercase tracking-widest text-slate-400">
            EXPLANATION
          </div>
          <p className="text-base text-slate-200 leading-relaxed font-sans italic border-l-4 border-amber-500 pl-4 py-1">
            "{data?.explanation || 'The submitted evidence is visually consistent with the original scene and shows substantial reduction of the reported stagnant-water area.'}"
          </p>
        </div>

        {/* INTERACTIVE REVIEWER ACTION BUTTONS */}
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 md:p-8 space-y-4 shadow-xl">
          <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
            JUDGING DECISION CONTROLS
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono font-bold text-sm">
            <button
              onClick={() => handleReviewAction('APPROVE')}
              className="py-4 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 transform active:scale-98 uppercase tracking-wider"
            >
              <CheckCircle2 className="w-5 h-5" />
              [APPROVE]
            </button>

            <button
              onClick={() => handleReviewAction('REQUEST_REVERIFICATION')}
              className="py-4 px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center gap-2 transform active:scale-98 uppercase tracking-wider"
            >
              <AlertTriangle className="w-5 h-5" />
              [REQUEST RE-VERIFICATION]
            </button>

            <button
              onClick={() => handleReviewAction('REOPEN')}
              className="py-4 px-6 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white shadow-xl shadow-rose-600/20 transition-all flex items-center justify-center gap-2 transform active:scale-98 uppercase tracking-wider"
            >
              <RotateCcw className="w-5 h-5" />
              [REOPEN TICKET]
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
