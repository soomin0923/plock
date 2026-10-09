// Offline evaluation of the natural-language planner parser.
//
//   npm run eval -- --data eval/dataset.csv                 # rule-based only
//   set GEMINI_API_KEY=...  (PowerShell: $env:GEMINI_API_KEY="...")
//   npm run eval -- --data eval/dataset.csv --llm           # + LLM and hybrid
//
// Each labeled sentence is parsed by:
//   rule    built-in Korean rule parser (lib/nlParser.ts)       — no cost, no network
//   llm     Gemini (lib/gemini.ts, the same prompt the app uses)
//   hybrid  rule when the sentence has a date expression the rules recognise, LLM otherwise
// and compared with the gold labels. LLM answers are cached in eval/.cache so reruns are free
// and repeatable. Results go to eval/results/<timestamp>/ (rows.csv, summary.md).

import fs from 'node:fs';
import path from 'node:path';
import { localParsePlan, resolveKoreanDate, type PlanDraft } from '../src/lib/nlParser';
import { aiParsePlan, lastModelUsed } from '../src/lib/gemini';
import { setDeviceSettings } from '../src/lib/deviceSettings';
import { DEFAULT_CATEGORIES } from '../src/data/defaults';

// ------------------------------------------------------------------ args

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const DATA = opt('data', 'eval/dataset.csv');
const USE_LLM = flag('llm');
const DELAY_MS = Number(opt('delay', '4500')); // free tier ≈ 15 requests/min
const MODEL = process.env.GEMINI_MODEL || '';

// ------------------------------------------------------------------ dataset

interface Gold {
  id: string;
  ref_date: string;
  text: string;
  kind: string;
  date: string | null;
  end_date: string | null;
  start_time: string | null;
  expr_type: string;
}

function parseCsv(src: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const s = src.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') row.push(cell), (cell = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

/** Excel saves "CSV" as CP949 on Korean Windows and "CSV UTF-8" as UTF-8: accept both. */
function readText(file: string): string {
  const buf = fs.readFileSync(file);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('euc-kr').decode(buf);
  }
}

function loadDataset(file: string): Gold[] {
  const [header, ...rows] = parseCsv(readText(file));
  const col = (name: string) => {
    const i = header.findIndex((h) => h.trim() === name);
    if (i < 0) throw new Error(`${file}: '${name}' 열이 없습니다. 헤더: ${header.join(',')}`);
    return i;
  };
  const idx = { id: col('id'), ref: col('ref_date'), text: col('text'), kind: col('kind'), date: col('date'), end: col('end_date'), time: col('start_time'), type: col('expr_type') };
  const nil = (v?: string) => (v && v.trim() ? v.trim() : null);
  const problems: string[] = [];
  const out = rows.map((r, n) => {
    const g: Gold = {
      id: nil(r[idx.id]) || String(n + 1),
      ref_date: (r[idx.ref] || '').trim(),
      text: (r[idx.text] || '').trim(),
      kind: (r[idx.kind] || '').trim(),
      date: nil(r[idx.date]),
      end_date: nil(r[idx.end]),
      start_time: nil(r[idx.time]),
      expr_type: nil(r[idx.type]) || '기타',
    };
    const where = `${file} ${n + 2}행 (${g.text || '빈 문장'})`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(g.ref_date)) problems.push(`${where}: ref_date는 YYYY-MM-DD`);
    if (!g.text) problems.push(`${where}: text가 비어 있음`);
    if (!['event', 'task', 'habit'].includes(g.kind)) problems.push(`${where}: kind는 event/task/habit`);
    if (g.date && !/^\d{4}-\d{2}-\d{2}$/.test(g.date)) problems.push(`${where}: date는 YYYY-MM-DD`);
    if (g.end_date && !/^\d{4}-\d{2}-\d{2}$/.test(g.end_date)) problems.push(`${where}: end_date는 YYYY-MM-DD`);
    if (g.start_time && !/^\d{2}:\d{2}$/.test(g.start_time)) problems.push(`${where}: start_time은 HH:mm (예: 09:00)`);
    return g;
  });
  if (problems.length) throw new Error(`라벨 형식 오류 ${problems.length}건\n- ${problems.join('\n- ')}`);

  // Labels that are valid but probably not what was meant (scored anyway).
  const warnings: string[] = [];
  out.forEach((g, n) => {
    const where = `${n + 2}행 (${g.text})`;
    if (/\d{1,2}\s*시|\d{1,2}:\d{2}/.test(g.text) && !g.start_time && g.kind !== 'habit') warnings.push(`${where}: 문장에 시각이 있는데 start_time이 비어 있음`);
    if (g.kind === 'task' && g.end_date && !g.date) warnings.push(`${where}: 할 일의 마감일은 date 칸에 (end_date는 여러 날 일정용)`);
    if (g.kind === 'habit' && !/매일|매주|마다|평일|주말마다|[월화수목금토일]{2,}(?=\s|$)|루틴|습관/.test(g.text)) warnings.push(`${where}: 반복 표현이 없는데 habit`);
    if (g.end_date && g.date && g.end_date < g.date) warnings.push(`${where}: end_date가 date보다 빠름`);
  });
  if (warnings.length) {
    console.warn(`\n라벨 확인 필요 ${warnings.length}건 (그대로 채점은 합니다)\n- ${warnings.join('\n- ')}\n`);
    if (flag('strict')) throw new Error('--strict: 위 항목을 고친 뒤 다시 실행하세요.');
  }
  return out;
}

// ------------------------------------------------------------------ prediction → comparable fields

interface Fields {
  kind: string;
  date: string | null;
  end_date: string | null;
  start_time: string | null;
}

function fieldsOf(d: PlanDraft): Fields {
  if (d.kind === 'task') return { kind: 'task', date: d.dueDate ?? null, end_date: null, start_time: d.dueTime ?? null };
  if (d.kind === 'habit') return { kind: 'habit', date: null, end_date: null, start_time: null };
  return { kind: 'event', date: d.startDate, end_date: d.endDate !== d.startDate ? d.endDate : null, start_time: d.startTime ?? null };
}

const FIELDS = ['kind', 'date', 'start_time', 'end_date'] as const;
type Field = (typeof FIELDS)[number];

/** Which fields are scored for this gold row (habits have no date; end_date only when labeled). */
function scored(g: Gold): Field[] {
  if (g.kind === 'habit') return ['kind'];
  return g.end_date ? ['kind', 'date', 'start_time', 'end_date'] : ['kind', 'date', 'start_time'];
}

function correct(g: Gold, p: Fields | null, f: Field): boolean {
  if (!p) return false;
  return (g[f] ?? null) === (p[f] ?? null);
}

// ------------------------------------------------------------------ LLM with cache + rate limit

const CACHE_DIR = 'eval/.cache';
type CacheEntry = { draft: PlanDraft | null; error?: string; latencyMs: number; model?: string };

function cacheFile() {
  return path.join(CACHE_DIR, `llm-${(MODEL || 'auto').replace(/[^\w.-]/g, '_')}.json`);
}
function loadCache(): Record<string, CacheEntry> {
  try {
    return JSON.parse(fs.readFileSync(cacheFile(), 'utf8'));
  } catch {
    return {};
  }
}
function saveCache(c: Record<string, CacheEntry>) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cacheFile(), JSON.stringify(c, null, 1));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function llmParse(g: Gold, cache: Record<string, CacheEntry>): Promise<CacheEntry> {
  const key = `${g.ref_date}|${g.text}`;
  if (cache[key]) return cache[key];
  let entry: CacheEntry = { draft: null, latencyMs: 0 };
  for (let attempt = 0; attempt < 4; attempt++) {
    const t0 = performance.now();
    try {
      const draft = await aiParsePlan(g.text, g.ref_date, DEFAULT_CATEGORIES);
      entry = { draft, latencyMs: Math.round(performance.now() - t0), model: lastModelUsed() };
      break;
    } catch (e) {
      const status = (e as { status?: number }).status;
      entry = { draft: null, error: (e as Error).message, latencyMs: Math.round(performance.now() - t0) };
      if (status !== 429 && status !== 503) break;
      const wait = 15000 * (attempt + 1);
      process.stdout.write(`  (한도 초과, ${wait / 1000}초 대기)\n`);
      await sleep(wait);
    }
  }
  cache[key] = entry;
  saveCache(cache);
  await sleep(DELAY_MS);
  return entry;
}

// ------------------------------------------------------------------ main

type Mode = 'rule' | 'llm' | 'hybrid';
interface Row {
  g: Gold;
  pred: Partial<Record<Mode, Fields | null>>;
  hybridUsedLlm: boolean;
  llmLatency?: number;
  llmError?: string;
}

const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : '-');
const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function main() {
  if (!fs.existsSync(DATA)) {
    console.error(`데이터 파일이 없습니다: ${DATA}\n eval/dataset.example.csv 를 복사해 eval/dataset.csv 를 만드세요.`);
    process.exit(1);
  }
  const gold = loadDataset(DATA);
  const modes: Mode[] = USE_LLM ? ['rule', 'llm', 'hybrid'] : ['rule'];
  if (USE_LLM) {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) {
      console.error('--llm 을 쓰려면 GEMINI_API_KEY 환경변수가 필요합니다.');
      process.exit(1);
    }
    setDeviceSettings({ geminiKey: key, geminiModel: MODEL });
  }
  console.log(`문장 ${gold.length}개 · 방식 ${modes.join(', ')}${USE_LLM ? ` · 모델 ${MODEL || '자동'}` : ''}`);

  const cache = USE_LLM ? loadCache() : {};
  const rows: Row[] = [];
  for (const [i, g] of gold.entries()) {
    const row: Row = { g, pred: {}, hybridUsedLlm: false };
    row.pred.rule = fieldsOf(localParsePlan(g.text, g.ref_date, DEFAULT_CATEGORIES));
    if (USE_LLM) {
      process.stdout.write(`[${i + 1}/${gold.length}] ${g.text}\n`);
      const e = await llmParse(g, cache);
      row.pred.llm = e.draft ? fieldsOf(e.draft) : null;
      row.llmLatency = e.latencyMs;
      row.llmError = e.error;
      // Hybrid: trust the rules when they found an explicit date expression; otherwise ask the LLM.
      const ruleHasDate = resolveKoreanDate(g.text, g.ref_date) !== null;
      row.hybridUsedLlm = !ruleHasDate;
      row.pred.hybrid = ruleHasDate ? row.pred.rule : row.pred.llm ?? row.pred.rule;
    }
    rows.push(row);
  }

  // ---- summary
  const lines: string[] = [];
  lines.push(`# 파서 평가 결과`, '', `- 데이터: \`${DATA}\` (${gold.length}문장)`, `- 실행: ${new Date().toISOString()}`);
  if (USE_LLM) lines.push(`- 모델: ${[...new Set(rows.map((r) => cache[`${r.g.ref_date}|${r.g.text}`]?.model).filter(Boolean))].join(', ') || MODEL || '자동'}`);
  lines.push('', '## 필드별 정확도', '', `| 방식 | ${FIELDS.join(' | ')} | 완전 일치 |`, `|---|${FIELDS.map(() => '---').join('|')}|---|`);
  for (const m of modes) {
    const cells = FIELDS.map((f) => {
      const rs = rows.filter((r) => scored(r.g).includes(f));
      return `${pct(rs.filter((r) => correct(r.g, r.pred[m] ?? null, f)).length, rs.length)} (n=${rs.length})`;
    });
    const exact = rows.filter((r) => scored(r.g).every((f) => correct(r.g, r.pred[m] ?? null, f))).length;
    lines.push(`| ${m} | ${cells.join(' | ')} | ${pct(exact, rows.length)} |`);
  }

  const types = [...new Set(rows.map((r) => r.g.expr_type))];
  lines.push('', '## 표현 유형별 날짜 정확도', '', `| 유형 | n | ${modes.join(' | ')} |`, `|---|---|${modes.map(() => '---').join('|')}|`);
  for (const t of types) {
    const rs = rows.filter((r) => r.g.expr_type === t && scored(r.g).includes('date'));
    if (!rs.length) continue;
    lines.push(`| ${t} | ${rs.length} | ${modes.map((m) => pct(rs.filter((r) => correct(r.g, r.pred[m] ?? null, 'date')).length, rs.length)).join(' | ')} |`);
  }

  if (USE_LLM) {
    const lat = rows.map((r) => r.llmLatency || 0).filter((x) => x > 0).sort((a, b) => a - b);
    const q = (p: number) => (lat.length ? lat[Math.min(lat.length - 1, Math.floor(p * lat.length))] : 0);
    const errors = rows.filter((r) => r.llmError).length;
    const llmCalls = rows.filter((r) => r.hybridUsedLlm).length;
    lines.push(
      '',
      '## 비용·속도',
      '',
      `| 항목 | 값 |`,
      `|---|---|`,
      `| LLM 응답 시간 평균 / p50 / p95 | ${Math.round(lat.reduce((s, x) => s + x, 0) / (lat.length || 1))} / ${q(0.5)} / ${q(0.95)} ms |`,
      `| LLM 실패 | ${errors}건 |`,
      `| hybrid가 LLM을 부른 비율 | ${pct(llmCalls, rows.length)} (${llmCalls}/${rows.length}) |`,
      `| 규칙 방식 응답 시간 | 1ms 미만 |`,
      '',
      '※ 캐시된 응답의 시간은 처음 호출했을 때 기록한 값입니다.',
    );
  }

  lines.push('', '## 틀린 문장', '');
  for (const m of modes) {
    const wrong = rows.filter((r) => !scored(r.g).every((f) => correct(r.g, r.pred[m] ?? null, f)));
    lines.push(`### ${m} (${wrong.length}건)`, '', '| id | 문장 | 정답 | 예측 | 틀린 필드 |', '|---|---|---|---|---|');
    for (const r of wrong) {
      const p = r.pred[m] ?? null;
      const bad = scored(r.g).filter((f) => !correct(r.g, p, f));
      const fmt = (x: Partial<Fields> | null) => (x ? `${x.kind} ${x.date ?? '-'} ${x.start_time ?? ''}${x.end_date ? `~${x.end_date}` : ''}`.trim() : '실패');
      lines.push(`| ${r.g.id} | ${r.g.text.replace(/\|/g, '/')} | ${fmt(r.g)} | ${fmt(p)}${m === 'llm' && r.llmError ? ` (${r.llmError})` : ''} | ${bad.join(', ')} |`);
    }
    lines.push('');
  }

  // ---- files
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outDir = path.join('eval/results', stamp);
  fs.mkdirSync(outDir, { recursive: true });
  const header = ['id', 'ref_date', 'text', 'expr_type', 'gold_kind', 'gold_date', 'gold_start_time', 'gold_end_date', ...modes.flatMap((m) => [`${m}_kind`, `${m}_date`, `${m}_start_time`, `${m}_end_date`, `${m}_exact`]), ...(USE_LLM ? ['llm_latency_ms', 'llm_error', 'hybrid_used_llm'] : [])];
  const body = rows.map((r) => [
    r.g.id, r.g.ref_date, r.g.text, r.g.expr_type, r.g.kind, r.g.date, r.g.start_time, r.g.end_date,
    ...modes.flatMap((m) => {
      const p = r.pred[m] ?? null;
      return [p?.kind, p?.date, p?.start_time, p?.end_date, scored(r.g).every((f) => correct(r.g, p, f)) ? 1 : 0];
    }),
    ...(USE_LLM ? [r.llmLatency, r.llmError, r.hybridUsedLlm ? 1 : 0] : []),
  ]);
  fs.writeFileSync(path.join(outDir, 'rows.csv'), '﻿' + [header, ...body].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n');
  fs.writeFileSync(path.join(outDir, 'summary.md'), lines.join('\n') + '\n');

  console.log('\n' + lines.slice(0, lines.indexOf('## 틀린 문장')).join('\n'));
  console.log(`\n저장: ${outDir}/summary.md, rows.csv`);
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
