import React from 'react';
import type { ParamsObject } from 'sql.js';
import { useData } from '../../data/DataProvider';
import { Select, TextInput } from '../../components/ui';
import { builtinParams, queryParamNames } from '../../db/userSql';
import { sortCategories } from '../planner/helpers';
import { today } from '../../lib/date';

export const BUILTIN_PARAM_HELP: [string, string][] = [
  [':today', '오늘'],
  [':yesterday', '어제'],
  [':tomorrow', '내일'],
  [':week_start', '이번 주 첫날'],
  [':week_end', '이번 주 마지막 날'],
  [':month_start', '이번 달 1일'],
  [':month_end', '이번 달 마지막 날'],
];

export type ParamValues = Record<string, string>;

/** Parameters the user picks a value for (everything that isn't a built-in date). */
export function userParamNames(sql: string, weekStartsOn: 0 | 1): string[] {
  const builtins = builtinParams(today(), weekStartsOn);
  return queryParamNames(sql).filter((n) => !(n in builtins));
}

/** Values to bind: built-in dates + the user's choices (empty choice = NULL). */
export function bindParams(sql: string, values: ParamValues, weekStartsOn: 0 | 1): ParamsObject {
  const builtins = builtinParams(today(), weekStartsOn);
  const out: ParamsObject = {};
  for (const name of queryParamNames(sql)) {
    if (name in builtins) out[name] = builtins[name];
    else {
      const v = values[name];
      out[name] = v === undefined || v === '' ? null : /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
    }
  }
  return out;
}

export function ParamControls({ names, values, onChange }: { names: string[]; values: ParamValues; onChange: (v: ParamValues) => void }) {
  const { data } = useData();
  const cats = sortCategories(data.categories);
  if (!names.length) return null;
  const set = (name: string, v: string) => onChange({ ...values, [name]: v });
  return (
    <div className="flex flex-wrap gap-2">
      {names.map((name) => {
        const v = values[name] ?? '';
        const key = name.slice(1).toLowerCase();
        let control: React.ReactNode;
        if (key === 'category' || key === 'category_name') {
          control = (
            <Select value={v} onChange={(e) => set(name, e.target.value)} className="h-9 w-auto min-w-28 text-sm">
              <option value="">(NULL)</option>
              {cats.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </Select>
          );
        } else if (key === 'category_id') {
          control = (
            <Select value={v} onChange={(e) => set(name, e.target.value)} className="h-9 w-auto min-w-28 text-sm">
              <option value="">(NULL)</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.id})
                </option>
              ))}
            </Select>
          );
        } else if (key === 'kind') {
          control = (
            <Select value={v} onChange={(e) => set(name, e.target.value)} className="h-9 w-auto text-sm">
              <option value="">(NULL)</option>
              <option value="할 일">할 일</option>
              <option value="일정">일정</option>
            </Select>
          );
        } else {
          control = <TextInput value={v} onChange={(e) => set(name, e.target.value)} placeholder="값 (비우면 NULL)" className="h-9 w-36 text-sm" />;
        }
        return (
          <label key={name} className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-soft">
            <code className="rounded bg-hover px-1.5 py-0.5 font-mono text-[12px]">{name}</code>
            {control}
          </label>
        );
      })}
    </div>
  );
}
