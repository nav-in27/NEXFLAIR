import React, { useState, useRef } from 'react';
import { ZoomIn, RotateCcw, SlidersHorizontal, Camera, CheckCircle2 } from 'lucide-react';

interface EvidenceViewerProps {
  beforeUrl?: string | null;
  afterUrl?: string | null;
  caseNumber?: string;
  beforeTimestamp?: string;
  afterTimestamp?: string;
  deviceInfo?: string;
  hash?: string;
  latitude?: number | null;
  longitude?: number | null;
  statusBadge?: string;
}

export const EvidenceViewer: React.FC<EvidenceViewerProps> = ({
  beforeUrl,
  afterUrl,
  caseNumber = 'MK-10482',
  beforeTimestamp = '2023-10-24 08:14 UTC',
  afterTimestamp = '2023-10-25 14:32 UTC',
  deviceInfo = 'iPhone 13 Pro',
  hash = 'a9b3f...2c1e',
  latitude = 34.0522,
  longitude = -118.2437,
  statusBadge
}) => {
  const [sliderPosition, setSliderPosition] = useState<number>(50);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isInverted, setIsInverted] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    let percentage = (x / rect.width) * 100;
    if (percentage < 0) percentage = 0;
    if (percentage > 100) percentage = 100;
    setSliderPosition(percentage);
  };

  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) handleMove(e.clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && e.touches.length > 0) {
      handleMove(e.touches[0].clientX);
    }
  };

  const toggleZoom = () => {
    setZoomLevel((prev) => (prev === 1 ? 1.5 : 1));
  };

  const normalizedBeforeUrl = beforeUrl ? (beforeUrl.startsWith('http') || beforeUrl.startsWith('/') ? beforeUrl : `/${beforeUrl}`) : null;
  const normalizedAfterUrl = afterUrl ? (afterUrl.startsWith('http') || afterUrl.startsWith('/') ? afterUrl : `/${afterUrl}`) : null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden space-y-0">
      
      {/* HEADER CONTROLS BAR */}
      <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700">
        <div className="flex items-center space-x-2">
          <span className="text-slate-400 font-mono">FORENSIC VISUAL COMPARISON #{caseNumber}</span>
          {statusBadge && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {statusBadge}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={toggleZoom}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all ${
              zoomLevel > 1 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <ZoomIn className="w-3.5 h-3.5" />
            <span>{zoomLevel > 1 ? 'Reset Zoom' : 'Zoom'}</span>
          </button>

          <button
            onClick={() => setIsInverted(!isInverted)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all ${
              isInverted ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Invert</span>
          </button>
        </div>
      </div>

      {/* SLIDER COMPARISON VIEW CONTAINER */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onMouseMove={handleMouseMove}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
        onTouchMove={handleTouchMove}
        className="relative w-full h-80 sm:h-[400px] bg-slate-900 overflow-hidden select-none cursor-ew-resize"
      >
        {/* AFTER IMAGE (BOTTOM LAYER) */}
        <div className="absolute inset-0 w-full h-full">
          {normalizedAfterUrl ? (
            <img
              src={normalizedAfterUrl}
              alt="After Evidence"
              className={`w-full h-full object-cover transition-transform duration-200 ${
                isInverted ? 'invert' : ''
              }`}
              style={{ transform: `scale(${zoomLevel})` }}
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent && !parent.querySelector('.img-err-msg')) {
                  const msg = document.createElement('div');
                  msg.className = 'img-err-msg w-full h-full flex flex-col items-center justify-center text-rose-400 bg-slate-900 p-4 text-center text-xs font-mono';
                  msg.innerText = `Failed to load resolution image (${normalizedAfterUrl})`;
                  parent.appendChild(msg);
                }
              }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-slate-800">
              <Camera className="w-8 h-8 mb-2 opacity-50" />
              <span className="text-xs font-mono">PENDING FIELD OFFICER PHOTO</span>
            </div>
          )}
          
          <div className="absolute top-4 right-4 px-3 py-1 rounded bg-black/75 backdrop-blur-md text-[11px] font-mono text-white border border-white/10 shadow-sm">
            AFTER <span className="text-slate-400 font-normal ml-1">{afterTimestamp}</span>
          </div>
        </div>

        {/* BEFORE IMAGE (CLIPPED TOP LAYER) */}
        <div
          className="absolute inset-0 h-full overflow-hidden border-r border-white/80 shadow-2xl"
          style={{ width: `${sliderPosition}%` }}
        >
          <div
            className="absolute inset-0 w-full h-full"
            style={{ width: containerRef.current ? `${containerRef.current.clientWidth}px` : '100%' }}
          >
            {normalizedBeforeUrl ? (
              <img
                src={normalizedBeforeUrl}
                alt="Before Evidence"
                className={`w-full h-full object-cover transition-transform duration-200 ${
                  isInverted ? 'invert' : ''
                }`}
                style={{ transform: `scale(${zoomLevel})` }}
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent && !parent.querySelector('.img-err-msg')) {
                    const msg = document.createElement('div');
                    msg.className = 'img-err-msg w-full h-full flex flex-col items-center justify-center text-rose-400 bg-slate-900 p-4 text-center text-xs font-mono';
                    msg.innerText = `Failed to load citizen photo (${normalizedBeforeUrl})`;
                    parent.appendChild(msg);
                  }
                }}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-slate-850">
                <Camera className="w-8 h-8 mb-2 opacity-50" />
                <span className="text-xs font-mono">NO INITIAL PHOTO ATTACHED</span>
              </div>
            )}

            <div className="absolute top-4 left-4 px-3 py-1 rounded bg-black/75 backdrop-blur-md text-[11px] font-mono text-white border border-white/10 shadow-sm">
              BEFORE <span className="text-slate-400 font-normal ml-1">{beforeTimestamp}</span>
            </div>
          </div>
        </div>

        {/* DRAGGABLE CENTER SLIDER HANDLE */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize z-20 flex items-center justify-center"
          style={{ left: `${sliderPosition}%` }}
        >
          <div className="w-8 h-8 rounded-full bg-white text-slate-900 border border-slate-300 shadow-lg flex items-center justify-center -ml-3.5">
            <SlidersHorizontal className="w-4 h-4 text-slate-700" />
          </div>
        </div>
      </div>

      {/* METADATA FOOTER BAR */}
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 grid grid-cols-3 gap-2 text-[11px] font-mono text-slate-600">
        <div>
          <span className="text-slate-400 block text-[10px]">DEVICE / CAMERA</span>
          <span className="font-semibold text-slate-800">{deviceInfo}</span>
        </div>
        <div>
          <span className="text-slate-400 block text-[10px]">GEOGRAPHIC LOCATION</span>
          <span className="font-semibold text-slate-800">
            {latitude ? `${latitude.toFixed(4)}° N, ${longitude?.toFixed(4)}° W` : 'Geo-Verified'}
          </span>
        </div>
        <div className="text-right">
          <span className="text-slate-400 block text-[10px]">CRYPTOGRAPHIC HASH</span>
          <span className="font-semibold text-blue-700 hover:underline cursor-pointer">{hash}</span>
        </div>
      </div>

    </div>
  );
};

export default EvidenceViewer;
