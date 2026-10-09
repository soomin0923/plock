import type { Category, LedgerCategory } from '../types';
import { WEEKDAYS_KR, nowHm, weekday } from './date';
import { getDeviceSettings } from './deviceSettings';
import { blobToBase64 } from './image';
import type { LedgerDraft, PlanDraft } from './nlParser';

// Gemini is called directly from the browser with the user's own API key
// (Google AI Studio keys allow browser calls). Nothing goes through a Plock server,
// so each user pays for / controls their own usage and the key never leaves their device
// except to Google.

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export class GeminiError extends Error {
  constructor(
    message: string,
    public status?: number,
    /** For 429: Google's quota id (e.g. "...PerDay...") and suggested wait, when the response says. */
    public quota?: { id?: string; retryAfterMs?: number },
  ) {
    super(message);
  }
}

export function hasGeminiKey(): boolean {
  return !!getDeviceSettings().geminiKey.trim();
}

async function call<T>(path: string, init: RequestInit, key: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key, ...(init.headers || {}) },
    });
  } catch {
    throw new GeminiError('네트워크 연결을 확인해 주세요.');
  }
  if (!res.ok) {
    let msg = '';
    let quota: { id?: string; retryAfterMs?: number } | undefined;
    try {
      const body = await res.json();
      msg = body?.error?.message || '';
      const details: { '@type'?: string; retryDelay?: string; violations?: { quotaId?: string }[] }[] = body?.error?.details || [];
      const delay = details.find((d) => d.retryDelay)?.retryDelay;
      quota = {
        id: details.flatMap((d) => d.violations || []).find((v) => v.quotaId)?.quotaId,
        retryAfterMs: delay ? Math.ceil(parseFloat(delay) * 1000) : undefined,
      };
    } catch {
      /* ignore */
    }
    if (res.status === 400 && /api key/i.test(msg)) throw new GeminiError('API 키가 올바르지 않습니다. 설정에서 다시 확인해 주세요.', 400);
    if (res.status === 403) throw new GeminiError('이 API 키로는 Gemini를 사용할 수 없습니다. (권한 없음)', 403);
    if (res.status === 429) throw new GeminiError('Gemini 사용 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.', 429, quota);
    if (res.status === 404) throw new GeminiError('선택한 모델을 찾을 수 없습니다.', 404);
    if (res.status === 503) throw new GeminiError('Gemini 서버가 혼잡합니다. 잠시 후 다시 시도해 주세요.', 503);
    throw new GeminiError(msg || `Gemini 요청 실패 (${res.status})`, res.status);
  }
  return res.json() as Promise<T>;
}

export interface GeminiModel {
  id: string; // e.g. "gemini-2.5-flash"
  label: string;
}

export async function listModels(key = getDeviceSettings().geminiKey): Promise<GeminiModel[]> {
  if (!key.trim()) throw new GeminiError('Gemini API 키를 먼저 입력해 주세요.');
  const res = await call<{ models?: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[] }>(
    'models?pageSize=200',
    { method: 'GET' },
    key.trim(),
  );
  return (res.models || [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent') && /gemini/i.test(m.name))
    .map((m) => ({ id: m.name.replace(/^models\//, ''), label: m.displayName || m.name }));
}

/**
 * Backup models for when the first choice is overloaded (503) or out of quota (429; quotas are per
 * model): other stable flash models newest first, then flash-lite. Never preview/experimental.
 */
export function rankFallbackModels(models: GeminiModel[], exclude: string): string[] {
  const score = (id: string) => parseFloat(id.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] || '0');
  const ok = models
    .map((m) => m.id)
    .filter((id) => id !== exclude && /flash/.test(id) && !/(image|tts|live|audio|thinking|exp|embedding|8b|preview)/.test(id));
  const full = ok.filter((id) => !/lite/.test(id)).sort((a, b) => score(b) - score(a) || a.length - b.length);
  const lite = ok.filter((id) => /lite/.test(id)).sort((a, b) => score(b) - score(a) || a.length - b.length);
  return [...full, ...lite];
}

/** Turn model fallback off (the offline eval must measure one model, not a mix). */
let fallbackEnabled = true;
export function setModelFallback(on: boolean) {
  fallbackEnabled = on;
}

/** Newest stable "flash" model: fast and cheap, good enough for parsing short Korean sentences. */
export function pickDefaultModel(models: GeminiModel[]): string | null {
  const score = (id: string) => {
    const v = id.match(/gemini-(\d+(?:\.\d+)?)/);
    return v ? parseFloat(v[1]) : 0;
  };
  const candidates = models
    .map((m) => m.id)
    .filter((id) => /flash/.test(id) && !/(lite|image|tts|live|audio|thinking|exp|embedding|8b)/.test(id));
  const stable = candidates.filter((id) => !/preview/.test(id));
  const pool = stable.length ? stable : candidates;
  pool.sort((a, b) => score(b) - score(a) || a.length - b.length);
  return pool[0] || models[0]?.id || null;
}

let resolvedModel: { key: string; model: string } | null = null;
let lastUsed: string | undefined;

/** Model id of the most recent successful generate call (for the parse log). */
export function lastModelUsed(): string | undefined {
  return lastUsed;
}

async function modelFor(key: string, forceRefresh = false): Promise<string> {
  const chosen = getDeviceSettings().geminiModel.trim();
  if (chosen && !forceRefresh) return chosen;
  if (!forceRefresh && resolvedModel?.key === key) return resolvedModel.model;
  const model = pickDefaultModel(await listModels(key));
  if (!model) throw new GeminiError('사용 가능한 Gemini 모델이 없습니다.');
  resolvedModel = { key, model };
  return model;
}

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

async function generateJson<T>(system: string, parts: Part[]): Promise<T> {
  const key = getDeviceSettings().geminiKey.trim();
  if (!key) throw new GeminiError('Gemini API 키가 설정되지 않았습니다.');
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
  });
  const run = async (model: string) => {
    lastUsed = model;
    return call<{ candidates?: { content?: { parts?: { text?: string }[] } }[] }>(
      `models/${encodeURIComponent(model)}:generateContent`,
      { method: 'POST', body },
      key,
    );
  };
  let res;
  const first = await modelFor(key);
  try {
    res = await run(first);
  } catch (e) {
    if (!(e instanceof GeminiError)) throw e;
    // The configured/cached model may have been retired: pick a fresh one once.
    if (e.status === 404) res = await run(await modelFor(key, true));
    else if ((e.status === 503 || e.status === 429) && fallbackEnabled) {
      // Overloaded or out of quota: try up to two other models before giving up.
      let last: unknown = e;
      for (const alt of rankFallbackModels(await listModels(key), first).slice(0, 2)) {
        try {
          res = await run(alt);
          break;
        } catch (e2) {
          last = e2;
          if (!(e2 instanceof GeminiError) || (e2.status !== 503 && e2.status !== 429)) throw e2;
        }
      }
      if (!res) throw last;
    } else throw e;
  }
  const text = res.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  try {
    return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')) as T;
  } catch {
    throw new GeminiError('AI 응답을 해석하지 못했습니다. 다시 시도해 주세요.');
  }
}

/** Verifies the key and returns the model that will be used plus the models it can access. */
export async function testGeminiKey(key: string): Promise<{ model: string; models: GeminiModel[] }> {
  const k = key.trim();
  const models = await listModels(k);
  const chosen = getDeviceSettings().geminiModel.trim();
  if (chosen && !models.some((m) => m.id === chosen)) {
    throw new GeminiError(`키는 정상이지만 '${chosen}' 모델을 쓸 수 없습니다. 모델을 '자동'으로 바꿔 주세요.`);
  }
  const auto = pickDefaultModel(models);
  if (auto) resolvedModel = { key: k, model: auto };
  return { model: chosen || auto || '(없음)', models };
}

function context(today: string) {
  return `오늘: ${today} (${WEEKDAYS_KR[weekday(today)]}요일), 현재 시각: ${nowHm()}. 시간대: Asia/Seoul.`;
}

export async function aiParsePlan(text: string, today: string, categories: Category[]): Promise<PlanDraft> {
  const system = `너는 한국어 플래너 입력 파서다. 사용자의 한 문장을 일정/할 일/습관 중 하나로 분류하고 JSON 하나만 반환한다.
${context(today)}
카테고리 목록(id: 이름): ${categories.map((c) => `${c.id}: ${c.name}`).join(', ')}

규칙:
- kind: "event"(특정 날짜/시간의 일정, 약속, 여행, 기간), "task"(해야 할 일, 마감이 있는 일), "habit"(매일/매주 반복하는 습관)
- 날짜는 오늘 기준으로 계산해 YYYY-MM-DD로. "이번 주 X요일"은 오늘이 속한 월~일 주, "다음 주 X요일"은 그다음 주.
- 시간은 HH:mm 24시간제. 없으면 null. endTime이 없고 startTime이 있으면 1시간 뒤.
- "~부터 ~까지"는 startDate/endDate. 단일 날짜면 둘 다 같은 날.
- task는 dueDate(마감일)와 dueTime(선택).
- habit은 days: 0(일)~6(토) 숫자 배열. "매일"=[0..6], "평일"=[1..5], "주말"=[0,6].
- title은 날짜/시간 표현과 조사를 뺀 핵심만 (예: "내일 오후 3시 팀 회의" → "팀 회의").
- categoryId는 목록 중 가장 알맞은 id.

반환 형식:
{"kind":"event|task|habit","title":"","startDate":"","endDate":"","startTime":null,"endTime":null,"dueDate":null,"dueTime":null,"priority":"high|medium|low","days":[],"categoryId":"","memo":""}`;
  const r = await generateJson<Record<string, unknown>>(system, [{ text }]);
  return sanitizePlan(r, today, categories);
}

function sanitizePlan(r: Record<string, unknown>, today: string, categories: Category[]): PlanDraft {
  const ymd = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const hm = (v: unknown) => (typeof v === 'string' && /^\d{2}:\d{2}$/.test(v) ? v : undefined);
  const kind = r.kind === 'task' || r.kind === 'habit' ? r.kind : 'event';
  const startDate = ymd(r.startDate) || ymd(r.dueDate) || today;
  const endDate = ymd(r.endDate) && ymd(r.endDate)! >= startDate ? ymd(r.endDate)! : startDate;
  const days = Array.isArray(r.days) ? r.days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6) : [];
  return {
    kind,
    title: String(r.title || '').trim() || '새 항목',
    startDate,
    endDate,
    startTime: hm(r.startTime),
    endTime: hm(r.endTime),
    dueDate: ymd(r.dueDate) || (kind === 'task' ? startDate : undefined),
    dueTime: hm(r.dueTime),
    priority: r.priority === 'high' || r.priority === 'low' ? r.priority : 'medium',
    days: days.length ? days : [0, 1, 2, 3, 4, 5, 6],
    categoryId: categories.some((c) => c.id === r.categoryId) ? String(r.categoryId) : categories[0]?.id || 'cat_etc',
    memo: typeof r.memo === 'string' ? r.memo : undefined,
    source: 'ai',
  };
}

const ledgerSystem = (today: string, cats: LedgerCategory[]) => `너는 한국어 가계부 입력 파서다. JSON 하나만 반환한다.
${context(today)}
카테고리 목록(id: 이름, 종류): ${cats.map((c) => `${c.id}: ${c.name}(${c.type === 'income' ? '수입' : '지출'})`).join(', ')}
규칙:
- 한 문장에 여러 건이 있으면 entries에 여러 개.
- amount는 원 단위 정수 (예: "4천5백원"=4500, "1.2만"=12000).
- type: 기본 "expense". 월급/용돈 받음/환급/입금 등은 "income".
- method: "card" | "cash" | "transfer" | "etc" (언급 없으면 "card").
- date: "어제", "그저께" 등은 오늘 기준 계산. 없으면 오늘.
- memo: 가게/품목 등 짧은 설명.
- categoryId: 목록에서 type에 맞는 가장 알맞은 id.
반환 형식: {"entries":[{"type":"expense","amount":0,"categoryId":"","method":"card","date":"YYYY-MM-DD","memo":""}]}`;

function sanitizeLedger(r: unknown, today: string, cats: LedgerCategory[]): LedgerDraft[] {
  const list = Array.isArray((r as { entries?: unknown })?.entries) ? ((r as { entries: unknown[] }).entries as Record<string, unknown>[]) : [];
  return list
    .map((e) => {
      const type = e.type === 'income' ? 'income' : 'expense';
      const amount = Math.round(Math.abs(Number(e.amount) || 0));
      const fallback = cats.find((c) => c.type === type && /기타/.test(c.name)) || cats.find((c) => c.type === type);
      const cat = cats.find((c) => c.id === e.categoryId && c.type === type) || fallback;
      return {
        type,
        amount,
        categoryId: cat?.id || (type === 'income' ? 'lc_etc_in' : 'lc_etc_out'),
        method: e.method === 'cash' || e.method === 'transfer' || e.method === 'etc' ? e.method : 'card',
        date: typeof e.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : today,
        memo: typeof e.memo === 'string' ? e.memo.trim() : '',
      } as LedgerDraft;
    })
    .filter((e) => e.amount > 0);
}

export async function aiParseLedger(text: string, today: string, cats: LedgerCategory[]): Promise<LedgerDraft[]> {
  const r = await generateJson<unknown>(ledgerSystem(today, cats), [{ text }]);
  return sanitizeLedger(r, today, cats);
}

export async function aiReadReceipt(image: Blob, today: string, cats: LedgerCategory[]): Promise<LedgerDraft[]> {
  const system = `${ledgerSystem(today, cats)}
이미지는 영수증/결제 내역 캡처다. 최종 결제 금액(합계) 1건을 entries에 넣는다. memo는 가게 이름(+대표 품목).
날짜가 영수증에 있으면 그 날짜, 없으면 오늘. 영수증이 아니면 {"entries":[]}.`;
  const r = await generateJson<unknown>(system, [
    { inlineData: { mimeType: image.type || 'image/jpeg', data: await blobToBase64(image) } },
    { text: '이 영수증을 가계부 항목으로 바꿔줘.' },
  ]);
  return sanitizeLedger(r, today, cats);
}
