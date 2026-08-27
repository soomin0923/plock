import { PlannerItem, RoutineItem, ChecklistItem, DiaryEntry, FinancialEntry, UserCustomSticker, CustomCategory } from '../types';

export const DEFAULT_CATEGORIES: CustomCategory[] = [
  { id: 'work', name: '업무/직장', color: '#1A1A1A' },
  { id: 'coding_test', name: '코딩테스트', color: '#0F766E' },
  { id: 'personal', name: '개인일정', color: '#C1876B' },
  { id: 'health', name: '운동/건강', color: '#849283' },
  { id: 'study', name: '자기계발', color: '#7A6B58' },
  { id: 'finance', name: '가계/금융', color: '#B25D3B' },
  { id: 'travel', name: '여행/외출', color: '#3E5240' },
  { id: 'routine', name: '루틴/반복', color: '#2A2A2A' },
  { id: 'other', name: '기타', color: '#6B7280' },
];

export const INITIAL_PLANNER_ITEMS: PlannerItem[] = [];
export const INITIAL_ROUTINES: RoutineItem[] = [];
export const INITIAL_CHECKLIST: ChecklistItem[] = [];
export const INITIAL_DIARIES: DiaryEntry[] = [];
export const INITIAL_FINANCIALS: FinancialEntry[] = [];
export const INITIAL_PRESET_STICKERS = [
  { id: 'stk_1', name: '하트 스티커', imageUrl: '💖', type: 'emoji' },
  { id: 'stk_2', name: '반짝 스파클', imageUrl: '✨', type: 'emoji' },
  { id: 'stk_3', name: '행운의 클로버', imageUrl: '🍀', type: 'emoji' },
  { id: 'stk_4', name: '해바라기', imageUrl: '🌻', type: 'emoji' },
  { id: 'stk_5', name: '커피 타임', imageUrl: '☕', type: 'emoji' },
  { id: 'stk_6', name: '체크 바인더', imageUrl: '📌', type: 'emoji' },
  { id: 'stk_7', name: '별나라', imageUrl: '⭐', type: 'emoji' },
  { id: 'stk_8', name: '곰돌이 감사', imageUrl: '🧸', type: 'emoji' },
  { id: 'stk_9', name: '무지개', imageUrl: '🌈', type: 'emoji' },
  { id: 'stk_10', name: '음악 노트', imageUrl: '🎵', type: 'emoji' },
  { id: 'stk_11', name: '여름 바다', imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=150&auto=format&fit=crop&q=80', type: 'image' },
  { id: 'stk_12', name: '마스킹 테이프', imageUrl: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=150&auto=format&fit=crop&q=80', type: 'image' },
  { id: 'stk_13', name: '빈티지 우표', imageUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=150&auto=format&fit=crop&q=80', type: 'image' },
  { id: 'stk_14', name: '귀여운 고양이', imageUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=150&auto=format&fit=crop&q=80', type: 'image' },
];
export const INITIAL_USER_STICKERS: UserCustomSticker[] = [];
