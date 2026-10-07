import {
  WindState,
  CloudLayer,
  WeatherCondition,
  ChangeGroup,
  TafReport,
  TafEvaluationResult,
  HourEvaluation,
  ElementEvaluation,
  BecmgEvaluation,
  BecmgElementEvaluation
} from '../types';

// Helper to calculate angular difference between two wind directions
export function getWindDirDiff(dir1: string, dir2: string): number {
  if (dir1 === 'VRB' || dir2 === 'VRB' || dir1 === '///' || dir2 === '///') return 0;
  const d1 = parseInt(dir1, 10);
  const d2 = parseInt(dir2, 10);
  if (isNaN(d1) || isNaN(d2)) return 0;
  let diff = Math.abs(d1 - d2);
  if (diff > 180) {
    diff = 360 - diff;
  }
  return diff;
}

// Helper to normalize weather descriptors (light/heavy rain, shower etc. are both rain)
export function isRainWeather(w: string): boolean {
  if (!w || w === 'NIL' || w === 'NSW') return false;
  const norm = w.toUpperCase();
  return norm.includes('RA') || norm.includes('SHRA') || norm.includes('TSRA') || norm.includes('DZ');
}

export function isThunderstorm(w: string): boolean {
  if (!w || w === 'NIL' || w === 'NSW') return false;
  const norm = w.toUpperCase();
  return norm.includes('TS') || norm.includes('VCTS') || norm.includes('CB');
}

export function isFogOrMist(w: string): boolean {
  if (!w || w === 'NIL' || w === 'NSW') return false;
  const norm = w.toUpperCase();
  return norm.includes('BR') || norm.includes('FG');
}

// Parse wind component supporting both KT and MPS (common in Vietnam)
export function parseWind(part: string): WindState | null {
  const windRegex = /(\d{3}|VRB)(\d{2})(?:G(\d{2}))?(KT|MPS)/;
  const match = part.match(windRegex);
  if (match) {
    const rawSpeed = parseInt(match[2], 10);
    const unit = match[4] as 'KT' | 'MPS';
    return {
      direction: match[1],
      speed: rawSpeed,
      unit,
      gust: match[3] ? parseInt(match[3], 10) : undefined
    };
  }
  return null;
}

// Parse cloud layer
export function parseCloud(part: string): CloudLayer | null {
  if (part === 'NSC' || part === 'SKC' || part === 'NCD' || part === 'CAVOK') {
    return { amount: 'NSC', height: null };
  }
  const cloudRegex = /(FEW|SCT|BKN|OVC|NSC|VV)(\d{3}|\/\/\/)/;
  const match = part.match(cloudRegex);
  if (match) {
    return {
      amount: match[1] as any,
      height: match[2] === '///' ? null : parseInt(match[2], 10) * 100
    };
  }
  return null;
}

// Clean and tokenize reports
export function tokenizeReport(report: string): string[] {
  return report
    .replace(/=/g, '')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length > 0);
}

// Parse METAR or SPECI
export function parseMetarOrSpeci(raw: string): WeatherCondition | null {
  const tokens = tokenizeReport(raw);
  if (tokens.length < 3) return null;

  let type: 'METAR' | 'SPECI' = 'METAR';
  let stationIndex = 1;
  let timeIndex = 2;

  if (tokens[0] === 'METAR' || tokens[0] === 'SPECI') {
    type = tokens[0] as any;
    let offset = 1;
    if (tokens[offset] === 'COR' || tokens[offset] === 'AMD') {
      offset++;
    }
    stationIndex = offset;
    timeIndex = offset + 1;
  } else {
    // If prefix is omitted, detect by station pattern (4 letters) and time group (6 digits + Z)
    if (tokens[0].length === 4 && /^\d{6}Z$/.test(tokens[1])) {
      type = 'METAR';
      stationIndex = 0;
      timeIndex = 1;
    } else {
      return null;
    }
  }

  const station = tokens[stationIndex];
  const timeStr = tokens[timeIndex];
  if (!timeStr || !/^\d{6}Z$/.test(timeStr)) return null;

  const day = parseInt(timeStr.slice(0, 2), 10);
  const hour = parseInt(timeStr.slice(2, 4), 10);
  const minute = parseInt(timeStr.slice(4, 6), 10);

  // Default values
  let wind: WindState = { direction: '000', speed: 0, unit: 'KT' };
  let visibility = 9999;
  let isCavok = false;
  let isNsc = false;
  let weather = 'NIL';
  const clouds: CloudLayer[] = [];

  // Parse remaining tokens
  for (let i = timeIndex + 1; i < tokens.length; i++) {
    const token = tokens[i];

    if (token === 'CAVOK') {
      isCavok = true;
      visibility = 9999;
      isNsc = true;
      weather = 'NIL';
      continue;
    }

    if (token === 'NSC' || token === 'SKC' || token === 'NCD') {
      isNsc = true;
      continue;
    }

    if (token === 'NSW') {
      weather = 'NIL';
      continue;
    }

    // Wind
    const windParsed = parseWind(token);
    if (windParsed) {
      wind = windParsed;
      continue;
    }

    // Visibility (4 digits like 9999 or 3500)
    if (/^\d{4}$/.test(token)) {
      visibility = parseInt(token, 10);
      continue;
    }

    // Clouds
    const cloudParsed = parseCloud(token);
    if (cloudParsed) {
      clouds.push(cloudParsed);
      continue;
    }

    // Weather phenomena (e.g. -RA, +SHRA, TSRA, BR, FG, NSW)
    const weatherRegex = /^[+-]?(RA|DZ|SH|TS|BR|FG|HZ|DZ|VA|DU|SA|PO|SQ|FC|SS|DS|RA|GR|GS|PL)+$/;
    if (weatherRegex.test(token)) {
      weather = token;
      continue;
    }
  }

  return {
    raw,
    type,
    station,
    timeStr,
    day,
    hour,
    minute,
    wind,
    visibility,
    isCavok,
    isNsc: isNsc || isCavok || clouds.length === 0,
    weather,
    clouds: clouds.length > 0 ? clouds : (isCavok || isNsc ? [{ amount: 'NSC', height: null }] : [])
  };
}

// Helper to describe human-readable change group details
function generateChangeGroupDescription(type: 'BECMG' | 'TEMPO' | 'FM', startHour: number, endHour: number, startDay: number, conditions: Partial<WeatherCondition>): string {
  const parts: string[] = [];
  if (conditions.wind) {
    parts.push(`Gió ${conditions.wind.direction}/${String(conditions.wind.speed).padStart(2, '0')}${conditions.wind.unit || 'KT'}`);
  }
  if (conditions.isCavok) {
    parts.push('CAVOK (≥10km, không mây thấp/mưa)');
  } else {
    if (conditions.visibility !== undefined) parts.push(`Tầm nhìn ${conditions.visibility}m`);
    if (conditions.weather) parts.push(`Thời tiết ${conditions.weather === 'NIL' ? 'NSW (Hết mưa/thời tiết)' : conditions.weather}`);
  }
  if (conditions.clouds && conditions.clouds.length > 0) {
    const clStr = conditions.clouds.map(c => `${c.amount}${c.height !== null ? String(c.height / 100).padStart(3, '0') : ''}`).join(' ');
    parts.push(`Mây ${clStr}`);
  }

  const prefix = type === 'BECMG' 
    ? `Biến đổi dần (BECMG) từ ${String(startHour).padStart(2, '0')}:00Z đến ${String(endHour).padStart(2, '0')}:00Z (ngày ${String(startDay).padStart(2, '0')})`
    : type === 'TEMPO'
    ? `Biến đổi tạm thời (TEMPO) từ ${String(startHour).padStart(2, '0')}:00Z đến ${String(endHour).padStart(2, '0')}:00Z (ngày ${String(startDay).padStart(2, '0')})`
    : `Bắt đầu từ (FM) ${String(startHour).padStart(2, '0')}:00Z (ngày ${String(startDay).padStart(2, '0')})`;

  return `${prefix}: ${parts.join(', ') || 'Thay đổi chỉ tiêu'}`;
}

// Robust change group timing parser supporting all meteorological time representations:
// DDHH/DDHH, HHMM/HHMM, DDHH/HH, HH/HH, HHHH, FM/TL/AT with or without day
export function parseChangeGroupTiming(
  validStr: string,
  validStartDay: number,
  validStartHour: number,
  validEndDay: number,
  validEndHour: number
): { startDay: number; startHour: number; endDay: number; endHour: number } {
  let startDay = validStartDay;
  let startHour = validStartHour;
  let endDay = validEndDay;
  let endHour = validEndHour;

  if (!validStr) {
    return {
      startDay: validStartDay,
      startHour: validStartHour,
      endDay: validStartDay,
      endHour: Math.min(validStartHour + 2, 24)
    };
  }

  const s = validStr.replace(/\s+/g, '').replace(/-/g, '/');

  // Case 1: DDHH/DDHH (e.g. 0908/0910) or HHMM/HHMM (e.g. 0800/1000)
  const m1 = s.match(/^(\d{2})(\d{2})\/(\d{2})(\d{2})$/);
  if (m1) {
    const d1 = parseInt(m1[1], 10);
    const h1 = parseInt(m1[2], 10);
    const d2 = parseInt(m1[3], 10);
    const h2 = parseInt(m1[4], 10);

    // If d1 != validStartDay, and h1 is 0 or 30 and h2 is 0 or 30, it is HHMM/HHMM
    if (d1 !== validStartDay && (h1 === 0 || h1 === 30) && (h2 === 0 || h2 === 30) && d1 < 24 && d2 < 24) {
      startDay = validStartDay;
      startHour = d1;
      endDay = validStartDay;
      endHour = d2;
      if (endHour < startHour) endDay = validEndDay;
    } else {
      startDay = d1;
      startHour = h1;
      endDay = d2;
      endHour = h2;
    }
    return { startDay, startHour, endDay, endHour };
  }

  // Case 2: DDHH/HH (e.g. 0908/10)
  const m2 = s.match(/^(\d{2})(\d{2})\/(\d{2})$/);
  if (m2) {
    startDay = parseInt(m2[1], 10);
    startHour = parseInt(m2[2], 10);
    endDay = startDay;
    endHour = parseInt(m2[3], 10);
    if (endHour < startHour) endDay = validEndDay;
    return { startDay, startHour, endDay, endHour };
  }

  // Case 3: HH/HH (e.g. 08/10)
  const m3 = s.match(/^(\d{2})\/(\d{2})$/);
  if (m3) {
    startDay = validStartDay;
    startHour = parseInt(m3[1], 10);
    endDay = validStartDay;
    endHour = parseInt(m3[2], 10);
    if (endHour < startHour) endDay = validEndDay;
    return { startDay, startHour, endDay, endHour };
  }

  // Case 4: 4 digits HHHH (e.g. 0810)
  const m4 = s.match(/^(\d{2})(\d{2})$/);
  if (m4) {
    startDay = validStartDay;
    startHour = parseInt(m4[1], 10);
    endDay = validStartDay;
    endHour = parseInt(m4[2], 10);
    if (endHour < startHour) endDay = validEndDay;
    return { startDay, startHour, endDay, endHour };
  }

  // Case 5: FM/TL/AT prefixes
  const m5 = s.match(/^(FM|TL|AT)(\d{2,6})$/i);
  if (m5) {
    const prefix = m5[1].toUpperCase();
    const val = m5[2];
    if (prefix === 'FM') {
      if (val.length === 6) {
        startDay = parseInt(val.slice(0, 2), 10);
        startHour = parseInt(val.slice(2, 4), 10);
      } else {
        startDay = validStartDay;
        startHour = parseInt(val.slice(0, 2), 10);
      }
      endDay = validEndDay;
      endHour = validEndHour;
    } else if (prefix === 'TL') {
      if (val.length === 6) {
        endDay = parseInt(val.slice(0, 2), 10);
        endHour = parseInt(val.slice(2, 4), 10);
      } else {
        endDay = validStartDay;
        endHour = parseInt(val.slice(0, 2), 10);
      }
    } else if (prefix === 'AT') {
      startDay = validStartDay;
      startHour = parseInt(val.slice(0, 2), 10);
      endHour = Math.min(startHour + 1, 24);
    }
    return { startDay, startHour, endDay, endHour };
  }

  return {
    startDay: validStartDay,
    startHour: validStartHour,
    endDay: validStartDay,
    endHour: Math.min(validStartHour + 2, 24)
  };
}

// Parse TAF bulletin with comprehensive BECMG, TEMPO, and FM change groups
export function parseTaf(raw: string): TafReport | null {
  const cleanRaw = raw.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = cleanRaw.replace(/=/g, '').split(' ').filter(Boolean);
  if (tokens.length < 4) return null;

  let tafIndex = tokens.indexOf('TAF');
  if (tafIndex === -1) {
    tafIndex = tokens[0] === 'AMD' ? 0 : 0;
  }

  let offset = tafIndex;
  if (tokens[offset] === 'TAF') offset++;
  if (tokens[offset] === 'AMD') offset++;

  const station = tokens[offset];
  const issueTimeStr = tokens[offset + 1];
  const validityStr = tokens[offset + 2];

  if (!station || !issueTimeStr || !validityStr || !/^\d{6}Z$/.test(issueTimeStr) || !/^\d{4}\/\d{4}$/.test(validityStr)) {
    return null;
  }

  const validStartDay = parseInt(validityStr.slice(0, 2), 10);
  const validStartHour = parseInt(validityStr.slice(2, 4), 10);
  const validEndDay = parseInt(validityStr.slice(5, 7), 10);
  const validEndHour = parseInt(validityStr.slice(7, 9), 10);

  // Divide the TAF into Base block and Change Groups (BECMG, TEMPO, FM, PROB)
  const baseTokens: string[] = [];
  const changeGroupBlocks: { type: 'BECMG' | 'TEMPO' | 'FM'; validStr: string; tokens: string[] }[] = [];

  let currentBlock: { type: 'BECMG' | 'TEMPO' | 'FM'; validStr: string; tokens: string[] } | null = null;

  for (let i = offset + 3; i < tokens.length; i++) {
    const token = tokens[i];

    if (token === 'BECMG' || token === 'TEMPO' || token.startsWith('FM') || token.startsWith('PROB')) {
      if (token === 'BECMG' || token === 'TEMPO') {
        let validCandidate = tokens[i + 1] || '';
        // If slash with spaces e.g. "0908 / 0910"
        if (tokens[i + 2] === '/' && tokens[i + 3]) {
          validCandidate = `${validCandidate}/${tokens[i + 3]}`;
          i += 2;
        }

        const isTimeToken = /^(\d{2,4}[\/\-]\d{2,4}|\d{4}|(FM|TL|AT)\d{2,6})$/i.test(validCandidate);
        if (isTimeToken) {
          currentBlock = { type: token as any, validStr: validCandidate, tokens: [] };
          changeGroupBlocks.push(currentBlock);
          i++; // skip validity token
        } else {
          // If no time group provided, BECMG applies immediately
          currentBlock = { type: token as any, validStr: '', tokens: [] };
          changeGroupBlocks.push(currentBlock);
        }
      } else if (token.startsWith('PROB')) {
        // e.g. PROB30 TEMPO 0908/0911
        const nextToken = tokens[i + 1];
        if (nextToken === 'TEMPO' || nextToken === 'BECMG') {
          let validityCandidate = tokens[i + 2] || '';
          if (tokens[i + 3] === '/' && tokens[i + 4]) {
            validityCandidate = `${validityCandidate}/${tokens[i + 4]}`;
            i += 2;
          }
          const isTimeToken = /^(\d{2,4}[\/\-]\d{2,4}|\d{4}|(FM|TL|AT)\d{2,6})$/i.test(validityCandidate);
          if (isTimeToken) {
            currentBlock = { type: nextToken as any, validStr: validityCandidate, tokens: [] };
            changeGroupBlocks.push(currentBlock);
            i += 2;
          } else {
            currentBlock = { type: nextToken as any, validStr: '', tokens: [] };
            changeGroupBlocks.push(currentBlock);
            i += 1;
          }
        } else {
          if (currentBlock) currentBlock.tokens.push(token);
          else baseTokens.push(token);
        }
      } else if (token.startsWith('FM')) {
        // FM091500 or FM1500
        currentBlock = { type: 'FM', validStr: token.slice(2), tokens: [] };
        changeGroupBlocks.push(currentBlock);
      }
    } else {
      if (currentBlock) {
        currentBlock.tokens.push(token);
      } else {
        baseTokens.push(token);
      }
    }
  }

  // Parse Base condition
  const baseCondition = parseBaseCondition(station, issueTimeStr, baseTokens);

  // Parse Change Groups using the robust parseChangeGroupTiming helper
  const changeGroups: ChangeGroup[] = changeGroupBlocks.map(block => {
    const timing = parseChangeGroupTiming(
      block.validStr,
      validStartDay,
      validStartHour,
      validEndDay,
      validEndHour
    );

    // Partial parse condition within block
    const conditions = parsePartialCondition(block.tokens);
    const rawGroup = `${block.type} ${block.validStr} ${block.tokens.join(' ')}`.replace(/\s+/g, ' ').trim();
    const description = generateChangeGroupDescription(block.type, timing.startHour, timing.endHour, timing.startDay, conditions);

    return {
      raw: rawGroup,
      type: block.type,
      startDay: timing.startDay,
      startHour: timing.startHour,
      endDay: timing.endDay,
      endHour: timing.endHour,
      conditions,
      description
    };
  });

  return {
    raw,
    station,
    issueTimeStr,
    validStartDay,
    validStartHour,
    validEndDay,
    validEndHour,
    base: baseCondition,
    changeGroups
  };
}

function parseBaseCondition(station: string, issueTimeStr: string, tokens: string[]): WeatherCondition {
  const day = parseInt(issueTimeStr.slice(0, 2), 10);
  const hour = parseInt(issueTimeStr.slice(2, 4), 10);
  const minute = parseInt(issueTimeStr.slice(4, 6), 10);

  let wind: WindState = { direction: '000', speed: 0, unit: 'KT' };
  let visibility = 9999;
  let isCavok = false;
  let isNsc = false;
  let weather = 'NIL';
  const clouds: CloudLayer[] = [];

  for (const token of tokens) {
    if (token === 'CAVOK') {
      isCavok = true;
      visibility = 9999;
      isNsc = true;
      weather = 'NIL';
      continue;
    }
    if (token === 'NSC' || token === 'SKC' || token === 'NCD') {
      isNsc = true;
      continue;
    }
    if (token === 'NSW') {
      weather = 'NIL';
      continue;
    }
    const windParsed = parseWind(token);
    if (windParsed) {
      wind = windParsed;
      continue;
    }
    if (/^\d{4}$/.test(token)) {
      visibility = parseInt(token, 10);
      continue;
    }
    const cloudParsed = parseCloud(token);
    if (cloudParsed) {
      clouds.push(cloudParsed);
      continue;
    }
    const weatherRegex = /^[+-]?(RA|DZ|SH|TS|BR|FG|HZ|DZ|VA|DU|SA|PO|SQ|FC|SS|DS|RA|GR|GS|PL)+$/;
    if (weatherRegex.test(token)) {
      weather = token;
      continue;
    }
  }

  return {
    raw: tokens.join(' '),
    type: 'TAF_BASE',
    station,
    timeStr: issueTimeStr,
    day,
    hour,
    minute,
    wind,
    visibility,
    isCavok,
    isNsc: isNsc || isCavok || clouds.length === 0,
    weather,
    clouds: clouds.length > 0 ? clouds : (isCavok || isNsc ? [{ amount: 'NSC', height: null }] : [])
  };
}

function parsePartialCondition(tokens: string[]): Partial<WeatherCondition> {
  const cond: Partial<WeatherCondition> = {};
  const clouds: CloudLayer[] = [];

  for (const token of tokens) {
    if (token === 'CAVOK') {
      cond.isCavok = true;
      cond.visibility = 9999;
      cond.isNsc = true;
      cond.weather = 'NIL';
      cond.clouds = [{ amount: 'NSC', height: null }];
      continue;
    }
    if (token === 'NSC' || token === 'SKC' || token === 'NCD' || token === 'CLR') {
      cond.isNsc = true;
      cond.clouds = [{ amount: 'NSC', height: null }];
      continue;
    }
    if (token === 'NSW') {
      cond.weather = 'NIL';
      continue;
    }
    if (token === '///') {
      continue;
    }
    const windParsed = parseWind(token);
    if (windParsed) {
      cond.wind = windParsed;
      continue;
    }
    if (/^\d{4}$/.test(token)) {
      cond.visibility = parseInt(token, 10);
      continue;
    }
    const cloudParsed = parseCloud(token);
    if (cloudParsed) {
      clouds.push(cloudParsed);
      continue;
    }
    const weatherRegex = /^[+-]?(VC)?(RA|DZ|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PO|SQ|FC|SS|DS|SH|TS)+$/i;
    if (weatherRegex.test(token)) {
      cond.weather = token.toUpperCase();
      continue;
    }
  }

  if (clouds.length > 0) {
    cond.clouds = clouds;
  }
  return cond;
}

// Immutable update of forecast condition with partial change group conditions
export function applyChangeConditions(
  baseState: WeatherCondition,
  conditions: Partial<WeatherCondition>
): WeatherCondition {
  const next: WeatherCondition = {
    ...baseState,
    wind: conditions.wind ? { ...conditions.wind } : { ...baseState.wind },
    clouds: conditions.clouds ? [...conditions.clouds] : [...baseState.clouds]
  };

  if (conditions.isCavok) {
    next.isCavok = true;
    next.visibility = 9999;
    next.weather = 'NIL';
    next.isNsc = true;
    next.clouds = [{ amount: 'NSC', height: null }];
  } else {
    if (conditions.visibility !== undefined) {
      next.visibility = conditions.visibility;
      next.isCavok = false;
    }
    if (conditions.weather !== undefined) {
      next.weather = conditions.weather === 'NSW' ? 'NIL' : conditions.weather;
    }
    if (conditions.isNsc) {
      next.isNsc = true;
      next.clouds = [{ amount: 'NSC', height: null }];
    } else if (conditions.clouds && conditions.clouds.length > 0) {
      next.clouds = [...conditions.clouds];
      next.isNsc = false;
    }
  }

  return next;
}

// Convert day/hour/minute to numeric absolute hour for chronological comparison
function getAbsTime(day: number, hour: number, minute: number = 0): number {
  return day * 24 + hour + minute / 60;
}

export interface ResolvedTafState {
  primary: WeatherCondition;
  alternative?: WeatherCondition;
  activeChangeGroup?: ChangeGroup;
  changeGroupPhase?: 'BEFORE' | 'TRANSITION' | 'AFTER';
  label: string; // e.g. "BASE", "BECMG", "TEMPO", "FM"
  details?: string;
}

// Resolve TAF conditions at a specific observation time `T` (day, hour, minute)
// Incorporating ICAO Annex 3 rules for BECMG transition & persistent state
export function resolveTafStateAt(
  taf: TafReport,
  obsDay: number,
  obsHour: number,
  obsMin: number,
  allObsList: WeatherCondition[] = []
): ResolvedTafState {
  const tObs = getAbsTime(obsDay, obsHour, obsMin);

  // Start with base conditions
  let state = { ...taf.base };

  // Sort change groups chronologically
  const sortedGroups = [...taf.changeGroups].sort((a, b) => {
    return getAbsTime(a.startDay, a.startHour) - getAbsTime(b.startDay, b.startHour);
  });

  let activeTransitionBECMG: ChangeGroup | null = null;
  let lastAppliedPersistentGroup: ChangeGroup | null = null;

  for (const group of sortedGroups) {
    const tStart = getAbsTime(group.startDay, group.startHour);
    const tEnd = getAbsTime(group.endDay, group.endHour);

    if (group.type === 'FM') {
      if (tObs >= tStart) {
        state = applyChangeConditions(state, group.conditions);
        lastAppliedPersistentGroup = group;
      }
    } else if (group.type === 'BECMG') {
      if (tObs >= tEnd) {
        // Change has completed: permanently update the base forecast state
        state = applyChangeConditions(state, group.conditions);
        lastAppliedPersistentGroup = group;
      } else if (tObs >= tStart && tObs < tEnd) {
        // Currently within BECMG transition window
        activeTransitionBECMG = group;
      }
    }
  }

  const primaryState = { ...state };

  // 1. ACTIVE BECMG TRANSITION PERIOD:
  // Both pre-BECMG and post-BECMG states are valid during this transition window!
  if (activeTransitionBECMG) {
    const alternativeState = applyChangeConditions(state, activeTransitionBECMG.conditions);
    const timeSpan = `${String(activeTransitionBECMG.startHour).padStart(2, '0')}:00Z-${String(activeTransitionBECMG.endHour).padStart(2, '0')}:00Z`;
    return {
      primary: primaryState,
      alternative: alternativeState,
      activeChangeGroup: activeTransitionBECMG,
      changeGroupPhase: 'TRANSITION',
      label: 'BECMG',
      details: `Đang chuyển tiếp BECMG (${timeSpan}): Cho phép phù hợp điều kiện trước hoặc sau biến đổi.`
    };
  }

  // 2. CHECK IF ANY TEMPO GROUP COVERS THIS OBSERVATION TIME
  const activeTEMPO = sortedGroups.find(group => {
    if (group.type !== 'TEMPO') return false;
    const tStart = getAbsTime(group.startDay, group.startHour);
    const tEnd = getAbsTime(group.endDay, group.endHour);
    return tObs >= tStart && tObs <= tEnd;
  });

  if (activeTEMPO) {
    const tStartVal = getAbsTime(activeTEMPO.startDay, activeTEMPO.startHour);
    const tEndVal = getAbsTime(activeTEMPO.endDay, activeTEMPO.endHour);

    const obsInTempoWindow = allObsList.filter(obs => {
      const tob = getAbsTime(obs.day, obs.hour, obs.minute);
      return tob >= tStartVal && tob <= tEndVal;
    });

    let occurred = false;
    if (obsInTempoWindow.length > 0) {
      occurred = obsInTempoWindow.some(obs => {
        if (activeTEMPO.conditions.wind && Math.abs(obs.wind.speed - activeTEMPO.conditions.wind.speed) <= 5) return true;
        if (activeTEMPO.conditions.weather && obs.weather !== 'NIL' && isRainWeather(obs.weather) === isRainWeather(activeTEMPO.conditions.weather)) return true;
        if (activeTEMPO.conditions.visibility !== undefined && Math.abs(obs.visibility - activeTEMPO.conditions.visibility) <= 500) return true;
        if (activeTEMPO.conditions.clouds && activeTEMPO.conditions.clouds.length > 0) {
          const mainObsCloud = obs.clouds[0];
          const mainTempoCloud = activeTEMPO.conditions.clouds[0];
          if (mainObsCloud && mainTempoCloud && mainObsCloud.amount === mainTempoCloud.amount) return true;
        }
        return false;
      });
    }

    const alternativeState = { ...state, ...activeTEMPO.conditions } as WeatherCondition;
    const timeSpan = `${String(activeTEMPO.startHour).padStart(2, '0')}:00Z-${String(activeTEMPO.endHour).padStart(2, '0')}:00Z`;

    return {
      primary: primaryState,
      alternative: occurred ? alternativeState : undefined,
      activeChangeGroup: activeTEMPO,
      changeGroupPhase: 'TRANSITION',
      label: 'TEMPO',
      details: `Biến đổi tạm thời TEMPO (${timeSpan}): ${occurred ? 'Đã xuất hiện trong khung giờ (ĐẠT)' : 'Đang theo dõi tính chất tạm thời'}`
    };
  }

  // 3. PERSISTENT BECMG / FM APPLIED (AFTER TRANSITION HAS COMPLETED):
  if (lastAppliedPersistentGroup && lastAppliedPersistentGroup.type === 'BECMG') {
    const timeSpan = `${String(lastAppliedPersistentGroup.startHour).padStart(2, '0')}:00Z-${String(lastAppliedPersistentGroup.endHour).padStart(2, '0')}:00Z`;
    return {
      primary: primaryState,
      activeChangeGroup: lastAppliedPersistentGroup,
      changeGroupPhase: 'AFTER',
      label: 'BECMG',
      details: `Đã hoàn tất chuyển tiếp BECMG (${timeSpan}): Áp dụng điều kiện mới làm dự báo nền.`
    };
  }

  if (lastAppliedPersistentGroup && lastAppliedPersistentGroup.type === 'FM') {
    return {
      primary: primaryState,
      activeChangeGroup: lastAppliedPersistentGroup,
      changeGroupPhase: 'AFTER',
      label: 'FM',
      details: `Áp dụng điều kiện thay thế từ FM ${String(lastAppliedPersistentGroup.startHour).padStart(2, '0')}:00Z.`
    };
  }

  // 4. INITIAL BASE TAF
  return {
    primary: primaryState,
    changeGroupPhase: 'BEFORE',
    label: 'BASE',
    details: 'Điều kiện dự báo ban đầu (Base TAF).'
  };
}

// Evaluate a single meteorological element according to ICAO Annex 3
export function evaluateElement(
  element: 'DD' | 'FF' | 'VV' | 'WW' | 'CC' | 'HH',
  tafState: WeatherCondition,
  metarState: WeatherCondition
): ElementEvaluation {
  let score = 1.0;
  let tafVal = '';
  let metarVal = '';

  switch (element) {
    case 'DD': {
      tafVal = tafState.wind.direction;
      metarVal = metarState.wind.direction;

      const tafSpeed = tafState.wind.speed;
      const metarSpeed = metarState.wind.speed;

      // Special rule: if both speeds <= 7 kt (or <= 4 mps), automatic Green
      if (tafSpeed <= 7 && metarSpeed <= 7) {
        score = 1.0;
      } else if (tafVal === 'VRB' && tafSpeed <= 6) {
        score = 1.0;
      } else {
        const diff = getWindDirDiff(tafVal, metarVal);
        if (diff <= 20) {
          score = 1.0;
        } else if (diff >= 60) {
          if (tafSpeed >= 10 || metarSpeed >= 10) {
            score = 0.0;
          } else {
            score = 0.5;
          }
        } else {
          score = 0.5;
        }
      }
      break;
    }

    case 'FF': {
      tafVal = String(tafState.wind.speed).padStart(2, '0');
      metarVal = String(metarState.wind.speed).padStart(2, '0');

      let tafSpeed = tafState.wind.speed;
      let metarSpeed = metarState.wind.speed;

      // Normalize speed if one is MPS and other is KT
      if (tafState.wind.unit === 'MPS' && metarState.wind.unit === 'KT') {
        tafSpeed = Math.round(tafSpeed * 1.94384);
      } else if (tafState.wind.unit === 'KT' && metarState.wind.unit === 'MPS') {
        metarSpeed = Math.round(metarSpeed * 1.94384);
      }

      const maxSpeed = Math.max(tafSpeed, metarSpeed);
      const diff = Math.abs(tafSpeed - metarSpeed);

      if (maxSpeed <= 25) {
        if (diff <= 5) {
          score = 1.0;
        } else if (diff <= 9) {
          score = 0.5;
        } else {
          score = 0.0;
        }
      } else {
        // For > 25 kt, limit is ±20%
        const limit = 0.20 * maxSpeed;
        if (diff <= limit) {
          score = 1.0;
        } else if (diff <= 0.35 * maxSpeed) {
          score = 0.5;
        } else {
          score = 0.0;
        }
      }
      break;
    }

    case 'VV': {
      tafVal = tafState.isCavok ? 'CAVOK' : String(tafState.visibility);
      metarVal = metarState.isCavok ? 'CAVOK' : String(metarState.visibility);

      const tafVis = tafState.visibility;
      const metarVis = metarState.visibility;

      // Milestones: 150, 350, 600, 800, 1500, 3000, 5000, 10000 (CAVOK matches 10000)
      const milestones = [150, 350, 600, 800, 1500, 3000, 5000, 10000];
      const crossedMilestones = milestones.filter(M => {
        return (tafVis < M && metarVis >= M) || (tafVis >= M && metarVis < M);
      });

      if (crossedMilestones.length >= 1) {
        score = 0.0;
      } else {
        const diff = Math.abs(tafVis - metarVis);
        if (tafVis <= 800 && metarVis <= 800) {
          if (diff <= 200) {
            score = 1.0;
          } else {
            score = 0.5;
          }
        } else {
          const maxVis = Math.max(tafVis, metarVis);
          if (diff / maxVis <= 0.30) {
            score = 1.0;
          } else {
            score = 0.5;
          }
        }
      }
      break;
    }

    case 'WW': {
      tafVal = tafState.isCavok ? 'NIL' : (tafState.weather === 'NIL' || tafState.weather === 'NSW' ? 'NIL' : tafState.weather);
      metarVal = metarState.isCavok ? 'NIL' : (metarState.weather === 'NIL' || metarState.weather === 'NSW' ? 'NIL' : metarState.weather);

      const isTafRain = isRainWeather(tafVal);
      const isMetarRain = isRainWeather(metarVal);
      const isTafTs = isThunderstorm(tafVal);
      const isMetarTs = isThunderstorm(metarVal);
      const isTafFog = isFogOrMist(tafVal);
      const isMetarFog = isFogOrMist(metarVal);

      if (tafVal === metarVal) {
        score = 1.0;
      } else if (isTafRain === isMetarRain && isTafTs === isMetarTs && isTafFog === isMetarFog) {
        score = 1.0;
      } else {
        score = 0.0;
      }
      break;
    }

    case 'CC': {
      const tafCloud = tafState.clouds[0] || { amount: 'NSC', height: null };
      const metarCloud = metarState.clouds[0] || { amount: 'NSC', height: null };

      let tAmt = tafState.isCavok ? 'NSC' : tafCloud.amount;
      let mAmt = metarState.isCavok ? 'NSC' : metarCloud.amount;

      tafVal = tAmt;
      metarVal = mAmt;

      const getGroup = (amt: string) => {
        if (amt === 'BKN' || amt === 'OVC') return 'thick';
        return 'thin'; // FEW, SCT, NSC, NIL, CAVOK
      };

      if (tAmt === mAmt) {
        score = 1.0;
      } else if ((tAmt === 'NSC' && mAmt === 'FEW') || (tAmt === 'FEW' && mAmt === 'NSC')) {
        score = 1.0;
      } else if (getGroup(tAmt) === getGroup(mAmt)) {
        score = 0.5; // FEW <-> SCT
      } else {
        score = 0.0; // FEW/SCT <-> BKN/OVC
      }
      break;
    }

    case 'HH': {
      const tafCloud = tafState.clouds[0] || { amount: 'NSC', height: null };
      const metarCloud = metarState.clouds[0] || { amount: 'NSC', height: null };

      const tafH = tafCloud.height;
      const metarH = metarCloud.height;

      const tAmt = tafState.isCavok ? 'NSC' : tafCloud.amount;
      const mAmt = metarState.isCavok ? 'NSC' : metarCloud.amount;

      tafVal = tafH !== null ? String(tafH / 100).padStart(3, '0') : '///';
      metarVal = metarH !== null ? String(metarH / 100).padStart(3, '0') : '///';

      if (metarState.clouds.some(c => c.amount === '///' || c.height === null)) {
        score = 1.0;
        metarVal = '///';
      } else if (mAmt === 'NSC') {
        if (tAmt === 'NSC') {
          score = 1.0;
          tafVal = '///';
          metarVal = '///';
        } else {
          score = 0.0;
          metarVal = '///';
        }
      } else if (tAmt === 'NSC') {
        score = 0.0;
        tafVal = '///';
      } else if (tafH !== null && metarH !== null) {
        const milestones = [100, 200, 500, 1000, 1500];
        const crossedMilestones = milestones.filter(M => {
          return (tafH < M && metarH >= M) || (tafH >= M && metarH < M);
        });

        if (crossedMilestones.length >= 1) {
          score = 0.0;
        } else {
          const diff = Math.abs(tafH - metarH);
          if (tafH <= 1000 && metarH <= 1000) {
            if (diff <= 100) {
              score = 1.0;
            } else {
              score = 0.5;
            }
          } else {
            const maxH = Math.max(tafH, metarH);
            if (diff / maxH <= 0.30) {
              score = 1.0;
            } else {
              score = 0.5;
            }
          }
        }
      } else {
        score = 1.0;
      }
      break;
    }
  }

  const rating = score === 1.0 ? '🟢' : (score === 0.5 ? '🟡' : '🔴');

  return {
    element,
    score,
    rating,
    tafVal,
    metarVal
  };
}

// -------------------------------------------------------------
// ĐẶC TẢ XỬ LÝ THUẬT NGỮ BECMG TRONG TAF (4 BƯỚC H, T, P, S)
// -------------------------------------------------------------

function evaluateSingleBecmgElement(
  element: 'DD' | 'FF' | 'VV' | 'WW' | 'CC' | 'HH',
  elementName: string,
  targetVal: string,
  checkHitFn: (obs: WeatherCondition) => boolean,
  sortedObs: WeatherCondition[],
  t1: number,
  t2: number,
  dExpected: number
): BecmgElementEvaluation {
  // Tìm OBS đầu tiên đạt target trong hoặc gần sau T1
  let firstHitIdx = -1;
  for (let i = 0; i < sortedObs.length; i++) {
    const tob = getAbsTime(sortedObs[i].day, sortedObs[i].hour, sortedObs[i].minute);
    if (tob >= t1 - 1.5 && checkHitFn(sortedObs[i])) {
      firstHitIdx = i;
      break;
    }
  }

  // BƯỚC 1: TARGET HIT (H_i)
  if (firstHitIdx === -1) {
    return {
      element,
      elementName,
      targetVal,
      targetHit: false,
      timingHit: false,
      persistence: 0,
      score: 0,
      transitionIntervalStr: 'Không quan sát thấy đạt target',
      targetHitCode: 'BGMG_TARGET_MISS',
      timingHitCode: 'BGMG_TIMING_MISS',
      persistenceCode: 'BGMG_TEMPORARY',
      summaryStatus: 'Không đạt ngưỡng mục tiêu (BGMG_TARGET_MISS)'
    };
  }

  const targetHit = true;
  const targetHitCode: 'BGMG_TARGET_HIT' = 'BGMG_TARGET_HIT';

  // BƯỚC 2: TIMING HIT (T_i)
  // Xác định khoảng chuyển đổi giữa OBS trước và OBS sau: (T_prev, T_hit]
  const obsHit = sortedObs[firstHitIdx];
  const tHit = getAbsTime(obsHit.day, obsHit.hour, obsHit.minute);
  const tHitStr = `${String(obsHit.hour).padStart(2, '0')}:${String(obsHit.minute).padStart(2, '0')}Z`;

  let tPrev = tHit - 0.5;
  let tPrevStr = `${String(Math.floor(tPrev % 24)).padStart(2, '0')}:30Z`;

  if (firstHitIdx > 0) {
    const obsPrev = sortedObs[firstHitIdx - 1];
    tPrev = getAbsTime(obsPrev.day, obsPrev.hour, obsPrev.minute);
    tPrevStr = `${String(obsPrev.hour).padStart(2, '0')}:${String(obsPrev.minute).padStart(2, '0')}Z`;
  }

  const transitionIntervalStr = `${tPrevStr} < T_actual ≤ ${tHitStr}`;

  // Điều kiện đúng thời gian: Khoảng chuyển đổi (T_prev, T_hit] giao với cửa sổ [T1, T2]
  // Giao nhau khi: T_prev < T2 VÀ T_hit >= T1
  const timingHit = (tPrev < t2) && (tHit >= t1);
  const timingHitCode: 'BGMG_TIMING_HIT' | 'BGMG_TIMING_MISS' = timingHit ? 'BGMG_TIMING_HIT' : 'BGMG_TIMING_MISS';

  // BƯỚC 3: PERSISTENCE (P_i)
  // P = D_actual / D_expected, giới hạn 0 <= P <= 1
  let actualHitCount = 0;
  let totalSubsequentObs = 0;

  for (let i = firstHitIdx; i < sortedObs.length; i++) {
    totalSubsequentObs++;
    if (checkHitFn(sortedObs[i])) {
      actualHitCount++;
    }
  }

  const persistenceRate = totalSubsequentObs > 0 ? actualHitCount / totalSubsequentObs : 0;
  const persistence = Math.round(persistenceRate * 100) / 100;
  const persistenceCode: 'BGMG_PERSISTENT' | 'BGMG_TEMPORARY' = persistence >= 0.5 ? 'BGMG_PERSISTENT' : 'BGMG_TEMPORARY';

  // BƯỚC 4: ELEMENT SCORE (S_i = H_i * T_i * P_i * 100)
  const hVal = targetHit ? 1 : 0;
  const tVal = timingHit ? 1 : 0;
  const score = Math.round(hVal * tVal * persistence * 100);

  let summaryStatus = '';
  if (score >= 85) summaryStatus = 'Xuất sắc: Đạt target, đúng cửa sổ, duy trì ổn định (BGMG_PERSISTENT)';
  else if (score >= 50) summaryStatus = 'Khá: Chuyển đổi đúng cửa sổ nhưng mức duy trì vừa phải';
  else if (!timingHit) summaryStatus = 'Đạt target nhưng chuyển đổi ngoài cửa sổ BECMG (BGMG_TIMING_MISS)';
  else summaryStatus = 'Chuyển đổi chỉ xuất hiện thoáng qua (BGMG_TEMPORARY)';

  return {
    element,
    elementName,
    targetVal,
    targetHit,
    timingHit,
    persistence,
    score,
    transitionIntervalStr,
    targetHitCode,
    timingHitCode,
    persistenceCode,
    summaryStatus
  };
}

// Đánh giá chuyên sâu toàn bộ nhóm BECMG theo đặc tả nghiệp vụ
export function evaluateBecmgGroup(
  group: ChangeGroup,
  taf: TafReport,
  observations: WeatherCondition[]
): BecmgEvaluation {
  // 1. Kiểm tra cửa sổ thời gian (Window Validation - ICAO Compliance)
  const t1 = getAbsTime(group.startDay, group.startHour, 0);
  const t2 = getAbsTime(group.endDay, group.endHour, 0);
  const durationHours = Math.max(0, t2 - t1);

  let windowStatus: 'BGMG_WINDOW_NORMAL' | 'BGMG_WINDOW_EXTENDED' | 'BGMG_WINDOW_INVALID';
  let icaoCompliant: boolean;
  let icaoNotes: string;

  if (durationHours <= 2) {
    windowStatus = 'BGMG_WINDOW_NORMAL';
    icaoCompliant = true;
    icaoNotes = `Cửa sổ ${durationHours}h: Phù hợp mức thông thường theo ICAO Annex 3 (≤ 2 giờ)`;
  } else if (durationHours <= 4) {
    windowStatus = 'BGMG_WINDOW_EXTENDED';
    icaoCompliant = true;
    icaoNotes = `Cửa sổ ${durationHours}h: Mở rộng (> 2h đến ≤ 4h - Không tự động coi là sai ICAO)`;
  } else {
    windowStatus = 'BGMG_WINDOW_INVALID';
    icaoCompliant = false;
    icaoNotes = `Cửa sổ ${durationHours}h: Vi phạm giới hạn thời lượng BECMG của ICAO (không được vượt quá 4 giờ)`;
  }

  // 2. Thu thập chuỗi quan trắc liên quan
  const sortedObs = [...observations].sort((a, b) => {
    return getAbsTime(a.day, a.hour, a.minute) - getAbsTime(b.day, b.hour, b.minute);
  });

  const tafEnd = getAbsTime(taf.validEndDay, taf.validEndHour, 0);
  const dExpected = Math.max(1, tafEnd - t2);

  // 3. Đánh giá 4 bước (H, T, P, Score) cho từng element mục tiêu trong nhóm BECMG
  const elementEvaluations: BecmgElementEvaluation[] = [];

  // 3.1. Visibility (VV)
  if (group.conditions.visibility !== undefined || group.conditions.isCavok) {
    const targetVis = group.conditions.isCavok ? 9999 : group.conditions.visibility!;
    const baseVis = taf.base.isCavok ? 9999 : taf.base.visibility;
    const isDecreasing = targetVis < baseVis;

    const checkHit = (obs: WeatherCondition): boolean => {
      if (group.conditions.isCavok) {
        return obs.isCavok || obs.visibility >= 9000;
      }
      if (isDecreasing) {
        return obs.visibility <= targetVis || (obs.visibility <= 800 ? obs.visibility - targetVis <= 200 : (obs.visibility - targetVis) / targetVis <= 0.3);
      } else {
        return obs.visibility >= targetVis || (targetVis - obs.visibility) / targetVis <= 0.3;
      }
    };

    elementEvaluations.push(
      evaluateSingleBecmgElement(
        'VV',
        'Tầm nhìn ngang (VIS)',
        group.conditions.isCavok ? 'CAVOK (≥10km)' : `${targetVis}m`,
        checkHit,
        sortedObs,
        t1,
        t2,
        dExpected
      )
    );
  }

  // 3.2. Weather (WW)
  if (group.conditions.weather !== undefined) {
    const targetWx = group.conditions.weather;
    const isNsw = targetWx === 'NIL' || targetWx === 'NSW';

    const checkHit = (obs: WeatherCondition): boolean => {
      if (isNsw) {
        return obs.weather === 'NIL' || obs.weather === 'NSW' || obs.isCavok;
      }
      if (obs.weather === 'NIL') return false;
      if (obs.weather === targetWx) return true;
      if (isRainWeather(targetWx) && isRainWeather(obs.weather)) return true;
      if (isThunderstorm(targetWx) && isThunderstorm(obs.weather)) return true;
      if (isFogOrMist(targetWx) && isFogOrMist(obs.weather)) return true;
      return false;
    };

    elementEvaluations.push(
      evaluateSingleBecmgElement(
        'WW',
        'Hiện tượng thời tiết (WX)',
        isNsw ? 'NSW (Không có hiện tượng)' : targetWx,
        checkHit,
        sortedObs,
        t1,
        t2,
        dExpected
      )
    );
  }

  // 3.3. Cloud (CC & HH)
  if (group.conditions.clouds !== undefined || group.conditions.isNsc || group.conditions.isCavok) {
    const targetCloud = group.conditions.clouds?.[0] || { amount: 'NSC', height: null };
    const targetAmt = (group.conditions.isCavok || group.conditions.isNsc) ? 'NSC' : targetCloud.amount;
    const targetHeight = (group.conditions.isCavok || group.conditions.isNsc) ? null : targetCloud.height;

    const checkAmountHit = (obs: WeatherCondition): boolean => {
      if (targetAmt === 'NSC') return obs.isCavok || obs.isNsc || obs.clouds.length === 0;
      const obsAmt = obs.clouds[0]?.amount || (obs.isCavok || obs.isNsc ? 'NSC' : 'NIL');
      if (obsAmt === targetAmt) return true;
      if (targetAmt === 'BKN' && (obsAmt === 'BKN' || obsAmt === 'OVC')) return true;
      if (targetAmt === 'SCT' && (obsAmt === 'SCT' || obsAmt === 'FEW')) return true;
      return false;
    };

    elementEvaluations.push(
      evaluateSingleBecmgElement(
        'CC',
        'Lượng mây (Amount)',
        targetAmt,
        checkAmountHit,
        sortedObs,
        t1,
        t2,
        dExpected
      )
    );

    if (targetHeight !== null) {
      const checkHeightHit = (obs: WeatherCondition): boolean => {
        const obsH = obs.clouds[0]?.height;
        if (obsH === null || obsH === undefined) return false;
        if (Math.abs(obsH - targetHeight) <= (targetHeight <= 1000 ? 100 : targetHeight * 0.3)) return true;
        return obsH <= targetHeight;
      };

      elementEvaluations.push(
        evaluateSingleBecmgElement(
          'HH',
          'Độ cao trần mây (Base)',
          `${String(targetHeight / 100).padStart(3, '0')} (${targetHeight}ft)`,
          checkHeightHit,
          sortedObs,
          t1,
          t2,
          dExpected
        )
      );
    }
  }

  // 3.4. Wind (DD & FF)
  if (group.conditions.wind) {
    const targetDir = group.conditions.wind.direction;
    const targetSpd = group.conditions.wind.speed;
    const targetUnit = group.conditions.wind.unit || 'KT';

    const checkWindHit = (obs: WeatherCondition): boolean => {
      let obsSpeed = obs.wind.speed;
      if (obs.wind.unit === 'MPS' && targetUnit === 'KT') obsSpeed = Math.round(obsSpeed * 1.94384);
      else if (obs.wind.unit === 'KT' && targetUnit === 'MPS') obsSpeed = Math.round(obsSpeed / 1.94384);

      const spdDiff = Math.abs(obsSpeed - targetSpd);
      const isSpdHit = targetSpd <= 25 ? spdDiff <= 5 : spdDiff <= targetSpd * 0.2;
      const isDirHit = (targetSpd <= 7 && obsSpeed <= 7) || targetDir === 'VRB' || getWindDirDiff(targetDir, obs.wind.direction) <= 20;

      return isSpdHit && isDirHit;
    };

    elementEvaluations.push(
      evaluateSingleBecmgElement(
        'DD',
        'Gió (Wind DD/FF)',
        `${targetDir}/${String(targetSpd).padStart(2, '0')}${targetUnit}`,
        checkWindHit,
        sortedObs,
        t1,
        t2,
        dExpected
      )
    );
  }

  // 4. Tính điểm tổng hợp nhóm BECMG (Score_BECMG = Σ(w_i * S_i) / Σw_i)
  const totalWeight = elementEvaluations.length;
  const overallScore = totalWeight > 0
    ? Math.round(elementEvaluations.reduce((sum, e) => sum + e.score, 0) / totalWeight)
    : 100;

  const hitCount = elementEvaluations.filter(e => e.targetHit && e.timingHit).length;
  let statusCode: 'BGMG_FULL_HIT' | 'BGMG_PARTIAL' | 'BGMG_NO_HIT' = 'BGMG_NO_HIT';
  if (hitCount === totalWeight && totalWeight > 0) {
    statusCode = 'BGMG_FULL_HIT';
  } else if (hitCount > 0) {
    statusCode = 'BGMG_PARTIAL';
  }

  const avgPersistence = totalWeight > 0
    ? elementEvaluations.reduce((sum, e) => sum + e.persistence, 0) / totalWeight
    : 0;

  const classificationCode = avgPersistence >= 0.5 ? 'BGMG_PERSISTENT' : 'BGMG_TEMPORARY';

  return {
    raw: group.raw || `BECMG ${String(group.startDay).padStart(2, '0')}${String(group.startHour).padStart(2, '0')}/${String(group.endDay).padStart(2, '0')}${String(group.endHour).padStart(2, '0')}`,
    startDay: group.startDay,
    startHour: group.startHour,
    endDay: group.endDay,
    endHour: group.endHour,
    durationHours,
    windowStatus,
    icaoCompliant,
    icaoNotes,
    elementEvaluations,
    overallScore,
    statusCode,
    classificationCode
  };
}

// Evaluate a TAF report against a list of METARs and SPECIs
export function evaluateTaf(taf: TafReport, observations: WeatherCondition[]): TafEvaluationResult {
  const evalHours: HourEvaluation[] = [];

  const startDay = taf.validStartDay;
  const startHour = taf.validStartHour;

  for (let step = 0; step < 12; step++) {
    // 30-minute intervals
    let totalMinutes = startHour * 60 + step * 30;
    let obsDay = startDay;
    let obsHour = Math.floor(totalMinutes / 60);
    let obsMin = totalMinutes % 60;

    if (obsHour >= 24) {
      obsDay += Math.floor(obsHour / 24);
      obsHour = obsHour % 24;
    }

    const timeStrStr = `${String(obsHour).padStart(2, '0')}${String(obsMin).padStart(2, '0')}`;
    const targetAbsTime = getAbsTime(obsDay, obsHour, obsMin);

    // Find closest METAR / SPECI (within ± 15 mins first, fallback to ± 30 mins)
    let matchedObs = observations.find(obs => {
      const obsAbsTime = getAbsTime(obs.day, obs.hour, obs.minute);
      return Math.abs(obsAbsTime - targetAbsTime) <= 0.25;
    });

    if (!matchedObs) {
      matchedObs = observations.filter(obs => {
        const obsAbsTime = getAbsTime(obs.day, obs.hour, obs.minute);
        return Math.abs(obsAbsTime - targetAbsTime) <= 0.55;
      }).sort((a, b) => {
        const diffA = Math.abs(getAbsTime(a.day, a.hour, a.minute) - targetAbsTime);
        const diffB = Math.abs(getAbsTime(b.day, b.hour, b.minute) - targetAbsTime);
        return diffA - diffB;
      })[0];
    }

    const defaultMetar: WeatherCondition = matchedObs || {
      raw: '',
      type: 'METAR',
      station: taf.station,
      timeStr: `${String(obsDay).padStart(2, '0')}${timeStrStr}Z`,
      day: obsDay,
      hour: obsHour,
      minute: obsMin,
      wind: { direction: '///', speed: 0, unit: 'KT' },
      visibility: 9999,
      isCavok: false,
      isNsc: true,
      weather: 'NIL',
      clouds: [{ amount: 'NSC', height: null }]
    };

    // Resolve TAF conditions with BECMG / TEMPO change group handling
    const resolved = resolveTafStateAt(taf, obsDay, obsHour, obsMin, observations);

    // Evaluate element-by-element
    // During BECMG transition, both pre and post conditions get hit verification (ICAO Annex 3)
    // while the TAF forecast clearly displays the BECMG target values
    const elements: ('DD' | 'FF' | 'VV' | 'WW' | 'CC' | 'HH')[] = ['DD', 'FF', 'VV', 'WW', 'CC', 'HH'];
    const hourElements: any = {};

    for (const el of elements) {
      const primEval = evaluateElement(el, resolved.primary, defaultMetar);
      let isChangedByBecmg = false;
      let becmgBaseVal: string | undefined;
      let becmgTargetVal: string | undefined;

      if (resolved.alternative && resolved.label === 'BECMG') {
        const altEval = evaluateElement(el, resolved.alternative, defaultMetar);

        const cond = resolved.activeChangeGroup?.conditions;
        if (cond) {
          if (el === 'DD' || el === 'FF') isChangedByBecmg = !!cond.wind;
          else if (el === 'VV') isChangedByBecmg = cond.visibility !== undefined || !!cond.isCavok;
          else if (el === 'WW') isChangedByBecmg = cond.weather !== undefined || !!cond.isCavok;
          else if (el === 'CC') isChangedByBecmg = cond.clouds !== undefined || !!cond.isNsc || !!cond.isCavok;
          else if (el === 'HH') isChangedByBecmg = cond.clouds !== undefined || !!cond.isNsc || !!cond.isCavok;
        }

        // ICAO Annex 3 verification: during BECMG transition, METAR matching either pre or post condition is correct!
        const bestScore = Math.max(primEval.score, altEval.score);
        const bestRating = bestScore === 1.0 ? '🟢' : (bestScore === 0.5 ? '🟡' : '🔴');

        // Target value from BECMG:
        const tafDisplayVal = isChangedByBecmg ? altEval.tafVal : primEval.tafVal;

        hourElements[el] = {
          element: el,
          score: bestScore,
          rating: bestRating,
          tafVal: tafDisplayVal,
          metarVal: primEval.metarVal,
          isBecmgTransition: true,
          isBecmgChanged: isChangedByBecmg,
          becmgBaseVal: primEval.tafVal,
          becmgTargetVal: altEval.tafVal
        };
      } else {
        if (resolved.changeGroupPhase === 'AFTER' && resolved.activeChangeGroup?.type === 'BECMG') {
          const cond = resolved.activeChangeGroup.conditions;
          if (cond) {
            if (el === 'DD' || el === 'FF') isChangedByBecmg = !!cond.wind;
            else if (el === 'VV') isChangedByBecmg = cond.visibility !== undefined || !!cond.isCavok;
            else if (el === 'WW') isChangedByBecmg = cond.weather !== undefined || !!cond.isCavok;
            else if (el === 'CC') isChangedByBecmg = cond.clouds !== undefined || !!cond.isNsc || !!cond.isCavok;
            else if (el === 'HH') isChangedByBecmg = cond.clouds !== undefined || !!cond.isNsc || !!cond.isCavok;
          }
          if (isChangedByBecmg) {
            becmgBaseVal = evaluateElement(el, taf.base, defaultMetar).tafVal;
            becmgTargetVal = primEval.tafVal;
          }
        }

        hourElements[el] = {
          ...primEval,
          isBecmgTransition: false,
          isBecmgChanged: isChangedByBecmg,
          becmgBaseVal,
          becmgTargetVal
        };
      }
    }

    const hourScore = elements.reduce((sum, el) => sum + hourElements[el].score, 0) / 6;

    evalHours.push({
      timeStr: timeStrStr,
      score: hourScore,
      changeGroupLabel: resolved.label,
      changeGroupPhase: resolved.changeGroupPhase,
      changeGroupDetails: resolved.details,
      elements: hourElements
    });
  }

  // Calculate Element Accuracy
  const calcElementPct = (element: 'DD' | 'FF' | 'VV' | 'WW' | 'CC' | 'HH') => {
    const hits = evalHours.filter(h => h.elements[element].score >= 0.5).length;
    return Math.round((hits / 12) * 100);
  };

  const elementAccuracy = {
    DD: calcElementPct('DD'),
    FF: calcElementPct('FF'),
    VV: calcElementPct('VV'),
    WW: calcElementPct('WW'),
    CC: calcElementPct('CC'),
    HH: calcElementPct('HH')
  };

  const overallAccuracy = Math.round(
    Object.values(elementAccuracy).reduce((sum, v) => sum + v, 0) / 6
  );

  const hasRed = evalHours.some(h => {
    return Object.values(h.elements).some(e => e.score === 0.0);
  });

  // Đánh giá chuyên sâu từng nhóm BECMG theo đặc tả 4 bước (H, T, P, S)
  const becmgGroups = taf.changeGroups.filter(g => g.type === 'BECMG');
  const becmgEvaluations = becmgGroups.map(g => evaluateBecmgGroup(g, taf, observations));

  return {
    taf,
    evaluations: evalHours,
    overallAccuracy,
    elementAccuracy,
    passed: !hasRed,
    becmgEvaluations
  };
}
