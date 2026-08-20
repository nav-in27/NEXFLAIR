import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, RotateCcw, Filter } from 'lucide-react';

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
      setActionFeedback(`TICKET ${data?.ticket_code_display || '#4821'} APPROVED & RECORDED AS RESOLVED`);
    } else if (action === 'REQUEST_REVERIFICATION') {
      setActionFeedback('RE-VERIFICATION DISPATCHED TO FIELD WORKER');
    } else if (action === 'REOPEN') {
      setActionFeedback('TICKET REOPENED FOR AUDIT RE-EVALUATION');
    }
    setTimeout(() => setActionFeedback(null), 5000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] text-slate-500 font-sans">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-mono">Loading Verification Engine Scenarios...</p>
        </div>
      </div>
    );
  }

  const decisionBadgeStyle =
    data?.decision === 'VERIFIED'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : data?.decision === 'HUMAN_REVIEW'
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : 'bg-rose-50 text-rose-800 border-rose-200';

  const scoreTextColor =
    (data?.overall_score ?? 0) >= 90
      ? 'text-emerald-700'
      : (data?.overall_score ?? 0) >= 70
      ? 'text-amber-700'
      : 'text-rose-700';

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans p-4 sm:p-8 flex justify-center">
      <div className="w-full max-w-5xl space-y-6">

        {/* Action Toast Feedback */}
        {actionFeedback && (
          <div className="sticky top-4 z-50 p-4 rounded-md bg-slate-900 text-white font-medium text-center text-xs shadow-lg animate-fade-in flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{actionFeedback}</span>
          </div>
        )}

        {/* SCENARIO SWITCHER */}
        <div className="civic-card p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-blue-600" />
              Interactive Verification Test Scenarios
            </span>
            <span className="text-[10px] font-mono text-slate-400">Select scenario to simulate pipeline behavior</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {[
              { id: 'GENUINE_RESOLUTION', label: '1. Genuine Resolution' },
              { id: 'WRONG_LOCATION', label: '2. Wrong Location' },
              { id: 'NO_RESOLUTION', label: '3. No Resolution' },
              { id: 'REPLAYED_EVIDENCE', label: '4. Replayed Evidence' },
              { id: 'SPATIO_TEMPORAL_ANOMALY', label: '5. Speed Anomaly' },
              { id: 'LOW_QUALITY_EVIDENCE', label: '6. Low Quality' },
            ].map((sc) => (
              <button
                key={sc.id}
                onClick={() => handleSelectScenario(sc.id)}
                className={`py-2 px-2.5 rounded-md text-xs font-mono font-semibold transition-colors text-center border ${
                  activeScenarioId === sc.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {sc.label}
              </button>
            ))}
          </div>
        </div>

        {/* HEADER BLOCK */}
        <div className="civic-card p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-lg font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
                {data?.ticket_code_display || 'TKT #4821'}
              </span>
              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-mono text-xs font-semibold">
                {data?.complaint_type || 'STAGNANT WATER'}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-mono text-xs font-semibold">
                {data?.ward_name || 'WARD 14'}
              </span>
            </div>
            <p className="text-xs text-slate-500 pt-1 font-medium">
              {data?.title} — <span className="text-slate-700">{data?.subtitle}</span>
            </p>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            <span>Forensic Engine Active</span>
          </div>
        </div>

        {/* BEFORE & VERIFICATION EVIDENCE PAIR */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* BEFORE CARD */}
          <div className="civic-card p-4 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Before Evidence
              </span>
              <span className="text-[10px] font-mono text-slate-400">Citizen Report Baseline</span>
            </div>
            <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100 aspect-video">
              <img
                src={data?.before_image_url || '/uploads/evidence/demo_before_a.jpg'}
                alt="BEFORE Complaint Evidence"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* VERIFICATION CARD */}
          <div className="civic-card p-4 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Verification Evidence
              </span>
              <span className="text-[10px] font-mono text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Live Resolution Capture
              </span>
            </div>
            <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100 aspect-video">
              <img
                src={data?.verification_image_url || '/uploads/evidence/demo_clean_a.jpg'}
                alt="VERIFICATION Evidence"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* VISUAL MATCH ANALYSIS SECTION */}
        <div className="civic-card p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Visual Correspondence Analysis
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                SuperPoint + RANSAC Keypoint Geometric Inlier Matching
              </p>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-slate-500 uppercase font-medium">Scene Match Index:</span>
              <span className={`font-bold px-2.5 py-0.5 rounded border ${data?.scene_consistency && data.scene_consistency >= 70 ? 'text-emerald-800 bg-emerald-50 border-emerald-200' : 'text-rose-800 bg-rose-50 border-rose-200'}`}>
                {data?.scene_consistency ?? 94} / 100
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-900 overflow-hidden">
            <img
              src={data?.scene_viz_url || '/uploads/visualizations/demo_match_genuine.png'}
              alt="Feature Match Visualization"
              className="w-full max-h-72 object-contain bg-slate-900"
            />
          </div>
        </div>

        {/* HAZARD CHANGE SECTION */}
        <div className="civic-card p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Defect Area Reduction Analysis
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                Surface Mask Segmentation & Pixel Area Differential
              </p>
            </div>
            <div className="font-mono text-right text-xs">
              <span className="text-slate-500 uppercase font-medium">Visual Clearance: </span>
              <span className={`font-bold ${data?.visual_reduction_pct && data.visual_reduction_pct >= 70 ? 'text-emerald-700' : 'text-amber-700'}`}>
                {data?.visual_reduction_pct ?? 83.2}%
              </span>
            </div>
          </div>

          {/* Area Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-center text-xs">
            <div className="p-3 rounded-md bg-slate-50 border border-slate-200">
              <div className="text-[10px] text-slate-500 uppercase font-medium">Before Hazard Area</div>
              <div className="text-lg font-bold text-slate-900 mt-1">{data?.before_hazard_area_px?.toLocaleString() ?? '12,500'} px</div>
            </div>
            <div className="p-3 rounded-md bg-slate-50 border border-slate-200">
              <div className="text-[10px] text-slate-500 uppercase font-medium">After Hazard Area</div>
              <div className="text-lg font-bold text-emerald-800 mt-1">{data?.after_hazard_area_px?.toLocaleString() ?? '2,100'} px</div>
            </div>
            <div className="p-3 rounded-md bg-slate-50 border border-slate-200">
              <div className="text-[10px] text-slate-500 uppercase font-medium">Net Reduction</div>
              <div className="text-lg font-bold text-blue-800 mt-1">{data?.visual_reduction_pct ?? 83.2}%</div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-900 overflow-hidden">
            <img
              src={data?.hazard_viz_url || '/uploads/visualizations/demo_hazard_genuine.png'}
              alt="Hazard Mask Visualization"
              className="w-full max-h-72 object-contain bg-slate-900"
            />
          </div>
        </div>

        {/* EVIDENCE SIGNALS BREAKDOWN */}
        <div className="civic-card p-6 space-y-4">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-3">
            Multi-Gate Forensic Signals Breakdown
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 font-mono text-center">
            {[
              { name: 'Scene', val: data?.signals.scene ?? 94 },
              { name: 'Hazard', val: data?.signals.hazard ?? 91 },
              { name: 'Live Capture', val: data?.signals.live_capture ?? 97 },
              { name: 'Spatial', val: data?.signals.spatial ?? 89 },
              { name: 'Temporal', val: data?.signals.temporal ?? 93 },
              { name: 'Freshness', val: data?.signals.freshness ?? 98 },
              { name: 'Quality', val: data?.signals.quality ?? 95 },
            ].map((sig) => (
              <div key={sig.name} className="p-3 rounded-md bg-slate-50 border border-slate-200 flex flex-col justify-between">
                <span className="text-[10px] uppercase font-medium text-slate-500 truncate">{sig.name}</span>
                <span className="text-xl font-bold text-slate-900 mt-1">{sig.val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* FINAL SCORE BADGE */}
        <div className="civic-card p-8 text-center space-y-3">
          <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
            COMPOSITE INTEGRITY SCORE
          </div>

          <div className={`text-5xl md:text-6xl font-extrabold font-mono tracking-tight ${scoreTextColor}`}>
            {data?.overall_score ?? 93} <span className="text-xl text-slate-400 font-medium">/ 100</span>
          </div>

          <div>
            <span className={`inline-block px-4 py-1 rounded text-xs font-mono font-bold uppercase tracking-wider border ${decisionBadgeStyle}`}>
              {data?.decision ?? 'VERIFIED'}
            </span>
          </div>
        </div>

        {/* EXPLANATION BOX */}
        <div className="civic-card p-5 space-y-1.5">
          <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
            System Determination Rationale
          </div>
          <p className="text-xs text-slate-700 leading-relaxed font-sans italic pl-3 border-l-2 border-slate-900 py-0.5">
            "{data?.explanation || 'The submitted evidence is visually consistent with the original scene and shows substantial reduction of the reported defect.'}"
          </p>
        </div>

        {/* REVIEWER ACTION BUTTONS */}
        <div className="civic-card p-5 space-y-3">
          <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
            Auditor Simulation Controls
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              onClick={() => handleReviewAction('APPROVE')}
              className="btn-primary justify-center text-xs py-2.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Verify Closure</span>
            </button>

            <button
              onClick={() => handleReviewAction('REQUEST_REVERIFICATION')}
              className="btn-secondary justify-center text-xs py-2.5"
            >
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Request Re-Inspection</span>
            </button>

            <button
              onClick={() => handleReviewAction('REOPEN')}
              className="btn-secondary justify-center text-xs py-2.5"
            >
              <RotateCcw className="w-4 h-4 text-rose-600" />
              <span>Reopen Ticket</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default EvidenceInvestigationDemo;
