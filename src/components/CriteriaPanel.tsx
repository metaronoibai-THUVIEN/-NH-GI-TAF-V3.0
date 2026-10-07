import React from 'react';
import { Shield, Info, Activity, RefreshCw } from 'lucide-react';

export default function CriteriaPanel() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs h-full overflow-y-auto hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 pb-4 mb-4 border-b border-slate-100">
        <Shield className="w-5 h-5 text-indigo-600" />
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">📋 TIÊU CHÍ ĐÁNH GIÁ (ICAO)</h2>
      </div>

      <div className="space-y-5 text-xs text-slate-600 leading-relaxed font-sans">
        <div>
          <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2 uppercase text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            A. GIÓ (DD - FF)
          </h3>
          <ul className="list-disc pl-5 space-y-1 text-slate-500">
            <li><strong>Hướng (DD)</strong>: Sai lệch ≤ 20° (🟢). Sai lệch 21°-59° (🟡). Sai lệch ≥ 60° (🔴 - khi tốc độ ≥ 10 kt hoặc ≥ 5 m/s).</li>
            <li><strong>Đặc biệt</strong>: Không kiểm tra hướng (mặc định 🟢) nếu tốc độ dự báo và thực tế đều ≤ 7 kt (≤ 4 m/s), hoặc dự báo VRB với tốc độ ≤ 6 kt.</li>
            <li><strong>Tốc độ (FF)</strong>: Sai lệch ≤ 5 kt (🟢), 6-9 kt (🟡), ≥ 10 kt (🔴) cho tốc độ ≤ 25 kt. Với tốc độ &gt; 25 kt, sai lệch cho phép là ±20% (🟢). Hỗ trợ cả đơn vị KT và MPS.</li>
          </ul>
        </div>

        <div>
          <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2 uppercase text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
            B. TẦM NHÌN (VV)
          </h3>
          <ul className="list-disc pl-5 space-y-1 text-slate-500">
            <li><strong>Sai lệch cho phép</strong>: ≤ 200m (khi tầm nhìn ≤ 800m) hoặc ≤ 30% (khi tầm nhìn 800m - 10km) (🟢).</li>
            <li><strong>Vượt mốc đột biến</strong>: 150, 350, 600, 800, 1500, 3000, 5000, 10000m không có BECMG/TEMPO tương ứng (🔴).</li>
          </ul>
        </div>

        <div>
          <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2 uppercase text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
            C. MÂY (CC - HH)
          </h3>
          <ul className="list-disc pl-5 space-y-1 text-slate-500">
            <li><strong>Lượng mây (CC)</strong>: Đúng hạng mục (🟢). FEW ↔ SCT, BKN ↔ OVC (🟡). Thay đổi giữa các nhóm FEW/SCT ↔ BKN/OVC (🔴).</li>
            <li><strong>Đặc biệt</strong>: CAVOK/NSC/SKC tương đương FEW.</li>
            <li><strong>Độ cao mây (HH)</strong>: Sai lệch ≤ 100ft (khi ≤ 1000ft) hoặc ≤ 30% (khi 1000ft - 10000ft) (🟢).</li>
            <li><strong>Mốc đột biến</strong>: 100, 200, 500, 1000, 1500ft không có BECMG/TEMPO tương ứng (🔴). METAR ghi /// coi như đạt.</li>
          </ul>
        </div>

        <div>
          <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2 uppercase text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            D. THỜI TIẾT (WW)
          </h3>
          <ul className="list-disc pl-5 space-y-1 text-slate-500">
            <li><strong>Mưa & Giông</strong>: Xuất hiện hoặc mất đi của mưa (RA/SHRA/TSRA/DZ) hay giông (TS/VCTS/CB) phải trùng khớp giữa TAF và thực tế (🟢). Sai lệch sự có/không là 🔴.</li>
            <li>Không phân biệt cường độ (ví dụ -RA, RA, +RA đều tính là "có mưa"). Thuật ngữ NSW (No Significant Weather) biểu thị hết mưa (chuyển về NIL).</li>
          </ul>
        </div>

        {/* E. NEW DEDICATED BECMG / TEMPO / FM RULES SECTION ACCORDING TO SPECIFICATION */}
        <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3.5 space-y-2.5">
          <h3 className="font-bold text-indigo-950 mb-1 flex items-center gap-2 uppercase text-[11px]">
            <RefreshCw className="w-3.5 h-3.5 text-indigo-600 animate-spin-slow" />
            E. ĐẶC TẢ XỬ LÝ THUẬT NGỮ BECMG (THEO QUY TẮC NGHIỆP VỤ)
          </h3>
          <div className="space-y-2 text-[11px] text-slate-700">
            <div>
              <p className="font-bold text-indigo-900">• Lớp 1: Kiểm tra cửa sổ thời gian (Tuân thủ ICAO):</p>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-600 mt-0.5">
                <li><strong>Cửa sổ ≤ 2 giờ</strong>: <code>[BGMG_WINDOW_NORMAL]</code> (Phù hợp mức thông thường).</li>
                <li><strong>2 giờ &lt; Cửa sổ ≤ 4 giờ</strong>: <code>[BGMG_WINDOW_EXTENDED]</code> (Cửa sổ mở rộng).</li>
                <li><strong>Cửa sổ &gt; 4 giờ</strong>: <code>[BGMG_WINDOW_INVALID]</code> (Vi phạm giới hạn thời lượng BECMG).</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-indigo-900">• Lớp 2: Đánh giá chất lượng dự báo 4 bước (Sᵢ = Hᵢ × Tᵢ × Pᵢ):</p>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-600 mt-0.5">
                <li><strong>Bước 1 (Target Hit - Hᵢ)</strong>: Đạt/vượt ngưỡng mục tiêu <code>[BGMG_TARGET_HIT]</code> hoặc không <code>[BGMG_TARGET_MISS]</code>. Đánh giá theo ngưỡng nghiệp vụ (không chỉ exact match).</li>
                <li><strong>Bước 2 (Timing Hit - Tᵢ)</strong>: Xác định khoảng chuyển đổi giữa OBS trước và OBS sau: (T_prev, T_hit]. Khoảng chuyển đổi phải <em>giao với cửa sổ BECMG [T1, T2]</em> <code>[BGMG_TIMING_HIT]</code>.</li>
                <li><strong>Bước 3 (Persistence - Pᵢ)</strong>: P = D_actual / D_expected (0 ≤ P ≤ 1). Nếu duy trì: <code>[BGMG_PERSISTENT]</code>; nếu biến mất nhanh: <code>[BGMG_TEMPORARY]</code>.</li>
                <li><strong>Bước 4 (Element Score - Sᵢ)</strong>: Sᵢ = Hᵢ × Tᵢ × Pᵢ (0–100%). Điểm nhóm: Score_BECMG = Σ(wᵢ × Sᵢ) / Σwᵢ.</li>
              </ul>
            </div>
            <p className="text-[10px] text-indigo-900 font-bold bg-white p-2 rounded-lg border border-indigo-150">
              * Khóa 10 nguyên tắc: BECMG là một khoảng chuyển đổi (không phải một thời điểm); T_actual xác định bằng khoảng (T_prev, T_hit]; Tuân thủ ICAO và Điểm chất lượng dự báo là hai kết quả độc lập.
            </p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-[11px] leading-relaxed">
          <div className="flex gap-2.5 items-start text-slate-600">
            <Info className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-slate-900 mb-1">CÁCH XẾP HẠNG CHẤT LƯỢNG TAF:</p>
              <p>• <strong>≥ 85%</strong>: Đạt tiêu chuẩn ICAO (🟢)</p>
              <p>• <strong>70% - 84%</strong>: Khá (chưa đạt chuẩn ICAO) (🟡)</p>
              <p>• <strong>&lt; 70%</strong>: Cần rút kinh nghiệm (🔴)</p>
              <p className="mt-1.5 text-slate-500 font-medium italic">
                * Chỉ tiêu chuẩn của ICAO Annex 3 đối với dự báo TAF là &gt; 84%.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
