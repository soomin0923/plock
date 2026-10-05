import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Hammer, Play, Plus, Trash2, ListTree, Copy } from 'lucide-react';
import type { SqlSavedQuery, SqlSetup, SqlSource } from '../../types';
import { useData } from '../../data/DataProvider';
import { useRouter } from '../../app/router';
import { Button, Segmented, Select, Sheet, Spinner, TextInput, useConfirm } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { SqlResultTable } from '../../components/SqlResultTable';
import { useSqlJs } from '../../db/useUserSqlDb';
import {
  buildUserDb,
  CATEGORY_FIELDS,
  fieldsFor,
  ITEM_FIELDS,
  listIndexes,
  reconcileBindings,
  runUserQuery,
  setupToMarkdown,
  type QueryResult,
  type UserDb,
} from '../../db/userSql';
import { cx, newId } from '../../lib/util';
import { BUILTIN_PARAM_HELP, ParamControls, bindParams, userParamNames, type ParamValues } from './params';

export const EMPTY_SQL_SETUP: SqlSetup = { ddl: '', include: 'both', bindings: [], queries: [] };

const DDL_PLACEHOLDER = `-- 일정 테이블을 직접 설계해 보세요. 예:
-- CREATE TABLE 테이블이름 (
--   컬럼이름 타입 제약조건,
--   ...
-- );
-- CREATE INDEX 인덱스이름 ON 테이블이름 (컬럼, ...);`;

const QUERY_PLACEHOLDER = `-- SELECT 컬럼, ...
-- FROM 테이블
-- WHERE 조건
-- ORDER BY 컬럼;`;

export async function copySetupMarkdown(setup: SqlSetup, indexes: { name: string; sql: string }[] = []) {
  const md = setupToMarkdown(setup, indexes);
  try {
    await navigator.clipboard.writeText(md);
    return true;
  } catch {
    return false;
  }
}

export function SqlSetupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { prefs, savePrefs, data } = useData();
  const { go } = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { SQL, error: loadError } = useSqlJs(open);
  const initial = prefs.sql || EMPTY_SQL_SETUP;
  const [draft, setDraft] = useState<SqlSetup>(initial);
  const [appliedDdl, setAppliedDdl] = useState<string | null>(null);
  const [userDb, setUserDb] = useState<(UserDb & { indexes: { name: string; table: string; sql: string }[] }) | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [showFields, setShowFields] = useState(false);
  const dbRef = useRef<UserDb | null>(null);

  // Fresh draft every time the sheet opens.
  useEffect(() => {
    if (open) {
      setDraft(prefs.sql || EMPTY_SQL_SETUP);
      setAppliedDdl(null);
      setUserDb(null);
      setBuildError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => dbRef.current?.db.close(), []);

  const src = useMemo(() => ({ categories: data.categories, events: data.events, tasks: data.tasks }), [data.categories, data.events, data.tasks]);

  const apply = (next: SqlSetup) => {
    if (!SQL) return;
    try {
      const built = buildUserDb(SQL, next, src);
      dbRef.current?.db.close();
      dbRef.current = built;
      setUserDb({ ...built, indexes: listIndexes(built.db) });
      setDraft({ ...next, bindings: reconcileBindings(built.tables, next.bindings) });
      setAppliedDdl(next.ddl);
      setBuildError(null);
    } catch (e) {
      setBuildError((e as Error).message);
    }
  };

  // Show the saved design immediately when the sheet opens with one.
  useEffect(() => {
    if (open && SQL && prefs.sql?.ddl.trim() && appliedDdl === null) apply(prefs.sql);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, SQL]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const ddlChanged = appliedDdl !== null && appliedDdl !== draft.ddl;

  const close = async (): Promise<boolean> => {
    if (dirty && !(await confirm({ title: '저장하지 않고 닫을까요?', message: '작성한 테이블 설계와 쿼리 변경 내용이 사라져요.', confirmLabel: '닫기', danger: true }))) return false;
    onClose();
    return true;
  };

  const save = () => {
    savePrefs({ sql: draft });
    toast('일정 DB 설계를 저장했어요.', 'success', draft.queries.length ? { label: '결과 보기', onClick: () => go('planner', { type: 'planner-section', section: 'sql' }) } : undefined);
    onClose();
  };

  const setBinding = (table: string, patch: { source?: SqlSource; column?: string; field?: string }) => {
    const bindings = draft.bindings.map((b) => {
      if (b.table !== table) return b;
      if (patch.source) {
        // Switching source: clear fields that don't exist for the new source.
        const valid = new Set(fieldsFor(patch.source).map((f) => f.key));
        return { ...b, source: patch.source, columns: b.columns.map((c) => ({ ...c, field: valid.has(c.field) ? c.field : '' })) };
      }
      return { ...b, columns: b.columns.map((c) => (c.column === patch.column ? { ...c, field: patch.field ?? '' } : c)) };
    });
    apply({ ...draft, bindings });
  };

  const setQuery = (id: string, patch: Partial<SqlSavedQuery>) => setDraft((d) => ({ ...d, queries: d.queries.map((q) => (q.id === id ? { ...q, ...patch } : q)) }));

  return (
    <Sheet
      open={open}
      onClose={close}
      title="일정 DB 설계 (SQL)"
      size="lg"
      footer={
        <div className="flex flex-wrap items-center gap-2">
          {prefs.sql && (
            <Button
              variant="ghost"
              className="text-expense"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={async () => {
                if (!(await confirm({ title: '일정 DB 설계를 지울까요?', message: '작성한 테이블 설계와 저장한 쿼리가 모두 지워져요. 일정·할 일 데이터는 그대로예요.', confirmLabel: '지우기', danger: true }))) return;
                savePrefs({ sql: undefined });
                onClose();
              }}
            >
              설계 지우기
            </Button>
          )}
          <div className="flex-1" />
          <Button onClick={() => close()}>취소</Button>
          <Button variant="primary" onClick={save} disabled={!draft.ddl.trim()}>
            저장
          </Button>
        </div>
      }
    >
      <p className="mb-4 text-[13px] leading-relaxed text-muted">
        일정·할 일 데이터를 담을 SQLite 테이블을 직접 설계하고, 기한·카테고리별 조회 쿼리를 작성해요. 모든 처리는 이 브라우저 안의 SQLite(WebAssembly)에서 이뤄져 서버 비용이 들지 않아요.
        원본 데이터는 그대로 두고, 설계한 테이블에 매번 다시 채워 넣어요.
      </p>
      {loadError && <p className="mb-3 rounded-xl bg-expense/10 px-3 py-2 text-[13px] text-expense">{loadError}</p>}

      {/* ① Table design */}
      <Step n={1} title="테이블 설계">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[13px] font-semibold text-ink-soft">담을 데이터</span>
          <Segmented<SqlSetup['include']>
            size="sm"
            value={draft.include}
            onChange={(include) => (appliedDdl !== null ? apply({ ...draft, include }) : setDraft({ ...draft, include }))}
            options={[
              { value: 'tasks', label: '할 일' },
              { value: 'events', label: '일정' },
              { value: 'both', label: '둘 다' },
            ]}
          />
        </div>
        <button type="button" onClick={() => setShowFields((v) => !v)} className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-primary" aria-expanded={showFields}>
          <ChevronDown className={cx('h-4 w-4 transition', !showFields && '-rotate-90')} />
          테이블에 넣을 수 있는 데이터 보기
        </button>
        {showFields && <FieldReference />}
        <textarea
          value={draft.ddl}
          onChange={(e) => setDraft({ ...draft, ddl: e.target.value })}
          placeholder={DDL_PLACEHOLDER}
          spellCheck={false}
          rows={10}
          aria-label="CREATE TABLE 문"
          className="mt-3 w-full rounded-xl border border-line-strong bg-ink p-3 font-mono text-[13px] leading-relaxed text-white/90 placeholder:text-white/35 focus:border-primary focus:outline-none"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button variant="primary" size="sm" disabled={!SQL || !draft.ddl.trim()} icon={SQL ? <Hammer className="h-4 w-4" /> : <Spinner />} onClick={() => apply(draft)}>
            {appliedDdl === null ? '테이블 만들기' : '다시 만들기'}
          </Button>
          {ddlChanged && <span className="text-[13px] text-amber-700">설계를 바꿨어요. ‘다시 만들기’를 눌러 적용하세요.</span>}
        </div>
        {buildError && <p className="mt-2 rounded-xl bg-expense/10 px-3 py-2 font-mono text-[13px] text-expense">{buildError}</p>}
      </Step>

      {/* ② Column mapping */}
      {userDb && (
        <Step n={2} title="데이터 연결">
          <p className="mb-3 text-[13px] text-muted">각 컬럼에 어떤 값을 넣을지 고르세요. 비워 둔 컬럼은 NULL(또는 DEFAULT 값)이 들어가요.</p>
          <div className="space-y-4">
            {draft.bindings.map((b) => {
              const t = userDb.tables.find((x) => x.name === b.table);
              const report = userDb.reports.find((r) => r.table === b.table);
              if (!t) return null;
              return (
                <div key={b.table} className="rounded-2xl border border-line p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <code className="rounded bg-hover px-2 py-0.5 font-mono text-sm font-semibold">{b.table}</code>
                    <span className="text-[13px] text-muted">←</span>
                    <Select value={b.source} onChange={(e) => setBinding(b.table, { source: e.target.value as SqlSource })} className="h-9 w-auto text-sm" aria-label={`${b.table} 데이터 원본`}>
                      <option value="items">일정·할 일</option>
                      <option value="categories">카테고리</option>
                      <option value="none">넣지 않음</option>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    {t.columns.map((c) => {
                      const mapped = b.columns.find((x) => x.column === c.name)?.field ?? '';
                      return (
                        <div key={c.name} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] items-center gap-2">
                          <div className="min-w-0">
                            <code className="font-mono text-[13px] font-semibold">{c.name}</code>
                            <span className="ml-1.5 text-[11px] text-muted">
                              {c.type}
                              {c.primaryKey && ' · PK'}
                              {c.notNull && ' · NOT NULL'}
                              {c.hasDefault && ' · DEFAULT'}
                            </span>
                          </div>
                          <Select
                            value={mapped}
                            disabled={b.source === 'none'}
                            onChange={(e) => setBinding(b.table, { column: c.name, field: e.target.value })}
                            className="h-9 text-sm"
                            aria-label={`${b.table}.${c.name}에 넣을 값`}
                          >
                            <option value="">(비워 두기)</option>
                            {fieldsFor(b.source).map((f) => (
                              <option key={f.key} value={f.key}>
                                {f.label}
                              </option>
                            ))}
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                  {report && (
                    <p className={cx('mt-2 text-[13px]', report.failed ? 'text-amber-700' : 'text-muted')}>
                      {report.inserted}행 들어감{report.failed ? ` · ${report.failed}행은 제약 조건 때문에 빠짐` : ''}
                    </p>
                  )}
                  {report?.errors.map((e) => (
                    <p key={e} className="font-mono text-[12px] text-expense">
                      {e}
                    </p>
                  ))}
                  <TablePreview db={userDb} table={b.table} />
                </div>
              );
            })}
          </div>
          {userDb.indexes.length > 0 && (
            <p className="mt-3 text-[13px] text-muted">
              인덱스: {userDb.indexes.map((i) => (
                <code key={i.name} className="mr-1.5 rounded bg-hover px-1.5 py-0.5 font-mono text-[12px]">
                  {i.name}
                </code>
              ))}
            </p>
          )}
        </Step>
      )}

      {/* ③ Queries */}
      <Step n={3} title="조회 쿼리">
        <p className="mb-2 text-[13px] text-muted">저장한 쿼리는 플래너의 ‘내 쿼리’ 탭에서 실행 결과로 보여요. SELECT(또는 WITH)로 시작하는 조회만 가능해요.</p>
        <div className="mb-3 text-[12px] leading-relaxed text-muted">
          <p>자동으로 채워지는 날짜 파라미터</p>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
            {BUILTIN_PARAM_HELP.map(([k, v]) => (
              <span key={k} className="whitespace-nowrap">
                <code className="font-mono">{k}</code> {v}
              </span>
            ))}
          </div>
          <p className="mt-1">
            그 밖의 이름(예: <code className="font-mono">:category</code>)은 실행할 때 값을 골라요.
          </p>
        </div>
        <div className="space-y-3">
          {draft.queries.map((q) => (
            <QueryEditor
              key={q.id}
              q={q}
              db={userDb}
              onChange={(patch) => setQuery(q.id, patch)}
              onDelete={() => setDraft((d) => ({ ...d, queries: d.queries.filter((x) => x.id !== q.id) }))}
            />
          ))}
        </div>
        <Button
          size="sm"
          className="mt-3"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => setDraft((d) => ({ ...d, queries: [...d.queries, { id: newId('q'), name: `쿼리 ${d.queries.length + 1}`, sql: '' }] }))}
        >
          쿼리 추가
        </Button>
      </Step>

      {userDb && draft.ddl.trim() && (
        <Button
          size="sm"
          variant="ghost"
          className="mt-2"
          icon={<Copy className="h-4 w-4" />}
          onClick={async () => toast((await copySetupMarkdown(draft, userDb.indexes)) ? '스키마와 쿼리를 마크다운으로 복사했어요. README에 붙여 넣으세요.' : '복사하지 못했어요.', 'info')}
        >
          README용 마크다운 복사
        </Button>
      )}
    </Sheet>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="mb-2.5 flex items-center gap-2 font-bold">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[13px] text-white">{n}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function FieldReference() {
  const block = (title: string, fields: typeof ITEM_FIELDS) => (
    <div>
      <p className="mb-1 text-[12px] font-bold text-muted">{title}</p>
      <table className="w-full text-left text-[12px]">
        <tbody>
          {fields.map((f) => (
            <tr key={f.key} className="border-b border-line/60">
              <td className="py-1 pr-2 font-semibold">{f.label}</td>
              <td className="py-1 font-mono text-muted">{f.example}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <div className="mt-2 grid gap-3 rounded-xl bg-hover/60 p-3 sm:grid-cols-2">
      {block('일정·할 일 한 건', ITEM_FIELDS)}
      {block('카테고리 한 개', CATEGORY_FIELDS)}
    </div>
  );
}

function TablePreview({ db, table }: { db: UserDb; table: string }) {
  const [open, setOpen] = useState(false);
  const result = useMemo(() => {
    if (!open) return null;
    try {
      return runUserQuery(db.db, `SELECT * FROM "${table.replace(/"/g, '""')}" LIMIT 5`, {});
    } catch {
      return null;
    }
  }, [open, db, table]);
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen((v) => !v)} className="text-[12px] font-semibold text-muted hover:text-ink" aria-expanded={open}>
        {open ? '미리보기 접기' : '들어간 데이터 미리보기 (5행)'}
      </button>
      {open && result && (
        <div className="mt-1.5">
          <SqlResultTable result={result} maxHeight="max-h-52" />
        </div>
      )}
    </div>
  );
}

function QueryEditor({ q, db, onChange, onDelete }: { q: SqlSavedQuery; db: UserDb | null; onChange: (p: Partial<SqlSavedQuery>) => void; onDelete: () => void }) {
  const { prefs } = useData();
  const [values, setValues] = useState<ParamValues>({});
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const names = userParamNames(q.sql, prefs.weekStartsOn);

  const run = (explain = false) => {
    if (!db) return setError('먼저 ① 테이블을 만들어 주세요.');
    const sql = explain ? `EXPLAIN QUERY PLAN ${q.sql.replace(/^\s*EXPLAIN\s+QUERY\s+PLAN\s*/i, '')}` : q.sql;
    try {
      setResult(runUserQuery(db.db, sql, bindParams(q.sql, values, prefs.weekStartsOn)));
      setError(null);
    } catch (e) {
      setResult(null);
      setError((e as Error).message);
    }
  };

  return (
    <div className="rounded-2xl border border-line p-3">
      <div className="mb-2 flex items-center gap-2">
        <TextInput value={q.name} onChange={(e) => onChange({ name: e.target.value })} className="h-9 flex-1 text-sm font-semibold" aria-label="쿼리 이름" />
        <button type="button" onClick={onDelete} className="rounded-lg p-2 text-faint hover:bg-hover hover:text-expense" aria-label={`${q.name} 삭제`}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <textarea
        value={q.sql}
        onChange={(e) => onChange({ sql: e.target.value })}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            run();
          }
        }}
        placeholder={QUERY_PLACEHOLDER}
        spellCheck={false}
        rows={6}
        aria-label={`${q.name} SQL`}
        className="w-full rounded-xl border border-line-strong bg-ink p-3 font-mono text-[13px] leading-relaxed text-white/90 placeholder:text-white/35 focus:border-primary focus:outline-none"
      />
      {names.length > 0 && (
        <div className="mt-2">
          <ParamControls names={names} values={values} onChange={setValues} />
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="soft" icon={<Play className="h-4 w-4" />} onClick={() => run()} disabled={!q.sql.trim()}>
          실행
        </Button>
        <Button size="sm" variant="ghost" icon={<ListTree className="h-4 w-4" />} onClick={() => run(true)} disabled={!q.sql.trim()}>
          실행 계획
        </Button>
        <span className="text-[12px] text-faint">Ctrl/⌘ + Enter</span>
      </div>
      {error && <p className="mt-2 rounded-xl bg-expense/10 px-3 py-2 font-mono text-[13px] text-expense">{error}</p>}
      {result && (
        <div className="mt-2">
          <SqlResultTable result={result} maxHeight="max-h-64" />
        </div>
      )}
    </div>
  );
}
