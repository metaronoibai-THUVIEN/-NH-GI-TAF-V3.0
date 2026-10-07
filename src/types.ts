export interface WindState {
  direction: string; // e.g. "300", "VRB"
  speed: number;
  unit?: 'KT' | 'MPS';
  gust?: number;
}

export interface CloudLayer {
  amount: 'FEW' | 'SCT' | 'BKN' | 'OVC' | 'NSC' | 'NIL' | '///';
  height: number | null; // height in hundreds of feet (e.g., 20 is 2000ft)
}

export interface WeatherCondition {
  raw: string;
  type: 'METAR' | 'SPECI' | 'TAF_BASE' | 'BECMG' | 'TEMPO' | 'FM';
  station: string;
  timeStr: string; // e.g., "090600Z"
  day: number;
  hour: number;
  minute: number;
  wind: WindState;
  visibility: number; // in meters (e.g., 9999)
  isCavok: boolean;
  isNsc: boolean;
  weather: string; // e.g. "NIL", "-RA", "TSRA"
  clouds: CloudLayer[];
}

export interface ChangeGroup {
  raw?: string; // e.g. "BECMG 0908/0910 14005KT 5000 -RA BKN015"
  type: 'BECMG' | 'TEMPO' | 'FM';
  startDay: number;
  startHour: number;
  endDay: number;
  endHour: number;
  conditions: Partial<WeatherCondition>;
  description?: string;
}

export interface TafReport {
  raw: string;
  station: string;
  issueTimeStr: string; // e.g., "090500Z"
  validStartDay: number;
  validStartHour: number;
  validEndDay: number;
  validEndHour: number;
  base: WeatherCondition;
  changeGroups: ChangeGroup[];
}

export interface ElementEvaluation {
  element: 'DD' | 'FF' | 'VV' | 'WW' | 'CC' | 'HH';
  score: number; // 1.0 = Green, 0.5 = Yellow, 0.0 = Red
  rating: '🟢' | '🟡' | '🔴';
  tafVal: string;
  metarVal: string;
  isBecmgTransition?: boolean;
  isBecmgChanged?: boolean; // True if this element value was altered by a BECMG change group
  becmgBaseVal?: string; // Value prior to BECMG
  becmgTargetVal?: string; // Target value after BECMG
}

export interface HourEvaluation {
  timeStr: string; // e.g. "0600"
  score: number; // average of element scores
  changeGroupLabel?: string; // e.g. "BASE", "BECMG", "TEMPO", "FM"
  changeGroupPhase?: 'BEFORE' | 'TRANSITION' | 'AFTER';
  changeGroupDetails?: string;
  elements: {
    DD: ElementEvaluation;
    FF: ElementEvaluation;
    VV: ElementEvaluation;
    WW: ElementEvaluation;
    CC: ElementEvaluation;
    HH: ElementEvaluation;
  };
}

export interface BecmgElementEvaluation {
  element: 'DD' | 'FF' | 'VV' | 'WW' | 'CC' | 'HH';
  elementName: string;
  targetVal: string;
  targetHit: boolean; // H_i: Có đạt/vượt target không (TRUE/FALSE)
  timingHit: boolean; // T_i: Khoảng chuyển đổi có giao [T1,T2] không (TRUE/FALSE)
  persistence: number; // P_i: D_actual / D_expected (0 đến 1)
  score: number; // S_i = H_i * T_i * P_i * 100 (0 đến 100%)
  transitionIntervalStr: string; // Ví dụ: "14:30Z < T_actual ≤ 15:00Z"
  targetHitCode: 'BGMG_TARGET_HIT' | 'BGMG_TARGET_MISS';
  timingHitCode: 'BGMG_TIMING_HIT' | 'BGMG_TIMING_MISS' | 'BGMG_TRANSITION_UNCERTAIN';
  persistenceCode: 'BGMG_PERSISTENT' | 'BGMG_TEMPORARY';
  summaryStatus: string;
}

export interface BecmgEvaluation {
  raw: string;
  startDay: number;
  startHour: number;
  endDay: number;
  endHour: number;
  durationHours: number;
  // Lớp 1: Tuân thủ quy tắc ICAO (Độc lập với điểm chất lượng)
  windowStatus: 'BGMG_WINDOW_NORMAL' | 'BGMG_WINDOW_EXTENDED' | 'BGMG_WINDOW_INVALID';
  icaoCompliant: boolean;
  icaoNotes: string;
  // Lớp 2: Đánh giá chất lượng dự báo 4 bước
  elementEvaluations: BecmgElementEvaluation[];
  overallScore: number; // Score_BECMG = Σ(w_i * S_i) / Σ(w_i) (0 đến 100%)
  statusCode: 'BGMG_FULL_HIT' | 'BGMG_PARTIAL' | 'BGMG_NO_HIT';
  classificationCode: 'BGMG_PERSISTENT' | 'BGMG_TEMPORARY';
}

export interface TafEvaluationResult {
  taf: TafReport;
  evaluations: HourEvaluation[]; // usually 12 hourly/half-hourly observations
  overallAccuracy: number; // e.g. 82%
  elementAccuracy: {
    DD: number;
    FF: number;
    VV: number;
    WW: number;
    CC: number;
    HH: number;
  };
  passed: boolean; // Based on rule: passed if no RED (or score > 84% at day level)
  becmgEvaluations?: BecmgEvaluation[]; // Đánh giá chi tiết nhóm BECMG theo đặc tả 4 bước
}

export interface EvaluationCriteria {
  windDirection: {
    green: string;
    yellow: string;
    red: string;
  };
  windSpeed: {
    green: string;
    yellow: string;
    red: string;
  };
  visibility: {
    green: string;
    yellow: string;
    red: string;
  };
  weather: {
    green: string;
    red: string;
  };
  cloudAmount: {
    green: string;
    yellow: string;
    red: string;
  };
  cloudHeight: {
    green: string;
    yellow: string;
    red: string;
  };
}
