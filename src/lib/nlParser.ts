import type { Category, LedgerCategory, LedgerType, PayMethod, Priority } from '../types';
import { addDays, addMinutesHm, startOfWeek, weekday, ymd, parseYmd } from './date';

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
  categoryId: string;
  memo?: string;
  source: 'ai' | 'local';
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

/** Resolve a Korean date expression. Returns null when the text has no date in it. */
export function resolveKoreanDate(expr: string, base: string, contextMonth?: number): string | null {
  const t = expr.trim();
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

  const week = t.match(/(이번\s*주|다음\s*주|담주|다다음\s*주)?\s*([월화수목금토일])요일/);
  if (week) {
    const target = DAY_IDX[week[2]];
    const monday = startOfWeek(base, 1);
    const offset = target === 0 ? 6 : target - 1;
    let d = addDays(monday, offset);
    const prefix = (week[1] || '').replace(/\s/g, '');
    if (prefix === '다음주' || prefix === '담주') d = addDays(d, 7);
    else if (prefix === '다다음주') d = addDays(d, 14);
    else if (!prefix && d < base) d = addDays(d, 7); // bare "금요일" = the upcoming one
    return d;
  }

  const full = t.match(/(\d{4})[-./년]\s*(\d{1,2})[-./월]\s*(\d{1,2})/);
  if (full) return ymd(new Date(Number(full[1]), Number(full[2]) - 1, Number(full[3])));

  const md = t.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일?/) || t.match(/(?:^|\s)(\d{1,2})\/(\d{1,2})(?:\s|$)/);
  if (md) {
    const b = parseYmd(base);
    let d = new Date(b.getFullYear(), Number(md[1]) - 1, Number(md[2]));
    // "1월 3일" written in December means next year.
    if (ymd(d) < addDays(base, -60)) d = new Date(b.getFullYear() + 1, Number(md[1]) - 1, Number(md[2]));
    return ymd(d);
  }

  const dayOnly = t.match(/(?:^|[^\d])(\d{1,2})\s*일(?!\s*(?:뒤|후|간|동안))/);
  if (dayOnly) {
    const b = parseYmd(base);
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
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    let h = Number(m[2]);
    if (h > 24) continue;
    const min = m[3] === '반' ? 30 : m[3] ? parseInt(m[3], 10) : m[4] ? Number(m[4]) : 0;
    const mer = m[1];
    if (mer === '오후' || mer === '저녁' || mer === '밤') {
      if (h < 12) h += 12;
    } else if (mer === '오전' || mer === '새벽' || mer === '아침') {
      if (h === 12) h = 0;
    } else if (mer === '낮') {
      if (h < 7) h += 12;
    } else if (!m[4] && h >= 1 && h <= 7) {
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

function parseHabitDays(text: string): number[] {
  if (/평일/.test(text)) return [1, 2, 3, 4, 5];
  if (/주말/.test(text)) return [0, 6];
  const seq = text.match(/([월화수목금토일](?:요일)?(?:\s*[,·/]?\s*[월화수목금토일](?:요일)?)*)\s*(?:마다|에)/);
  if (seq) {
    const days = Array.from(seq[1].replace(/요일/g, '').replace(/[\s,·/]/g, '')).map((c) => DAY_IDX[c]).filter((d) => d !== undefined);
    if (days.length) return Array.from(new Set(days)).sort();
  }
  return [0, 1, 2, 3, 4, 5, 6];
}

export function localParsePlan(input: string, today: string, categories: Category[]): PlanDraft {
  const text = input.trim();
  let startDate: string | null = null;
  let endDate: string | null = null;
  let deadline = false;

  const range = text.match(/(.+?)\s*(?:부터|에서)\s*(.+?)\s*까지/);
  if (range) {
    startDate = resolveKoreanDate(range[1], today);
    const startMonth = startDate ? parseYmd(startDate).getMonth() + 1 : undefined;
    endDate = resolveKoreanDate(range[2], today, startMonth);
  }
  if (!startDate) {
    const until = text.match(/(.+?)\s*까지/);
    if (until) {
      startDate = resolveKoreanDate(until[1], today);
      deadline = !!startDate;
    }
  }
  if (!startDate) startDate = resolveKoreanDate(text, today);
  const hasDate = !!startDate;
  startDate = startDate || today;
  endDate = endDate && endDate >= startDate ? endDate : startDate;

  const times = parseTimes(text);
  const isHabit = /매일|매주|마다|루틴|습관|꾸준히/.test(text);
  const isTaskWord = /해야|하기$|제출|마감|신청|예약하기|사기|보내기|할\s*일|챙기기|끝내기/.test(text);
  const isEventWord = /약속|회의|미팅|여행|모임|수업|병원|예약|생일|콘서트|시험|면접|파티|데이트|공연|발표/.test(text);

  let kind: PlanDraft['kind'];
  if (isHabit) kind = 'habit';
  else if (deadline && !times.start) kind = 'task';
  else if (times.start || isEventWord || (range && endDate !== startDate)) kind = 'event';
  else if (isTaskWord || !hasDate) kind = 'task';
  else kind = 'event';

  let title = text;
  if (range) title = title.replace(range[0], ' ');
  times.raw.forEach((r) => (title = title.replace(r, ' ')));
  title = title
    .replace(/(이번\s*주|다음\s*주|담주|다다음\s*주)?\s*[월화수목금토일]요일/g, ' ')
    .replace(/\d{4}[-./년]\s*\d{1,2}[-./월]\s*\d{1,2}일?/g, ' ')
    .replace(/\d{1,2}\s*월\s*\d{1,2}\s*일?/g, ' ')
    .replace(/(?:^|\s)\d{1,2}\/\d{1,2}(?=\s|$)/g, ' ')
    .replace(/\d+\s*(?:일|주)\s*(?:뒤|후)/g, ' ')
    .replace(/(?:^|\s)\d{1,2}\s*일(?=\s|$|까지|부터|에)/g, ' ')
    .replace(/오늘|내일\s*모레|내일|모레|글피|어제|그저께|그제/g, ' ')
    .replace(/매일|매주|평일마다|주말마다|평일|주말|[월화수목금토일]+마다|마다/g, ' ')
    .replace(/(?:^|\s)(?:까지|부터|에|에서|에는)(?=\s|$)/g, ' ')
    .replace(/^\s*(?:까지|부터|에)\s*/, '')
    .replace(/\s*(?:하기로\s*함|해야\s*함|해야\s*돼|해야\s*해|할\s*것|하자|예정|등록|추가)\s*$/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.~·-]+|[\s,.~·-]+$/g, '')
    .trim();
  if (!title) title = text;

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
