import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, RefreshCw, Check, AlertCircle, MapPin, Upload, Loader2 } from 'lucide-react';

export interface CameraGpsData {
  latitude?: number;
  longitude?: number;
  accuracy_meters?: number;
  captured_at?: string;
  status: 'GPS_CAPTURED' | 'GPS_PERMISSION_DENIED' | 'GPS_UNAVAILABLE';
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File, previewUrl: string, gps?: CameraGpsData) => void;
  onFallbackUpload?: () => void;
  title?: string;
}

export const CameraCaptureModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onCapture,
  onFallbackUpload,
  title = 'Live Camera Evidence Capture',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [gpsData, setGpsData] = useState<CameraGpsData>({ status: 'GPS_UNAVAILABLE' });
  const [isGpsLoading, setIsGpsLoading] = useState<boolean>(false);

  // Stop media tracks
  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // Start Camera Stream
  const startCamera = async () => {
    setIsLoading(true);
    setCameraError(null);
    stopStream();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera API is not supported in this browser. Please use standard photo upload.');
      setIsLoading(false);
      return;
    }

    try {
      // First try rear camera for mobile devices
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } catch {
        // Fallback to default camera for desktop webcam
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsLoading(false);
    } catch (err: any) {
      setIsLoading(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission was denied. Please allow camera access in your browser settings or upload an existing photo.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No camera device was found on this system. Please upload a photo from your files.');
      } else {
        setCameraError('Unable to access camera: ' + (err.message || 'Unknown device error.'));
      }
    }
  };

  // Capture GPS coordinates
  const captureGps = () => {
    if (!navigator.geolocation) {
      setGpsData({ status: 'GPS_UNAVAILABLE' });
      return;
    }

    setIsGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsGpsLoading(false);
        setGpsData({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy_meters: Math.round(pos.coords.accuracy),
          captured_at: new Date(pos.timestamp).toISOString(),
          status: 'GPS_CAPTURED',
        });
      },
      (err) => {
        setIsGpsLoading(false);
        setGpsData({
          status: err.code === err.PERMISSION_DENIED ? 'GPS_PERMISSION_DENIED' : 'GPS_UNAVAILABLE',
        });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    if (isOpen) {
      setCapturedBlob(null);
      setCapturedPreview(null);
      startCamera();
      captureGps();
    } else {
      stopStream();
    }

    return () => {
      stopStream();
    };
  }, [isOpen]);

  // Take Snapshot
  const handleTakeSnapshot = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setCapturedBlob(blob);
        const url = URL.createObjectURL(blob);
        setCapturedPreview(url);
        stopStream();
      },
      'image/jpeg',
      0.92
    );
  };

  // Retake Snapshot
  const handleRetake = () => {
    if (capturedPreview) {
      URL.revokeObjectURL(capturedPreview);
    }
    setCapturedBlob(null);
    setCapturedPreview(null);
    startCamera();
  };

  // Confirm and Use Photo
  const handleConfirm = () => {
    if (!capturedBlob || !capturedPreview) return;
    const file = new File([capturedBlob], `live_capture_${Date.now()}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
    onCapture(file, capturedPreview, gpsData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden relative flex flex-col my-auto">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">{title}</h3>
              <p className="text-[11px] text-slate-400">Live device optical capture</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport Area */}
        <div className="p-6 space-y-4">
          <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
            
            {/* Loading Indicator */}
            {isLoading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/80 text-white space-y-2">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                <span className="text-xs font-semibold">Initializing Camera Feed...</span>
              </div>
            )}

            {/* Error View */}
            {cameraError ? (
              <div className="p-6 text-center space-y-4 max-w-md">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">Camera Unavailable</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{cameraError}</p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  {onFallbackUpload && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onFallbackUpload();
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-md"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Photo Instead</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry</span>
                  </button>
                </div>
              </div>
            ) : capturedPreview ? (
              /* Captured Image Preview */
              <div className="w-full h-full relative">
                <img
                  src={capturedPreview}
                  alt="Captured snapshot"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 bg-emerald-950/80 backdrop-blur-sm border border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>PHOTO CAPTURED</span>
                </div>
              </div>
            ) : (
              /* Live Video Stream */
              <div className="w-full h-full relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {/* Viewfinder crosshairs / frame */}
                <div className="absolute inset-4 border border-white/20 rounded-xl pointer-events-none flex items-center justify-center">
                  <div className="w-10 h-10 border-t-2 border-l-2 border-blue-400/80 absolute top-0 left-0" />
                  <div className="w-10 h-10 border-t-2 border-r-2 border-blue-400/80 absolute top-0 right-0" />
                  <div className="w-10 h-10 border-b-2 border-l-2 border-blue-400/80 absolute bottom-0 left-0" />
                  <div className="w-10 h-10 border-b-2 border-r-2 border-blue-400/80 absolute bottom-0 right-0" />
                </div>
                <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-sm border border-slate-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  <span>LIVE VIEW</span>
                </div>
              </div>
            )}
          </div>

          {/* GPS telemetry status */}
          <div className="px-4 py-2.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-[11px] text-slate-300">
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-blue-400" />
              <span>Location Telemetry:</span>
            </div>
            <div>
              {isGpsLoading ? (
                <span className="text-amber-400 font-mono">Acquiring GPS...</span>
              ) : gpsData.status === 'GPS_CAPTURED' && gpsData.latitude !== undefined ? (
                <span className="text-emerald-400 font-mono font-semibold">
                  {gpsData.latitude.toFixed(4)}°, {gpsData.longitude?.toFixed(4)}° (±{gpsData.accuracy_meters}m)
                </span>
              ) : (
                <span className="text-slate-400 italic">GPS unavailable (will use area lookup)</span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-between gap-3">
            {capturedPreview ? (
              <>
                <button
                  type="button"
                  onClick={handleRetake}
                  className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Retake Photo</span>
                </button>

                <button
                  type="button"
                  onClick={handleConfirm}
                  className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/30"
                >
                  <Check className="w-4 h-4" />
                  <span>Use Photo</span>
                </button>
              </>
            ) : (
              <>
                {onFallbackUpload && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onFallbackUpload();
                    }}
                    className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Switch to Upload</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={isLoading || !!cameraError}
                  onClick={handleTakeSnapshot}
                  className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/30 disabled:opacity-40"
                >
                  <Camera className="w-4 h-4" />
                  <span>Capture Photo</span>
                </button>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
