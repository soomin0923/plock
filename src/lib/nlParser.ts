import type { Category, LedgerCategory, LedgerType, PayMethod, Priority } from '../types';
import { addDays, addMinutesHm, addMonths, startOfWeek, weekday, ymd, parseYmd } from './date';
import { holidaysOfYear } from './holidays';

// Rule-based Korean parser used when the user has no Gemini key (or the AI call fails).

export interface PlanDraft {
  kind: 'event' | 'task' | 'habit';
  title: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  dueDate?: string;
  dueTime?: string;
  priority: Priority;
  days: number[];
  /** Monthly habit (1–31, -1 = last day). */
  monthDays?: number[];
  categoryId: string;
  memo?: string;
  source: 'ai' | 'local';
  /** Parse-log row for this draft (see lib/parseLog.ts). */
  logId?: string;
}

export interface LedgerDraft {
  type: LedgerType;
  amount: number;
  categoryId: string;
  method: PayMethod;
  date: string;
  memo: string;
}

const DAY_IDX: Record<string, number> = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };
const KOR_NUM: Record<string, number> = { 한: 1, 두: 2, 세: 3, 네: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9, 열: 10, 열한: 11, 열두: 12 };
const KOR_DAYS: Record<string, number> = { 하루: 1, 이틀: 2, 사흘: 3, 나흘: 4, 닷새: 5, 엿새: 6, 이레: 7, 열흘: 10, 보름: 15 };
const NTH: Record<string, number> = { 첫: 1, 첫째: 1, 둘째: 2, 셋째: 3, 넷째: 4, 다섯째: 5, 마지막: -1 };

/**
 * Rewrite the casual forms people actually type into the forms the resolver reads:
 * 낼 → 내일, 담주 → 다음 주, 화욜 → 화요일, 금 7시 → 금요일 7시, 세 시 → 3시, 이틀 뒤 → 2일 뒤,
 * 일주일 → 1주, 10.15 / 10/15 → 10월 15일, 월~수 / 토일 → 월요일부터 수요일까지, 15~17시 → 15시~17시.
 */
export function normalizeKorean(input: string): string {
  let t = ` ${input} `;
  t = t.replace(/\(\s*[월화수목금토일](?:요일)?\s*\)/g, ' '); // 10/12(월)
  t = t.replace(/(\s)낼\s*모레/g, '$1내일모레').replace(/(\s)낼(?=\s|까지|부터|은|도|에)/g, '$1내일');
  t = t.replace(/담주/g, '다음 주').replace(/담달/g, '다음 달');
  t = t.replace(/(다다음|다음|이번|저번|지난)\s*(주|달)/g, '$1 $2');
  t = t.replace(/([월화수목금토일])욜/g, '$1요일');
  t = t.replace(/(열한|열두|다섯|여섯|일곱|여덟|아홉|한|두|세|네|열)\s*시(?![간작])/g, (_, w: string) => `${KOR_NUM[w]}시`);
  t = t.replace(/(하루|이틀|사흘|나흘|닷새|엿새|이레|열흘|보름)(?=\s*(?:뒤|후|간|동안))/g, (w) => `${KOR_DAYS[w]}일`);
  t = t.replace(/일주일/g, '1주').replace(/(한|두|세|네)\s*(주|달)(?=\s*(?:뒤|후|간|동안))/g, (_, w: string, u: string) => `${KOR_NUM[w]}${u}`);
  t = t.replace(/(\d+)\s*개월/g, '$1달');
  // 10.15 / 10/15 → 10월 15일 (only plausible month/day pairs, not times or decimals)
  t = t.replace(/(^|[\s~(])(\d{1,2})[./](\d{1,2})(?=[\s~(]|까지|부터|에|$)/g, (m, p: string, a: string, b: string) =>
    +a >= 1 && +a <= 12 && +b >= 1 && +b <= 31 ? `${p}${+a}월 ${+b}일` : m,
  );
  // Date ranges written with ~
  t = t.replace(/(\d{1,2}월\s*\d{1,2}일)\s*~\s*(\d{1,2}월\s*\d{1,2}일|\d{1,2}일)/g, '$1부터 $2까지');
  t = t.replace(/(^|\s)([월화수목금토일])(?:요일)?\s*~\s*([월화수목금토일])(?:요일)?(?=\s|$)/g, '$1$2요일부터 $3요일까지');
  // Two consecutive weekdays (토일, 수목) = a span; non-consecutive runs (월수금) are left for the habit check.
  t = t.replace(/(\s)([월화수목금토일])([월화수목금토일])(?=\s)/g, (m, p: string, a: string, b: string) =>
    (DAY_IDX[a] + 1) % 7 === DAY_IDX[b] ? `${p}${a}요일부터 ${b}요일까지` : m,
  );
  // One-letter weekday before a time / day part / 까지: 금 7시, 다음 주 토 10시, 월 오전
  t = t.replace(/(\s)([월화수목금토])(?=\s*(?:\d|오전|오후|아침|점심|저녁|밤|새벽|낮|까지|부터))/g, '$1$2요일');
  t = t.replace(/(주\s+)일(?=\s*(?:\d|오전|오후|아침|점심|저녁|밤|새벽|낮|까지|부터))/g, '$1일요일');
  // Hour ranges: 15~17시 → 15시~17시
  t = t.replace(/(\d{1,2})\s*~\s*(\d{1,2})\s*시/g, '$1시~$2시');
  return t.replace(/\s+/g, ' ').trim();
}

const FIXED_DAYS: [RegExp, string][] = [
  [/(?:크리스마스|성탄절?)\s*이브/, '12-24'],
  [/크리스마스|성탄절/, '12-25'],
  [/신정|새해\s*첫\s*날/, '01-01'],
  [/삼일절/, '03-01'],
  [/어린이\s*날/, '05-05'],
  [/어버이\s*날/, '05-08'],
  [/현충일/, '06-06'],
  [/광복절/, '08-15'],
  [/개천절/, '10-03'],
  [/한글날/, '10-09'],
  [/할로윈|핼러윈/, '10-31'],
  [/빼빼로\s*데이/, '11-11'],
  [/발렌타인\s*데이/, '02-14'],
  [/화이트\s*데이/, '03-14'],
  [/제야|섣달\s*그믐|마지막\s*날\s*밤/, '12-31'],
];
const LUNAR_DAYS: [RegExp, string][] = [
  [/설날|설\s*연휴|구정/, '설날'],
  [/추석|한가위/, '추석'],
  [/부처님\s*오신\s*날|석가탄신일/, '부처님오신날'],
];

/** 크리스마스, 어린이날, 추석 … → the next such day on or after base. Lunar days use the holiday table. */
function namedDay(t: string, base: string): string | null {
  const year = parseYmd(base).getFullYear();
  for (const [re, md] of FIXED_DAYS) {
    if (!re.test(t)) continue;
    const d = `${year}-${md}`;
    return d >= base ? d : `${year + 1}-${md}`;
  }
  for (const [re, name] of LUNAR_DAYS) {
    if (!re.test(t)) continue;
    for (const y of [year, year + 1]) {
      const days = [...holidaysOfYear(y)].filter(([, n]) => n.includes(name)).map(([d]) => d).sort();
      // 설날·추석 are three days off; the day itself is the middle one.
      const day = days.length >= 3 ? days[1] : days[0];
      if (day && day >= base) return day;
    }
  }
  return null;
}

function nthWeekdayOfMonth(year: number, month0: number, dow: number, n: number): string {
  if (n < 0) {
    const last = new Date(year, month0 + 1, 0);
    last.setDate(last.getDate() - ((last.getDay() - dow + 7) % 7));
    return ymd(last);
  }
  const first = new Date(year, month0, 1);
  first.setDate(1 + ((dow - first.getDay() + 7) % 7) + (n - 1) * 7);
  return ymd(first);
}

function monthOffset(word: string): number {
  return word === '다다음' ? 2 : word === '다음' ? 1 : word === '지난' || word === '저번' ? -1 : 0;
}

/** Resolve a Korean date expression. Returns null when the text has no date in it. */
export function resolveKoreanDate(expr: string, base: string, contextMonth?: number): string | null {
  const t = normalizeKorean(expr);
  const b = parseYmd(base);
  if (/그저께|그제/.test(t)) return addDays(base, -2);
  if (/어제/.test(t)) return addDays(base, -1);
  if (/오늘/.test(t)) return base;
  if (/내일\s*모레|모레/.test(t)) return addDays(base, 2);
  if (/내일/.test(t)) return addDays(base, 1);
  if (/글피/.test(t)) return addDays(base, 3);

  const later = t.match(/(\d+)\s*일\s*(?:뒤|후)/);
  if (later) return addDays(base, Number(later[1]));
  const weeksLater = t.match(/(\d+)\s*주\s*(?:뒤|후)/);
  if (weeksLater) return addDays(base, Number(weeksLater[1]) * 7);
  const monthsLater = t.match(/(\d+)\s*달\s*(?:뒤|후)/);
  if (monthsLater) return addMonths(base, Number(monthsLater[1]));

  // 11월 첫째 주 월요일, 다음 달 마지막 금요일
  const nth = t.match(/(?:(\d{1,2})\s*월|(이번|다음|다다음)\s*달)\s*(첫째|첫|둘째|셋째|넷째|다섯째|마지막)\s*(?:주\s*)?([월화수목금토일])요일/);
  if (nth) {
    let y = b.getFullYear();
    let m0 = nth[1] ? Number(nth[1]) - 1 : b.getMonth() + monthOffset(nth[2]);
    if (nth[1] && m0 < b.getMonth() - 1) y += 1;
    const d = nthWeekdayOfMonth(y, m0, DAY_IDX[nth[4]], NTH[nth[3]]);
    return d;
  }

  // 월말, 10월 말, 다음 달 말
  const monthEnd = t.match(/(?:(\d{1,2})\s*월|(이번|다음|다다음)\s*달)?\s*말(?:까지|에|$|\s)/);
  if (monthEnd && (monthEnd[1] || monthEnd[2] || /월말/.test(t))) {
    const m0 = monthEnd[1] ? Number(monthEnd[1]) - 1 : b.getMonth() + monthOffset(monthEnd[2] || '');
    let y = b.getFullYear();
    if (monthEnd[1] && m0 < b.getMonth() - 1) y += 1;
    return ymd(new Date(y, m0 + 1, 0));
  }

  // 이번 주말 / 다음 주 주말 / 주말 (not 주말마다): the Saturday of that week
  const weekend = t.match(/(이번|다음|다다음)?\s*주\s*(?:주말|말)|주말(?!\s*마다)/);
  if (weekend) {
    const sat = addDays(startOfWeek(base, 1), 5);
    const add = weekend[1] === '다음' ? 7 : weekend[1] === '다다음' ? 14 : 0;
    const d = addDays(sat, add);
    return !weekend[1] && d < base ? base : d; // on a Sunday "주말" is today
  }

  const week = t.match(/(이번\s*주|다음\s*주|다다음\s*주)?\s*([월화수목금토일])요일/);
  if (week) {
    const target = DAY_IDX[week[2]];
    const monday = startOfWeek(base, 1);
    const offset = target === 0 ? 6 : target - 1;
    let d = addDays(monday, offset);
    const prefix = (week[1] || '').replace(/\s/g, '');
    if (prefix === '다음주') d = addDays(d, 7);
    else if (prefix === '다다음주') d = addDays(d, 14);
    else if (!prefix && d < base) d = addDays(d, 7); // bare "금요일" = the upcoming one
    return d;
  }

  const full = t.match(/(\d{4})[-./년]\s*(\d{1,2})[-./월]\s*(\d{1,2})/);
  if (full) return ymd(new Date(Number(full[1]), Number(full[2]) - 1, Number(full[3])));

  const md = t.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일?/);
  if (md) {
    let d = new Date(b.getFullYear(), Number(md[1]) - 1, Number(md[2]));
    // "1월 3일" written in December means next year.
    if (ymd(d) < addDays(base, -60)) d = new Date(b.getFullYear() + 1, Number(md[1]) - 1, Number(md[2]));
    return ymd(d);
  }

  // Named days: 크리스마스 이브, 어린이날, 추석 … (the next one on or after base).
  // After written dates, so "12월 24일 크리스마스 파티" keeps the 24th.
  const named = namedDay(t, base);
  if (named) return named;

  // 다음 달 15일
  const relMonthDay = t.match(/(이번|다음|다다음)\s*달\s*(\d{1,2})\s*일/);
  if (relMonthDay) return ymd(new Date(b.getFullYear(), b.getMonth() + monthOffset(relMonthDay[1]), Number(relMonthDay[2])));

  const dayOnly = t.match(/(?:^|[^\d])(\d{1,2})\s*일(?!\s*(?:뒤|후|간|동안))/);
  if (dayOnly) {
    const month = contextMonth ? contextMonth - 1 : b.getMonth();
    let d = new Date(b.getFullYear(), month, Number(dayOnly[1]));
    if (!contextMonth && ymd(d) < base) d = new Date(b.getFullYear(), month + 1, Number(dayOnly[1]));
    return ymd(d);
  }
  return null;
}

interface TimeMatch {
  start?: string;
  end?: string;
  raw: string[];
}

function parseTimes(text: string): TimeMatch {
  const re = /(오전|오후|아침|낮|저녁|밤|새벽)?\s*(\d{1,2})\s*(?:시\s*(반|\d{1,2}\s*분)?|:(\d{2}))/g;
  const found: { hm: string; raw: string }[] = [];
  // Context for a bare "8시": 이따/저녁 → evening, 기상/출근 → morning.
  const laterToday = /이따|퇴근\s*(?:후|하고)/.test(text);
  const morning = /기상|일어나|출근/.test(text);
  let m: RegExpExecArray | null;
  let lastMer: string | undefined;
  while ((m = re.exec(text))) {
    let h = Number(m[2]);
    if (h > 24) continue;
    const min = m[3] === '반' ? 30 : m[3] ? parseInt(m[3], 10) : m[4] ? Number(m[4]) : 0;
    // "오후 1시~4시": the second time inherits the first one's 오전/오후.
    const mer = m[1] || (found.length ? lastMer : undefined);
    if (m[1]) lastMer = m[1];
    if (mer === '오후' || mer === '저녁') {
      if (h < 12) h += 12;
    } else if (mer === '밤') {
      if (h === 12) h = 0; // 밤 12시 = midnight
      else if (h >= 6 && h < 12) h += 12;
    } else if (mer === '오전' || mer === '새벽' || mer === '아침') {
      if (h === 12) h = 0;
    } else if (mer === '낮') {
      if (h < 7) h += 12;
    } else if (!m[4] && laterToday && h < 12) {
      h += 12;
    } else if (!m[4] && !morning && h >= 1 && h <= 7) {
      h += 12; // "3시 회의" almost always means 15:00
    }
    found.push({ hm: `${String(h % 24).padStart(2, '0')}:${String(min).padStart(2, '0')}`, raw: m[0] });
  }
  return { start: found[0]?.hm, end: found[1]?.hm, raw: found.map((f) => f.raw) };
}

const CATEGORY_HINTS: [RegExp, string, RegExp][] = [
  [/회의|미팅|보고|출근|업무|고객|메일|발표|마감|프로젝트|야근|출장/, 'cat_work', /업무|일|회사|직장/],
  [/공부|토익|toeic|강의|과제|코딩|코테|알고리즘|독서|시험|스터디|수업|레포트|자격증/i, 'cat_study', /공부|학습|자기계발|스터디/],
  [/운동|헬스|러닝|달리기|요가|수영|필라테스|병원|약|영양제|산책|스트레칭|치과/, 'cat_health', /운동|건강/],
  [/약속|친구|모임|저녁 먹|점심 먹|데이트|생일|파티|만나/, 'cat_meet', /약속|모임|만남/],
  [/여행|제주|캠핑|비행기|숙소|호텔|휴가|드라이브|ktx|기차/i, 'cat_travel', /여행|외출/],
  [/청소|빨래|정리|장보기|마트|분리수거|설거지|은행|택배/, 'cat_personal', /개인|생활/],
];

function guessCategory(text: string, categories: Category[]): string {
  const byName = categories.find((c) => c.name.length >= 2 && text.includes(c.name));
  if (byName) return byName.id;
  for (const [re, id, nameRe] of CATEGORY_HINTS) {
    if (!re.test(text)) continue;
    const found = categories.find((c) => c.id === id) || categories.find((c) => nameRe.test(c.name));
    if (found) return found.id;
  }
  return categories.find((c) => c.id === 'cat_personal')?.id || categories[0]?.id || 'cat_etc';
}

/** 매월 15일 → [15], 매달 1일·15일 → [1, 15], 매 달 말일 / 마지막 날 / 월말 → [-1]. No day given → the 1st. */
function parseMonthDays(text: string): number[] {
  const out = new Set<number>();
  if (/말일|마지막\s*날|월말/.test(text)) out.add(-1);
  for (const m of text.matchAll(/(\d{1,2})\s*일/g)) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 31) out.add(n);
  }
  return out.size ? [...out].sort((a, b) => a - b) : [1];
}

function parseHabitDays(text: string): number[] {
  if (/평일/.test(text)) return [1, 2, 3, 4, 5];
  if (/주말/.test(text)) return [0, 6];
  const seq =
    text.match(/([월화수목금토일](?:요일)?(?:\s*[,·/]?\s*[월화수목금토일](?:요일)?)*)\s*(?:마다|에)/) ||
    text.match(/(?:^|\s)([월화수목금토일]{2,})(?=\s|$)/);
  if (seq) {
    const days = Array.from(seq[1].replace(/요일/g, '').replace(/[\s,·/]/g, '')).map((c) => DAY_IDX[c]).filter((d) => d !== undefined);
    if (days.length) return Array.from(new Set(days)).sort();
  }
  return [0, 1, 2, 3, 4, 5, 6];
}

export function localParsePlan(input: string, today: string, categories: Category[]): PlanDraft {
  const original = input.trim();
  let text = normalizeKorean(original);
  let startDate: string | null = null;
  let endDate: string | null = null;
  let deadline = false;

  // "1박2일", "3일간", "나흘 동안": a length in days counted from the start date.
  let spanDays = 0;
  const nights = text.match(/(\d+)\s*박\s*(\d+)\s*일/);
  if (nights) {
    spanDays = Number(nights[2]);
    text = text.replace(nights[0], ' ').replace(/\s+/g, ' ').trim();
  }
  const span = text.match(/(\d+)\s*일\s*(?:간|동안)/);
  if (span) spanDays = Number(span[1]);

  const range = text.match(/(.+?)\s*(?:부터|에서)\s*(.+?)\s*까지/);
  if (range) {
    startDate = resolveKoreanDate(range[1], today);
    if (startDate) {
      const startMonth = parseYmd(startDate).getMonth() + 1;
      // A weekday or bare day at the end counts from the start ("다음 주 월요일부터 수요일까지").
      const relative = !/오늘|내일|모레|글피|주|달|월/.test(range[2].replace(/[월화수목금토일]요일/g, ''));
      endDate = resolveKoreanDate(range[2], relative ? startDate : today, startMonth);
    }
  }
  if (!startDate) {
    const until = text.match(/(.+?)\s*까지/);
    if (until) {
      startDate = resolveKoreanDate(until[1], today);
      // "주말까지" means by the end of the weekend: Sunday, not Saturday.
      if (startDate && /주말/.test(until[1]) && weekday(startDate) === 6) startDate = addDays(startDate, 1);
      deadline = !!startDate;
    }
  }
  if (!startDate) startDate = resolveKoreanDate(text.replace(/\d+\s*일\s*(?:간|동안)/, ' '), today);
  if (startDate && spanDays > 1 && !endDate) endDate = addDays(startDate, spanDays - 1);

  const times = parseTimes(text);
  // No date word, but a clock time or a part of the day ("저녁에 장보기", "새벽 1시"): today,
  // or tomorrow when it is after midnight. Without either, there is no date (a to-do).
  const partOfDay = /아침|점심|저녁|밤|새벽|오전|오후|낮|이따|퇴근|출근/.test(text);
  if (!startDate && (times.start || partOfDay)) {
    startDate = times.start && times.start < '06:00' && /새벽|밤/.test(text) ? addDays(today, 1) : today;
  }
  const hasDate = !!startDate;
  startDate = startDate || today;
  endDate = endDate && endDate >= startDate ? endDate : startDate;

  const monthly = /매\s*(?:달|월)/.test(text);
  const isHabit = monthly || /매일|매주|마다|루틴|습관|꾸준히|평일|(?:^|\s)[월화수목금토일]{2,}(?=\s|$)/.test(text);
  // Things you hand in or pay by a time are to-dos even with a clock time ("밤 11시 과제 마감").
  const isDueWord = /마감|제출|납부|접수|입금|송금|정산/.test(text);
  const isTaskWord = /해야|하기$|신청하기|예약하기|사기|보내기|할\s*일|챙기기|끝내기/.test(text);
  const isEventWord = /약속|회의|미팅|여행|모임|수업|병원|예약|생일|콘서트|시험|면접|파티|데이트|공연|발표/.test(text);

  let kind: PlanDraft['kind'];
  if (isHabit) kind = 'habit';
  else if (!hasDate) kind = 'task';
  else if (deadline || isDueWord) kind = 'task';
  else if (times.start || isEventWord || endDate !== startDate) kind = 'event';
  else if (isTaskWord) kind = 'task';
  else kind = 'event';

  let title = text;
  if (range) title = title.replace(range[0], ' ');
  times.raw.forEach((r) => (title = title.replace(r, ' ')));
  title = title
    .replace(/(이번\s*주|다음\s*주|다다음\s*주)?\s*[월화수목금토일]요일/g, ' ')
    .replace(/(?:\d{1,2}\s*월|(?:이번|다음|다다음)\s*달)\s*(?:첫째|첫|둘째|셋째|넷째|다섯째|마지막)\s*주?/g, ' ')
    .replace(/(?:이번|다음|다다음)?\s*주\s*주말|(?:이번|다음|다다음)\s*주말|주말(?!\s*마다)/g, ' ')
    .replace(/(?:\d{1,2}\s*월\s*|(?:이번|다음|다다음)\s*달\s*)?말(?=까지|에|\s|$)|월말/g, ' ')
    .replace(/(?:이번|다음|다다음)\s*(?:주|달)/g, ' ')
    .replace(/\d+\s*일\s*(?:간|동안)|\d+\s*달\s*(?:뒤|후)/g, ' ')
    .replace(/이따가?/g, ' ')
    .replace(/\d{4}[-./년]\s*\d{1,2}[-./월]\s*\d{1,2}일?/g, ' ')
    .replace(/\d{1,2}\s*월\s*\d{1,2}\s*일?/g, ' ')
    .replace(/(?:^|\s)\d{1,2}\/\d{1,2}(?=\s|$)/g, ' ')
    .replace(/\d+\s*(?:일|주)\s*(?:뒤|후)/g, ' ')
    .replace(/(?:^|\s)\d{1,2}\s*일(?=\s|$|까지|부터|에)/g, ' ')
    .replace(/오늘|내일\s*모레|내일|모레|글피|어제|그저께|그제/g, ' ')
    .replace(/매\s*(?:달|월)\s*(?:(?:\d{1,2}\s*일[,·\s]*)+|말일|마지막\s*날|월말)?(?:\s*에)?/g, ' ')
    .replace(/매일|매주|평일마다|주말마다|평일|주말|[월화수목금토일]+마다|마다/g, ' ')
    .replace(/(?:^|\s)(?:까지|부터|에|에서|에는)(?=\s|$)/g, ' ')
    .replace(/^\s*(?:까지|부터|에)(?=\s|$)\s*/, '')
    .replace(/\s*(?:하기로\s*함|해야\s*함|해야\s*돼|해야\s*해|할\s*것|하자|예정|등록|추가)\s*$/g, '')
    .replace(/(?:^|\s)[~,]+(?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.~·-]+|[\s,.~·-]+$/g, '')
    .trim();
  if (!title) title = original;

  const priority: Priority = /급한|중요|반드시|필수|긴급|꼭/.test(text) ? 'high' : /여유|천천히|가볍게|틈틈이/.test(text) ? 'low' : 'medium';
  const startTime = times.start;
  const endTime = times.end && startTime && times.end > startTime ? times.end : startTime ? addMinutesHm(startTime, 60) : undefined;

  return {
    kind,
    title,
    startDate,
    endDate,
    startTime: kind === 'event' ? startTime : undefined,
    endTime: kind === 'event' ? endTime : undefined,
    dueDate: kind === 'task' ? (hasDate ? endDate : undefined) : undefined,
    dueTime: kind === 'task' ? startTime : undefined,
    priority,
    days: kind === 'habit' ? parseHabitDays(text) : [0, 1, 2, 3, 4, 5, 6],
    ...(kind === 'habit' && monthly ? { monthDays: parseMonthDays(text) } : {}),
    categoryId: guessCategory(text, categories),
    source: 'local',
  };
}

// ------------------------------------------------------------------ ledger

const LEDGER_HINTS: [RegExp, string][] = [
  [/월급|급여|알바비|봉급|상여|보너스/, 'lc_salary'],
  [/용돈/, 'lc_allowance'],
  [/부수입|중고|당근|판매|환급|캐시백/, 'lc_side'],
  [/이자|배당/, 'lc_interest'],
  [/커피|카페|스벅|스타벅스|라떼|아메리카노|디저트|케이크|간식|음료|버블티|빵|베이커리|아이스크림/, 'lc_cafe'],
  [/점심|저녁|아침|밥|식사|김밥|라면|치킨|피자|배달|마트|장보|편의점|햄버거|국밥|고기|분식|떡볶이|술|회식|식당|배민|요기요|쿠팡이츠/, 'lc_food'],
  [/버스|지하철|택시|교통|기차|ktx|srt|주유|기름|톨비|통행료|주차|따릉이/i, 'lc_transport'],
  [/월세|관리비|전기|가스|수도|통신|핸드폰|휴대폰|폰요금|인터넷|보험/, 'lc_housing'],
  [/병원|약국|약값|헬스|pt|필라테스|요가|치과|안경/i, 'lc_health'],
  [/학원|강의|인강|교재|수강|토익|시험|책값|문제집/, 'lc_edu'],
  [/선물|축의금|조의금|부조|경조사/, 'lc_gift'],
  [/영화|넷플릭스|유튜브|구독|공연|콘서트|게임|책|여행|노래방|pc방|전시|티켓/i, 'lc_culture'],
  [/옷|신발|쇼핑|쿠팡|무신사|올리브영|화장품|가방|에이블리|지그재그/, 'lc_shopping'],
  [/생필품|다이소|세제|휴지|생활용품|청소용품/, 'lc_living'],
];

function guessLedgerCategory(text: string, type: LedgerType, cats: LedgerCategory[]): string {
  const ofType = cats.filter((c) => c.type === type);
  const byName = ofType.find((c) => c.name.length >= 2 && text.includes(c.name));
  if (byName) return byName.id;
  for (const [re, id] of LEDGER_HINTS) {
    if (re.test(text)) {
      const found = ofType.find((c) => c.id === id);
      if (found) return found.id;
    }
  }
  return (ofType.find((c) => /기타/.test(c.name)) || ofType[ofType.length - 1])?.id || (type === 'income' ? 'lc_etc_in' : 'lc_etc_out');
}

function parseAmount(m: RegExpExecArray): number {
  const n = (s?: string) => Number((s || '').replace(/,/g, '')) || 0;
  const a = n(m[1]);
  let total = m[2] === '만' ? a * 10000 : m[2] === '천' ? a * 1000 : a;
  if (m[3]) total += m[4] === '천' ? n(m[3]) * 1000 : n(m[3]);
  return Math.round(total);
}

export function localParseLedger(input: string, today: string, cats: LedgerCategory[]): LedgerDraft[] {
  const text = input.trim();
  const date = /그저께|그제/.test(text) ? addDays(today, -2) : /어제/.test(text) ? addDays(today, -1) : resolveKoreanDate(text.replace(/\d[\d,]*\s*원/g, ''), today) || today;
  const globalMethod: PayMethod = /현금/.test(text) ? 'cash' : /이체|계좌|송금/.test(text) ? 'transfer' : 'card';
  const re = /(\d[\d,]*(?:\.\d+)?)\s*(만|천)?(?:\s*(\d[\d,]*)\s*(천)?)?\s*(원)?/g;
  const out: LedgerDraft[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const next = text.slice(m.index + m[0].length).trimStart()[0] || '';
    const hasUnit = !!(m[2] || m[5]);
    const amount = parseAmount(m);
    if (/[월일시분개명번살주]/.test(next) || (!hasUnit && amount < 100)) continue;
    const segment = text.slice(last, m.index);
    last = m.index + m[0].length;
    const isIncome = /월급|급여|용돈\s*받|입금|환급|수입|받음|받았|알바비|이자|캐시백/.test(segment || text);
    const type: LedgerType = isIncome ? 'income' : 'expense';
    const memo = segment
      .replace(/그저께|그제|어제|오늘/g, '')
      .replace(/카드|현금|계좌\s*이체|이체|송금|으로|로\s*결제|결제|썼음|썼다|씀|사용/g, '')
      .replace(/[,·/]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    out.push({ type, amount, categoryId: guessLedgerCategory(segment || text, type, cats), method: globalMethod, date, memo });
  }
  return out;
}

export function draftWeekdayLabel(d: string): string {
  return ['일', '월', '화', '수', '목', '금', '토'][weekday(d)];
}
