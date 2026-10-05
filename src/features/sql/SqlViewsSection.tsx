import React, { useMemo, useState } from 'react';
import { Code2, DatabaseZap, Settings2 } from 'lucide-react';
import type { SqlValue } from 'sql.js';
import type { SqlSavedQuery } from '../../types';
import { useData } from '../../data/DataProvider';
import { useRouter } from '../../app/router';
import { Button, Card, EmptyState, Spinner } from '../../components/ui';
import { SqlResultTable } from '../../components/SqlResultTable';
import { useUserSqlDb } from '../../db/useUserSqlDb';
import { runUserQuery, type UserDb } from '../../db/userSql';
import type { PlanSheetState } from '../planner/forms';
import { ParamControls, bindParams, userParamNames, type ParamValues } from './params';

/** Planner tab: results of the queries the user wrote in 설정 > 일정 DB. */
export function SqlViewsSection({ openSheet }: { openSheet: (s: PlanSheetState) => void }) {
  const { prefs } = useData();
  const { go } = useRouter();
  const setup = prefs.sql;
  const { userDb, error, loading } = useUserSqlDb(setup);

  const toSettings = () => go('settings', { type: 'settings-section', section: 'sql' });

  if (!setup?.ddl.trim() || !setup.queries.length) {
    return (
      <Card>
        <EmptyState
          icon={<DatabaseZap className="h-10 w-10" />}
          title="아직 저장한 쿼리가 없어요"
          description="설정 > 일정 DB(SQL)에서 테이블을 설계하고 조회 쿼리를 저장하면 여기에서 결과를 볼 수 있어요."
          action={<Button variant="primary" onClick={toSettings}>설계하러 가기</Button>}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] text-muted">내가 설계한 테이블과 쿼리로 조회한 결과예요. 데이터가 바뀌면 바로 다시 조회해요.</p>
        <Button size="sm" variant="ghost" icon={<Settings2 className="h-4 w-4" />} onClick={toSettings}>
          편집
        </Button>
      </div>
      {loading && (
        <p className="flex items-center gap-2 px-1 text-sm text-muted">
          <Spinner /> SQLite 준비 중…
        </p>
      )}
      {error && <Card className="p-4 font-mono text-[13px] text-expense">{error}</Card>}
      {userDb && setup.queries.map((q) => <SavedQueryCard key={q.id} q={q} userDb={userDb} openSheet={openSheet} />)}
    </div>
  );
}

function SavedQueryCard({ q, userDb, openSheet }: { q: SqlSavedQuery; userDb: UserDb; openSheet: (s: PlanSheetState) => void }) {
  const { data, prefs } = useData();
  const [values, setValues] = useState<ParamValues>({});
  const [showSql, setShowSql] = useState(false);
  const names = userParamNames(q.sql, prefs.weekStartsOn);

  const outcome = useMemo(() => {
    try {
      return { result: runUserQuery(userDb.db, q.sql, bindParams(q.sql, values, prefs.weekStartsOn)) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [userDb, q.sql, values, prefs.weekStartsOn]);

  // Rows that carry an item id (any column mapped to “고유 ID”, or a column named id) open that item.
  const idColumns = useMemo(() => {
    const cols = new Set(['id']);
    for (const b of prefs.sql?.bindings || []) if (b.source === 'items') b.columns.filter((c) => c.field === 'id').forEach((c) => cols.add(c.column));
    return cols;
  }, [prefs.sql]);
  const rowAction = (row: Record<string, SqlValue>) => {
    for (const col of idColumns) {
      const id = row[col];
      if (typeof id !== 'string') continue;
      const task = data.tasks.find((t) => t.id === id);
      if (task) return () => openSheet({ mode: 'edit-task', item: task });
      const ev = data.events.find((e) => e.id === id);
      if (ev) return () => openSheet({ mode: 'edit-event', item: ev });
    }
    return null;
  };

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="flex-1 font-bold tracking-tight">{q.name}</h3>
        <button type="button" onClick={() => setShowSql((v) => !v)} className="inline-flex items-center gap-1 text-[12px] font-semibold text-muted hover:text-ink" aria-expanded={showSql}>
          <Code2 className="h-3.5 w-3.5" /> SQL
        </button>
      </div>
      {showSql && <pre className="mb-2 max-h-60 overflow-auto rounded-xl bg-ink p-3 font-mono text-[12px] leading-relaxed text-white/90">{q.sql.trim()}</pre>}
      {names.length > 0 && (
        <div className="mb-2">
          <ParamControls names={names} values={values} onChange={setValues} />
        </div>
      )}
      {'error' in outcome ? (
        <p className="rounded-xl bg-expense/10 px-3 py-2 font-mono text-[13px] text-expense">{outcome.error}</p>
      ) : (
        outcome.result && <SqlResultTable result={outcome.result} rowAction={rowAction} />
      )}
    </Card>
  );
}
