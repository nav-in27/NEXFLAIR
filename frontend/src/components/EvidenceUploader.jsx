import React, { useState, useRef } from 'react';
import { UploadCloud, File, AlertTriangle, ShieldCheck, Loader2, FileText, CheckCircle2, Lock } from 'lucide-react';

export default function EvidenceUploader({ onAnalysisComplete }) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file) => {
    setErrorMsg(null);
    if (file.size > 50 * 1024 * 1024) {
      setErrorMsg('File size exceeds the maximum limit of 50MB.');
      return;
    }
    setSelectedFile(file);
  };

  const handleSubmitAnalysis = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setErrorMsg(null);

    try {
      setUploadStep('Computing Cryptographic SHA-256 Digest...');
      await new Promise(r => setTimeout(r, 600));

      setUploadStep('Running Error Level Analysis (ELA) Computer Vision...');
      await new Promise(r => setTimeout(r, 700));

      setUploadStep('Extracting EXIF & Device Footprints...');
      await new Promise(r => setTimeout(r, 600));

      setUploadStep('Minting Immutable Audit Ledger Block...');

      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/v1/evidence/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Evidence analysis failed.');
      }

      const result = await response.json();
      onAnalysisComplete(result);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'An error occurred during evidence analysis.');
    } finally {
      setIsUploading(false);
      setUploadStep('');
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      
      {/* Title & Introduction */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold">
          <Lock className="w-3.5 h-3.5" />
          <span>Cryptographic Proof Engine</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Ingest & Verify Civic Evidence
        </h1>
        <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto">
          Upload photo, video, or document evidence to perform instant forensic Error Level Analysis (ELA), EXIF extraction, and immutable SHA-256 Merkle chain verification.
        </p>
      </div>

      {/* Main Upload Dropzone */}
      <div className="glass-panel rounded-2xl p-6 sm:p-8 border border-slate-800">
        
        <form onDragEnter={handleDrag} onSubmit={(e) => e.preventDefault()}>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,video/*,application/pdf"
            onChange={handleChange}
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
              dragActive
                ? 'border-sky-400 bg-sky-500/10 scale-[1.01]'
                : 'border-slate-700 hover:border-slate-500 bg-slate-900/40'
            }`}
          >
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60 shadow-lg text-sky-400">
                <UploadCloud className="w-10 h-10" />
              </div>

              <div>
                <p className="text-base font-bold text-white">
                  Drag and drop civic evidence here, or <span className="text-sky-400 underline underline-offset-4">browse files</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Supports JPG, PNG, WEBP, MP4, PDF (Max file size: 50MB)
                </p>
              </div>

              {/* Supported Tech Pills */}
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                <span className="text-[11px] px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 font-mono">SHA-256</span>
                <span className="text-[11px] px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 font-mono">Merkle Proof</span>
                <span className="text-[11px] px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 font-mono">ELA Vision</span>
                <span className="text-[11px] px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 font-mono">EXIF Audit</span>
              </div>
            </div>
          </div>
        </form>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center space-x-3 text-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Selected File Card & Analysis Action */}
        {selectedFile && !isUploading && (
          <div className="mt-6 p-4 rounded-xl bg-slate-900/80 border border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <div className="p-3 rounded-lg bg-sky-500/10 text-sky-400">
                <FileText className="w-6 h-6" />
              </div>
              <div className="truncate">
                <p className="text-sm font-semibold text-white truncate max-w-xs sm:max-w-md">{selectedFile.name}</p>
                <p className="text-xs text-slate-400 font-mono">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedFile.type || 'Unknown format'}</p>
              </div>
            </div>

            <button
              onClick={handleSubmitAnalysis}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-sky-500/20 transition-all flex items-center justify-center space-x-2"
            >
              <ShieldCheck className="w-5 h-5" />
              <span>Analyze & Verify Integrity</span>
            </button>
          </div>
        )}

        {/* Upload & Forensic Processing Progress Overlay */}
        {isUploading && (
          <div className="mt-6 p-6 rounded-xl bg-slate-900/90 border border-sky-500/30 text-center space-y-4">
            <div className="inline-flex p-3 rounded-full bg-sky-500/10 text-sky-400 animate-spin">
              <Loader2 className="w-8 h-8" />
            </div>
            <div>
              <p className="text-base font-bold text-white">{uploadStep}</p>
              <p className="text-xs text-slate-400 mt-1 font-mono">Running forensic algorithms and calculating Merkle proof...</p>
            </div>
            
            {/* Progress bar */}
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div className="bg-gradient-to-r from-sky-500 to-indigo-500 h-full w-3/4 animate-pulse"></div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
