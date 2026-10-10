// Data access for the Plock MCP server: one user's planner in Firestore (accounts/{uid}/…).
// Kept apart from the MCP wiring so it can be tested against the Firestore emulator.

import { getApps, initializeApp, applicationDefault, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import config from '../firebase-applet-config.json' with { type: 'json' };
import type { Category, PlannerEvent } from '../src/types';
import { newId, nowIso } from '../src/lib/util';
import { diffDays } from '../src/lib/date';

export interface StoreOptions {
  uid: string;
  projectId?: string;
  databaseId?: string;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_RANGE_DAYS = 366;

export class PlockStore {
  private db: Firestore;

  constructor(private opts: StoreOptions) {
    // Credentials: Application Default Credentials (gcloud login or GOOGLE_APPLICATION_CREDENTIALS),
    // or FIRESTORE_EMULATOR_HOST for tests.
    const app: App =
      getApps()[0] ??
      initializeApp({
        projectId: opts.projectId ?? config.projectId,
        ...(process.env.FIRESTORE_EMULATOR_HOST ? {} : { credential: applicationDefault() }),
      });
    this.db = getFirestore(app, opts.databaseId ?? config.firestoreDatabaseId);
  }

  private col(name: 'events' | 'categories') {
    return this.db.collection('accounts').doc(this.opts.uid).collection(name);
  }

  /** For setup checks: which account ids exist in this database, and record counts for ours. */
  async diagnose(): Promise<{ accounts: string[]; counts: Record<string, number> }> {
    const accounts = (await this.db.collection('accounts').listDocuments()).map((d) => d.id);
    const cols = await this.db.collection('accounts').doc(this.opts.uid).listCollections();
    const counts: Record<string, number> = {};
    for (const c of cols) counts[c.id] = (await c.count().get()).data().count;
    return { accounts, counts };
  }

  async categories(): Promise<Category[]> {
    const snap = await this.col('categories').get();
    return snap.docs.map((d) => d.data() as Category).sort((a, b) => a.order - b.order);
  }

  /** Events that overlap [from, to] (inclusive), oldest first. */
  async listEvents(from: string, to: string): Promise<(PlannerEvent & { categoryName?: string })[]> {
    if (!YMD.test(from) || !YMD.test(to)) throw new Error('from/to는 YYYY-MM-DD 형식이어야 합니다.');
    if (to < from) throw new Error('to가 from보다 빠릅니다.');
    if (diffDays(from, to) > MAX_RANGE_DAYS) throw new Error(`한 번에 ${MAX_RANGE_DAYS}일까지만 조회할 수 있습니다.`);
    // Firestore allows a range filter on one field: narrow by startDate, then check endDate here.
    const [snap, cats] = await Promise.all([this.col('events').where('startDate', '<=', to).get(), this.categories()]);
    const name = new Map(cats.map((c) => [c.id, c.name]));
    return snap.docs
      .map((d) => d.data() as PlannerEvent)
      .filter((e) => (e.endDate || e.startDate) >= from)
      .sort((a, b) => a.startDate.localeCompare(b.startDate) || (a.startTime || '').localeCompare(b.startTime || ''))
      .map((e) => ({ ...e, categoryName: name.get(e.categoryId) }));
  }

  /**
   * Create an event the way the app does. If an event with the same title, start date and start
   * time already exists it is returned instead (an agent retrying a call must not duplicate it).
   */
  async createEvent(input: {
    title: string;
    date: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
    category?: string;
    location?: string;
    memo?: string;
  }): Promise<{ event: PlannerEvent; created: boolean }> {
    const title = input.title.trim();
    if (!title) throw new Error('title이 비어 있습니다.');
    if (!YMD.test(input.date)) throw new Error('date는 YYYY-MM-DD 형식이어야 합니다.');
    const endDate = input.endDate ?? input.date;
    if (!YMD.test(endDate) || endDate < input.date) throw new Error('endDate는 date와 같거나 늦은 YYYY-MM-DD여야 합니다.');
    if (diffDays(input.date, endDate) > 60) throw new Error('일정은 최대 60일까지 걸칠 수 있습니다.');
    for (const [k, v] of [['startTime', input.startTime], ['endTime', input.endTime]] as const) {
      if (v !== undefined && !HM.test(v)) throw new Error(`${k}는 HH:mm(24시간) 형식이어야 합니다.`);
    }
    if (input.endTime && !input.startTime) throw new Error('endTime만 있고 startTime이 없습니다.');
    if (input.startTime && input.endTime && endDate === input.date && input.endTime <= input.startTime) {
      throw new Error('endTime이 startTime보다 늦어야 합니다.');
    }

    const existing = await this.col('events').where('startDate', '==', input.date).get();
    const dup = existing.docs.map((d) => d.data() as PlannerEvent).find((e) => e.title === title && (e.startTime || '') === (input.startTime || ''));
    if (dup) return { event: dup, created: false };

    const cats = await this.categories();
    const wanted = input.category?.trim();
    const cat = (wanted && (cats.find((c) => c.name === wanted) || cats.find((c) => c.name.includes(wanted) || wanted.includes(c.name)))) || cats[0];
    const now = nowIso();
    const event: PlannerEvent = {
      id: newId('ev'),
      title,
      startDate: input.date,
      endDate,
      ...(input.startTime ? { startTime: input.startTime } : {}),
      ...(input.startTime ? { endTime: input.endTime ?? plusHour(input.startTime) } : {}),
      categoryId: cat?.id ?? 'cat_etc',
      ...(input.location?.trim() ? { location: input.location.trim() } : {}),
      ...(input.memo?.trim() ? { memo: input.memo.trim() } : {}),
      photos: [],
      done: false,
      createdAt: now,
      updatedAt: now,
    };
    await this.col('events').doc(event.id).set(event);
    return { event, created: true };
  }
}

function plusHour(hm: string): string {
  const [h, m] = hm.split(':').map(Number);
  return `${String(Math.min(h + 1, 23)).padStart(2, '0')}:${String(h + 1 > 23 ? 59 : m).padStart(2, '0')}`;
}

