import { WeatherCondition, TafReport } from '../types';
import { parseMetarOrSpeci, parseTaf } from './tafEvaluator';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';

export interface ParsedReports {
  tafs: TafReport[];
  observations: WeatherCondition[];
  rawText: string;
  referenceMonthYear: string;
  fileHeader?: string;
  fileNames?: string[];
  stations?: string[];
  monthYearForFile?: string;
}

// Utility to parse month/year and header from the first line or non-empty non-report lines of the file, or filename
export function getReferenceDateInfo(text: string, fileName?: string): {
  monthYearStr: string;
  fullHeader?: string;
  monthYearForFile: string;
} {
  const now = new Date();
  const defaultMonthYearStr = `Tháng ${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  const defaultMonthYearForFile = `${String(now.getMonth() + 1).padStart(2, '0')}_${now.getFullYear()}`;

  const cleanMonthYear = (matchMonth: string, matchYear: string) => {
    const m = matchMonth.padStart(2, '0');
    const y = matchYear.length === 2 ? `20${matchYear}` : matchYear;
    return {
      monthYearStr: `Tháng ${m}/${y}`,
      monthYearForFile: `${m}_${y}`
    };
  };

  const lines = text ? text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0) : [];

  // Find the first line that is not a raw meteorological report
  let headerLine = "";
  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper.startsWith('TAF') || upper.startsWith('METAR') || upper.startsWith('SPECI') || upper.startsWith('AAXX') || upper.startsWith('TTYY')) {
      continue;
    }
    // Found a potential header line
    headerLine = line;
    break;
  }

  // 1. Try matching from header line if available
  if (headerLine) {
    // Matches: "tháng 10 năm 2026", "tháng 10/2026", "tháng 10-2026"
    const m1 = headerLine.match(/tháng\s*(\d{1,2})\s*(?:năm|\/|\-)\s*(\d{2,4})/i);
    if (m1) {
      const res = cleanMonthYear(m1[1], m1[2]);
      return { ...res, fullHeader: headerLine };
    }

    // Matches: "10/2026" or "10-2026"
    const m2 = headerLine.match(/\b(\d{1,2})[\/\-](\d{4})\b/);
    if (m2) {
      const res = cleanMonthYear(m2[1], m2[2]);
      return { ...res, fullHeader: headerLine };
    }

    // Matches: "2026-10" or "2026/10"
    const m3 = headerLine.match(/\b(\d{4})[\/\-](\d{1,2})\b/);
    if (m3) {
      const res = cleanMonthYear(m3[2], m3[1]);
      return { ...res, fullHeader: headerLine };
    }

    // Matches: "tháng 10" (without year, fallback to current year)
    const m4 = headerLine.match(/tháng\s*(\d{1,2})/i);
    if (m4) {
      const res = cleanMonthYear(m4[1], String(now.getFullYear()));
      return { ...res, fullHeader: headerLine };
    }
  }

  // 2. Try matching from fileName if provided (e.g. VVNB_10_2026.txt or TAF_10-2026.docx)
  if (fileName) {
    const fn1 = fileName.match(/(?:tháng[_\s-]*)?(\d{1,2})[_\-\/](\d{4})/i);
    if (fn1) {
      const res = cleanMonthYear(fn1[1], fn1[2]);
      return { ...res, fullHeader: headerLine || fileName };
    }

    const fn2 = fileName.match(/(\d{4})[_\-\/](\d{1,2})/i);
    if (fn2) {
      const res = cleanMonthYear(fn2[2], fn2[1]);
      return { ...res, fullHeader: headerLine || fileName };
    }
  }

  // 3. Fallback: if headerLine exists without date pattern
  if (headerLine) {
    return {
      monthYearStr: headerLine.length > 50 ? headerLine.slice(0, 50) + "..." : headerLine,
      monthYearForFile: defaultMonthYearForFile,
      fullHeader: headerLine
    };
  }

  return {
    monthYearStr: defaultMonthYearStr,
    monthYearForFile: defaultMonthYearForFile
  };
}

// Smart bulletin splitter that cleanly handles multi-line bulletins,
// preserving BECMG/TEMPO attached to TAF across line breaks or equal signs.
export function splitBulletins(text: string): { tafTexts: string[]; obsTexts: string[] } {
  const rawLines = text.split(/\r?\n/);
  const lines: string[] = [];
  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    // Strip leading row numbering like "1.", "1/ ", "Row 2: "
    const cleanLine = trimmed.replace(/^(\d+[\.\/\)\-]\s*)/, '').trim();
    if (cleanLine) lines.push(cleanLine);
  }

  const tafTexts: string[] = [];
  const obsTexts: string[] = [];

  let currentTafTokens: string[] = [];
  let currentObsTokens: string[] = [];

  const flushTaf = () => {
    if (currentTafTokens.length > 0) {
      tafTexts.push(currentTafTokens.join(' '));
      currentTafTokens = [];
    }
  };

  const flushObs = () => {
    if (currentObsTokens.length > 0) {
      obsTexts.push(currentObsTokens.join(' '));
      currentObsTokens = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const isTafStart = /^(TAF|AMD\s+TAF|COR\s+TAF)\b/i.test(line) ||
      (/^[A-Z]{4}\s+\d{6}Z\s+\d{4}\/\d{4}\b/i.test(line) && !/^(METAR|SPECI)\b/i.test(line));

    const isObsStart = /^(METAR|SPECI|COR\s+METAR|COR\s+SPECI)\b/i.test(line) ||
      (/^[A-Z]{4}\s+\d{6}Z\s+(\d{3}|VRB)\d{2}/i.test(line) && !/\d{4}\/\d{4}/.test(line));

    const isChangeGroup = /^(BECMG|TEMPO|FM\d{2,6}|PROB\d{2})\b/i.test(line);

    if (isTafStart) {
      flushTaf();
      flushObs();
      currentTafTokens.push(line.replace(/=/g, ' '));
      if (line.endsWith('=')) {
        const nextLine = lines[i + 1] ? lines[i + 1].trim() : '';
        if (nextLine && /^(BECMG|TEMPO|FM\d|PROB\d)\b/i.test(nextLine)) {
          // Keep attaching following change groups to this TAF
        } else {
          flushTaf();
        }
      }
    } else if (isObsStart) {
      flushTaf();
      flushObs();
      currentObsTokens.push(line.replace(/=/g, ' '));
      if (line.endsWith('=')) {
        flushObs();
      }
    } else if (isChangeGroup && currentTafTokens.length > 0) {
      // BECMG/TEMPO group attached to current TAF!
      currentTafTokens.push(line.replace(/=/g, ' '));
      if (line.endsWith('=')) {
        const nextLine = lines[i + 1] ? lines[i + 1].trim() : '';
        if (!nextLine || !/^(BECMG|TEMPO|FM\d|PROB\d)\b/i.test(nextLine)) {
          flushTaf();
        }
      }
    } else if (currentTafTokens.length > 0 && !isObsStart) {
      // Line continuation of current TAF
      currentTafTokens.push(line.replace(/=/g, ' '));
      if (line.endsWith('=')) {
        const nextLine = lines[i + 1] ? lines[i + 1].trim() : '';
        if (!nextLine || !/^(BECMG|TEMPO|FM\d|PROB\d)\b/i.test(nextLine)) {
          flushTaf();
        }
      }
    } else if (currentObsTokens.length > 0 && !isTafStart) {
      // Line continuation of current OBS
      currentObsTokens.push(line.replace(/=/g, ' '));
      if (line.endsWith('=')) {
        flushObs();
      }
    } else {
      if (/TAF\s+[A-Z]{4}/i.test(line)) {
        flushTaf();
        flushObs();
        currentTafTokens.push(line.replace(/=/g, ' '));
      } else if (/(METAR|SPECI)\s+[A-Z]{4}/i.test(line)) {
        flushTaf();
        flushObs();
        currentObsTokens.push(line.replace(/=/g, ' '));
      }
    }
  }

  flushTaf();
  flushObs();

  // Fallback: If no TAFs were found with line structure, split by '='
  if (tafTexts.length === 0) {
    const eqParts = text.split('=');
    let pendingTaf: string | null = null;

    for (let part of eqParts) {
      part = part.trim();
      if (!part) continue;
      const norm = part.replace(/\s+/g, ' ');

      if (norm.startsWith('TAF') || norm.includes('TAF ') || /^[A-Z]{4}\s+\d{6}Z\s+\d{4}\/\d{4}/.test(norm)) {
        if (pendingTaf) {
          tafTexts.push(pendingTaf);
        }
        pendingTaf = part;
      } else if (/^(BECMG|TEMPO|FM\d|PROB\d)\b/i.test(norm) && pendingTaf) {
        pendingTaf += ' ' + part;
      } else if (/^(METAR|SPECI)\b/i.test(norm) || /^[A-Z]{4}\s+\d{6}Z/i.test(norm)) {
        if (pendingTaf) {
          tafTexts.push(pendingTaf);
          pendingTaf = null;
        }
        obsTexts.push(part);
      } else {
        if (pendingTaf) {
          pendingTaf += ' ' + part;
        }
      }
    }
    if (pendingTaf) {
      tafTexts.push(pendingTaf);
    }
  }

  return { tafTexts, obsTexts };
}

// Extract TAFs and METARs from raw text
export function parseReportsFromText(text: string, fileName?: string): ParsedReports {
  const tafs: TafReport[] = [];
  const observations: WeatherCondition[] = [];

  const { tafTexts, obsTexts } = splitBulletins(text);

  // Parse TAFs
  for (const tafStr of tafTexts) {
    const cleanTaf = tafStr.replace(/=/g, '').trim() + ' =';
    const parsed = parseTaf(cleanTaf);
    if (parsed) {
      tafs.push(parsed);
    }
  }

  // Parse Observations (METAR / SPECI)
  for (const obsStr of obsTexts) {
    const cleanObs = obsStr.replace(/=/g, '').trim() + ' =';
    const parsed = parseMetarOrSpeci(cleanObs);
    if (parsed) {
      observations.push(parsed);
    }
  }

  const dateInfo = getReferenceDateInfo(text, fileName);
  const stations = Array.from(new Set(tafs.map(t => t.station.toUpperCase()))).sort();

  return {
    tafs,
    observations,
    rawText: text,
    referenceMonthYear: dateInfo.monthYearStr,
    monthYearForFile: dateInfo.monthYearForFile,
    fileHeader: dateInfo.fullHeader,
    fileNames: fileName ? [fileName] : [],
    stations
  };
}

// Convert HTML to simple text
function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}

// Parse single file content based on extension
export async function parseFile(file: File): Promise<ParsedReports> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    if (extension === 'txt' || extension === 'csv') {
      reader.onload = (e) => {
        const text = e.target?.result as string;
        resolve(parseReportsFromText(text, file.name));
      };
      reader.onerror = () => reject(new Error(`Lỗi khi đọc file ${file.name}.`));
      reader.readAsText(file);

    } else if (extension === 'html') {
      reader.onload = (e) => {
        const html = e.target?.result as string;
        const text = stripHtml(html);
        resolve(parseReportsFromText(text, file.name));
      };
      reader.onerror = () => reject(new Error(`Lỗi khi đọc file HTML ${file.name}.`));
      reader.readAsText(file);

    } else if (extension === 'docx') {
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const result = await mammoth.extractRawText({ arrayBuffer });
          resolve(parseReportsFromText(result.value, file.name));
        } catch (error) {
          reject(new Error(`Lỗi khi phân giải file .docx (${file.name}): ` + (error as Error).message));
        }
      };
      reader.onerror = () => reject(new Error(`Lỗi khi đọc file Word ${file.name}.`));
      reader.readAsArrayBuffer(file);

    } else if (extension === 'xlsx' || extension === 'xls') {
      reader.onload = (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          let text = '';
          workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            text += XLSX.utils.sheet_to_txt(worksheet) + '\n';
          });
          resolve(parseReportsFromText(text, file.name));
        } catch (error) {
          reject(new Error(`Lỗi khi phân giải file Excel (${file.name}): ` + (error as Error).message));
        }
      };
      reader.onerror = () => reject(new Error(`Lỗi khi đọc file Excel ${file.name}.`));
      reader.readAsArrayBuffer(file);

    } else {
      reject(new Error(`Định dạng file "${file.name}" không được hỗ trợ. Hãy tải lên .txt, .docx, .xlsx, .csv hoặc .html.`));
    }
  });
}

// Parse multiple files simultaneously
export async function parseMultipleFiles(files: File[]): Promise<ParsedReports> {
  if (files.length === 0) {
    throw new Error('Vui lòng chọn ít nhất một file dữ liệu.');
  }

  if (files.length === 1) {
    return parseFile(files[0]);
  }

  // Parse each file
  const parsedList = await Promise.all(files.map(f => parseFile(f)));

  const allTafs: TafReport[] = [];
  const allObs: WeatherCondition[] = [];
  const seenTafs = new Set<string>();
  const seenObs = new Set<string>();

  let referenceMonthYear = '';
  let monthYearForFile = '';
  let fileHeader = '';

  for (let i = 0; i < parsedList.length; i++) {
    const item = parsedList[i];

    // Pick referenceMonthYear and monthYearForFile from the files that have them
    if (!referenceMonthYear && item.referenceMonthYear) {
      referenceMonthYear = item.referenceMonthYear;
      monthYearForFile = item.monthYearForFile || '';
    }
    if (!fileHeader && item.fileHeader) {
      fileHeader = item.fileHeader;
    }

    // Merge TAFs deduplicated
    for (const taf of item.tafs) {
      const key = `${taf.station}_${taf.validStartDay}_${taf.validStartHour}_${taf.raw.trim()}`;
      if (!seenTafs.has(key)) {
        seenTafs.add(key);
        allTafs.push(taf);
      }
    }

    // Merge METARs deduplicated
    for (const obs of item.observations) {
      const key = `${obs.station}_${obs.day}_${obs.hour}_${obs.minute}_${obs.raw.trim()}`;
      if (!seenObs.has(key)) {
        seenObs.add(key);
        allObs.push(obs);
      }
    }
  }

  const allStations = Array.from(new Set(allTafs.map(t => t.station.toUpperCase()))).sort();
  const fileNames = files.map(f => f.name);

  return {
    tafs: allTafs,
    observations: allObs,
    rawText: parsedList.map((p, idx) => `=== TỆP: ${files[idx].name} ===\n${p.rawText}`).join('\n\n'),
    referenceMonthYear: referenceMonthYear || parsedList[0].referenceMonthYear,
    monthYearForFile: monthYearForFile || parsedList[0].monthYearForFile,
    fileHeader: fileHeader || parsedList[0].fileHeader,
    fileNames,
    stations: allStations
  };
}
