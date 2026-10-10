/**
 * Replay real app inputs through the current rule parser.
 *
 *   npm run eval:replay -- plock-parse-logs-YYYYMMDD.jsonl
 *
 * Input: the .jsonl from `plock.exportParseLogs()` in the browser console.
 * Each saved plan log has what was typed, the day it was typed, what the app predicted at the time
 * (old parser or Gemini), and what was finally saved after the user's edits. The saved record is
 * the reference; "logged" is the prediction the app made back then, "rule now" is this checkout.
 *
 * Output: eval/results/<stamp>-replay/summary.md (no input text, safe to share) and wrong.md (inputs).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { localParsePlan } from '../src/lib/nlParser';
import { DEFAULT_CATEGORIES } from '../src/data/defaults';
import type { ParseFields, ParseLog } from '../src/types';

const args = process.argv.slice(2);

// A path with spaces ("…\plock-parse-logs-20261009 (1).csv") arrives split in pieces when it isn't
// quoted: everything up to the first --option is the path.
const optStart = args.findIndex((a) => a.startsWith('--'));
const given = (optStart < 0 ? args : args.slice(0, optStart)).join(' ').trim() || process.env.npm_config_data || '';

// Without a path, take the newest export (.jsonl or .csv) from the Downloads folders we can find.
const home = os.homedir();
const downloadDirs = [...new Set([path.join(home, 'Downloads'), ...'CDEFG'.split('').map((d) => `${d}:\\Users\\${path.basename(home)}\\Downloads`)])];
const found = downloadDirs
  .flatMap((dir) => {
    try {
      return fs.readdirSync(dir).filter((f) => /^plock-parse-logs.*\.(jsonl|csv)$/i.test(f)).map((f) => path.join(dir, f));
    } catch {
      return [];
    }
  })
  .sort((x, y) => fs.statSync(y).mtimeMs - fs.statSync(x).mtimeMs || (/\.jsonl$/i.test(x) ? -1 : 1));
const file = given || found[0];
if (!file || !fs.existsSync(file)) {
  console.error(given ? `파일이 없습니다: ${given}` : `다운로드 폴더(${downloadDirs.filter((d) => fs.existsSync(d)).join(', ')})에서 plock-parse-logs 파일을 찾지 못했습니다.`);
  if (found.length) console.error(`찾은 파일:\n- ${found.join('\n- ')}`);
  console.error('사용법: npm run eval:replay -- [.jsonl 또는 .csv 경로] [--before 2026-10-09T22:10]  (경로를 빼면 다운로드 폴더의 최신 파일)');
  process.exit(1);
}
console.log(`파일: ${file}`);

// --before 2026-10-09T21:00  → only logs made before that local time (e.g. before a deploy)
const before = (() => {
  const i = args.indexOf('--before');
  const v = i >= 0 ? args[i + 1] : process.env.npm_config_before;
  return v && v !== 'true' ? new Date(v).toISOString() : null;
})();

// ---- read .jsonl, or the .csv twin (also after Excel re-saved it: CP949, 2026/10/9, 9:00)
function readText(f: string): string {
  const buf = fs.readFileSync(f);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('euc-kr').decode(buf);
  }
}
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') row.push(cell), (cell = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell), rows.push(row), (row = []), (cell = '');
    } else cell += c;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  return rows.filter((r) => r.some((x) => x.trim()));
}
const pad2 = (x: string | number) => String(x).padStart(2, '0');
const nDate = (v?: string) => {
  const m = v?.trim().match(/^(\d{4})[-/.]\s*(\d{1,2})[-/.]\s*(\d{1,2})/);
  return m ? `${m[1]}-${pad2(m[2])}-${pad2(m[3])}` : undefined;
};
const nTime = (v?: string) => {
  const m = v?.trim().match(/^(오전|오후|AM|PM)?\s*(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!m) return undefined;
  let h = Number(m[2]);
  const ap = (m[1] || m[4] || '').toUpperCase();
  if ((ap === '오후' || ap === 'PM') && h < 12) h += 12;
  if ((ap === '오전' || ap === 'AM') && h === 12) h = 0;
  return `${pad2(h)}:${m[3]}`;
};
function fromCsv(text: string): ParseLog[] {
  const [header, ...rows] = parseCsv(text.replace(/^﻿/, ''));
  const col = (name: string) => header.findIndex((h) => h.trim() === name);
  const get = (r: string[], name: string) => {
    const i = col(name);
    return i >= 0 && r[i]?.trim() ? r[i].trim() : undefined;
  };
  const fields = (r: string[], p: string): ParseFields | undefined =>
    get(r, `${p}_kind`)
      ? { kind: get(r, `${p}_kind`), title: get(r, `${p}_title`), date: nDate(get(r, `${p}_date`)), endDate: nDate(get(r, `${p}_end_date`)), startTime: nTime(get(r, `${p}_start_time`)), endTime: nTime(get(r, `${p}_end_time`)) }
      : undefined;
  return rows.map((r) => {
    const created = get(r, 'created_at');
    const createdIso = created ? (() => { const m = created.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/); return m ? `${m[1]}-${pad2(m[2])}-${pad2(m[3])}T${pad2(m[4])}:${m[5]}:${m[6] || '00'}.000Z` : created; })() : '';
    return {
      id: get(r, 'id') || '',
      createdAt: createdIso,
      updatedAt: createdIso,
      surface: get(r, 'surface'),
      task: get(r, 'task'),
      input: get(r, 'input') || '',
      refDate: nDate(get(r, 'ref_date')) || '',
      refTime: nTime(get(r, 'ref_time')) || '',
      mode: get(r, 'mode'),
      outcome: get(r, 'outcome'),
      error: get(r, 'error'),
      changed: get(r, 'changed')?.split(','),
      predicted: fields(r, 'pred') || {},
      final: fields(r, 'final'),
      appVersion: get(r, 'app_version') || '',
    } as unknown as ParseLog;
  });
}

const raw = readText(file);
const allLogs: ParseLog[] = /\.csv$/i.test(file)
  ? fromCsv(raw)
  : raw
      .replace(/^﻿/, '')
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l));
const logs = before ? allLogs.filter((l) => l.createdAt < before) : allLogs;
const versions = allLogs.reduce<Record<string, number>>((m, l) => ((m[l.appVersion || '?'] = (m[l.appVersion || '?'] || 0) + 1), m), {});

type F = { kind: string | null; date: string | null; start_time: string | null; end_date: string | null };
const FIELDS = ['kind', 'date', 'start_time', 'end_date'] as const;

function norm(f?: ParseFields): F {
  const kind = f?.kind ?? null;
  const date = f?.date ?? null;
  const end = f?.endDate && f.endDate !== date ? f.endDate : null;
  // Habits are scored on kind only (their dates are a schedule, not a parse result).
  if (kind === 'habit') return { kind, date: null, start_time: null, end_date: null };
  return { kind, date, start_time: f?.startTime ?? null, end_date: kind === 'event' ? end : null };
}

function ruleNow(l: ParseLog): F {
  const d = localParsePlan(l.input, l.refDate, DEFAULT_CATEGORIES);
  if (d.kind === 'task') return { kind: 'task', date: d.dueDate ?? null, start_time: d.dueTime ?? null, end_date: null };
  if (d.kind === 'habit') return { kind: 'habit', date: null, start_time: null, end_date: null };
  return { kind: 'event', date: d.startDate, start_time: d.startTime ?? null, end_date: d.endDate !== d.startDate ? d.endDate : null };
}

const plan = logs.filter((l) => l.task === 'plan');
const saved = plan.filter((l) => l.outcome === 'saved' && l.final);
const byOutcome = plan.reduce<Record<string, number>>((m, l) => ((m[l.outcome] = (m[l.outcome] || 0) + 1), m), {});

const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : '-');
const eq = (a: F, b: F, f: (typeof FIELDS)[number]) => a[f] === b[f];

// A value the user filled in that the sentence never mentioned (a to-do saved with the form's
// default date, a time picked for "새벽까지") is not something a parser could have read: not scored.
const DATE_WORDS = /크리스마스|성탄|신정|새해|설날|설\s*연휴|구정|추석|한가위|어린이\s*날|어버이\s*날|현충일|광복절|개천절|한글날|삼일절|할로윈|핼러윈|빼빼로|발렌타인|화이트\s*데이|부처님|제야|연말|연초|오늘|내일|낼|모레|글피|이따|요일|욜|주말|평일|담주|이번|다음|\d|말까지|뒤|후|아침|점심|저녁|밤|새벽|오전|오후|낮|퇴근|출근|자정|정오|연휴|[월화수목금토일](?=\s|$)/;
const TIME_WORDS = /\d{1,2}\s*시|\d{1,2}:\d{2}|(?:한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|열한|열두)\s*시(?![간작])/;
function addedByUser(l: ParseLog, gold: F): Set<(typeof FIELDS)[number]> {
  const out = new Set<(typeof FIELDS)[number]>();
  if (gold.date && !DATE_WORDS.test(l.input)) out.add('date');
  if (gold.start_time && !TIME_WORDS.test(l.input)) out.add('start_time');
  return out;
}

interface Row { l: ParseLog; gold: F; logged: F; now: F; added: Set<(typeof FIELDS)[number]> }
const rows: Row[] = saved.map((l) => {
  const gold = norm(l.final);
  return { l, gold, logged: norm(l.predicted), now: ruleNow(l), added: addedByUser(l, gold) };
});
const fieldsOf = (r: Row) => FIELDS.filter((f) => !r.added.has(f));
const addedCount = rows.filter((r) => r.added.size).length;

function table(title: string, subset: Row[]): string[] {
  const out = [`### ${title} (n=${subset.length})`, '', '| 예측 | kind | date | start_time | end_date | 완전 일치 |', '|---|---|---|---|---|---|'];
  for (const [name, pick] of [['그때 앱의 예측', (r: Row) => r.logged], ['현재 규칙 파서', (r: Row) => r.now]] as const) {
    const cells = FIELDS.map((f) => {
      const n = subset.filter((r) => !r.added.has(f) && (f === 'end_date' ? !!r.gold.end_date || !!pick(r).end_date : f === 'kind' || r.gold.kind !== 'habit'));
      return `${pct(n.filter((r) => eq(pick(r), r.gold, f)).length, n.length)} (n=${n.length})`;
    });
    const exact = subset.filter((r) => fieldsOf(r).every((f) => eq(pick(r), r.gold, f))).length;
    out.push(`| ${name} | ${cells.join(' | ')} | ${pct(exact, subset.length)} |`);
  }
  return [...out, ''];
}

const modes = ['local', 'local_fallback', 'ai'] as const;
const lines = [
  '# 실제 입력 재생 평가',
  '',
  `- 파일: \`${path.basename(file)}\``,
  `- 앱 버전별 기록: ${Object.entries(versions).map(([k, v]) => `${k} ${v}건`).join(', ')}${before ? ` · ${before} 이전 것만 사용` : ''}`,
  '- 2026.10 = 이전 규칙 파서, 2026.10.2 = 개선한 규칙 파서, 2026.10.3 = 명절 이름·주말까지 추가 + AI 서비스 선택, 2026.10.4 = 매월 반복 습관. "그때 앱의 예측"에 두 버전이 섞이면 --before로 나누세요.',
  `- 기간: ${plan.map((l) => l.refDate).sort()[0] ?? '-'} ~ ${plan.map((l) => l.refDate).sort().at(-1) ?? '-'}`,
  `- 일정 파싱 기록 ${plan.length}건: ${Object.entries(byOutcome).map(([k, v]) => `${k} ${v}`).join(', ')}`,
  `- 채점 대상: 저장된 ${saved.length}건 (저장한 최종 값을 정답으로 봄. 취소·되돌리기는 제외)`,
  `- 문장에 없던 값을 사용자가 채운 기록: ${addedCount}건 (그 필드는 채점에서 뺌. 예: 날짜 없는 할 일을 폼 기본값인 오늘로 저장, "새벽까지"에 시각 지정)`,
  `- 그때 사용자가 예측을 고친 비율: ${pct(saved.filter((l) => (l.changed || []).some((c) => c !== 'title' && c !== 'categoryId' && c !== 'priority')).length, saved.length)} (제목·카테고리·우선순위만 고친 경우 제외)`,
  '',
  '## 정확도',
  '',
  ...table('전체', rows),
  ...modes.filter((m) => rows.some((r) => r.l.mode === m)).flatMap((m) => table(`그때 방식: ${m === 'ai' ? 'Gemini' : m === 'local' ? '규칙' : '규칙 (AI 실패 후 대체)'}`, rows.filter((r) => r.l.mode === m))),
  // The prediction logged "back then" depends on the app version that made it.
  ...[...new Set(rows.map((r) => r.l.appVersion || '?'))].sort().flatMap((v) => table(`그때 앱 버전: ${v}`, rows.filter((r) => (r.l.appVersion || '?') === v))),
  '## AI 호출',
  '',
  ...(() => {
    const tried = plan.filter((l) => l.mode === 'ai' || l.mode === 'local_fallback');
    if (!tried.length) return ['AI를 시도한 기록이 없습니다 (키 없이 사용).', ''];
    const errs = tried.filter((l) => l.mode === 'local_fallback').reduce<Record<string, number>>((m, l) => ((m[l.error || '(메시지 없음)'] = (m[l.error || '(메시지 없음)'] || 0) + 1), m), {});
    return [
      `- AI 시도 ${tried.length}건 중 성공 ${tried.length - Object.values(errs).reduce((a, b) => a + b, 0)}건 (${pct(tried.filter((l) => l.mode === 'ai').length, tried.length)})`,
      ...Object.entries(errs).sort((a, b) => b[1] - a[1]).map(([e, n]) => `- 실패 ${n}건: ${e}`),
      '',
    ];
  })(),
  '## 읽는 법',
  '',
  '- 정답은 사용자가 저장한 값입니다. 예측이 틀렸는데 그냥 저장했다면 틀린 값이 정답이 되므로, "그때 앱의 예측"이 유리합니다.',
  '- 제목은 채점하지 않습니다. 날짜·시각·종류만 봅니다.',
  '- 문장 수가 적으면 1건이 몇 %p입니다. n을 같이 쓰세요.',
];

const wrong = rows.filter((r) => r.added.size || !fieldsOf(r).every((f) => eq(r.now, r.gold, f)) || !fieldsOf(r).every((f) => eq(r.logged, r.gold, f)));
const fmt = (x: F) => `${x.kind} ${x.date ?? '-'} ${x.start_time ?? ''}${x.end_date ? `~${x.end_date}` : ''}`.trim();
const wrongLines = [
  '# 틀린 입력 (본인 확인용)',
  '',
  '| 입력일 | 입력 | 저장한 값 | 그때 예측 (방식) | 현재 규칙 파서 | 채점 제외 (사용자가 채움) |',
  '|---|---|---|---|---|---|',
  ...wrong.map((r) => `| ${r.l.refDate} ${r.l.refTime} | ${r.l.input.replace(/\|/g, '/').replace(/\n/g, ' ')} | ${fmt(r.gold)} | ${fmt(r.logged)} (${r.l.mode}) | ${fmt(r.now)} | ${[...r.added].join(', ')} |`),
];

const outDir = path.join('eval/results', `${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}-replay`);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'summary.md'), lines.join('\n') + '\n');
fs.writeFileSync(path.join(outDir, 'wrong.md'), wrongLines.join('\n') + '\n');
console.log(lines.join('\n'));
console.log(`\n저장: ${outDir}/summary.md, wrong.md`);
