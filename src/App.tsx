import React, { useState } from 'react';
import {
  FileText,
  BarChart3,
  Download,
  RefreshCw,
  Play,
  Sparkles,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Check,
  Zap,
  ClipboardList
} from 'lucide-react';
import UploadPanel from './components/UploadPanel';
import CriteriaPanel from './components/CriteriaPanel';
import DetailTab from './components/DetailTab';
import SummaryTab from './components/SummaryTab';
import ExportDialog from './components/ExportDialog';
import { ParsedReports } from './utils/fileParser';
import { evaluateTaf } from './utils/tafEvaluator';
import { TafEvaluationResult } from './types';

export default function App() {
  const [parsedData, setParsedData] = useState<ParsedReports | null>(null);
  const [results, setResults] = useState<TafEvaluationResult[]>([]);
  const [activeTab, setActiveTab] = useState<'detail' | 'summary'>('detail');

  // Evaluation animation states
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalProgress, setEvalProgress] = useState(0);

  // Export Dialog state
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Gemini AI state
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Load parsed data from UploadPanel
  const handleDataLoaded = (data: ParsedReports) => {
    setParsedData(data);
    setResults([]); // Reset results until "Đánh giá" is explicitly clicked
    setAiAnalysis(null);
  };

  // Trigger evaluation with lively progress bar
  const handleEvaluate = () => {
    if (!parsedData || parsedData.tafs.length === 0) return;

    setIsEvaluating(true);
    setEvalProgress(0);
    setResults([]);
    setAiAnalysis(null);

    const interval = setInterval(() => {
      setEvalProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          // Run the real evaluation calculations
          const evalResults = parsedData.tafs.map(taf => {
            // Filter observations belonging to the same airport
            const relevantObs = parsedData.observations.filter(
              obs => obs.station.toUpperCase() === taf.station.toUpperCase()
            );
            return evaluateTaf(taf, relevantObs);
          });

          setResults(evalResults);
          setIsEvaluating(false);
          return 100;
        }
        // Varied speeds for a lively realistic progress feeling
        const increment = Math.floor(Math.random() * 15) + 10;
        return Math.min(prev + increment, 100);
      });
    }, 150);
  };

  // Trigger server-side Gemini analysis of current results
  const fetchAiAnalysis = async () => {
    if (results.length === 0) return;
    setIsAiLoading(true);
    setAiError(null);
    setAiAnalysis(null);

    const activeResult = results[0]; // Analyze the first/selected TAF result

    try {
      const response = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          station: activeResult.taf.station,
          accuracy: activeResult.overallAccuracy,
          elements: activeResult.elementAccuracy,
          rawTaf: activeResult.taf.raw,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Lỗi không xác định khi kết nối dịch vụ AI.');
      }
      setAiAnalysis(data.analysis);
    } catch (err) {
      setAiError((err as Error).message);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Reset all states
  const handleReset = () => {
    setParsedData(null);
    setResults([]);
    setIsEvaluating(false);
    setEvalProgress(0);
    setAiAnalysis(null);
    setAiError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col overflow-x-hidden selection:bg-indigo-100 selection:text-indigo-900">
      {/* Header Bar */}
      <header className="bg-slate-900 text-white p-4 flex justify-between items-center sticky top-0 z-40 shadow-md">
        <div className="w-full flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-2 rounded-lg font-bold">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight uppercase font-display bg-gradient-to-r from-indigo-200 to-sky-100 bg-clip-text text-transparent">HỆ THỐNG ĐÁNH GIÁ CHẤT LƯỢNG TAF v3.0</h1>
              <p className="text-[10px] opacity-75 font-mono tracking-widest uppercase">ICAO Annex 3 Standards • Meteorological Center Quality Assurance</p>
            </div>
          </div>
          <div className="flex gap-4 items-center w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-2 bg-slate-800 text-emerald-400 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold border border-slate-700 shadow-inner">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>HỆ THỐNG SẴN SÀNG
            </div>
            <div className="text-right font-mono text-slate-300">
              <p className="text-[10px] font-bold uppercase text-slate-100">TRUNG TÂM KHÍ TƯỢNG HÀNG KHÔNG</p>
              <p className="text-[10px] opacity-75">UTC: 2026-06-23 13:40</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Side: Controllers & Instructions */}
          <div className="lg:col-span-4 space-y-6">
            <UploadPanel onDataLoaded={handleDataLoaded} onReset={handleReset} />
            <CriteriaPanel />
          </div>

          {/* Right Side: Evaluation Workspace */}
          <div className="lg:col-span-8 space-y-6">
            {/* Control Bar */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-indigo-600 animate-pulse"></span>
                <div>
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">TRẠNG THÁI TIẾN TRÌNH</h3>
                  <p className="text-xs font-bold text-slate-800 uppercase">
                    {!parsedData
                      ? 'Đang chờ nạp dữ liệu khí tượng...'
                      : results.length > 0
                      ? `Đã hoàn thành phân tích (${results.length} bản tin TAF)`
                      : 'Đã nạp dữ liệu • Sẵn sàng đối chiếu so khớp'}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                {parsedData && results.length === 0 && !isEvaluating && (
                  <button
                    id="btn-evaluate"
                    onClick={handleEvaluate}
                    className="flex-1 sm:flex-none bg-indigo-600 text-white text-xs font-bold py-2.5 px-5 rounded-lg hover:bg-indigo-700 transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer shadow-xs hover:shadow-md"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Thực hiện đánh giá
                  </button>
                )}
                {results.length > 0 && (
                  <>
                    <button
                      id="btn-trigger-export"
                      onClick={() => setIsExportOpen(true)}
                      className="flex-1 sm:flex-none bg-emerald-600 text-white text-xs font-bold py-2.5 px-5 rounded-lg hover:bg-emerald-700 transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer shadow-xs hover:shadow-md"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Xuất báo cáo
                    </button>
                    <button
                      id="btn-re-evaluate"
                      onClick={handleEvaluate}
                      className="bg-white border border-slate-200 text-slate-700 p-2.5 rounded-lg hover:bg-slate-50 hover:text-indigo-600 transition-all flex items-center justify-center cursor-pointer shadow-2xs"
                      title="Tính toán lại"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Progress Bar (Visible during evaluation calculations) */}
            {isEvaluating && (
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3 animate-fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-ping"></span>
                    Đang giải trình tách yếu tố và so sánh dữ liệu quan trắc thực tế...
                  </span>
                  <span className="font-mono font-bold text-slate-900">{evalProgress}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all duration-150"
                    style={{ width: `${evalProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Results Output Tab Control */}
            {results.length > 0 && !isEvaluating && (
              <div className="space-y-6">
                {/* Tabs */}
                <div className="flex bg-slate-100 p-1.5 gap-1.5 rounded-xl border border-slate-200">
                  <button
                    id="tab-detail"
                    onClick={() => setActiveTab('detail')}
                    className={`flex items-center gap-2 py-2 px-5 text-xs font-bold rounded-lg transition-all uppercase tracking-wider cursor-pointer ${
                      activeTab === 'detail'
                        ? 'bg-[#1e293b] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    Bảng chi tiết (12 giờ)
                  </button>
                  <button
                    id="tab-summary"
                    onClick={() => setActiveTab('summary')}
                    className={`flex items-center gap-2 py-2 px-5 text-xs font-bold rounded-lg transition-all uppercase tracking-wider cursor-pointer ${
                      activeTab === 'summary'
                        ? 'bg-[#1e293b] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4" />
                    Bảng tổng hợp thống kê
                  </button>
                </div>

                {/* Tab content area */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:shadow-md transition-all">
                  {activeTab === 'detail' ? (
                    <DetailTab evaluationResults={results} />
                  ) : (
                    <SummaryTab evaluationResults={results} />
                  )}
                </div>

                {/* Gemini AI Forecast Coach Section */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:shadow-md transition-shadow space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                        <Cpu className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">PHÂN TÍCH CHẤT LƯỢNG BẰNG AI COACH</h4>
                        <p className="text-[10px] text-slate-400 font-sans">Xem phân tích tự động về xu hướng sai số và ý kiến chuyên môn từ Gemini AI</p>
                      </div>
                    </div>
                    {!aiAnalysis && !isAiLoading && (
                      <button
                        id="btn-trigger-ai"
                        onClick={fetchAiAnalysis}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold py-1.5 px-3.5 rounded-lg border border-transparent transition-all flex items-center gap-1.5 shadow-sm active:scale-95 uppercase tracking-wider cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                        Phân tích bằng AI
                      </button>
                    )}
                  </div>

                  {isAiLoading && (
                    <div className="py-8 text-center space-y-2.5">
                      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                      <p className="text-xs text-slate-500">Mô hình AI đang đối chiếu và phân tích chi tiết bản tin khí tượng...</p>
                    </div>
                  )}

                  {aiError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex gap-1.5 items-start font-sans">
                      <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <span>{aiError}</span>
                    </div>
                  )}

                  {aiAnalysis && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700 leading-relaxed space-y-3 animate-fade-in max-h-[350px] overflow-y-auto">
                      <div className="flex items-center gap-1.5 text-slate-900 font-bold mb-1 border-b border-slate-200 pb-2">
                        <Lightbulb className="w-4 h-4 text-amber-500" />
                        Ý KIẾN DỰ BÁO VIÊN AI:
                      </div>
                      <div className="space-y-2.5 text-slate-650">
                        {aiAnalysis.split('\n\n').map((paragraph, pIdx) => {
                          const isHeading = paragraph.startsWith('###') || paragraph.startsWith('1.') || paragraph.startsWith('2.') || paragraph.startsWith('3.');
                          if (isHeading) {
                            return (
                              <h5 key={pIdx} className="font-bold text-slate-900 text-xs uppercase mt-3 pt-2 first:mt-0 first:pt-0">
                                {paragraph.replace(/###/g, '').trim()}
                              </h5>
                            );
                          }
                          return (
                            <p key={pIdx} className="pl-1 leading-relaxed">
                              {paragraph}
                            </p>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Empty state when no data evaluated yet */}
            {results.length === 0 && !isEvaluating && (
              <div className="bg-white border border-slate-200 rounded-xl p-16 text-center text-slate-500 flex flex-col items-center justify-center min-h-[380px] shadow-xs hover:shadow-md transition-shadow">
                <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 mb-4 text-indigo-600">
                  <ClipboardList className="w-12 h-12" />
                </div>
                <h3 className="text-base font-bold text-slate-800 uppercase tracking-tight">Sẵn sàng thực hiện đánh giá</h3>
                <p className="text-xs text-slate-500 mt-2 max-w-sm leading-relaxed">
                  Vui lòng kéo thả tệp tin khí tượng của bạn vào bảng bên trái hoặc sử dụng dữ liệu mẫu, sau đó nhấn <strong>Bắt đầu đánh giá</strong> để phân tích chất lượng.
                </p>
                {parsedData && (
                  <button
                    id="btn-placeholder-evaluate"
                    onClick={handleEvaluate}
                    className="mt-6 bg-indigo-600 text-white text-xs font-bold py-2.5 px-5 rounded-lg hover:bg-indigo-700 transition-all flex items-center gap-2 active:scale-95 cursor-pointer shadow-sm hover:shadow-md uppercase tracking-wider"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Thực hiện đối chiếu ngay
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer Bar */}
      <footer className="bg-slate-900 text-slate-400 text-[10px] px-6 py-4 flex flex-col sm:flex-row justify-between gap-2 font-mono mt-auto border-t border-slate-800">
        <div>&copy; 2026 - TRUNG TÂM KHÍ TƯỢNG HÀNG KHÔNG • HỆ THỐNG ĐÁNH GIÁ CHẤT LƯỢNG TAF</div>
        <div className="flex gap-4">
          <span>PROCESSOR: AD-X9</span>
          <span>TIÊU CHUẨN: ICAO ANNEX 3</span>
          <span>TRẠNG THÁI: KHỚP THỰC TẾ</span>
        </div>
      </footer>

      {/* Export Dialog Overlay Modal */}
      <ExportDialog
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        evaluationResults={results}
        referenceMonthYear={parsedData?.referenceMonthYear}
        monthYearForFile={parsedData?.monthYearForFile}
        fileHeader={parsedData?.fileHeader}
        initialReportType={activeTab}
      />
    </div>
  );
}
