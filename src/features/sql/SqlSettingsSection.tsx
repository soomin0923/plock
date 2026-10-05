import React, { useState } from 'react';
import { Copy, DatabaseZap } from 'lucide-react';
import { useData } from '../../data/DataProvider';
import { Button, Card, Spinner } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { useUserSqlDb } from '../../db/useUserSqlDb';
import { listIndexes } from '../../db/userSql';
import { copySetupMarkdown, SqlSetupSheet } from './SqlSetupSheet';

/** Settings card: entry point to the user's own table design and queries. */
export function SqlSettingsSection() {
  const { prefs } = useData();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const setup = prefs.sql;
  const { userDb, error, loading } = useUserSqlDb(open ? undefined : setup);

  return (
    <Card id="settings-sql" className="scroll-mt-20 p-4 sm:p-5">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-primary-soft text-primary">
          <DatabaseZap className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-bold tracking-tight">일정 DB (SQL)</h3>
          <p className="mt-0.5 text-[13px] leading-relaxed text-muted">
            일정·할 일을 담을 테이블을 직접 설계하고, 기한·카테고리별 조회 쿼리를 작성해 플래너에서 결과를 볼 수 있어요. 브라우저 안의 SQLite로 실행돼 서버 비용이 없어요.
          </p>
        </div>
      </div>

      {setup?.ddl.trim() ? (
        <div className="space-y-2">
          {loading && (
            <p className="flex items-center gap-2 text-[13px] text-muted">
              <Spinner /> 테이블 만드는 중…
            </p>
          )}
          {error && <p className="rounded-xl bg-expense/10 px-3 py-2 font-mono text-[13px] text-expense">{error}</p>}
          {userDb && (
            <ul className="space-y-1 text-[13px]">
              {userDb.tables.map((t) => {
                const r = userDb.reports.find((x) => x.table === t.name);
                return (
                  <li key={t.name} className="flex flex-wrap items-baseline gap-x-2">
                    <code className="font-mono font-semibold">{t.name}</code>
                    <span className="text-muted">컬럼 {t.columns.length}개</span>
                    {r && <span className="text-muted">· {r.inserted}행</span>}
                    {r?.failed ? <span className="text-amber-700">· {r.failed}행 제외됨</span> : null}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-[13px] text-muted">저장한 조회 쿼리 {setup.queries.length}개</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
              설계·쿼리 편집
            </Button>
            <Button
              size="sm"
              icon={<Copy className="h-4 w-4" />}
              onClick={async () => toast((await copySetupMarkdown(setup, userDb ? listIndexes(userDb.db) : [])) ? '스키마와 쿼리를 마크다운으로 복사했어요. README에 붙여 넣으세요.' : '복사하지 못했어요.', 'info')}
            >
              README용 복사
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="primary" onClick={() => setOpen(true)}>
          테이블 설계 시작
        </Button>
      )}
      <SqlSetupSheet open={open} onClose={() => setOpen(false)} />
    </Card>
  );
}
