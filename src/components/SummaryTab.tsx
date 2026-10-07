import React from 'react';
import { TafEvaluationResult } from '../types';
import { BarChart3, TrendingUp, CheckCircle, XCircle, FileText, PlaneTakeoff, Award, Activity, Calendar } from 'lucide-react';

interface SummaryTabProps {
  evaluationResults: TafEvaluationResult[];
}

export default function SummaryTab({ evaluationResults }: SummaryTabProps) {
  if (evaluationResults.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 font-sans flex flex-col items-center justify-center shadow-sm">
        <BarChart3 className="w-12 h-12 text-slate-300 mb-3" />
        <p className="font-semibold text-slate-700">Chưa có dữ liệu thống kê</p>
        <p className="text-sm text-slate-400 mt-1">Hãy tải lên file hoặc tải dữ liệu mẫu để xem bảng tổng hợp.</p>
      </div>
    );
  }

  // Group evaluations by airport (station)
  const groupedByStation: { [station: string]: TafEvaluationResult[] } = {};
  evaluationResults.forEach(r => {
    const station = r.taf.station.toUpperCase();
    if (!groupedByStation[station]) {
      groupedByStation[station] = [];
    }
    groupedByStation[station].push(r);
  });

  // Calculate stats for each station
  const stationStats = Object.keys(groupedByStation).map(station => {
    const resultsForStation = groupedByStation[station];
    
    // Group by day key for daily stats of this station
    const groupedByDay: { [day: number]: TafEvaluationResult[] } = {};
    resultsForStation.forEach(r => {
      const day = r.taf.validStartDay;
      if (!groupedByDay[day]) {
        groupedByDay[day] = [];
      }
      groupedByDay[day].push(r);
    });

    const dailyStatsForStation = Object.keys(groupedByDay).map(dayStr => {
      const day = parseInt(dayStr, 10);
      const dayReports = groupedByDay[day];
      const totalScore = dayReports.reduce((sum, r) => sum + r.overallAccuracy, 0);
      const avgScore = Math.round(totalScore / dayReports.length);
      const isPassed = avgScore > 84;

      return {
        day,
        avgScore,
        isPassed,
        reports: dayReports
      };
    }).sort((a, b) => a.day - b.day);

    const totalDays = dailyStatsForStation.length;
    const passedDays = dailyStatsForStation.filter(d => d.isPassed).length;
    const failedDays = totalDays - passedDays;
    
    // Element averages for this station
    const elementAverages = {
      DD: Math.round(resultsForStation.reduce((sum, r) => sum + r.elementAccuracy.DD, 0) / resultsForStation.length),
      FF: Math.round(resultsForStation.reduce((sum, r) => sum + r.elementAccuracy.FF, 0) / resultsForStation.length),
      VV: Math.round(resultsForStation.reduce((sum, r) => sum + r.elementAccuracy.VV, 0) / resultsForStation.length),
      WW: Math.round(resultsForStation.reduce((sum, r) => sum + r.elementAccuracy.WW, 0) / resultsForStation.length),
      CC: Math.round(resultsForStation.reduce((sum, r) => sum + r.elementAccuracy.CC, 0) / resultsForStation.length),
      HH: Math.round(resultsForStation.reduce((sum, r) => sum + r.elementAccuracy.HH, 0) / resultsForStation.length)
    };

    const overallAverage = Math.round(resultsForStation.reduce((sum, r) => sum + r.overallAccuracy, 0) / resultsForStation.length);
    const passRate = totalDays > 0 ? Math.round((passedDays / totalDays) * 100) : 0;

    return {
      station,
      results: resultsForStation,
      resultsCount: resultsForStation.length,
      dailyStats: dailyStatsForStation,
      totalDays,
      passedDays,
      failedDays,
      passRate,
      elementAverages,
      overallAverage,
      isPassed: overallAverage > 84
    };
  }).sort((a, b) => a.station.localeCompare(b.station)); // Sort airports alphabetically

  // Calculate Overall Global Stats across all stations
  const totalReportsGlobal = evaluationResults.length;
  const totalDaysGlobal = stationStats.reduce((sum, s) => sum + s.totalDays, 0);
  const passedDaysGlobal = stationStats.reduce((sum, s) => sum + s.passedDays, 0);
  const failedDaysGlobal = totalDaysGlobal - passedDaysGlobal;
  const overallAverageGlobal = totalReportsGlobal > 0
    ? Math.round(evaluationResults.reduce((sum, r) => sum + r.overallAccuracy, 0) / totalReportsGlobal)
    : 0;

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
      case 'VVTH':
      case 'VVTX': return 'Cảng hàng không Thọ Xuân';
      case 'VVVH': return 'Cảng hàng không Quốc tế Vinh';
      case 'VVPQ': return 'Cảng hàng không Quốc tế Phú Quốc';
      case 'VVVD': return 'Cảng hàng không Quốc tế Vân Đồn';
      default: return `Sân bay ${code.toUpperCase()}`;
    }
  };

  const getScoreRating = (avg: number) => {
    if (avg >= 85) return { label: 'ĐẠT TIÊU CHUẨN ICAO', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    if (avg >= 70) return { label: 'KHÁ (CHƯA ĐẠT ICAO)', color: 'bg-blue-50 text-blue-700 border-blue-200' };
    if (avg >= 50) return { label: 'TRUNG BÌNH', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { label: 'KÉM (CẦN RÚT KINH NGHIỆM)', color: 'bg-rose-50 text-rose-700 border-rose-200' };
  };

  return (
    <div className="space-y-8 font-sans text-sm text-slate-700">
      {/* 4 Global Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Monthly Average */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider leading-none">TỈ LỆ ĐÚNG TRUNG BÌNH CHUNG</p>
            <p className="text-3xl font-bold text-slate-900 font-display">{overallAverageGlobal}%</p>
            <span className={`inline-block text-[9px] font-semibold px-2 py-0.5 rounded-full border ${
              overallAverageGlobal > 84 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'
            }`}>
              {overallAverageGlobal > 84 ? '✅ ĐẠT TIÊU CHUẨN ICAO (> 84%)' : '⚠️ CẦN CẢI THIỆN (≤ 84%)'}
            </span>
          </div>
          <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Total Airports & Days */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider leading-none">SÂN BAY & BẢN TIN ĐÁNH GIÁ</p>
            <p className="text-3xl font-bold text-slate-900 font-display">{stationStats.length} <span className="text-xs text-slate-400 font-normal">sân bay</span></p>
            <span className="text-[10px] text-slate-500 block font-medium">Tổng số: {totalReportsGlobal} bản tin ({totalDaysGlobal} ngày)</span>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
            <PlaneTakeoff className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Days PASSED */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider leading-none">TỔNG SỐ NGÀY ĐẠT</p>
            <p className="text-3xl font-bold text-emerald-600 font-display">{passedDaysGlobal} <span className="text-xs text-slate-400 font-normal">ngày</span></p>
            <span className="text-[10px] text-emerald-600 font-semibold block">Tỷ lệ ngày đạt: {totalDaysGlobal > 0 ? Math.round((passedDaysGlobal / totalDaysGlobal) * 100) : 0}%</span>
          </div>
          <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Days FAILED */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider leading-none">TỔNG SỐ NGÀY CHƯA ĐẠT</p>
            <p className="text-3xl font-bold text-rose-600 font-display">{failedDaysGlobal} <span className="text-xs text-slate-400 font-normal">ngày</span></p>
            <span className="text-[10px] text-rose-600 font-semibold block">Tỷ lệ chưa đạt: {totalDaysGlobal > 0 ? Math.round((failedDaysGlobal / totalDaysGlobal) * 100) : 0}%</span>
          </div>
          <div className="p-3 bg-rose-50 rounded-lg text-rose-600">
            <XCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Header divider */}
      <div className="border-b border-slate-200 pb-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <Award className="w-4 h-4 text-indigo-600" />
          BẢNG TỔNG HỢP THỐNG KÊ ĐÁNH GIÁ TAF TÁCH THEO TỪNG SÂN BAY
        </h3>
        <span className="text-[10px] text-slate-400 italic font-medium font-sans">
          *(Ngày đánh giá được tham chiếu trực tiếp từ nội dung tệp đánh giá đã nạp)
        </span>
      </div>

      {/* Airport Sections (Tách từng sân bay, có tỉ lệ đúng từng sân bay) */}
      <div className="space-y-8">
        {stationStats.map((stat) => {
          const rating = getScoreRating(stat.overallAverage);
          return (
            <div key={stat.station} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-all">
              {/* Airport Header Card */}
              <div className="bg-slate-50 border-b border-slate-200 p-4 md:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-600 text-white rounded-lg">
                    <PlaneTakeoff className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
                      {stat.station} - {getAirportFullName(stat.station)}
                    </h4>
                    <p className="text-xs text-slate-500 font-medium">
                      Đã đánh giá: <strong>{stat.resultsCount} bản tin TAF</strong> qua <strong>{stat.totalDays} ngày</strong> (Số ngày đạt: {stat.passedDays}/{stat.totalDays} ngày)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 bg-white p-3 border border-slate-200 rounded-xl shadow-2xs self-stretch sm:self-auto justify-between">
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">TỈ LỆ ĐÚNG SÂN BAY</span>
                    <span className={`text-2xl font-black font-display ${stat.isPassed ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {stat.overallAverage}%
                    </span>
                  </div>
                  <div className="border-l border-slate-200 pl-3">
                    <span className={`inline-block px-2.5 py-1 text-[10px] font-bold rounded-md border ${rating.color}`}>
                      {rating.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Airport stats details: Element averages + Daily breakdown */}
              <div className="p-4 md:p-5 space-y-6">
                {/* 1. Element accuracy progress grid */}
                <div className="space-y-3">
                  <h5 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-indigo-500" />
                    Độ chính xác trung bình theo yếu tố của sân bay {stat.station} (%)
                  </h5>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {(['DD', 'FF', 'VV', 'WW', 'CC', 'HH'] as const).map(el => {
                      const avg = stat.elementAverages[el];
                      const elFullName = el === 'DD' ? 'Hướng gió (DD)' :
                                         el === 'FF' ? 'Tốc độ gió (FF)' :
                                         el === 'VV' ? 'Tầm nhìn (VV)' :
                                         el === 'WW' ? 'Thời tiết (WW)' :
                                         el === 'CC' ? 'Lượng mây (CC)' : 'Trần mây (HH)';
                      
                      let barColor = 'bg-emerald-500';
                      if (avg < 50) barColor = 'bg-rose-500';
                      else if (avg < 75) barColor = 'bg-amber-500';
                      else if (avg < 85) barColor = 'bg-blue-500';

                      return (
                        <div key={el} className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 space-y-1.5">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-700 text-[11px]">{elFullName}</span>
                            <span className="font-bold text-slate-900 font-mono">{avg}%</span>
                          </div>
                          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div className={`h-full ${barColor}`} style={{ width: `${avg}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Detailed Table for this Airport */}
                <div className="space-y-3">
                  <h5 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    Bảng đánh giá chi tiết theo ngày và bản tin ({stat.station})
                  </h5>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-3xs">
                    <table className="w-full border-collapse bg-white text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-center">
                          <th className="p-2.5 border-r border-slate-200 w-12">STT</th>
                          <th className="p-2.5 border-r border-slate-200 text-left">Ngày đánh giá</th>
                          <th className="p-2.5 border-r border-slate-200 w-24">Hiệu lực</th>
                          <th className="p-2.5 border-r border-slate-200 w-16">DD (%)</th>
                          <th className="p-2.5 border-r border-slate-200 w-16">FF (%)</th>
                          <th className="p-2.5 border-r border-slate-200 w-16">VV (%)</th>
                          <th className="p-2.5 border-r border-slate-200 w-16">WW (%)</th>
                          <th className="p-2.5 border-r border-slate-200 w-16">CC (%)</th>
                          <th className="p-2.5 border-r border-slate-200 w-16">HH (%)</th>
                          <th className="p-2.5 border-r border-slate-200 w-24">Tỉ lệ đúng (%)</th>
                          <th className="p-2.5 w-24">Kết luận</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stat.results.map((r, rIdx) => {
                          const isPassed = r.overallAccuracy > 84;
                          return (
                            <tr key={rIdx} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors text-center font-mono">
                              <td className="p-2 border-r border-slate-100 font-sans text-slate-500">{rIdx + 1}</td>
                              <td className="p-2 border-r border-slate-100 text-left font-sans font-medium text-slate-800">
                                Ngày {String(r.taf.validStartDay).padStart(2, '0')}
                              </td>
                              <td className="p-2 border-r border-slate-100 text-slate-600">
                                {String(r.taf.validStartHour).padStart(2, '0')}Z-{String(r.taf.validEndHour).padStart(2, '0')}Z
                              </td>
                              <td className="p-2 border-r border-slate-100">{r.elementAccuracy.DD}%</td>
                              <td className="p-2 border-r border-slate-100">{r.elementAccuracy.FF}%</td>
                              <td className="p-2 border-r border-slate-100">{r.elementAccuracy.VV}%</td>
                              <td className="p-2 border-r border-slate-100">{r.elementAccuracy.WW}%</td>
                              <td className="p-2 border-r border-slate-100">{r.elementAccuracy.CC}%</td>
                              <td className="p-2 border-r border-slate-100">{r.elementAccuracy.HH}%</td>
                              <td className={`p-2 border-r border-slate-100 font-bold ${isPassed ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {r.overallAccuracy}%
                              </td>
                              <td className="p-2 font-sans font-bold">
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] border ${
                                  isPassed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}>
                                  {isPassed ? 'ĐẠT' : 'CHƯA ĐẠT'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50/80 font-bold border-t-2 border-slate-200 text-center">
                          <td colSpan={3} className="p-2.5 border-r border-slate-200 text-right uppercase text-slate-700 font-sans text-xs">
                            TRUNG BÌNH YẾU TỐ SÂN BAY {stat.station}:
                          </td>
                          <td className="p-2.5 border-r border-slate-200 font-mono">{stat.elementAverages.DD}%</td>
                          <td className="p-2.5 border-r border-slate-200 font-mono">{stat.elementAverages.FF}%</td>
                          <td className="p-2.5 border-r border-slate-200 font-mono">{stat.elementAverages.VV}%</td>
                          <td className="p-2.5 border-r border-slate-200 font-mono">{stat.elementAverages.WW}%</td>
                          <td className="p-2.5 border-r border-slate-200 font-mono">{stat.elementAverages.CC}%</td>
                          <td className="p-2.5 border-r border-slate-200 font-mono">{stat.elementAverages.HH}%</td>
                          <td className={`p-2.5 border-r border-slate-200 font-mono font-bold text-sm ${stat.isPassed ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {stat.overallAverage}%
                          </td>
                          <td className="p-2.5 font-sans">
                            <span className={`inline-block px-2.5 py-1 rounded text-[10px] font-bold border ${rating.color}`}>
                              {stat.isPassed ? 'ĐẠT' : 'CHƯA ĐẠT'}
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
