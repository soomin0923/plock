import type { Category, DiaryFont, LedgerCategory, Mood, PaperStyle, PayMethod, Prefs, Weather } from '../types';

const EPOCH = '2026-01-01T00:00:00.000Z';

// Defaults use fixed ids so that seeding on two devices at once can never create duplicates.
export const DEFAULT_CATEGORIES: Category[] = [
  ['cat_personal', '개인', '#C1876B'],
  ['cat_work', '업무', '#3F4A5A'],
  ['cat_study', '공부', '#6B5FA8'],
  ['cat_health', '운동·건강', '#4F8A6A'],
  ['cat_meet', '약속', '#C25B7A'],
  ['cat_travel', '여행', '#2F7FA8'],
  ['cat_etc', '기타', '#8A8378'],
].map(([id, name, color], order) => ({ id, name, color, order, createdAt: EPOCH, updatedAt: EPOCH }));

export const DEFAULT_LEDGER_CATEGORIES: LedgerCategory[] = [
  ['lc_food', 'expense', '식비', '🍚', '#E0913A'],
  ['lc_cafe', 'expense', '카페·간식', '☕', '#A9744F'],
  ['lc_transport', 'expense', '교통', '🚌', '#3D7DCA'],
  ['lc_shopping', 'expense', '쇼핑', '🛍️', '#D45D8C'],
  ['lc_living', 'expense', '생활', '🧻', '#5E9E7E'],
  ['lc_housing', 'expense', '주거·통신', '🏠', '#6C6FB4'],
  ['lc_culture', 'expense', '문화·여가', '🎬', '#8C5BB5'],
  ['lc_health', 'expense', '의료·건강', '💊', '#2E9C9C'],
  ['lc_edu', 'expense', '교육', '📚', '#B5873A'],
  ['lc_gift', 'expense', '경조·선물', '🎁', '#C2504E'],
  ['lc_etc_out', 'expense', '기타', '💸', '#8A8378'],
  ['lc_salary', 'income', '급여', '💼', '#2E8B57'],
  ['lc_allowance', 'income', '용돈', '💝', '#D16A8B'],
  ['lc_side', 'income', '부수입', '🪙', '#7BA23F'],
  ['lc_interest', 'income', '금융수입', '🏦', '#3E7CB1'],
  ['lc_etc_in', 'income', '기타', '✨', '#8A8378'],
].map(([id, type, name, emoji, color], order) => ({
  id,
  type: type as LedgerCategory['type'],
  name,
  emoji,
  color,
  order,
  createdAt: EPOCH,
  updatedAt: EPOCH,
}));

export const DEFAULT_PREFS: Prefs = { id: 'main', weekStartsOn: 0, createdAt: EPOCH, updatedAt: EPOCH };

export const PAY_METHODS: { id: PayMethod; label: string }[] = [
  { id: 'card', label: '카드' },
  { id: 'cash', label: '현금' },
  { id: 'transfer', label: '이체' },
  { id: 'etc', label: '기타' },
];

export const MOODS: { id: Mood; label: string; emoji: string; color: string }[] = [
  { id: 'joy', label: '기쁨', emoji: '😊', color: '#F2B233' },
  { id: 'calm', label: '평온', emoji: '😌', color: '#5DB58A' },
  { id: 'excited', label: '설렘', emoji: '🥰', color: '#EE7FB0' },
  { id: 'love', label: '감사', emoji: '🙏', color: '#E36C6C' },
  { id: 'tired', label: '피곤', emoji: '😪', color: '#9A9AA5' },
  { id: 'sad', label: '슬픔', emoji: '😢', color: '#5B8DD6' },
  { id: 'angry', label: '화남', emoji: '😤', color: '#D9534F' },
  { id: 'anxious', label: '불안', emoji: '😟', color: '#8E7CC3' },
];

export const WEATHERS: { id: Weather; label: string; emoji: string }[] = [
  { id: 'sunny', label: '맑음', emoji: '☀️' },
  { id: 'cloudy', label: '흐림', emoji: '☁️' },
  { id: 'rainy', label: '비', emoji: '🌧️' },
  { id: 'snowy', label: '눈', emoji: '❄️' },
  { id: 'windy', label: '바람', emoji: '🌬️' },
];

export const PAPERS: { id: PaperStyle; label: string }[] = [
  { id: 'plain', label: '기본' },
  { id: 'lined', label: '줄노트' },
  { id: 'grid', label: '모눈' },
  { id: 'dot', label: '도트' },
  { id: 'cream', label: '크림' },
  { id: 'pink', label: '핑크' },
  { id: 'mint', label: '민트' },
  { id: 'sky', label: '하늘' },
];

export const DIARY_FONTS: { id: DiaryFont; label: string; family: string }[] = [
  { id: 'sans', label: '기본', family: "'Pretendard Variable', Pretendard, system-ui, sans-serif" },
  { id: 'pen', label: '손글씨', family: "'Nanum Pen Script', 'Pretendard Variable', cursive" },
  { id: 'gaegu', label: '동글', family: "'Gaegu', 'Pretendard Variable', cursive" },
  { id: 'serif', label: '명조', family: "'Gowun Batang', 'Noto Serif KR', serif" },
];

export const EMOJI_STICKERS: { group: string; items: string[] }[] = [
  { group: '마음', items: ['💖', '💕', '💗', '💘', '🫶', '😊', '🥰', '😆', '🥹', '😴', '😭', '😤', '✨', '🌟', '⭐', '💫'] },
  { group: '자연', items: ['🌸', '🌷', '🌻', '🌼', '🍀', '🌿', '🍁', '🍂', '🌈', '☀️', '🌙', '☁️', '❄️', '🌊', '🔥', '⚡'] },
  { group: '음식', items: ['☕', '🧋', '🍰', '🍩', '🍪', '🍓', '🍑', '🍋', '🍕', '🍔', '🍜', '🍣', '🍙', '🍺', '🥂', '🎂'] },
  { group: '일상', items: ['📌', '📎', '✏️', '📚', '📷', '🎧', '🎵', '🎮', '💻', '🛍️', '🎁', '🎀', '🎈', '🎉', '✈️', '🏠'] },
  { group: '동물', items: ['🐶', '🐱', '🐰', '🐻', '🐼', '🐥', '🐧', '🦊', '🐨', '🐹', '🦋', '🐳', '🐾', '🦄', '🐸', '🐟'] },
  { group: '기호', items: ['✅', '❗', '❓', '💯', '🆗', '🔖', '📍', '💡', '💬', '💭', '⏰', '🗓️', '🏆', '🎯', '🍀', '♥️'] },
];

export const CATEGORY_COLORS = [
  '#C1876B', '#3F4A5A', '#6B5FA8', '#4F8A6A', '#C25B7A', '#2F7FA8',
  '#E0913A', '#D45D8C', '#2E9C9C', '#7BA23F', '#B5873A', '#8A8378',
];

/** Whole-screen color sets for 설정 > 화면. Every color can still be changed one by one. */
export const THEME_PRESETS = [
  { name: '크림', themeColor: '#C1876B', bgColor: '#F8F5F0', cardColor: '#FFFFFF', textColor: '#2A2622' },
  { name: '화이트', themeColor: '#3B7BB0', bgColor: '#F3F4F6', cardColor: '#FFFFFF', textColor: '#1F2328' },
  { name: '벚꽃', themeColor: '#D0688A', bgColor: '#FDF1F4', cardColor: '#FFFFFF', textColor: '#3B2A31' },
  { name: '미스티블루', themeColor: '#5F82BA', bgColor: '#EEF3FA', cardColor: '#FFFFFF', textColor: '#24304A' },
  { name: '민트', themeColor: '#2F8F7C', bgColor: '#EDF7F3', cardColor: '#FFFFFF', textColor: '#1F332C' },
  { name: '라벤더', themeColor: '#7C6BB5', bgColor: '#F4F1FA', cardColor: '#FFFFFF', textColor: '#2C2640' },
  { name: '다크', themeColor: '#E0A07F', bgColor: '#16171B', cardColor: '#22242A', textColor: '#ECEAE6' },
  { name: '네이비 다크', themeColor: '#8AB4F8', bgColor: '#101827', cardColor: '#1A2335', textColor: '#E6EAF2' },
];

export const THEME_COLORS = [
  { name: '테라코타', color: '#C1876B' },
  { name: '세이지', color: '#5E8C6A' },
  { name: '라벤더', color: '#7C6BB5' },
  { name: '로즈', color: '#C9607E' },
  { name: '오션', color: '#3B7BB0' },
  { name: '미스티블루', color: '#6A8CC0' },
  { name: '민트', color: '#3A9886' },
  { name: '네이비', color: '#34406B' },
  { name: '먹', color: '#3A3A3A' },
];

/**
 * Categories the previous Plock version used without storing them (its built-in defaults).
 * Imported events still point at these ids, so they are recreated when missing.
 */
export const LEGACY_CATEGORIES: { id: string; name: string; color: string }[] = [
  { id: 'work', name: '업무/직장', color: '#1A1A1A' },
  { id: 'coding_test', name: '코딩테스트', color: '#0F766E' },
  { id: 'personal', name: '개인일정', color: '#C1876B' },
  { id: 'health', name: '운동/건강', color: '#849283' },
  { id: 'study', name: '자기계발', color: '#7A6B58' },
  { id: 'finance', name: '가계/금융', color: '#B25D3B' },
  { id: 'travel', name: '여행/외출', color: '#3E5240' },
  { id: 'routine', name: '루틴/반복', color: '#2A2A2A' },
  { id: 'other', name: '기타(이전)', color: '#6B7280' },
];
