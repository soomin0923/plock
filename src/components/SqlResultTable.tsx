import React from 'react';
import type { SqlValue } from 'sql.js';
import type { QueryResult } from '../db/userSql';
import { cx } from '../lib/util';

function cell(v: SqlValue) {
  if (v === null) return <span className="text-faint">NULL</span>;
  if (v instanceof Uint8Array) return `<${v.length} bytes>`;
  return String(v);
}

/** Rows returned by a user's SQL query. `onRowClick` makes rows clickable when it returns true for them. */
export function SqlResultTable({
  result,
  rowAction,
  maxHeight = 'max-h-80',
}: {
  result: QueryResult;
  rowAction?: (row: Record<string, SqlValue>) => (() => void) | null;
  maxHeight?: string;
}) {
  if (!result.columns.length) return <p className="text-[13px] text-muted">결과 열이 없어요.</p>;
  return (
    <div>
      <div className={cx('overflow-auto rounded-xl border border-line', maxHeight)}>
        <table className="w-full border-collapse text-left text-[13px]">
          <thead className="sticky top-0 bg-hover">
            <tr>
              {result.columns.map((c, i) => (
                <th key={i} className="whitespace-nowrap border-b border-line px-3 py-2 font-semibold">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 && (
              <tr>
                <td colSpan={result.columns.length} className="px-3 py-4 text-center text-muted">
                  조건에 맞는 행이 없어요
                </td>
              </tr>
            )}
            {result.rows.map((r, i) => {
              const action = rowAction?.(Object.fromEntries(result.columns.map((c, j) => [c, r[j]])));
              return (
                <tr
                  key={i}
                  onClick={action || undefined}
                  className={cx(i % 2 === 1 && 'bg-hover/40', action && 'cursor-pointer hover:bg-primary-soft')}
                >
                  {r.map((v, j) => (
                    <td key={j} className="whitespace-nowrap border-b border-line/60 px-3 py-2 tabular">
                      {cell(v)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-[12px] text-muted">
        {result.rows.length}행{result.truncated ? ' (500행까지만 표시)' : ''} · {result.ms}ms
      </p>
    </div>
  );
}
