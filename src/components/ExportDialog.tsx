import React, { useState, useEffect } from 'react';
import { TafEvaluationResult } from '../types';
import { Download, X, FileEdit, FileCode, Printer, CheckCircle2, Award, Calendar, Plane } from 'lucide-react';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  evaluationResults: TafEvaluationResult[];
  referenceMonthYear?: string;
  monthYearForFile?: string;
  fileHeader?: string;
  initialReportType?: 'detail' | 'summary';
}

const getAirportFullName = (code: string) => {
  switch (code.toUpperCase()) {
    case 'VVNB': return 'Cảng hàng không Quốc tế Nội Bài';
    case 'VVTS': return 'Cảng hàng không Quốc tế Tân Sơn Nhất';
    case 'VVDN': return 'Cảng hàng không Quốc tế Đà Nẵng';
    case 'VVCR': return 'Cảng hàng không Quốc tế Cam Ranh';
    case 'VVPB': return 'Cảng hàng không Quốc tế Phú Bài';
    case 'VVCI': return 'Cảng hàng không Quốc tế Cát Bi';
    case 'VVCU': return 'Cảng hàng không Pleiku';
    case 'VVCT': return 'Cảng hàng không Quốc tế Cần Thơ';
    case 'VVBM': return 'Cảng hàng không Buôn Ma Thuột';
    case 'VVDH': return 'Cảng hàng không Đồng Hới';
    case 'VVDL': return 'Cảng hàng không Liên Khương';
    case 'VVPC': return 'Cảng hàng không Phù Cát';
    case 'VVTH': return 'Cảng hàng không Thọ Xuân';
    case 'VVVH': return 'Cảng hàng không Quốc tế Vinh';
    case 'VVPQ': return 'Cảng hàng không Quốc tế Phú Quốc';
    case 'VVVD': return 'Cảng hàng không Quốc tế Vân Đồn';
    case 'VVCS': return 'Cảng hàng không Côn Đảo';
    case 'VVDB': return 'Cảng hàng không Điện Biên Phủ';
    case 'VVRG': return 'Cảng hàng không Rạch Giá';
    case 'VVTX': return 'Cảng hàng không Thọ Xuân';
    case 'VVTL': return 'Cảng hàng không Tuy Hòa';
    default: return `Sân bay ${code.toUpperCase()}`;
  }
};

export default function ExportDialog({ 
  isOpen, 
  onClose, 
  evaluationResults, 
  referenceMonthYear = "Tháng đánh giá",
  monthYearForFile,
  fileHeader,
  initialReportType = 'detail'
}: ExportDialogProps) {
  const [reportType, setReportType] = useState<'detail' | 'summary'>('detail');
  const [format, setFormat] = useState<'.docx' | '.html' | '.pdf'>('.docx');

  // Synchronize reportType with the active tab when dialog opens
  useEffect(() => {
    if (isOpen) {
      setReportType(initialReportType);
    }
  }, [isOpen, initialReportType]);

  if (!isOpen) return null;

  // Extract unique airport station codes
  const uniqueStations = Array.from(new Set(evaluationResults.map(r => r.taf.station.toUpperCase()))).sort();
  const stationCodesStr = uniqueStations.length > 0 ? uniqueStations.join('_') : 'SANBAY';

  // Format monthYear for filename (e.g. 10_2026 or Thang_10_2026)
  const extractCleanMonthYearForFilename = (): string => {
    if (monthYearForFile && monthYearForFile.trim()) {
      return monthYearForFile.replace(/[^a-zA-Z0-9_]/g, '_');
    }
    // Match "tháng XX/YYYY" or "XX/YYYY"
    const m1 = referenceMonthYear.match(/tháng\s*(\d{1,2})\s*(?:năm|\/|\-)\s*(\d{2,4})/i);
    if (m1) {
      const month = m1[1].padStart(2, '0');
      const year = m1[2].length === 2 ? `20${m1[2]}` : m1[2];
      return `${month}_${year}`;
    }
    const m2 = referenceMonthYear.match(/\b(\d{1,2})[\/\-](\d{4})\b/);
    if (m2) {
      return `${m2[1].padStart(2, '0')}_${m2[2]}`;
    }
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, '0')}_${now.getFullYear()}`;
  };

  const cleanMonthYearStr = extractCleanMonthYearForFilename();

  // Generate the suggested file base name (without extension)
  const getExportFileName = (): string => {
    const prefix = reportType === 'detail' ? 'Chi_tiet_TAF' : 'Tong_hop_TAF';
    return `${prefix}_${stationCodesStr}_${cleanMonthYearStr}`;
  };

  // Group evaluation results by airport (station)
  const groupedByStation: { [station: string]: TafEvaluationResult[] } = {};
  evaluationResults.forEach(r => {
    const station = r.taf.station.toUpperCase();
    if (!groupedByStation[station]) {
      groupedByStation[station] = [];
    }
    groupedByStation[station].push(r);
  });

  // Calculate detailed stats per station
  const stationStatsList = Object.keys(groupedByStation).map(station => {
    const stationResults = groupedByStation[station];
    const totalReports = stationResults.length;

    // Group by day for daily averages
    const groupedByDay: { [day: number]: TafEvaluationResult[] } = {};
    stationResults.forEach(r => {
      const d = r.taf.validStartDay;
      if (!groupedByDay[d]) groupedByDay[d] = [];
      groupedByDay[d].push(r);
    });

    const dailyBreakdown = Object.keys(groupedByDay).map(dayStr => {
      const day = parseInt(dayStr, 10);
      const reports = groupedByDay[day];
      const avgScore = Math.round(reports.reduce((sum, r) => sum + r.overallAccuracy, 0) / reports.length);
      return {
        day,
        reports,
        avgScore,
        isPassed: avgScore > 84
      };
    }).sort((a, b) => a.day - b.day);

    const totalDays = dailyBreakdown.length;
    const passedDays = dailyBreakdown.filter(d => d.isPassed).length;
    const failedDays = totalDays - passedDays;

    const elementAverages = {
      DD: Math.round(stationResults.reduce((sum, r) => sum + r.elementAccuracy.DD, 0) / totalReports),
      FF: Math.round(stationResults.reduce((sum, r) => sum + r.elementAccuracy.FF, 0) / totalReports),
      VV: Math.round(stationResults.reduce((sum, r) => sum + r.elementAccuracy.VV, 0) / totalReports),
      WW: Math.round(stationResults.reduce((sum, r) => sum + r.elementAccuracy.WW, 0) / totalReports),
      CC: Math.round(stationResults.reduce((sum, r) => sum + r.elementAccuracy.CC, 0) / totalReports),
      HH: Math.round(stationResults.reduce((sum, r) => sum + r.elementAccuracy.HH, 0) / totalReports),
    };

    const overallAccuracyStation = Math.round(stationResults.reduce((sum, r) => sum + r.overallAccuracy, 0) / totalReports);
    const isStationPassed = overallAccuracyStation > 84;

    return {
      station,
      stationName: getAirportFullName(station),
      results: stationResults,
      totalReports,
      totalDays,
      passedDays,
      failedDays,
      dailyBreakdown,
      elementAverages,
      overallAccuracy: overallAccuracyStation,
      isPassed: isStationPassed
    };
  }).sort((a, b) => a.station.localeCompare(b.station));

  // Global calculations
  const grandTotalReports = evaluationResults.length;
  const grandTotalDays = stationStatsList.reduce((sum, s) => sum + s.totalDays, 0);
  const grandPassedDays = stationStatsList.reduce((sum, s) => sum + s.passedDays, 0);
  const grandFailedDays = grandTotalDays - grandPassedDays;
  const grandOverallAverage = grandTotalReports > 0
    ? Math.round(evaluationResults.reduce((sum, r) => sum + r.overallAccuracy, 0) / grandTotalReports)
    : 0;

  // Generate Detail Tables HTML (grouped by airport)
  const generateDetailHtml = (): string => {
    return stationStatsList.map((stStat) => {
      const stationTafsHtml = stStat.results.map((result) => {
        const { taf, evaluations, elementAccuracy, overallAccuracy } = result;
        const changeGroupsHtml = taf.changeGroups.length > 0 ? `
          <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-left: 4px solid #4f46e5; padding: 8px 12px; margin-bottom: 12px; border-radius: 4px; font-size: 11px;">
            <strong style="color: #1e1b4b; text-transform: uppercase;">🔄 Nhóm biến đổi (BECMG / TEMPO / FM) phát hiện trong bản tin:</strong>
            <ul style="margin: 4px 0 0 0; padding-left: 18px; color: #334155;">
              ${taf.changeGroups.map(g => `
                <li>
                  <strong style="font-family: monospace; color: #4338ca;">${g.raw || g.type}</strong>: 
                  ${g.description || ''} 
                  <em>(${g.type === 'BECMG' ? 'Trong khung giờ chuyển tiếp, số liệu quan trắc phù hợp trước hoặc sau biến đổi đều được tính là ĐÚNG theo ICAO' : 'Đánh giá theo tiêu chuẩn ICAO'})</em>
                </li>
              `).join('')}
            </ul>
          </div>
        ` : '';

        return `
          <div style="margin-bottom: 35px; page-break-after: always; font-family: 'Segoe UI', Arial, sans-serif;">
            <div style="border-bottom: 2px solid #1e293b; padding-bottom: 6px; margin-bottom: 12px;">
              <h3 style="font-size: 15px; margin: 0; color: #0f172a; text-transform: uppercase;">
                ĐÁNH GIÁ CHI TIẾT BẢN TIN DỰ BÁO TAF (12 GIỜ) - ${taf.station}
              </h3>
              <p style="font-size: 12px; margin: 4px 0 0 0; color: #475569;">
                Sân bay: <strong>${taf.station} (${stStat.stationName})</strong> | 
                Ngày: <strong>${String(taf.validStartDay).padStart(2, '0')} (${referenceMonthYear})</strong> | 
                Thời hạn hiệu lực: <strong>${String(taf.validStartHour).padStart(2, '0')}00Z - ${String(taf.validEndHour).padStart(2, '0')}00Z</strong> |
                Độ chính xác: <strong style="color: ${overallAccuracy > 84 ? '#166534' : '#991b1b'};">${overallAccuracy}% (${overallAccuracy > 84 ? 'ĐẠT' : 'KHÔNG ĐẠT'})</strong>
              </p>
            </div>

            ${changeGroupsHtml}

            ${(result.becmgEvaluations && result.becmgEvaluations.length > 0) ? `
              <div style="margin-bottom: 20px; background-color: #faf5ff; border: 1px solid #d8b4fe; border-radius: 6px; padding: 10px 14px;">
                <h4 style="margin: 0 0 6px 0; font-size: 13px; color: #581c87; text-transform: uppercase;">
                  📊 ĐẶC TẢ ĐÁNH GIÁ CHẤT LƯỢNG THUẬT NGỮ BECMG (THEO QUY TẮC NGHIỆP VỤ)
                </h4>
                <p style="margin: 0 0 10px 0; font-size: 11px; color: #4b5563;">
                  Tách biệt hai lớp: (1) Tuân thủ quy tắc ICAO; (2) Đánh giá chất lượng dự báo 4 bước: Target Hit (H) × Timing Hit (T) × Persistence (P).
                </p>
                ${result.becmgEvaluations.map(be => `
                  <div style="background-color: #ffffff; border: 1px solid #e9d5ff; border-radius: 4px; padding: 10px; margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #f3e8ff; padding-bottom: 6px;">
                      <div>
                        <strong style="font-family: monospace; font-size: 12px; color: #6b21a8;">${be.raw}</strong>
                        <span style="font-size: 11px; color: #4b5563; margin-left: 8px;">(Cửa sổ: ${String(be.startHour).padStart(2, '0')}:00Z - ${String(be.endHour).padStart(2, '0')}:00Z | Độ dài: ${be.durationHours}h)</span>
                      </div>
                      <div>
                        <span style="font-size: 10.5px; font-weight: bold; padding: 2px 6px; border-radius: 3px; background-color: ${be.icaoCompliant ? '#dcfce7; color: #166534;' : '#fee2e2; color: #991b1b;'}">
                          ICAO: ${be.windowStatus} (${be.icaoCompliant ? 'ĐẠT' : 'KHÔNG ĐẠT'})
                        </span>
                        <strong style="margin-left: 8px; font-size: 11.5px; color: #6b21a8;">Điểm BECMG: ${be.overallScore}% [${be.statusCode}]</strong>
                      </div>
                    </div>
                    <table style="width: 100%; border-collapse: collapse; font-size: 10.5px;">
                      <thead>
                        <tr style="background-color: #f5f3ff; text-align: center;">
                          <th style="padding: 5px; border: 1px solid #e9d5ff; text-align: left;">Yếu tố</th>
                          <th style="padding: 5px; border: 1px solid #e9d5ff;">Mục tiêu (Target)</th>
                          <th style="padding: 5px; border: 1px solid #e9d5ff;">Target Hit (H)</th>
                          <th style="padding: 5px; border: 1px solid #e9d5ff;">Khoảng chuyển đổi & Timing (T)</th>
                          <th style="padding: 5px; border: 1px solid #e9d5ff;">Mức duy trì (P)</th>
                          <th style="padding: 5px; border: 1px solid #e9d5ff;">Điểm Sᵢ = H×T×P</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${be.elementEvaluations.map(ee => `
                          <tr>
                            <td style="padding: 5px; border: 1px solid #e9d5ff; font-weight: bold;">${ee.elementName}</td>
                            <td style="padding: 5px; border: 1px solid #e9d5ff; font-family: monospace; text-align: center;">${ee.targetVal}</td>
                            <td style="padding: 5px; border: 1px solid #e9d5ff; text-align: center; color: ${ee.targetHit ? '#166534' : '#991b1b'}; font-weight: bold;">${ee.targetHit ? 'ĐẠT (H=1)' : 'KHÔNG (H=0)'}</td>
                            <td style="padding: 5px; border: 1px solid #e9d5ff; text-align: center; font-family: monospace;">${ee.transitionIntervalStr} <span style="font-weight: bold; color: ${ee.timingHit ? '#166534' : '#991b1b'};">(${ee.timingHit ? 'T=1: Giao cửa sổ' : 'T=0: Sai cửa sổ'})</span></td>
                            <td style="padding: 5px; border: 1px solid #e9d5ff; text-align: center; font-family: monospace;">P = ${ee.persistence} (${ee.persistenceCode})</td>
                            <td style="padding: 5px; border: 1px solid #e9d5ff; text-align: center; font-weight: bold; font-family: monospace; color: ${ee.score >= 70 ? '#166534' : '#991b1b'};">${ee.score}%</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                `).join('')}
              </div>
            ` : ''}

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11px;">
              <thead>
                <tr style="background-color: #f1f5f9;">
                  <th colspan="2" style="border: 1px solid #cbd5e1; padding: 6px; text-align: left; font-weight: bold; width: 130px;">Time UTC</th>
                  ${evaluations.map(h => `<th style="border: 1px solid #cbd5e1; padding: 4px; text-align: center; font-weight: bold; font-family: monospace;">${h.timeStr}</th>`).join('')}
                  <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; font-weight: bold; width: 45px;">%</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; font-weight: bold; width: 140px;">Accuracy</th>
                </tr>
                <tr style="background-color: #f8fafc;">
                  <th colspan="2" style="border: 1px solid #cbd5e1; padding: 4px; text-align: left; color: #64748b; font-size: 10px;">Nhóm TAF</th>
                  ${evaluations.map(h => `<th style="border: 1px solid #cbd5e1; padding: 3px 2px; text-align: center; font-size: 9px; font-weight: bold; color: ${h.changeGroupLabel === 'BECMG' ? '#4338ca' : (h.changeGroupLabel === 'TEMPO' ? '#b45309' : '#64748b')}; background-color: ${h.changeGroupLabel === 'BECMG' ? '#eef2ff' : '#f8fafc'};">${h.changeGroupLabel || 'BASE'}</th>`).join('')}
                  <th style="border: 1px solid #cbd5e1; padding: 4px; font-size: 10px; text-align: center; color: #64748b;">TB</th>
                  <th style="border: 1px solid #cbd5e1; padding: 4px; font-size: 10px; text-align: center; color: #64748b;">TỔNG HỢP</th>
                </tr>
                <tr style="background-color: #f8fafc;">
                  <th style="border: 1px solid #cbd5e1; padding: 4px; text-align: left; color: #64748b;">Element</th>
                  <th style="border: 1px solid #cbd5e1; padding: 4px; text-align: center; color: #64748b;">Type</th>
                  ${evaluations.map(() => `<th style="border: 1px solid #cbd5e1; padding: 4px;"></th>`).join('')}
                  <th style="border: 1px solid #cbd5e1; padding: 4px;"></th>
                  <th style="border: 1px solid #cbd5e1; padding: 4px;"></th>
                </tr>
              </thead>
              <tbody>
                ${(['DD', 'FF', 'VV', 'WW', 'CC', 'HH'] as const).map((el, elIdx) => {
                  return `
                    <tr>
                      <td rowspan="2" style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; font-weight: bold; background-color: #f8fafc; width: 60px;">${el}</td>
                      <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center; font-weight: bold; color: #475569;">TAF</td>
                      ${evaluations.map(h => {
                        const isAlt = h.elements[el].isBecmgTransition;
                        return `<td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center; font-family: monospace; background-color: ${isAlt ? '#eff6ff' : '#ffffff'}; color: #0f172a; font-weight: ${isAlt ? 'bold' : 'normal'};">${h.elements[el].tafVal}</td>`;
                      }).join('')}
                      <td rowspan="2" style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; font-weight: bold; width: 45px; font-family: monospace;">${elementAccuracy[el]}%</td>
                      ${elIdx === 0 ? `
                        <td rowspan="12" style="border: 1px solid #cbd5e1; padding: 10px; vertical-align: top; background-color: #f8fafc; font-family: monospace; font-size: 11px; line-height: 1.6; width: 140px;">
                          <strong style="font-size: 12px; color: #0f172a; display: block; margin-bottom: 6px;">Accuracy = ${overallAccuracy}%</strong>
                          DD = ${elementAccuracy.DD}%<br/>
                          FF = ${elementAccuracy.FF}%<br/>
                          VV = ${elementAccuracy.VV}%<br/>
                          WW = ${elementAccuracy.WW}%<br/>
                          CC = ${elementAccuracy.CC}%<br/>
                          HH = ${elementAccuracy.HH}%
                        </td>
                      ` : ''}
                    </tr>
                    <tr>
                      <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center; font-weight: bold; color: #475569;">METAR</td>
                      ${evaluations.map(h => `<td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center; font-family: monospace; color: #0f172a;">${h.elements[el].metarVal}</td>`).join('')}
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>

            <p style="font-size: 10px; color: #64748b; font-style: italic; margin-bottom: 6px;">
              Ghi chú ký hiệu: DD-Hướng gió; FF-Tốc độ gió; VV-Tầm nhìn ngang; WW-Hiện tượng thời tiết; CC-Lượng mây; HH-Độ cao chân mây.<br/>
              * Quy tắc đánh giá BECMG (ICAO Annex 3): Trong thời gian chuyển tiếp BECMG, điều kiện quan trắc phù hợp trạng thái trước hoặc sau biến đổi đều được tính là ĐÚNG.
            </p>
            <div style="border-top: 1px dashed #cbd5e1; padding-top: 6px; margin-top: 6px;">
              <span style="font-size: 11px; font-weight: bold; color: #334155;">Nội dung bản tin TAF gốc:</span>
              <code style="display: block; font-family: monospace; font-size: 11px; background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 6px 8px; border-radius: 4px; margin-top: 4px; white-space: pre-wrap;">${taf.raw}</code>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div style="margin-bottom: 40px;">
          <div style="background-color: #0f172a; color: white; padding: 10px 14px; border-radius: 6px; margin-bottom: 20px;">
            <h2 style="margin: 0; font-size: 16px; font-weight: bold;">
              ✈️ SÂN BAY: ${stStat.station} - ${stStat.stationName}
            </h2>
            <p style="margin: 4px 0 0 0; font-size: 11px; opacity: 0.9;">
              Tổng số bản tin: ${stStat.totalReports} bản tin | Đánh giá qua ${stStat.totalDays} ngày | Tỉ lệ đúng trung bình: ${stStat.overallAccuracy}%
            </p>
          </div>
          ${stationTafsHtml}
        </div>
      `;
    }).join('');
  };

  // Generate Summary Tables HTML (Separated by airport, with airport accuracy rates)
  const generateSummaryHtml = (): string => {
    // Generate individual airport summary sections
    const airportSummariesHtml = stationStatsList.map(st => {
      const dailyRows = st.results.map((r, rIdx) => {
        const isPassed = r.overallAccuracy > 84;
        return `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 7px 8px; font-size: 11px; border: 1px solid #cbd5e1; text-align: center;">${rIdx + 1}</td>
            <td style="padding: 7px 8px; font-size: 11px; border: 1px solid #cbd5e1;">Ngày ${String(r.taf.validStartDay).padStart(2, '0')} (${referenceMonthYear})</td>
            <td style="padding: 7px 8px; font-size: 11px; border: 1px solid #cbd5e1; font-family: monospace; text-align: center;">${String(r.taf.validStartHour).padStart(2, '0')}Z-${String(r.taf.validEndHour).padStart(2, '0')}Z</td>
            <td style="padding: 7px 8px; font-size: 11px; border: 1px solid #cbd5e1; font-family: monospace; text-align: center;">${r.elementAccuracy.DD}%</td>
            <td style="padding: 7px 8px; font-size: 11px; border: 1px solid #cbd5e1; font-family: monospace; text-align: center;">${r.elementAccuracy.FF}%</td>
            <td style="padding: 7px 8px; font-size: 11px; border: 1px solid #cbd5e1; font-family: monospace; text-align: center;">${r.elementAccuracy.VV}%</td>
            <td style="padding: 7px 8px; font-size: 11px; border: 1px solid #cbd5e1; font-family: monospace; text-align: center;">${r.elementAccuracy.WW}%</td>
            <td style="padding: 7px 8px; font-size: 11px; border: 1px solid #cbd5e1; font-family: monospace; text-align: center;">${r.elementAccuracy.CC}%</td>
            <td style="padding: 7px 8px; font-size: 11px; border: 1px solid #cbd5e1; font-family: monospace; text-align: center;">${r.elementAccuracy.HH}%</td>
            <td style="padding: 7px 8px; font-size: 11px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold; text-align: center; color: ${isPassed ? '#166534' : '#991b1b'};">${r.overallAccuracy}%</td>
            <td style="padding: 7px 8px; font-size: 11px; border: 1px solid #cbd5e1; font-weight: bold; text-align: center; color: ${isPassed ? '#166534' : '#991b1b'};">${isPassed ? 'ĐẠT' : 'KHÔNG ĐẠT'}</td>
          </tr>
        `;
      }).join('');

      return `
        <div style="margin-bottom: 35px; page-break-inside: avoid; font-family: 'Segoe UI', Arial, sans-serif;">
          <!-- Airport Header -->
          <div style="background-color: #f1f5f9; border-left: 5px solid #2563eb; padding: 10px 14px; margin-bottom: 12px; border-radius: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <h3 style="margin: 0; font-size: 15px; color: #0f172a; text-transform: uppercase;">
                  BẢNG THỐNG KÊ ĐÁNH GIÁ SÂN BAY: ${st.station} - ${st.stationName}
                </h3>
                <p style="margin: 3px 0 0 0; font-size: 11px; color: #475569;">
                  Thời gian đánh giá: <strong>${referenceMonthYear}</strong> | Tổng số bản tin: <strong>${st.totalReports} bản tin</strong> | Số ngày đánh giá: <strong>${st.totalDays} ngày</strong>
                </p>
              </div>
            </div>
          </div>

          <!-- Airport Daily Table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px;">
            <thead>
              <tr style="background-color: #e2e8f0; text-align: center;">
                <th style="padding: 8px; font-size: 11px; border: 1px solid #cbd5e1; width: 35px;">STT</th>
                <th style="padding: 8px; font-size: 11px; border: 1px solid #cbd5e1; text-align: left;">Ngày đánh giá</th>
                <th style="padding: 8px; font-size: 11px; border: 1px solid #cbd5e1; width: 85px;">Hiệu lực</th>
                <th style="padding: 8px; font-size: 11px; border: 1px solid #cbd5e1; width: 60px;">DD (%)</th>
                <th style="padding: 8px; font-size: 11px; border: 1px solid #cbd5e1; width: 60px;">FF (%)</th>
                <th style="padding: 8px; font-size: 11px; border: 1px solid #cbd5e1; width: 60px;">VV (%)</th>
                <th style="padding: 8px; font-size: 11px; border: 1px solid #cbd5e1; width: 60px;">WW (%)</th>
                <th style="padding: 8px; font-size: 11px; border: 1px solid #cbd5e1; width: 60px;">CC (%)</th>
                <th style="padding: 8px; font-size: 11px; border: 1px solid #cbd5e1; width: 60px;">HH (%)</th>
                <th style="padding: 8px; font-size: 11px; border: 1px solid #cbd5e1; width: 80px;">Tỉ lệ đúng (%)</th>
                <th style="padding: 8px; font-size: 11px; border: 1px solid #cbd5e1; width: 85px;">Kết luận</th>
              </tr>
            </thead>
            <tbody>
              ${dailyRows}
            </tbody>
            <tfoot>
              <tr style="background-color: #f8fafc; font-weight: bold; border-top: 2px solid #94a3b8;">
                <td colspan="3" style="padding: 8px; font-size: 11px; border: 1px solid #cbd5e1; text-align: right; text-transform: uppercase;">
                  TRUNG BÌNH YẾU TỐ SÂN BAY ${st.station}:
                </td>
                <td style="padding: 8px; font-size: 11px; border: 1px solid #cbd5e1; font-family: monospace; text-align: center;">${st.elementAverages.DD}%</td>
                <td style="padding: 8px; font-size: 11px; border: 1px solid #cbd5e1; font-family: monospace; text-align: center;">${st.elementAverages.FF}%</td>
                <td style="padding: 8px; font-size: 11px; border: 1px solid #cbd5e1; font-family: monospace; text-align: center;">${st.elementAverages.VV}%</td>
                <td style="padding: 8px; font-size: 11px; border: 1px solid #cbd5e1; font-family: monospace; text-align: center;">${st.elementAverages.WW}%</td>
                <td style="padding: 8px; font-size: 11px; border: 1px solid #cbd5e1; font-family: monospace; text-align: center;">${st.elementAverages.CC}%</td>
                <td style="padding: 8px; font-size: 11px; border: 1px solid #cbd5e1; font-family: monospace; text-align: center;">${st.elementAverages.HH}%</td>
                <td style="padding: 8px; font-size: 12px; border: 1px solid #cbd5e1; font-family: monospace; text-align: center; color: ${st.isPassed ? '#166534' : '#991b1b'};">
                  ${st.overallAccuracy}%
                </td>
                <td style="padding: 8px; font-size: 11px; border: 1px solid #cbd5e1; text-align: center; color: ${st.isPassed ? '#166534' : '#991b1b'};">
                  ${st.isPassed ? 'ĐẠT' : 'CHƯA ĐẠT'}
                </td>
              </tr>
            </tfoot>
          </table>

          <!-- Airport Accuracy Rating Box -->
          <div style="background-color: ${st.isPassed ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${st.isPassed ? '#bbf7d0' : '#fecaca'}; padding: 10px 14px; border-radius: 6px; font-size: 11px;">
            <p style="margin: 0; font-weight: bold; color: ${st.isPassed ? '#166534' : '#991b1b'};">
              KẾT QUẢ ĐÁNH GIÁ SÂN BAY ${st.station} (${st.stationName}):
            </p>
            <p style="margin: 4px 0 0 0; color: #334155;">
              • <strong>Tỉ lệ đúng bình quân của sân bay:</strong> <span style="font-weight: bold; font-size: 12px; color: ${st.isPassed ? '#166534' : '#991b1b'};">${st.overallAccuracy}%</span> (Số ngày đạt: ${st.passedDays}/${st.totalDays} ngày - Tỉ lệ đạt: ${st.totalDays > 0 ? Math.round((st.passedDays / st.totalDays) * 100) : 0}%)<br/>
              • <strong>Kết luận chất lượng dự báo sân bay:</strong> <strong style="color: ${st.isPassed ? '#166534' : '#991b1b'};">${st.isPassed ? '✅ ĐẠT TIÊU CHUẨN ĐỘ CHÍNH XÁC ICAO ANNEX 3 (> 84%)' : '❌ CHƯA ĐẠT TIÊU CHUẨN ĐỘ CHÍNH XÁC ICAO ANNEX 3 (≤ 84%)'}</strong>
            </p>
          </div>
        </div>
      `;
    }).join('');

    // Global Comparison Table if multiple airports exist
    const multiAirportsComparisonHtml = stationStatsList.length > 1 ? `
      <div style="margin-top: 30px; margin-bottom: 25px; page-break-inside: avoid;">
        <h3 style="font-size: 14px; border-bottom: 2px solid #0f172a; padding-bottom: 4px; color: #0f172a; text-transform: uppercase;">
          🏆 BẢNG TỔNG HỢP VÀ SO SÁNH TỈ LỆ ĐÚNG CÁC SÂN BAY
        </h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
          <thead>
            <tr style="background-color: #0f172a; color: white; text-align: center;">
              <th style="padding: 8px; font-size: 11px; border: 1px solid #475569; width: 40px;">STT</th>
              <th style="padding: 8px; font-size: 11px; border: 1px solid #475569; width: 70px;">Mã sân</th>
              <th style="padding: 8px; font-size: 11px; border: 1px solid #475569; text-align: left;">Tên Cảng hàng không</th>
              <th style="padding: 8px; font-size: 11px; border: 1px solid #475569; width: 80px;">Số bản tin</th>
              <th style="padding: 8px; font-size: 11px; border: 1px solid #475569; width: 75px;">Số ngày đạt</th>
              <th style="padding: 8px; font-size: 11px; border: 1px solid #475569; width: 80px;">Số ngày K.Đạt</th>
              <th style="padding: 8px; font-size: 11px; border: 1px solid #475569; width: 100px;">Tỉ lệ đúng (%)</th>
              <th style="padding: 8px; font-size: 11px; border: 1px solid #475569; width: 90px;">Đánh giá</th>
            </tr>
          </thead>
          <tbody>
            ${stationStatsList.map((st, i) => `
              <tr style="border-bottom: 1px solid #cbd5e1; text-align: center;">
                <td style="padding: 8px; font-size: 11px; border: 1px solid #cbd5e1;">${i + 1}</td>
                <td style="padding: 8px; font-size: 11px; border: 1px solid #cbd5e1; font-weight: bold;">${st.station}</td>
                <td style="padding: 8px; font-size: 11px; border: 1px solid #cbd5e1; text-align: left;">${st.stationName}</td>
                <td style="padding: 8px; font-size: 11px; border: 1px solid #cbd5e1;">${st.totalReports}</td>
                <td style="padding: 8px; font-size: 11px; border: 1px solid #cbd5e1; color: #166534; font-weight: bold;">${st.passedDays}</td>
                <td style="padding: 8px; font-size: 11px; border: 1px solid #cbd5e1; color: #991b1b; font-weight: bold;">${st.failedDays}</td>
                <td style="padding: 8px; font-size: 12px; border: 1px solid #cbd5e1; font-weight: bold; font-family: monospace; color: ${st.isPassed ? '#166534' : '#991b1b'};">${st.overallAccuracy}%</td>
                <td style="padding: 8px; font-size: 11px; border: 1px solid #cbd5e1; font-weight: bold; color: ${st.isPassed ? '#166534' : '#991b1b'};">${st.isPassed ? 'ĐẠT' : 'KHÔNG ĐẠT'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : '';

    return `
      <div style="font-family: 'Segoe UI', Arial, sans-serif;">
        <!-- Airport Sections -->
        ${airportSummariesHtml}

        <!-- Multi-airport summary table if applicable -->
        ${multiAirportsComparisonHtml}

        <!-- Global Summary Conclusion -->
        <div style="background-color: #f8fafc; border: 2px solid #0f172a; padding: 16px; border-radius: 8px; font-size: 12px; line-height: 1.7; margin-top: 25px;">
          <h4 style="margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px;">
            📌 KẾT LUẬN TỔNG THỂ ĐÁNH GIÁ CHẤT LƯỢNG BẢN TIN TAF
          </h4>
          <p style="margin: 0 0 4px 0;">• <strong>Tổng số sân bay đánh giá:</strong> ${stationStatsList.length} sân bay (${uniqueStations.join(', ')})</p>
          <p style="margin: 0 0 4px 0;">• <strong>Tổng số bản tin đánh giá:</strong> ${grandTotalReports} bản tin (${grandTotalDays} ngày đánh giá)</p>
          <p style="margin: 0 0 4px 0;">• <strong>Tỉ lệ đúng trung bình chung:</strong> <span style="font-size: 14px; font-weight: bold; color: ${grandOverallAverage > 84 ? '#166534' : '#991b1b'};">${grandOverallAverage}%</span></p>
          <p style="margin: 0 0 4px 0;">• <strong>Số ngày đạt tiêu chuẩn ICAO (> 84%):</strong> <span style="color: #166534; font-weight: bold;">${grandPassedDays}/${grandTotalDays} ngày</span> (${grandTotalDays > 0 ? Math.round((grandPassedDays / grandTotalDays) * 100) : 0}%)</p>
          <p style="margin: 0 0 8px 0;">• <strong>Đánh giá chung toàn hệ thống:</strong> <strong style="color: ${grandOverallAverage > 84 ? '#166534' : '#991b1b'};">${grandOverallAverage > 84 ? '✅ ĐẠT YÊU CẦU ĐỘ CHÍNH XÁC CỦA ICAO' : '❌ CHƯA ĐẠT CHỈ TIÊU ĐỘ CHÍNH XÁC CỦA ICAO'}</strong></p>
          <p style="margin: 0; margin-top: 10px; font-size: 10.5px; color: #64748b; font-style: italic; border-top: 1px dashed #cbd5e1; padding-top: 8px;">
            * Lưu ý: Thông tin về ngày, tháng, năm đánh giá được tham chiếu và đánh giá trực tiếp từ nội dung của file dữ liệu đã nạp.
          </p>
        </div>
      </div>
    `;
  };

  // Generate Styled HTML content
  const generateReportHtml = (): string => {
    const isDetail = reportType === 'detail';
    const reportTitle = isDetail 
      ? `BÁO CÁO CHI TIẾT ĐÁNH GIÁ CHẤT LƯỢNG BẢN TIN DỰ BÁO TAF THEO TIÊU CHUẨN ICAO ANNEX 3`
      : `BÁO CÁO TỔNG HỢP THỐNG KÊ ĐÁNH GIÁ CHẤT LƯỢNG BẢN TIN DỰ BÁO TAF`;

    const subTitle = isDetail
      ? `(Bảng chi tiết 12 giờ cho từng bản tin TAF - Phân loại theo sân bay)`
      : `(Bảng tổng hợp thống kê kết quả đánh giá phân tách theo từng sân bay & tỉ lệ đúng)`;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${getExportFileName()}</title>
        <style>
          @page {
            size: A4;
            margin: 15mm 12mm 15mm 12mm;
          }
          body { 
            font-family: 'Segoe UI', Arial, sans-serif;
            padding: 25px; 
            color: #0f172a;
            line-height: 1.4;
          }
          @media print {
            body { padding: 0; }
            button, .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <!-- Header -->
        <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px;">
          <h1 style="font-size: 17px; margin: 0 0 6px 0; text-transform: uppercase; color: #0f172a;">
            ${reportTitle}
          </h1>
          <p style="font-size: 12px; margin: 0 0 4px 0; color: #334155; font-weight: bold;">
            ${subTitle}
          </p>
          <p style="font-size: 11px; margin: 0; color: #64748b; font-style: italic;">
            *(Thông tin ngày, tháng, năm đánh giá được tham chiếu trực tiếp từ nội dung bản tin TAF và dòng đầu của tệp dữ liệu đã nạp)
          </p>
        </div>

        <!-- Render STRICTLY the requested content ("Hiển thị nội dung nào thì xuất nội dung đó") -->
        ${isDetail ? generateDetailHtml() : generateSummaryHtml()}

        <!-- Signature footer for official meteorological reports -->
        <div style="margin-top: 35px; page-break-inside: avoid; display: flex; justify-content: space-between; font-size: 11px; color: #334155;">
          <div style="text-align: center; width: 220px;">
            <p style="margin: 0; font-weight: bold;">NGƯỜI LẬP BÁO CÁO</p>
            <p style="margin: 4px 0 0 0; font-style: italic; color: #64748b;">(Ký, ghi rõ họ tên)</p>
            <div style="height: 55px;"></div>
          </div>
          <div style="text-align: center; width: 250px;">
            <p style="margin: 0; font-weight: bold;">TRUNG TÂM KHÍ TƯỢNG HÀNG KHÔNG</p>
            <p style="margin: 4px 0 0 0; font-style: italic; color: #64748b;">(Xác nhận chất lượng chuyên môn)</p>
            <div style="height: 55px;"></div>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const handleExport = () => {
    const reportHtml = generateReportHtml();
    const exportBaseName = getExportFileName();

    if (format === '.pdf') {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(reportHtml);
        printWindow.document.title = exportBaseName;
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 350);
      }
    } else {
      // For HTML or DOCX download
      const mimeType = format === '.docx' ? 'application/msword' : 'text/html';
      const fileExtension = format === '.docx' ? 'doc' : 'html';
      const blob = new Blob([reportHtml], { type: `${mimeType};charset=utf-8` });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      // Exact filename combining airport station code(s) + month/year from evaluation file
      link.download = `${exportBaseName}.${fileExtension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs font-sans">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-fade-in mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">💾 XUẤT BÁO CÁO ĐÁNH GIÁ TAF</h3>
          </div>
          <button
            id="btn-close-export-dialog"
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* File Name Preview Info Card */}
          <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3 text-xs space-y-1.5">
            <div className="flex items-center justify-between font-bold text-indigo-900">
              <span className="flex items-center gap-1.5 uppercase text-[11px] tracking-wider">
                <Award className="w-4 h-4 text-indigo-600" />
                Thông tin tệp xuất báo cáo
              </span>
              <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-mono">
                {uniqueStations.length} sân bay
              </span>
            </div>
            <div className="text-[11px] text-slate-600 font-mono bg-white p-2 rounded-lg border border-indigo-150 break-all flex items-center justify-between gap-2">
              <span className="font-bold text-indigo-700 truncate">
                {getExportFileName()}{format === '.docx' ? '.doc' : format}
              </span>
              <span className="text-[10px] text-slate-400 shrink-0 font-sans">Tên file tự động</span>
            </div>
            <p className="text-[10px] text-slate-500 italic">
              * Tên file bao gồm mã sân bay ({stationCodesStr}) kết hợp tháng năm trong file đánh giá ({cleanMonthYearStr}).
            </p>
          </div>

          {/* Section 1: Report Type Choice - Independent output as requested */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
              NỘI DUNG XUẤT BÁO CÁO (HIỂN THỊ NỘI DUNG NÀO XUẤT NỘI DUNG ĐÓ)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className={`flex items-start gap-2.5 p-3 border rounded-xl cursor-pointer transition-all ${
                reportType === 'detail'
                  ? 'border-indigo-600 bg-indigo-50/50 font-bold text-indigo-950 ring-1 ring-indigo-600/50 shadow-2xs'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'
              }`}>
                <input
                  type="radio"
                  name="reportType"
                  value="detail"
                  checked={reportType === 'detail'}
                  onChange={() => setReportType('detail')}
                  className="accent-indigo-600 cursor-pointer w-4 h-4 mt-0.5"
                />
                <div className="text-xs">
                  <p className="font-bold">Bảng chi tiết (12 giờ)</p>
                  <p className="text-[10px] text-slate-500 font-normal mt-0.5">
                    Chỉ xuất bảng so sánh 12 giờ chi tiết từng bản tin TAF theo từng sân bay.
                  </p>
                </div>
              </label>

              <label className={`flex items-start gap-2.5 p-3 border rounded-xl cursor-pointer transition-all ${
                reportType === 'summary'
                  ? 'border-indigo-600 bg-indigo-50/50 font-bold text-indigo-950 ring-1 ring-indigo-600/50 shadow-2xs'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'
              }`}>
                <input
                  type="radio"
                  name="reportType"
                  value="summary"
                  checked={reportType === 'summary'}
                  onChange={() => setReportType('summary')}
                  className="accent-indigo-600 cursor-pointer w-4 h-4 mt-0.5"
                />
                <div className="text-xs">
                  <p className="font-bold">Bảng tổng hợp thống kê</p>
                  <p className="text-[10px] text-slate-500 font-normal mt-0.5">
                    Chỉ xuất bảng tổng hợp thống kê tách từng sân và tỉ lệ đúng từng sân bay.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Section 2: Format Choice */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">ĐỊNH DẠNG TỆP XUẤT</label>
            <div className="space-y-2">
              {/* DOCX */}
              <label className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-all ${
                format === '.docx'
                  ? 'border-indigo-600 bg-indigo-50/40 font-bold text-indigo-950 ring-1 ring-indigo-600/50'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'
              }`}>
                <div className="flex items-center gap-3 text-xs w-full">
                  <input
                    type="radio"
                    name="format"
                    value=".docx"
                    checked={format === '.docx'}
                    onChange={() => setFormat('.docx')}
                    className="accent-indigo-600 cursor-pointer w-4 h-4"
                  />
                  <FileEdit className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div>
                    <p className="font-bold">Microsoft Word (.doc / .docx)</p>
                    <p className="text-[10px] text-slate-400 font-normal mt-0.5">Mở trực tiếp trên Microsoft Word với định dạng bảng chuẩn</p>
                  </div>
                </div>
              </label>

              {/* HTML */}
              <label className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-all ${
                format === '.html'
                  ? 'border-indigo-600 bg-indigo-50/40 font-bold text-indigo-950 ring-1 ring-indigo-600/50'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'
              }`}>
                <div className="flex items-center gap-3 text-xs w-full">
                  <input
                    type="radio"
                    name="format"
                    value=".html"
                    checked={format === '.html'}
                    onChange={() => setFormat('.html')}
                    className="accent-indigo-600 cursor-pointer w-4 h-4"
                  />
                  <FileCode className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div>
                    <p className="font-bold">Trang web (.html)</p>
                    <p className="text-[10px] text-slate-400 font-normal mt-0.5">Xem trên mọi trình duyệt web hoặc lưu trữ nội bộ</p>
                  </div>
                </div>
              </label>

              {/* PDF */}
              <label className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-all ${
                format === '.pdf'
                  ? 'border-indigo-600 bg-indigo-50/40 font-bold text-indigo-950 ring-1 ring-indigo-600/50'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'
              }`}>
                <div className="flex items-center gap-3 text-xs w-full">
                  <input
                    type="radio"
                    name="format"
                    value=".pdf"
                    checked={format === '.pdf'}
                    onChange={() => setFormat('.pdf')}
                    className="accent-indigo-600 cursor-pointer w-4 h-4"
                  />
                  <Printer className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div>
                    <p className="font-bold">Xuất bản in / Lưu PDF (.pdf)</p>
                    <p className="text-[10px] text-slate-400 font-normal mt-0.5">In trực tiếp hoặc Lưu thành file PDF chuẩn trang in A4</p>
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2.5 p-4 border-t border-slate-100 bg-slate-50/50">
          <button
            id="btn-dialog-cancel"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 border border-slate-200 text-xs text-slate-600 rounded-xl hover:bg-slate-100 font-bold transition-all shadow-3xs uppercase cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            id="btn-dialog-export"
            onClick={handleExport}
            className="flex-1 py-2.5 px-4 bg-indigo-600 text-white text-xs rounded-xl hover:bg-indigo-700 font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 uppercase cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Tải báo cáo {reportType === 'detail' ? 'Chi tiết' : 'Tổng hợp'}
          </button>
        </div>
      </div>
    </div>
  );
}
