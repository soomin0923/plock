import { CustomCategory, PlannerItem, ChecklistItem, RoutineItem } from '../types';
import { getGoogleGeminiApiHeaders } from './geminiAuthService';

export interface ParsedTaskResult {
  title: string;
  actionType: 'both' | 'planner' | 'checklist' | 'routine';
  targetDate: string; // YYYY-MM-DD (main target / end deadline)
  startDate: string; // YYYY-MM-DD (start of event or period)
  endDate: string; // YYYY-MM-DD (end of event or period)
  isDateRange: boolean; // true if startDate !== endDate
  durationDays: number; // e.g. 3 days
  startTime?: string | null; // HH:mm
  endTime?: string | null; // HH:mm
  categoryId: string;
  categoryName?: string;
  priority: 'high' | 'medium' | 'low';
  plannerTitle?: string;
  checklistTitle?: string;
  description?: string;
  routineFrequency?: 'daily' | 'weekdays' | 'weekends' | 'weekly' | null;
  reasoning: string;
  isAiParsed?: boolean;
}

const DAY_KR_MAP: { [key: string]: number } = {
  '일': 0, '일요일': 0,
  '월': 1, '월요일': 1,
  '화': 2, '화요일': 2,
  '수': 3, '수요일': 3,
  '목': 4, '목요일': 4,
  '금': 5, '금요일': 5,
  '토': 6, '토요일': 6,
};

const DAY_NAMES_KR = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

/**
 * Format a Date object to YYYY-MM-DD
 */
export function formatDateYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Calculate difference in days between two YYYY-MM-DD strings (+1 for inclusive duration)
 */
export function calculateDurationDays(startDateStr: string, endDateStr: string): number {
  try {
    const s = new Date(startDateStr + 'T00:00:00');
    const e = new Date(endDateStr + 'T00:00:00');
    const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff + 1);
  } catch {
    return 1;
  }
}

/**
 * Parse date from a string or relative Korean expression based on referenceDate (today)
 */
export function calculateKoreanDate(
  expr: string,
  baseDateStr: string = formatDateYMD(new Date()),
  contextMonth?: number // 1-12
): { dateStr: string; desc: string; month?: number } {
  const base = new Date(baseDateStr + 'T00:00:00');
  const baseDay = base.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat

  let trimmed = expr.trim();
  // Strip trailing 조사
  trimmed = trimmed.replace(/(?:부터|까지|에|에서|로|으로)$/, '').trim();

  // 1. Explicit relative keywords
  if (trimmed.includes('오늘')) {
    return { dateStr: formatDateYMD(base), desc: '오늘', month: base.getMonth() + 1 };
  }
  if (trimmed.includes('내일모레') || trimmed.includes('모레')) {
    const d = new Date(base);
    d.setDate(d.getDate() + 2);
    return { dateStr: formatDateYMD(d), desc: '모레', month: d.getMonth() + 1 };
  }
  if (trimmed.includes('내일')) {
    const d = new Date(base);
    d.setDate(d.getDate() + 1);
    return { dateStr: formatDateYMD(d), desc: '내일', month: d.getMonth() + 1 };
  }
  if (trimmed.includes('글피')) {
    const d = new Date(base);
    d.setDate(d.getDate() + 3);
    return { dateStr: formatDateYMD(d), desc: '글피', month: d.getMonth() + 1 };
  }
  if (trimmed.includes('어제')) {
    const d = new Date(base);
    d.setDate(d.getDate() - 1);
    return { dateStr: formatDateYMD(d), desc: '어제', month: d.getMonth() + 1 };
  }

  // 2. "N일 뒤", "N일 후"
  const daysLaterMatch = trimmed.match(/(\d+)\s*일\s*(?:뒤|후)/);
  if (daysLaterMatch) {
    const days = parseInt(daysLaterMatch[1], 10);
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return { dateStr: formatDateYMD(d), desc: `${days}일 후`, month: d.getMonth() + 1 };
  }

  // 3. "이번 주 [요일]" or "이번주 [요일]"
  const thisWeekMatch = trimmed.match(/(?:이번\s*주|이번주)\s*([월화수목금토일](?:요일)?)/);
  if (thisWeekMatch) {
    const targetDayName = thisWeekMatch[1];
    const targetDayIdx = DAY_KR_MAP[targetDayName] !== undefined ? DAY_KR_MAP[targetDayName] : DAY_KR_MAP[targetDayName[0]];

    if (targetDayIdx !== undefined) {
      const currentMondayOffset = (baseDay === 0 ? -6 : 1 - baseDay);
      const targetMondayOffset = (targetDayIdx === 0 ? 6 : targetDayIdx - 1);
      const diff = currentMondayOffset + targetMondayOffset;

      const d = new Date(base);
      d.setDate(d.getDate() + diff);
      return { dateStr: formatDateYMD(d), desc: `이번 주 ${DAY_NAMES_KR[targetDayIdx]}`, month: d.getMonth() + 1 };
    }
  }

  // 4. "다음 주 [요일]" or "다음주 [요일]"
  const nextWeekMatch = trimmed.match(/(?:다음\s*주|다음주)\s*([월화수목금토일](?:요일)?)/);
  if (nextWeekMatch) {
    const targetDayName = nextWeekMatch[1];
    const targetDayIdx = DAY_KR_MAP[targetDayName] !== undefined ? DAY_KR_MAP[targetDayName] : DAY_KR_MAP[targetDayName[0]];

    if (targetDayIdx !== undefined) {
      const currentMondayOffset = (baseDay === 0 ? -6 : 1 - baseDay);
      const targetMondayOffset = (targetDayIdx === 0 ? 6 : targetDayIdx - 1);
      const diff = currentMondayOffset + targetMondayOffset + 7;

      const d = new Date(base);
      d.setDate(d.getDate() + diff);
      return { dateStr: formatDateYMD(d), desc: `다음 주 ${DAY_NAMES_KR[targetDayIdx]}`, month: d.getMonth() + 1 };
    }
  }

  // 5. Plain day of week like "금요일", "일요일", "금", "일" (in Korean planner context)
  const plainDayMatch = trimmed.match(/^([월화수목금토일](?:요일)?)$/);
  if (plainDayMatch) {
    const targetDayName = plainDayMatch[1];
    const targetDayIdx = DAY_KR_MAP[targetDayName] !== undefined ? DAY_KR_MAP[targetDayName] : DAY_KR_MAP[targetDayName[0]];

    if (targetDayIdx !== undefined) {
      // In week context: relative to Monday of this week
      const currentMondayOffset = (baseDay === 0 ? -6 : 1 - baseDay);
      const targetMondayOffset = (targetDayIdx === 0 ? 6 : targetDayIdx - 1);
      let diff = currentMondayOffset + targetMondayOffset;
      // If day has passed earlier this week, move to upcoming
      if (diff < 0 && !trimmed.includes('이번')) {
        diff += 7;
      }

      const d = new Date(base);
      d.setDate(d.getDate() + diff);
      return { dateStr: formatDateYMD(d), desc: `${DAY_NAMES_KR[targetDayIdx]}`, month: d.getMonth() + 1 };
    }
  }

  // 6. Explicit full date "YYYY-MM-DD" or "YYYY/MM/DD"
  const fullDateMatch = trimmed.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (fullDateMatch) {
    const y = parseInt(fullDateMatch[1], 10);
    const m = String(parseInt(fullDateMatch[2], 10)).padStart(2, '0');
    const day = String(parseInt(fullDateMatch[3], 10)).padStart(2, '0');
    return { dateStr: `${y}-${m}-${day}`, desc: `${y}년 ${parseInt(m, 10)}월 ${parseInt(day, 10)}일`, month: parseInt(m, 10) };
  }

  // 7. Month & Day: "8월 28일", "8월 28", "8/28"
  const monthDayMatch = trimmed.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일?/);
  if (monthDayMatch) {
    const y = base.getFullYear();
    const m = String(parseInt(monthDayMatch[1], 10)).padStart(2, '0');
    const day = String(parseInt(monthDayMatch[2], 10)).padStart(2, '0');
    return { dateStr: `${y}-${m}-${day}`, desc: `${parseInt(m, 10)}월 ${parseInt(day, 10)}일`, month: parseInt(m, 10) };
  }

  const slashDateMatch = trimmed.match(/(\d{1,2})\/(\d{1,2})/);
  if (slashDateMatch) {
    const y = base.getFullYear();
    const m = String(parseInt(slashDateMatch[1], 10)).padStart(2, '0');
    const day = String(parseInt(slashDateMatch[2], 10)).padStart(2, '0');
    return { dateStr: `${y}-${m}-${day}`, desc: `${parseInt(m, 10)}월 ${parseInt(day, 10)}일`, month: parseInt(m, 10) };
  }

  // 8. Day only: "28일", "30일" (uses contextMonth if provided, otherwise base month)
  const dayOnlyMatch = trimmed.match(/(\d{1,2})\s*일?/);
  if (dayOnlyMatch) {
    const y = base.getFullYear();
    const targetMonth = contextMonth || (base.getMonth() + 1);
    const m = String(targetMonth).padStart(2, '0');
    const day = String(parseInt(dayOnlyMatch[1], 10)).padStart(2, '0');
    return { dateStr: `${y}-${m}-${day}`, desc: `${targetMonth}월 ${parseInt(day, 10)}일`, month: targetMonth };
  }

  // Default to today
  return { dateStr: formatDateYMD(base), desc: '오늘', month: base.getMonth() + 1 };
}

/**
 * Local Fallback Natural Language Parser
 */
export function localParseNaturalLanguage(
  input: string,
  referenceDateStr: string = formatDateYMD(new Date()),
  categories: CustomCategory[] = []
): ParsedTaskResult {
  const trimmed = input.trim();
  const base = new Date(referenceDateStr + 'T00:00:00');
  const baseDayKr = DAY_NAMES_KR[base.getDay()];

  let isDateRange = false;
  let startDate = referenceDateStr;
  let endDate = referenceDateStr;
  let targetDate = referenceDateStr;
  let dateDesc = '';
  let cleanTitle = trimmed;

  // 1. Check Date Range ("~부터 ~까지" or "~에서 ~까지")
  const rangeMatch = trimmed.match(/(.+?)\s*(?:부터|에서)\s*(.+?)\s*까지/);
  if (rangeMatch) {
    const startPart = rangeMatch[1].trim();
    const endPart = rangeMatch[2].trim();

    const startRes = calculateKoreanDate(startPart, referenceDateStr);
    const endRes = calculateKoreanDate(endPart, referenceDateStr, startRes.month);

    startDate = startRes.dateStr;
    endDate = endRes.dateStr;
    targetDate = endRes.dateStr;
    isDateRange = startDate !== endDate;
    dateDesc = `${startRes.desc} ~ ${endRes.desc}`;

    // Strip the range phrase from title
    cleanTitle = cleanTitle.replace(rangeMatch[0], '').trim();
  } else {
    // Single date or deadline ("~까지")
    const untilMatch = trimmed.match(/(.+?)\s*까지/);
    if (untilMatch) {
      const datePart = untilMatch[1].trim();
      const res = calculateKoreanDate(datePart, referenceDateStr);
      targetDate = res.dateStr;
      startDate = res.dateStr;
      endDate = res.dateStr;
      dateDesc = `${res.desc}까지`;
      cleanTitle = cleanTitle.replace(untilMatch[0], '').trim();
    } else {
      // Single start date ("~부터")
      const fromMatch = trimmed.match(/(.+?)\s*부터/);
      if (fromMatch) {
        const datePart = fromMatch[1].trim();
        const res = calculateKoreanDate(datePart, referenceDateStr);
        targetDate = res.dateStr;
        startDate = res.dateStr;
        endDate = res.dateStr;
        dateDesc = `${res.desc}부터`;
        cleanTitle = cleanTitle.replace(fromMatch[0], '').trim();
      } else {
        const res = calculateKoreanDate(trimmed, referenceDateStr);
        targetDate = res.dateStr;
        startDate = res.dateStr;
        endDate = res.dateStr;
        dateDesc = res.desc;
      }
    }
  }

  // 2. Extract Time (e.g., "오후 3시", "오전 9시 30분", "14:00")
  let startTime: string | null = null;
  let endTime: string | null = null;

  const timeMatch = trimmed.match(/(오전|오후|밤|새벽|낮|저녁)?\s*(\d{1,2})\s*(?:시|:)(\s*(\d{1,2})\s*분?)?/);
  if (timeMatch) {
    const meridian = timeMatch[1];
    let hour = parseInt(timeMatch[2], 10);
    const minute = timeMatch[4] ? parseInt(timeMatch[4], 10) : 0;

    if (meridian === '오후' || meridian === '밤' || meridian === '저녁') {
      if (hour < 12) hour += 12;
    } else if (meridian === '오전' || meridian === '새벽') {
      if (hour === 12) hour = 0;
    }

    startTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const endHour = hour + 1 < 24 ? hour + 1 : 23;
    endTime = `${String(endHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  // 3. Clean up the What (Title)
  cleanTitle = cleanTitle
    .replace(/(?:오늘|내일모레|모레|내일|글피|어제)/g, '')
    .replace(/(?:이번\s*주|이번주|다음\s*주|다음주)\s*[월화수목금토일](?:요일)?/g, '')
    .replace(/[월화수목금토일]요일/g, '')
    .replace(/\d{1,2}\s*월\s*\d{1,2}\s*일?/g, '')
    .replace(/\d{1,2}\/\d{1,2}/g, '')
    .replace(/\d+\s*일\s*(?:뒤|후)/g, '')
    .replace(/(?:오전|오후|밤|새벽|낮|저녁)?\s*\d{1,2}\s*(?:시|:)(?:\s*\d{1,2}\s*분?)?/g, '')
    .replace(/(?:부터|까지|에|에서|로|으로)/g, '')
    .replace(/(?:하기로\s*함|해야\s*함|하기|하자|할\s*것|예정|등록|추가|준비하기)/g, '')
    .trim();

  // If cleanTitle became empty or too short, revert to sensible summary
  if (cleanTitle.length === 0) {
    cleanTitle = trimmed;
  }

  // Clean trailing punctuation
  cleanTitle = cleanTitle.replace(/^[,\s.~!@#$%^&*()]+|[,\s.~!@#$%^&*()]+$/g, '');

  // 4. Categorize task
  let categoryId = 'other';
  let categoryName = '기타';

  const lower = trimmed.toLowerCase();
  if (lower.includes('청소') || lower.includes('빨래') || lower.includes('정리') || lower.includes('장보기') || lower.includes('마트') || lower.includes('분리수거') || lower.includes('집청소') || lower.includes('약속') || lower.includes('친구') || lower.includes('식사') || lower.includes('생일')) {
    categoryId = 'personal';
    categoryName = '개인일정';
  } else if (lower.includes('회의') || lower.includes('미팅') || lower.includes('보고') || lower.includes('출근') || lower.includes('업무') || lower.includes('고객') || lower.includes('메일') || lower.includes('발표') || lower.includes('마감') || lower.includes('프로젝트')) {
    categoryId = 'work';
    categoryName = '업무/직장';
  } else if (lower.includes('공부') || lower.includes('토익') || lower.includes('toeic') || lower.includes('강의') || lower.includes('과제') || lower.includes('코딩') || lower.includes('코테') || lower.includes('알고리즘') || lower.includes('독서') || lower.includes('시험') || lower.includes('연구')) {
    categoryId = 'study';
    categoryName = '자기계발';
  } else if (lower.includes('운동') || lower.includes('헬스') || lower.includes('러닝') || lower.includes('요가') || lower.includes('수영') || lower.includes('병원') || lower.includes('약') || lower.includes('영양제') || lower.includes('산책') || lower.includes('스트레칭')) {
    categoryId = 'health';
    categoryName = '운동/건강';
  } else if (lower.includes('가계부') || lower.includes('결제') || lower.includes('이체') || lower.includes('송금') || lower.includes('적금') || lower.includes('월급') || lower.includes('세금') || lower.includes('공과금') || lower.includes('지출')) {
    categoryId = 'finance';
    categoryName = '가계/금융';
  } else if (lower.includes('여행') || lower.includes('제주') || lower.includes('캠핑') || lower.includes('비행기') || lower.includes('숙소') || lower.includes('호텔') || lower.includes('휴가') || lower.includes('드라이브') || lower.includes('외출')) {
    categoryId = 'travel';
    categoryName = '여행/외출';
  } else if (lower.includes('매일') || lower.includes('루틴') || lower.includes('아침마다') || lower.includes('저녁마다') || lower.includes('습관')) {
    categoryId = 'routine';
    categoryName = '루틴/반복';
  }

  // Check against passed categories
  const matchedCustom = categories.find((c) => c.id === categoryId || c.name.includes(categoryName));
  if (matchedCustom) {
    categoryId = matchedCustom.id;
    categoryName = matchedCustom.name;
  }

  // 5. Determine action type
  let actionType: 'both' | 'planner' | 'checklist' | 'routine' = 'both';
  let routineFrequency: 'daily' | 'weekdays' | 'weekends' | 'weekly' | null = null;

  if (lower.includes('매일') || lower.includes('루틴') || lower.includes('아침마다') || lower.includes('저녁마다')) {
    actionType = 'routine';
    routineFrequency = lower.includes('평일') ? 'weekdays' : lower.includes('주말') ? 'weekends' : 'daily';
  } else if (lower.includes('할 일') || lower.includes('체크리스트') || lower.includes('체크')) {
    actionType = 'checklist';
  } else if (isDateRange || startTime || lower.includes('일정') || lower.includes('약속') || lower.includes('여행') || lower.includes('회의')) {
    actionType = 'both';
  }

  // Priority
  let priority: 'high' | 'medium' | 'low' = 'medium';
  if (lower.includes('급한') || lower.includes('중요') || lower.includes('반드시') || lower.includes('필수') || lower.includes('긴급')) {
    priority = 'high';
  } else if (lower.includes('여유') || lower.includes('천천히') || lower.includes('가볍게')) {
    priority = 'low';
  }

  const durationDays = calculateDurationDays(startDate, endDate);
  const reasoning = isDateRange
    ? `오늘(${referenceDateStr.slice(5)} ${baseDayKr}) 기준 [${startDate} ~ ${endDate} (${durationDays}일간)] 범위 일정으로 '${cleanTitle}'을(를) 자동 분류했습니다.`
    : `오늘(${referenceDateStr.slice(5)} ${baseDayKr}) 기준 [${dateDesc || targetDate}]에 '${cleanTitle}' 일정을 캘린더 및 할 일 목록에 자동 생성합니다.`;

  return {
    title: cleanTitle,
    actionType,
    targetDate,
    startDate,
    endDate,
    isDateRange,
    durationDays,
    startTime,
    endTime,
    categoryId,
    categoryName,
    priority,
    plannerTitle: cleanTitle,
    checklistTitle: cleanTitle,
    description: trimmed,
    routineFrequency,
    reasoning,
    isAiParsed: false,
  };
}

/**
 * Main parser function: Tries Gemini Server API first, falls back to local parser
 */
export async function parseNaturalLanguageTask(
  inputText: string,
  referenceDateStr: string = formatDateYMD(new Date()),
  categories: CustomCategory[] = [],
  userId?: string | null
): Promise<ParsedTaskResult> {
  const base = new Date(referenceDateStr + 'T00:00:00');
  const dayOfWeekKr = DAY_NAMES_KR[base.getDay()];
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  try {
    const headers = getGoogleGeminiApiHeaders(userId);
    const response = await fetch('/api/ai/parse-intent', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        text: inputText,
        referenceDate: referenceDateStr,
        dayOfWeek: dayOfWeekKr,
        currentTime,
        categories: categories.map((c) => ({ id: c.id, name: c.name })),
        userId: userId || undefined,
      }),
    });

    if (response.ok) {
      const json = await response.json();
      if (json.success && json.data && json.data.title) {
        const d = json.data;
        const startDate = d.startDate || d.targetDate || referenceDateStr;
        const endDate = d.endDate || d.targetDate || startDate;
        const isDateRange = startDate !== endDate;
        const durationDays = calculateDurationDays(startDate, endDate);

        return {
          title: d.title || inputText,
          actionType: d.actionType || 'both',
          targetDate: d.targetDate || endDate || referenceDateStr,
          startDate,
          endDate,
          isDateRange,
          durationDays,
          startTime: d.startTime || null,
          endTime: d.endTime || null,
          categoryId: d.categoryId || 'other',
          categoryName: d.categoryName || '기타',
          priority: d.priority || 'medium',
          plannerTitle: d.plannerTitle || d.title || inputText,
          checklistTitle: d.checklistTitle || d.title || inputText,
          description: d.description || inputText,
          routineFrequency: d.routineFrequency || null,
          reasoning: d.reasoning || (isDateRange
            ? `오늘 기준 [${startDate} ~ ${endDate} (${durationDays}일간)] 범위로 '${d.title}'을(를) 자동 분류했습니다.`
            : `오늘 기준 ${d.targetDate} 날짜에 '${d.title}'을(를) 자동 분류했습니다.`),
          isAiParsed: true,
        };
      }
    }
  } catch (err) {
    console.warn('AI Server parse failed, using local rule-based engine:', err);
  }

  // Fallback to local high-precision parser
  return localParseNaturalLanguage(inputText, referenceDateStr, categories);
}
