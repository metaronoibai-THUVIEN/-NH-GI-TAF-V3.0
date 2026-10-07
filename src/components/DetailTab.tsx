import React, { useState } from 'react';
import { TafEvaluationResult, BecmgEvaluation } from '../types';
import { AlertCircle, FileText, RefreshCw, CheckCircle2, Award, Clock, ArrowRight, ShieldCheck, ShieldAlert, Sparkles } from 'lucide-react';

interface DetailTabProps {
  evaluationResults: TafEvaluationResult[];
}

export default function DetailTab({ evaluationResults }: DetailTabProps) {
  const [selectedTafIndex, setSelectedTafIndex] = useState(0);

  if (evaluationResults.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 font-sans flex flex-col items-center justify-center">
        <AlertCircle className="w-12 h-12 text-slate-300 mb-3" />
        <p className="font-semibold text-slate-700">Chưa có kết quả đánh giá</p>
        <p className="text-xs text-slate-400 mt-1">Hãy tải lên file dữ liệu hoặc chọn bản tin mẫu ở bảng bên trái để xem chi tiết.</p>
      </div>
    );
  }

  const result = evaluationResults[selectedTafIndex] || evaluationResults[0];
  const { taf, evaluations, elementAccuracy, overallAccuracy, becmgEvaluations } = result;

  // Summary of element changes due to BECMG
  const becmgGroup = taf.changeGroups.find(g => g.type === 'BECMG');
  const getBecmgElementChanges = () => {
    if (!becmgGroup) return [];
    const base = taf.base;
    const cond = becmgGroup.conditions;
    const changes: { element: string; baseVal: string; targetVal: string; isChanged: boolean; note: string }[] = [];

    // 1. Wind (DD/FF)
    const baseWind = `${base.wind.direction}/${String(base.wind.speed).padStart(2, '0')}${base.wind.unit || 'KT'}`;
    const targetWind = cond.wind
      ? `${cond.wind.direction}/${String(cond.wind.speed).padStart(2, '0')}${cond.wind.unit || 'KT'}`
      : baseWind;
    changes.push({
      element: 'Gió (DD/FF)',
      baseVal: baseWind,
      targetVal: targetWind,
      isChanged: !!cond.wind,
      note: cond.wind ? 'Đổi hướng/tốc độ gió sau BECMG' : 'Không đổi'
    });

    // 2. Visibility (VV)
    const baseVis = base.isCavok ? 'CAVOK (≥10km)' : `${base.visibility}m`;
    const targetVis = cond.isCavok ? 'CAVOK (≥10km)' : (cond.visibility !== undefined ? `${cond.visibility}m` : baseVis);
    changes.push({
      element: 'Tầm nhìn (VV)',
      baseVal: baseVis,
      targetVal: targetVis,
      isChanged: cond.visibility !== undefined || !!cond.isCavok,
      note: (cond.visibility !== undefined || !!cond.isCavok) ? 'Đổi tầm nhìn sau BECMG' : 'Không đổi'
    });

    // 3. Weather (WW)
    const baseWx = base.weather || 'NIL';
    const targetWx = cond.isCavok ? 'NIL' : (cond.weather !== undefined ? (cond.weather === 'NSW' ? 'NIL (NSW)' : cond.weather) : baseWx);
    changes.push({
      element: 'Thời tiết (WW)',
      baseVal: baseWx,
      targetVal: targetWx,
      isChanged: cond.weather !== undefined || !!cond.isCavok,
      note: (cond.weather !== undefined || !!cond.isCavok) ? 'Đổi hiện tượng thời tiết sau BECMG' : 'Không đổi'
    });

    // 4. Cloud (CC/HH)
    const baseCloud = base.isCavok ? 'CAVOK' : (base.isNsc ? 'NSC' : base.clouds.map(c => `${c.amount}${c.height !== null ? String(c.height / 100).padStart(3, '0') : ''}`).join(' '));
    const targetCloud = cond.isCavok ? 'CAVOK' : (cond.isNsc ? 'NSC' : (cond.clouds && cond.clouds.length > 0 ? cond.clouds.map(c => `${c.amount}${c.height !== null ? String(c.height / 100).padStart(3, '0') : ''}`).join(' ') : baseCloud));
    changes.push({
      element: 'Mây (CC/HH)',
      baseVal: baseCloud || 'NSC',
      targetVal: targetCloud || 'NSC',
      isChanged: cond.clouds !== undefined || !!cond.isNsc || !!cond.isCavok,
      note: (cond.clouds !== undefined || !!cond.isNsc || !!cond.isCavok) ? 'Đổi lượng mây / trần mây sau BECMG' : 'Không đổi'
    });

    return changes;
  };

  const becmgChanges = getBecmgElementChanges();

  const getCellClassName = (isBecmg?: boolean) => {
    return `px-2 py-1.5 border-r border-b border-slate-200 text-center font-mono text-xs text-slate-800 ${
      isBecmg ? 'bg-indigo-50/50 font-bold text-indigo-900' : 'bg-white'
    }`;
  };

  const getGroupBadge = (label?: string, phase?: string) => {
    if (label === 'BECMG') {
      if (phase === 'TRANSITION') {
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200" title="Đang trong khung giờ chuyển tiếp BECMG (cho phép cả 2 trạng thái trước và sau)">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
            BECMG
          </span>
        );
      }
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200" title="Áp dụng điều kiện BECMG cố định">
          BECMG
        </span>
      );
    }
    if (label === 'TEMPO') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200" title="Biến đổi tạm thời TEMPO">
          TEMPO
        </span>
      );
    }
    if (label === 'FM') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200" title="Thay đổi từ thời điểm FM">
          FM
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-500 border border-slate-200" title="Điều kiện dự báo ban đầu">
        BASE
      </span>
    );
  };

  return (
    <div className="space-y-6 font-sans">
      {/* TAF Selector if multiple exist */}
      {evaluationResults.length > 1 && (
        <div className="flex items-center gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs font-semibold">
          <span className="text-slate-700">CHỌN BẢN TIN TAF ĐỂ XEM:</span>
          <select
            id="taf-select"
            value={selectedTafIndex}
            onChange={(e) => setSelectedTafIndex(parseInt(e.target.value, 10))}
            className="text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500 font-bold cursor-pointer shadow-2xs"
          >
            {evaluationResults.map((r, idx) => (
              <option key={idx} value={idx}>
                {r.taf.station} - Valid: {String(r.taf.validStartDay).padStart(2, '0')}{String(r.taf.validStartHour).padStart(2, '0')}Z ({r.taf.changeGroups.length > 0 ? `${r.taf.changeGroups.length} nhóm biến đổi: ${r.taf.changeGroups.map(g => g.type).join(', ')}` : 'Base TAF'})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Title area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-100 gap-2">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-600" />
          <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider font-sans flex items-center gap-1.5 flex-wrap">
            <span>BẢN TIN TAF: {taf.station} - NGÀY {String(taf.validStartDay).padStart(2, '0')}</span>
            <span className="text-[10px] text-slate-400 font-normal normal-case italic font-mono">(Hiệu lực {String(taf.validStartHour).padStart(2, '0')}00Z - {String(taf.validEndHour).padStart(2, '0')}00Z)</span>
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${
            overallAccuracy > 84 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}>
            ĐỘ CHÍNH XÁC TOÀN BỘ BẢN TIN: {overallAccuracy}% ({overallAccuracy > 84 ? 'ĐẠT' : 'KHÔNG ĐẠT'})
          </span>
        </div>
      </div>

      {/* Change Groups (BECMG / TEMPO / FM) Detection Card */}
      <div className="bg-gradient-to-r from-indigo-50/80 via-white to-sky-50/50 border border-indigo-200/80 rounded-xl p-4 shadow-3xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-950 font-bold text-xs uppercase tracking-wider">
            <RefreshCw className="w-4 h-4 text-indigo-600" />
            <span>NHÓM BIẾN ĐỔI PHÁT HIỆN TRONG BẢN TIN (BECMG / TEMPO / FM)</span>
          </div>
          <span className="text-[10px] font-mono bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-bold">
            {taf.changeGroups.length} nhóm
          </span>
        </div>

        {taf.changeGroups.length > 0 ? (
          <div className="space-y-2 pt-1">
            {taf.changeGroups.map((group, gIdx) => (
              <div key={gIdx} className="bg-white border border-indigo-150 p-2.5 rounded-lg text-xs space-y-1 shadow-3xs">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      {group.raw || `${group.type} ${String(group.startHour).padStart(2, '0')}/${String(group.endHour).padStart(2, '0')}`}
                    </span>
                    <span className="font-semibold text-slate-700 text-[11px]">
                      {group.description}
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Đã tích hợp đánh giá
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">
            Bản tin này có điều kiện dự báo thời tiết ổn định (Base TAF), không chứa nhóm biến đổi BECMG/TEMPO/FM.
          </p>
        )}
      </div>

      {/* DEDICATED BECMG EVALUATION SECTION ACCORDING TO SPECIFICATION */}
      {becmgEvaluations && becmgEvaluations.length > 0 && (
        <div className="space-y-5">
          <div className="border-b border-indigo-200 pb-2">
            <h4 className="text-xs sm:text-sm font-extrabold text-indigo-950 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              ĐẶC TẢ ĐÁNH GIÁ THUẬT NGỮ BECMG (THEO QUY TẮC NGHIỆP VỤ)
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Phân tách độc lập hai lớp: (1) Tuân thủ quy tắc ICAO; (2) Đánh giá chất lượng dự báo 4 bước (Target Hit, Timing Hit, Persistence, Score).
            </p>
          </div>

          {becmgEvaluations.map((becmgEval, bIdx) => (
            <div key={bIdx} className="bg-white border-2 border-indigo-200/90 rounded-2xl p-5 shadow-xs space-y-4">
              {/* Header Box of this BECMG */}
              <div className="bg-slate-900 text-white p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-indigo-500 text-white font-mono font-bold text-xs">
                      {becmgEval.raw}
                    </span>
                    <span className="text-xs font-bold text-indigo-200 uppercase">
                      Cửa sổ: {String(becmgEval.startHour).padStart(2, '0')}:00Z - {String(becmgEval.endHour).padStart(2, '0')}:00Z ({becmgEval.durationHours} giờ)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Mã cửa sổ: <code className="text-amber-300 font-bold font-mono">[{becmgEval.windowStatus}]</code> • Mã phân loại: <code className="text-sky-300 font-bold font-mono">[{becmgEval.classificationCode}]</code>
                  </p>
                </div>

                <div className="flex items-center gap-4 bg-slate-800/90 p-2.5 rounded-lg border border-slate-700 self-stretch md:self-auto justify-between">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">ĐIỂM DỰ BÁO BECMG</span>
                    <span className="text-xl font-black text-amber-400 font-mono">{becmgEval.overallScore}%</span>
                  </div>
                  <div className="border-l border-slate-700 pl-3">
                    <span className={`inline-block px-2 py-1 rounded text-[10px] font-bold ${
                      becmgEval.statusCode === 'BGMG_FULL_HIT' ? 'bg-emerald-900/80 text-emerald-300 border border-emerald-600' :
                      becmgEval.statusCode === 'BGMG_PARTIAL' ? 'bg-blue-900/80 text-blue-300 border border-blue-600' :
                      'bg-rose-900/80 text-rose-300 border border-rose-600'
                    }`}>
                      {becmgEval.statusCode}
                    </span>
                  </div>
                </div>
              </div>

              {/* Layer 1: ICAO Compliance Note */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                  becmgEval.icaoCompliant ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' : 'bg-rose-50/80 border-rose-200 text-rose-900'
                }`}>
                  {becmgEval.icaoCompliant ? (
                    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <strong className="block font-bold uppercase text-[11px]">
                      1. TUÂN THỦ QUY TẮC ICAO (CỬA SỔ THỜI GIAN):
                    </strong>
                    <p className="text-[11px] mt-0.5">{becmgEval.icaoNotes}</p>
                    <p className="text-[10px] text-slate-500 mt-1 italic">
                      * Kết quả tuân thủ ICAO và điểm chất lượng dự báo là hai kết quả độc lập (Nguyên tắc 10).
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-indigo-150 bg-indigo-50/50 text-indigo-950 flex items-start gap-2.5">
                  <Award className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold uppercase text-[11px]">
                      2. CÔNG THỨC TÍNH ĐIỂM DỰ BÁO:
                    </strong>
                    <p className="text-[11px] font-mono mt-0.5 font-bold">
                      Sᵢ = Hᵢ × Tᵢ × Pᵢ &nbsp;•&nbsp; Score_BECMG = Σ(wᵢ × Sᵢ) / Σwᵢ
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      H: Target Hit (0/1) • T: Timing Hit (0/1) • P: Persistence (0–1).
                    </p>
                  </div>
                </div>
              </div>

              {/* Layer 2: 4-Step Evaluation Table for each element */}
              <div className="space-y-2">
                <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  Bảng đối chiếu 4 bước từng yếu tố mục tiêu trong nhóm BECMG
                </h5>

                <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-3xs">
                  <table className="w-full border-collapse bg-white text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-center">
                        <th className="p-2.5 border-r border-slate-200 text-left w-36">Yếu tố (Element)</th>
                        <th className="p-2.5 border-r border-slate-200 text-center w-36">Mục tiêu (Target)</th>
                        <th className="p-2.5 border-r border-slate-200 text-center w-32">Bước 1: Target Hit (H)</th>
                        <th className="p-2.5 border-r border-slate-200 text-center">Bước 2: Khoảng chuyển đổi & Timing (T)</th>
                        <th className="p-2.5 border-r border-slate-200 text-center w-36">Bước 3: Mức duy trì (P)</th>
                        <th className="p-2.5 border-r border-slate-200 text-center w-24">Điểm (Sᵢ)</th>
                        <th className="p-2.5 text-left w-48">Đánh giá nghiệp vụ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {becmgEval.elementEvaluations.map((elEval, eIdx) => (
                        <tr key={eIdx} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                          <td className="p-2.5 border-r border-slate-100 font-bold text-slate-800">
                            {elEval.elementName}
                          </td>
                          <td className="p-2.5 border-r border-slate-100 font-mono font-bold text-center text-indigo-700 bg-indigo-50/20">
                            {elEval.targetVal}
                          </td>
                          <td className="p-2.5 border-r border-slate-100 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                              elEval.targetHit ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}>
                              {elEval.targetHit ? 'ĐẠT (TRUE)' : 'KHÔNG (FALSE)'}
                            </span>
                            <span className="block text-[9px] text-slate-400 font-mono mt-0.5">[{elEval.targetHitCode}]</span>
                          </td>
                          <td className="p-2.5 border-r border-slate-100 text-center">
                            <code className="text-slate-800 font-mono text-[11px] font-bold block bg-slate-50 px-1 py-0.5 rounded">
                              {elEval.transitionIntervalStr}
                            </code>
                            <div className="mt-1 flex items-center justify-center gap-1.5">
                              <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                elEval.timingHit ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'
                              }`}>
                                {elEval.timingHit ? 'Giao với cửa sổ: ĐÚNG' : 'Sai cửa sổ'}
                              </span>
                              <span className="text-[9px] text-slate-400 font-mono">[{elEval.timingHitCode}]</span>
                            </div>
                          </td>
                          <td className="p-2.5 border-r border-slate-100 text-center">
                            <span className="font-mono font-bold text-slate-800 text-[11px] block">
                              P = {elEval.persistence} ({(elEval.persistence * 100).toFixed(0)}%)
                            </span>
                            <span className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded mt-0.5 border ${
                              elEval.persistence >= 0.5 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {elEval.persistenceCode}
                            </span>
                          </td>
                          <td className="p-2.5 border-r border-slate-100 text-center font-mono font-bold text-sm">
                            <span className={elEval.score >= 70 ? 'text-emerald-600' : elEval.score >= 50 ? 'text-amber-600' : 'text-rose-600'}>
                              {elEval.score}%
                            </span>
                          </td>
                          <td className="p-2.5 text-[11px] text-slate-600">
                            {elEval.summaryStatus}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50/90 font-bold border-t-2 border-slate-200">
                        <td colSpan={5} className="p-2.5 text-right uppercase text-slate-700 text-xs">
                          ĐIỂM TRUNG BÌNH CHẤT LƯỢNG NHÓM BECMG:
                        </td>
                        <td className="p-2.5 text-center font-mono text-base font-black text-indigo-700 border-r border-slate-200">
                          {becmgEval.overallScore}%
                        </td>
                        <td className="p-2.5 text-xs font-bold text-indigo-900">
                          Mã: [{becmgEval.statusCode}] • [{becmgEval.classificationCode}]
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* BECMG Elements Change Comparison Summary */}
      {becmgGroup && becmgChanges.length > 0 && (
        <div className="bg-gradient-to-r from-indigo-50/90 via-white to-blue-50/60 border border-indigo-200 rounded-xl p-4 shadow-3xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100 pb-2">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin-slow" />
              <h4 className="text-xs sm:text-sm font-bold text-indigo-950 uppercase tracking-wide">
                ĐỐI CHIẾU SỰ THAY ĐỔI CÁC YẾU TỐ DO THUẬT NGỮ BECMG TRONG BẢN TIN TAF
              </h4>
            </div>
            <span className="text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-md border border-indigo-200 self-start sm:self-auto">
              Cửa sổ BECMG: {String(becmgGroup.startHour).padStart(2, '0')}:00Z ➔ {String(becmgGroup.endHour).padStart(2, '0')}:00Z
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
            {becmgChanges.map((item, cIdx) => (
              <div
                key={cIdx}
                className={`p-2.5 rounded-lg border transition-all ${
                  item.isChanged
                    ? 'bg-indigo-50/80 border-indigo-200 text-indigo-950 shadow-3xs'
                    : 'bg-slate-50/80 border-slate-200 text-slate-600'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-[11px] text-slate-800">{item.element}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                    item.isChanged ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>
                    {item.isChanged ? 'CÓ ĐỔI' : 'KHÔNG ĐỔI'}
                  </span>
                </div>
                <div className="font-mono text-[11px] space-y-0.5">
                  <div className="text-slate-500 flex justify-between">
                    <span>Trước:</span> <span className="font-semibold text-slate-700">{item.baseVal}</span>
                  </div>
                  <div className={`flex justify-between ${item.isChanged ? 'text-indigo-700 font-bold' : 'text-slate-600'}`}>
                    <span>Sau:</span> <span>{item.targetVal}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-500 italic">
            * Trong bảng 12 giờ bên dưới: Các ô TAF có nhãn <strong className="text-indigo-700">BECMG</strong> (chuyển tiếp) hoặc <strong className="text-blue-700">MỚI</strong> (sau biến đổi) hiển thị trực tiếp giá trị đã thay đổi từ nhóm BECMG.
          </p>
        </div>
      )}

      {/* Main Table Matching LongTAF_MAU.docx exactly with Change Group indicators */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-indigo-600" />
            Bảng đánh giá chi tiết 12 giờ cho từng bản tin TAF
          </h4>
          <span className="text-[10px] text-slate-400 italic">
            * Cột giờ có nhãn BECMG áp dụng điều kiện chuyển tiếp và điều kiện mới theo tiêu chuẩn ICAO Annex 3
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
          <table className="w-full border-collapse bg-white table-fixed" style={{ minWidth: '1000px' }}>
            <thead>
              {/* Row 1 Header: Time UTC */}
              <tr className="bg-slate-900 text-white">
                <th colSpan={2} className="w-[130px] min-w-[130px] px-3 py-2 border-b border-r border-slate-800 font-bold text-left text-xs uppercase">
                  Time UTC
                </th>
                {evaluations.map((h, i) => (
                  <th key={i} className="w-[52px] min-w-[52px] px-1 py-2 border-b border-r border-slate-800 font-mono font-bold text-center text-xs">
                    {h.timeStr}
                  </th>
                ))}
                <th className="w-[55px] min-w-[55px] px-2 py-2 border-b border-r border-slate-800 font-bold text-center text-xs">
                  %
                </th>
                <th className="w-[185px] min-w-[185px] px-3 py-2 border-b border-slate-800 font-bold text-center text-xs">
                  Accuracy
                </th>
              </tr>

              {/* Row 2 Header: Change Group Indicator Row (BECMG / BASE / TEMPO) */}
              <tr className="bg-slate-100 border-b border-slate-200">
                <th colSpan={2} className="px-2 py-1.5 border-r border-slate-200 font-bold text-left text-[10px] text-slate-500 uppercase">
                  Nhóm TAF
                </th>
                {evaluations.map((h, i) => (
                  <th key={i} className="w-[52px] min-w-[52px] px-0.5 py-1.5 border-r border-slate-200 text-center">
                    {getGroupBadge(h.changeGroupLabel, h.changeGroupPhase)}
                  </th>
                ))}
                <th className="w-[55px] min-w-[55px] px-1 py-1.5 border-r border-slate-200 text-center font-mono text-[10px] text-slate-500">
                  TB
                </th>
                <th className="w-[185px] min-w-[185px] px-2 py-1.5 text-center text-[10px] text-slate-500 font-bold">
                  TỔNG HỢP
                </th>
              </tr>

              {/* Row 3 Header: Element and Type label */}
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="w-[70px] min-w-[70px] px-3 py-1 border-r border-slate-200 font-bold text-left text-[10px] text-slate-400 uppercase font-sans">
                  Element
                </th>
                <th className="w-[60px] min-w-[60px] px-2 py-1 border-r border-slate-200 font-bold text-center text-[10px] text-slate-400 uppercase font-sans">
                  Type
                </th>
                {evaluations.map((_, i) => (
                  <th key={i} className="w-[52px] min-w-[52px] px-1 py-1 border-r border-slate-200"></th>
                ))}
                <th className="w-[55px] min-w-[55px] px-1 py-1 border-r border-slate-200"></th>
                <th className="w-[185px] min-w-[185px]"></th>
              </tr>
            </thead>
            <tbody>
              {/* Loop through each element and build 2 rows: TAF and METAR */}
              {(['DD', 'FF', 'VV', 'WW', 'CC', 'HH'] as const).map((element, elIdx) => {
                return (
                  <React.Fragment key={element}>
                    {/* TAF Row */}
                    <tr className="border-b border-slate-200">
                      <td rowSpan={2} className="px-3 py-2 border-r border-b border-slate-200 font-bold text-slate-700 text-xs text-center bg-slate-50 font-sans">
                        {element}
                      </td>
                      <td className="px-2 py-1.5 border-r border-b border-slate-200 text-center font-bold text-[10px] text-slate-500 bg-slate-50/50 font-mono">
                        TAF
                      </td>
                      {evaluations.map((h, hIdx) => {
                        const elObj = h.elements[element];
                        const isTransition = elObj.isBecmgTransition;
                        const isAfter = h.changeGroupPhase === 'AFTER' && elObj.isBecmgChanged;

                        let cellClass = 'px-1 py-1.5 border-r border-b border-slate-200 text-center font-mono text-xs transition-colors ';
                        if (isTransition && elObj.isBecmgChanged) {
                          cellClass += 'bg-indigo-50/90 text-indigo-950 font-bold';
                        } else if (isTransition) {
                          cellClass += 'bg-indigo-50/40 text-slate-800';
                        } else if (isAfter) {
                          cellClass += 'bg-blue-50/70 text-blue-950 font-bold';
                        } else {
                          cellClass += 'bg-white text-slate-800';
                        }

                        return (
                          <td
                            key={hIdx}
                            className={cellClass}
                            title={
                              elObj.isBecmgChanged
                                ? (isTransition
                                    ? `Chuyển tiếp BECMG: ${elObj.becmgBaseVal || 'Gốc'} ➔ ${elObj.tafVal}`
                                    : `Sau BECMG: ${elObj.tafVal}`)
                                : `Dự báo TAF: ${elObj.tafVal}`
                            }
                          >
                            <span className={elObj.isBecmgChanged ? 'font-bold' : ''}>
                              {elObj.tafVal}
                            </span>
                            {elObj.isBecmgChanged && isTransition && (
                              <span className="block text-[8px] font-sans font-bold text-indigo-600 leading-none mt-0.5 uppercase tracking-tighter">
                                BECMG
                              </span>
                            )}
                            {elObj.isBecmgChanged && isAfter && (
                              <span className="block text-[8px] font-sans font-bold text-blue-600 leading-none mt-0.5 uppercase tracking-tighter">
                                MỚI
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td rowSpan={2} className="px-2 py-2 border-r border-b border-slate-200 font-bold text-center text-xs text-slate-800 bg-slate-50/40 font-mono">
                        {elementAccuracy[element]}%
                      </td>
                      {elIdx === 0 && (
                        <td rowSpan={12} className="px-3 py-4 border-l border-slate-200 text-left bg-slate-900 text-slate-200 font-bold" style={{ verticalAlign: 'top' }}>
                          <div className="font-sans text-xs space-y-4">
                            <p className="font-black text-sm border-b border-slate-800 pb-2.5 text-white uppercase tracking-wider font-display">
                              Accuracy = {overallAccuracy} %
                            </p>
                            <div className="pt-1.5 space-y-2 text-slate-400 font-mono">
                              <p className="flex justify-between"><span>DD</span> <span>= {elementAccuracy.DD} %</span></p>
                              <p className="flex justify-between"><span>FF</span> <span>= {elementAccuracy.FF} %</span></p>
                              <p className="flex justify-between"><span>VV</span> <span>= {elementAccuracy.VV} %</span></p>
                              <p className="flex justify-between"><span>WW</span> <span>= {elementAccuracy.WW} %</span></p>
                              <p className="flex justify-between"><span>CC</span> <span>= {elementAccuracy.CC} %</span></p>
                              <p className="flex justify-between"><span>HH</span> <span>= {elementAccuracy.HH} %</span></p>
                            </div>
                            <div className="pt-3 border-t border-slate-800 text-[10px] text-slate-400 font-sans space-y-1">
                              <p className="font-semibold text-slate-300">Ghi chú đánh giá:</p>
                              <p>• Cột có nền xanh nhạt: Áp dụng điều kiện chuyển tiếp BECMG.</p>
                              <p>• Tiêu chuẩn đạt ICAO: &gt; 84%.</p>
                            </div>
                          </div>
                        </td>
                      )}
                    </tr>

                    {/* METAR Row */}
                    <tr className="border-b border-slate-200">
                      <td className="px-2 py-1.5 border-r border-b border-slate-200 text-center font-bold text-[10px] text-slate-500 bg-slate-50/50 font-mono">
                        METAR
                      </td>
                      {evaluations.map((h, hIdx) => (
                        <td key={hIdx} className="px-2 py-1.5 border-r border-b border-slate-200 text-center font-mono text-xs text-slate-700 bg-white">
                          {h.elements[element].metarVal}
                        </td>
                      ))}
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Note and original TAF block */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 shadow-3xs">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
          Note: DD-Direction; FF-Speed; VV-Visibility; WW-Weather; CC-Amount; HH-Height
        </p>
        <div className="border-t border-slate-200 pt-3">
          <span className="text-[11px] font-bold text-slate-700 block mb-1.5 uppercase">Bản tin TAF gốc (Original Bulletin):</span>
          <code className="text-xs font-mono text-indigo-700 block bg-white border border-slate-200 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-3xs">
            {taf.raw}
          </code>
        </div>
        <div className="text-[9px] uppercase font-mono opacity-50 flex justify-between">
          <p>Accuracy Calculation: (Matches / Total OBS) * 100</p>
          <p>Thuật ngữ BECMG được kiểm tra cửa sổ ICAO và đánh giá 4 bước (H x T x P) theo đặc tả nghiệp vụ</p>
        </div>
      </div>
    </div>
  );
}
