import { useEffect, useState } from 'react';
import type { SqlJsStatic } from 'sql.js';
import type { SqlSetup } from '../types';
import { useData } from '../data/DataProvider';
import { buildUserDb, loadSqlJs, type UserDb } from './userSql';

/** sql.js, loaded on first use. */
export function useSqlJs(enabled: boolean): { SQL: SqlJsStatic | null; error: string | null } {
  const [SQL, setSQL] = useState<SqlJsStatic | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || SQL) return;
    let alive = true;
    loadSqlJs()
      .then((s) => alive && setSQL(s))
      .catch((e) => alive && setError(`SQLite 엔진을 불러오지 못했어요: ${(e as Error)?.message || e}`));
    return () => {
      alive = false;
    };
  }, [enabled, SQL]);
  return { SQL, error };
}

/**
 * The user's saved table design, filled with the current plan data.
 * Rebuilt whenever the data or the saved design changes.
 */
export function useUserSqlDb(setup: SqlSetup | undefined): { userDb: UserDb | null; error: string | null; loading: boolean } {
  const { data } = useData();
  const enabled = !!setup?.ddl.trim();
  const { SQL, error: loadError } = useSqlJs(enabled);
  const [built, setBuilt] = useState<{ value?: UserDb; error?: string } | null>(null);

  useEffect(() => {
    if (!SQL || !setup || !enabled) {
      setBuilt(null);
      return;
    }
    let result: { value?: UserDb; error?: string };
    try {
      result = { value: buildUserDb(SQL, setup, { categories: data.categories, events: data.events, tasks: data.tasks }) };
    } catch (e) {
      result = { error: (e as Error).message };
    }
    setBuilt(result);
    return () => result.value?.db.close();
  }, [SQL, setup, enabled, data.categories, data.events, data.tasks]);

  return { userDb: built?.value ?? null, error: loadError ?? built?.error ?? null, loading: enabled && !built && !loadError };
}
