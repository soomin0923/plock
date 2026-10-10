import type { AiProvider } from './deviceSettings';

// The non-Gemini AI services. Like Gemini, each is called straight from the browser with the
// user's own key: nothing goes through a Plock server. lib/gemini.ts holds the prompts and
// decides which service to call (and falls back to the next one with a key when one is busy).

export interface AiProviderInfo {
  id: AiProvider;
  label: string;
  /** Where to get a key. */
  keyUrl: string;
  keyPlaceholder: string;
  note: string;
}

export const AI_PROVIDERS: AiProviderInfo[] = [
  { id: 'gemini', label: 'Google Gemini', keyUrl: 'https://aistudio.google.com/apikey', keyPlaceholder: 'AIza…', note: '무료 한도가 있어요. 붐비는 시간엔 혼잡 오류가 잦아요.' },
  { id: 'groq', label: 'Groq', keyUrl: 'https://console.groq.com/keys', keyPlaceholder: 'gsk_…', note: '무료 한도가 있고 응답이 아주 빨라요. 공개 모델(Llama·Qwen 등)을 써요.' },
  { id: 'openrouter', label: 'OpenRouter', keyUrl: 'https://openrouter.ai/keys', keyPlaceholder: 'sk-or-…', note: '키 하나로 여러 회사 모델을 써요. 이름이 :free로 끝나는 모델은 무료(하루 요청 수 제한).' },
  { id: 'claude', label: 'Anthropic Claude', keyUrl: 'https://console.anthropic.com/settings/keys', keyPlaceholder: 'sk-ant-…', note: '유료(결제 등록 필요). 짧은 문장이라 요청당 비용은 작아요.' },
  { id: 'openai', label: 'OpenAI', keyUrl: 'https://platform.openai.com/api-keys', keyPlaceholder: 'sk-…', note: '유료(결제 등록 필요).' },
];

export const providerInfo = (p: AiProvider) => AI_PROVIDERS.find((x) => x.id === p)!;

export class AiError extends Error {
  constructor(
    message: string,
    public status?: number,
    /** For 429: the provider's quota id (Gemini) and suggested wait, when the response says. */
    public quota?: { id?: string; retryAfterMs?: number },
  ) {
    super(message);
  }
}

/** Busy, rate-limited or out of quota: worth trying another model or service. */
export const isRetryable = (e: unknown) => e instanceof AiError && (e.status === 429 || e.status === 503 || e.status === 529 || e.status === 500);

export type AiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

export interface AiModel {
  id: string;
  label: string;
}

const statusMessage = (who: string, status: number, msg: string): string => {
  if (status === 401) return `${who} API 키가 올바르지 않습니다. 설정에서 다시 확인해 주세요.`;
  if (status === 402) return `${who} 계정의 크레딧이 부족합니다.`;
  if (status === 403) return `이 ${who} 키로는 이 모델을 쓸 수 없습니다. (권한 없음)`;
  if (status === 404) return `${who}에서 선택한 모델을 찾을 수 없습니다.`;
  if (status === 429) return `${who} 사용 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.`;
  if (status === 503 || status === 529) return `${who} 서버가 혼잡합니다. 잠시 후 다시 시도해 주세요.`;
  return msg || `${who} 요청 실패 (${status})`;
};

// ------------------------------------------------------------------ OpenAI-compatible (OpenAI, Groq, OpenRouter)

const OPENAI_COMPAT: Partial<Record<AiProvider, { base: string; jsonMode: boolean }>> = {
  openai: { base: 'https://api.openai.com/v1', jsonMode: true },
  groq: { base: 'https://api.groq.com/openai/v1', jsonMode: true },
  // Many OpenRouter models reject response_format; the prompt already asks for JSON only.
  openrouter: { base: 'https://openrouter.ai/api/v1', jsonMode: false },
};

async function compatFetch<T>(p: AiProvider, path: string, key: string, init: RequestInit = {}): Promise<T> {
  const cfg = OPENAI_COMPAT[p]!;
  const who = providerInfo(p).label;
  let res: Response;
  try {
    res = await fetch(`${cfg.base}/${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, ...(init.headers || {}) } });
  } catch {
    throw new AiError(`${who}에 연결하지 못했어요. 네트워크를 확인해 주세요.`);
  }
  if (!res.ok) {
    let msg = '';
    try {
      const body = await res.json();
      msg = body?.error?.message || body?.message || '';
    } catch {
      /* ignore */
    }
    throw new AiError(statusMessage(who, res.status, msg), res.status);
  }
  return res.json() as Promise<T>;
}

async function compatGenerate(p: AiProvider, key: string, model: string, system: string, parts: AiPart[]): Promise<string> {
  const hasImage = parts.some((x) => 'inlineData' in x);
  const content = hasImage
    ? parts.map((x) => ('text' in x ? { type: 'text', text: x.text } : { type: 'image_url', image_url: { url: `data:${x.inlineData.mimeType};base64,${x.inlineData.data}` } }))
    : parts.map((x) => ('text' in x ? x.text : '')).join('\n');
  const res = await compatFetch<{ choices?: { message?: { content?: string } }[] }>(p, 'chat/completions', key, {
    method: 'POST',
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content },
      ],
      ...(OPENAI_COMPAT[p]!.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  return res.choices?.[0]?.message?.content || '';
}

async function compatModels(p: AiProvider, key: string): Promise<(AiModel & { created: number })[]> {
  const res = await compatFetch<{ data?: { id: string; name?: string; created?: number }[] }>(p, 'models', key, { method: 'GET' });
  const skip = /whisper|tts|transcribe|audio|realtime|embed|moderation|guard|image|dall-e|sora|search|computer|babbage|davinci|instruct/i;
  return (res.data || []).filter((m) => !skip.test(m.id)).map((m) => ({ id: m.id, label: m.name || m.id, created: m.created || 0 }));
}

/** A reasonable default when the user hasn't picked a model: newest small/fast chat model. */
function compatDefault(p: AiProvider, models: (AiModel & { created: number })[]): string | null {
  const newest = (list: typeof models) => [...list].sort((a, b) => b.created - a.created)[0]?.id ?? null;
  if (p === 'openai') return newest(models.filter((m) => /^gpt-/.test(m.id) && /mini/.test(m.id) && !/nano/.test(m.id))) ?? newest(models.filter((m) => /^gpt-/.test(m.id)));
  if (p === 'openrouter') return newest(models.filter((m) => /:free$/.test(m.id))) ?? newest(models);
  return newest(models);
}

// ------------------------------------------------------------------ Claude (official SDK, loaded only when used)

const CLAUDE_DEFAULT = 'claude-opus-5-5';
// Models that take the server-side refusal fallback ("default" routing).
const CLAUDE_FALLBACK_MODELS = /^claude-(fable-5-1|opus-5-5|opus-5|sonnet-5-5)$/;

async function claudeClient(key: string) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  // The key belongs to the user and stays on their device; Plock has no server to proxy through.
  return { Anthropic, client: new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 1 }) };
}

function claudeError(Anthropic: typeof import('@anthropic-ai/sdk').default, e: unknown): AiError {
  if (e instanceof Anthropic.APIError) return new AiError(statusMessage('Claude', e.status ?? 0, e.message), e.status);
  if (e instanceof AiError) return e;
  return new AiError('Claude에 연결하지 못했어요. 네트워크를 확인해 주세요.');
}

async function claudeGenerate(key: string, model: string, system: string, parts: AiPart[]): Promise<string> {
  const { Anthropic, client } = await claudeClient(key);
  try {
    const res = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      // A short sentence to JSON: low effort is plenty and keeps it fast.
      output_config: { effort: 'low' },
      ...(CLAUDE_FALLBACK_MODELS.test(model) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
      system,
      messages: [
        {
          role: 'user',
          content: parts.map((x) =>
            'text' in x
              ? { type: 'text' as const, text: x.text }
              : { type: 'image' as const, source: { type: 'base64' as const, media_type: x.inlineData.mimeType as 'image/jpeg', data: x.inlineData.data } },
          ),
        },
      ],
    });
    if (res.stop_reason === 'refusal') throw new AiError('Claude가 이 요청을 처리하지 않았어요.');
    return res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  } catch (e) {
    throw claudeError(Anthropic, e);
  }
}

async function claudeModels(key: string): Promise<AiModel[]> {
  const { Anthropic, client } = await claudeClient(key);
  try {
    const out: AiModel[] = [];
    for await (const m of client.models.list()) out.push({ id: m.id, label: m.display_name || m.id });
    return out;
  } catch (e) {
    throw claudeError(Anthropic, e);
  }
}

// ------------------------------------------------------------------ public

export async function providerGenerate(p: Exclude<AiProvider, 'gemini'>, key: string, model: string, system: string, parts: AiPart[]): Promise<string> {
  return p === 'claude' ? claudeGenerate(key, model, system, parts) : compatGenerate(p, key, model, system, parts);
}

export async function providerModels(p: Exclude<AiProvider, 'gemini'>, key: string): Promise<AiModel[]> {
  return p === 'claude' ? claudeModels(key) : compatModels(p, key);
}

const defaultCache = new Map<string, string>();
/** The model used when the user left "자동": looked up once per key. */
export async function providerDefaultModel(p: Exclude<AiProvider, 'gemini'>, key: string, models?: AiModel[]): Promise<string> {
  const cacheKey = `${p}:${key.slice(-6)}`;
  if (!models && defaultCache.has(cacheKey)) return defaultCache.get(cacheKey)!;
  let picked: string | null;
  if (p === 'claude') {
    const list = models ?? (await claudeModels(key));
    picked = list.some((m) => m.id === CLAUDE_DEFAULT) ? CLAUDE_DEFAULT : list[0]?.id ?? CLAUDE_DEFAULT;
  } else {
    const list = (models as (AiModel & { created: number })[] | undefined) ?? (await compatModels(p, key));
    picked = compatDefault(p, list);
  }
  if (!picked) throw new AiError(`${providerInfo(p).label}에서 쓸 수 있는 모델이 없습니다.`);
  defaultCache.set(cacheKey, picked);
  return picked;
}
