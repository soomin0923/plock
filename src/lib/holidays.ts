import { addDays, parseYmd } from './date';

// Korean public holidays (공휴일), computed for any year:
// - solar holidays are fixed dates,
// - 설날 · 부처님오신날 · 추석 come from the Korean lunisolar calendar (Intl 'dangi', Korea time),
// - substitute holidays (대체공휴일) follow the current rules (2023~),
// - one-off holidays (elections, 임시공휴일) are listed explicitly.

const EXTRA: Record<string, string> = {
  '2025-01-27': '임시공휴일',
  '2025-06-03': '대통령선거',
  '2026-06-03': '지방선거',
  '2028-04-12': '국회의원선거',
};

let lunarFmt: Intl.DateTimeFormat | null | undefined;
function lunarMonthDay(date: string): string | null {
  if (lunarFmt === undefined) {
    try {
      lunarFmt = new Intl.DateTimeFormat('en-u-ca-dangi', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' });
      if (lunarFmt.resolvedOptions().calendar !== 'dangi') lunarFmt = null;
    } catch {
      lunarFmt = null;
    }
  }
  if (!lunarFmt) return null;
  const parts = lunarFmt.formatToParts(new Date(`${date}T12:00:00+09:00`));
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  // Leap months are formatted like "4bis", so they never match the plain numbers below.
  return m && d ? `${m}/${d}` : null;
}

const cache = new Map<number, Map<string, string>>();

export function holidaysOfYear(year: number): Map<string, string> {
  const hit = cache.get(year);
  if (hit) return hit;
  const map = new Map<string, string>();
  const add = (d: string, name: string) => {
    const prev = map.get(d);
    map.set(d, prev && !prev.includes(name) ? `${prev}·${name}` : name);
  };
  const y = String(year);
  const solar: [string, string, boolean][] = [
    // [MM-DD, name, gets a substitute holiday when it falls on a weekend]
    ['01-01', '신정', false],
    ['03-01', '삼일절', true],
    ['05-05', '어린이날', true],
    ['06-06', '현충일', false],
    ['08-15', '광복절', true],
    ['10-03', '개천절', true],
    ['10-09', '한글날', true],
    ['12-25', '성탄절', true],
  ];
  for (const [md, name] of solar) add(`${y}-${md}`, name);

  // Lunar holidays: scan the year once.
  let seollal: string | null = null;
  let chuseok: string | null = null;
  let buddha: string | null = null;
  for (let d = `${y}-01-01`; d.startsWith(y); d = addDays(d, 1)) {
    const md = lunarMonthDay(d);
    if (!md) break;
    if (md === '1/1') seollal = d;
    else if (md === '8/15') chuseok = d;
    else if (md === '4/8') buddha = d;
  }
  const threeDays = (center: string | null, name: string) => (center ? [addDays(center, -1), center, addDays(center, 1)].map((d) => (add(d, name), d)) : []);
  const seollalDays = threeDays(seollal, '설날');
  const chuseokDays = threeDays(chuseok, '추석');
  if (buddha) add(buddha, '부처님오신날');
  for (const [d, name] of Object.entries(EXTRA)) if (d.startsWith(y)) add(d, name);

  // 대체공휴일
  const isOff = (d: string) => map.has(d) || parseYmd(d).getDay() === 0;
  const nextFreeWeekday = (from: string) => {
    let d = addDays(from, 1);
    while (isOff(d) || parseYmd(d).getDay() === 6) d = addDays(d, 1);
    return d;
  };
  const overlaps = (d: string) => (map.get(d) || '').includes('·');
  const subs: string[] = [];
  for (const days of [seollalDays, chuseokDays]) {
    // 설날·추석: only when a day falls on Sunday or overlaps another holiday.
    if (days.length && days.some((d) => parseYmd(d).getDay() === 0 || overlaps(d))) subs.push(days[2]);
  }
  const weekendRule = [...solar.filter((s) => s[2]).map(([md]) => `${y}-${md}`), ...(buddha ? [buddha] : [])];
  for (const d of weekendRule) {
    // A day inside 설날/추석 is already covered by the rule above (one substitute per overlap).
    if (seollalDays.includes(d) || chuseokDays.includes(d)) continue;
    const wd = parseYmd(d).getDay();
    if (wd === 0 || wd === 6 || overlaps(d)) subs.push(d);
  }
  for (const base of Array.from(new Set(subs)).sort()) add(nextFreeWeekday(base), '대체공휴일');

  cache.set(year, map);
  return map;
}

/** Holiday name for a date (YYYY-MM-DD), or undefined. */
export function holidayName(date: string): string | undefined {
  return holidaysOfYear(Number(date.slice(0, 4))).get(date);
}

export function isHoliday(date: string): boolean {
  return !!holidayName(date);
}
