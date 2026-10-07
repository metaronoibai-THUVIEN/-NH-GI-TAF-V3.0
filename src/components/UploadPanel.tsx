import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Sparkles, Files, Layers, Calendar, Plane } from 'lucide-react';
import { parseMultipleFiles, ParsedReports, parseReportsFromText } from '../utils/fileParser';
import { SAMPLE_DATA_TEXT } from '../sampleData';

interface UploadPanelProps {
  onDataLoaded: (data: ParsedReports) => void;
  onReset: () => void;
}

export default function UploadPanel({ onDataLoaded, onReset }: UploadPanelProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [stats, setStats] = useState<ParsedReports | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const processFiles = async (uploadedFiles: File[]) => {
    if (uploadedFiles.length === 0) return;
    setIsLoading(true);
    setError(null);
    setFiles(uploadedFiles);

    try {
      const parsed = await parseMultipleFiles(uploadedFiles);
      setStats(parsed);
      onDataLoaded(parsed);
    } catch (err) {
      setError((err as Error).message);
      setStats(null);
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files) as File[];
      await processFiles(droppedFiles);
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files) as File[];
      await processFiles(selectedFiles);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const loadSample = () => {
    setError(null);
    setFiles([]);
    const parsed = parseReportsFromText(SAMPLE_DATA_TEXT, "Du_lieu_mau_LongTAF.txt");
    setStats(parsed);
    onDataLoaded(parsed);
  };

  const handleReset = () => {
    setFiles([]);
    setStats(null);
    setError(null);
    onReset();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const totalFileSizeKb = files.reduce((acc, f) => acc + f.size, 0) / 1024;

  return (
    <div className="bg-gradient-to-b from-white to-indigo-50/20 border border-slate-200 rounded-2xl p-5 shadow-xs h-full flex flex-col justify-between hover:shadow-md transition-all duration-300 relative overflow-hidden">
      {/* Decorative top colored bar */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600" />
      
      <div className="pt-1">
        <div className="flex items-center gap-2 pb-4 mb-4 border-b border-slate-100">
          <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <Upload className="w-5 h-5" />
          </div>
          <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">📁 NHẬP DỮ LIỆU ĐÁNH GIÁ</h2>
        </div>

        {/* Drag and Drop Zone - Supports multiple files simultaneously */}
        <div
          id="upload-dropzone"
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={handleButtonClick}
          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center min-h-[190px] ${
            isDragActive
              ? 'border-indigo-500 bg-indigo-100/50 scale-[0.99] ring-4 ring-indigo-500/10'
              : 'border-indigo-200 bg-gradient-to-br from-indigo-50/40 via-white to-blue-50/20 hover:bg-indigo-50/30 hover:border-indigo-400 hover:shadow-sm'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleChange}
            accept=".txt,.docx,.xlsx,.xls,.csv,.html"
            multiple
            className="hidden"
          />
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full mb-3 group-hover:scale-110 transition-transform duration-300 shadow-3xs">
            <Files className="w-8 h-8" />
          </div>
          <p className="font-bold text-slate-700 text-xs uppercase tracking-wide">
            Kéo thả một hoặc nhiều file vào đây
          </p>
          <p className="text-[11px] text-indigo-600 mt-1 font-medium">
            (Có thể chọn cùng lúc nhiều file hoặc kéo thả nhiều file)
          </p>
          <p className="text-[10px] text-slate-400 mt-2.5 uppercase tracking-wide bg-slate-100 px-2.5 py-1 rounded-full font-medium inline-block">
            Định dạng: .txt, .docx, .xlsx, .csv, .html
          </p>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-xl text-xs flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <span>Đang đọc và phân tích dữ liệu các tệp...</span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs flex gap-2 items-start animate-fade-in shadow-3xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Status indicator */}
        {stats && (
          <div className="mt-4 p-4 bg-emerald-50/80 border border-emerald-100/80 rounded-2xl text-xs space-y-3 shadow-3xs">
            <div className="flex items-center gap-1.5 font-extrabold text-emerald-800 mb-2 uppercase tracking-wide">
              <div className="p-1 bg-emerald-100 rounded-full">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <span>ĐÃ NẠP DỮ LIỆU THÀNH CÔNG</span>
            </div>

            {/* Files list */}
            {files.length > 0 && (
              <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-150 space-y-1.5">
                <div className="flex items-center justify-between text-slate-700 font-bold text-[11px]">
                  <span className="flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                    Đã nạp {files.length} tệp ({totalFileSizeKb.toFixed(1)} KB)
                  </span>
                </div>
                <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                  {files.map((f, i) => (
                    <div key={i} className="flex justify-between items-center text-[10px] bg-slate-50 px-2 py-1 rounded text-slate-600 font-mono">
                      <span className="truncate max-w-[200px]" title={f.name}>{f.name}</span>
                      <span className="text-slate-400 shrink-0">{(f.size / 1024).toFixed(1)} KB</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reference info detected from files */}
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="bg-white/70 p-2 rounded-lg border border-emerald-100 flex items-center gap-1.5 text-slate-700">
                <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="truncate" title={stats.referenceMonthYear}>
                  <strong>Thời gian:</strong> {stats.referenceMonthYear}
                </span>
              </div>
              <div className="bg-white/70 p-2 rounded-lg border border-emerald-100 flex items-center gap-1.5 text-slate-700">
                <Plane className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="truncate" title={stats.stations?.join(', ')}>
                  <strong>Sân bay:</strong> {stats.stations && stats.stations.length > 0 ? stats.stations.join(', ') : 'Tự động'}
                </span>
              </div>
            </div>

            {/* Counts */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-white border border-emerald-100 rounded-xl p-2.5 text-center shadow-3xs">
                <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider leading-tight">TAF PHÁT HIỆN</p>
                <p className="text-2xl font-black text-indigo-600 mt-1">{stats.tafs.length}</p>
              </div>
              <div className="bg-white border border-emerald-100 rounded-xl p-2.5 text-center shadow-3xs">
                <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider leading-tight">METAR/SPECI</p>
                <p className="text-2xl font-black text-purple-600 mt-1">{stats.observations.length}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2.5 mt-6 pt-4 border-t border-slate-100">
        <button
          id="btn-load-sample"
          onClick={loadSample}
          type="button"
          className="flex-1 py-2.5 px-3 bg-white border border-indigo-200 text-xs text-indigo-700 rounded-xl hover:bg-indigo-50 hover:text-indigo-800 font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs hover:shadow-xs uppercase cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
          Sử dụng bản tin mẫu
        </button>
        {stats && (
          <button
            id="btn-reset-upload"
            onClick={handleReset}
            type="button"
            className="py-2.5 px-3 bg-rose-50 border border-rose-200 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-100/50 rounded-xl font-bold transition-all shadow-2xs uppercase cursor-pointer"
          >
            Đặt lại
          </button>
        )}
      </div>
    </div>
  );
}
