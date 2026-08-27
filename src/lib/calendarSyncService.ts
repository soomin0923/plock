import { PlannerItem, DiaryEntry, FinancialEntry } from '../types';
import {
  GoogleCalendarEvent,
  listGoogleCalendarEvents,
  createGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
} from './googleCalendar';

function getNextDayDateString(dateStr: string): string {
  if (!dateStr || typeof dateStr !== 'string') return dateStr;
  const cleanStr = dateStr.slice(0, 10);
  const parts = cleanStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2] + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function normalizeTime(t?: string): string {
  if (!t) return '';
  return t.trim().slice(0, 5); // "10:00:00" -> "10:00"
}

export function deduplicatePlannerItems(items: PlannerItem[]): PlannerItem[] {
  if (!Array.isArray(items)) return [];
  const map = new Map<string, PlannerItem>();

  for (const item of items) {
    if (!item || !item.title || !item.date) continue;
    const cleanTitle = item.title.trim().toLowerCase();
    const key = `${cleanTitle}_${item.date}`;

    if (!map.has(key)) {
      map.set(key, { ...item, title: item.title.trim() });
    } else {
      const existing = map.get(key)!;
      if (!existing.googleCalendarEventId && item.googleCalendarEventId) {
        existing.googleCalendarEventId = item.googleCalendarEventId;
        existing.isGoogleCalendarSynced = true;
      }
      if (!existing.startTime && item.startTime) existing.startTime = item.startTime;
      if (!existing.endTime && item.endTime) existing.endTime = item.endTime;
      if (!existing.description && item.description) existing.description = item.description;
      if (!existing.location && item.location) existing.location = item.location;
      if (!existing.isCompleted && item.isCompleted) existing.isCompleted = item.isCompleted;
      if (item.isGoogleCalendarSynced) existing.isGoogleCalendarSynced = true;
    }
  }

  return Array.from(map.values());
}

export function deduplicateDiaries(diaries: DiaryEntry[]): DiaryEntry[] {
  if (!Array.isArray(diaries)) return [];
  const map = new Map<string, DiaryEntry>();

  for (const d of diaries) {
    if (!d || !d.title || !d.date) continue;
    const key = `${d.title.trim().toLowerCase()}_${d.date}`;
    if (!map.has(key)) {
      map.set(key, { ...d });
    } else {
      const existing = map.get(key)!;
      if (!existing.googleCalendarEventId && d.googleCalendarEventId) {
        existing.googleCalendarEventId = d.googleCalendarEventId;
        existing.isGoogleCalendarSynced = true;
      }
      if (!existing.content && d.content) {
        existing.content = d.content;
      }
      if ((!existing.emotions || existing.emotions.length === 0) && d.emotions) {
        existing.emotions = d.emotions;
      }
    }
  }

  return Array.from(map.values());
}

export function deduplicateFinancials(financials: FinancialEntry[]): FinancialEntry[] {
  if (!Array.isArray(financials)) return [];
  const map = new Map<string, FinancialEntry>();

  for (const f of financials) {
    if (!f || !f.date) continue;
    const key = `${f.type}_${(f.category || '').trim().toLowerCase()}_${f.amount}_${f.date}`;
    if (!map.has(key)) {
      map.set(key, { ...f });
    } else {
      const existing = map.get(key)!;
      if (!existing.memo && f.memo) {
        existing.memo = f.memo;
      }
    }
  }

  return Array.from(map.values());
}

export function plannerItemToGoogleEvent(item: PlannerItem): GoogleCalendarEvent {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul';

  let startObj: { dateTime?: string; date?: string; timeZone?: string } = {};
  let endObj: { dateTime?: string; date?: string; timeZone?: string } = {};

  if (item.startTime) {
    const startIso = `${item.date}T${item.startTime}:00`;
    let endIso = `${item.date}T${item.endTime || item.startTime}:00`;
    if (item.startTime === item.endTime || !item.endTime) {
      // Default to 1 hour event
      const [h, m] = item.startTime.split(':').map(Number);
      const endH = String((h + 1) % 24).padStart(2, '0');
      endIso = `${item.date}T${endH}:${String(m).padStart(2, '0')}:00`;
    }
    startObj = { dateTime: new Date(startIso).toISOString(), timeZone };
    endObj = { dateTime: new Date(endIso).toISOString(), timeZone };
  } else {
    startObj = { date: item.date };
    endObj = { date: getNextDayDateString(item.date) };
  }

  return {
    summary: item.title,
    description: item.description || '',
    location: item.location || '',
    start: startObj,
    end: endObj,
    extendedProperties: {
      private: {
        source: 'chronicle_app',
        localId: item.id,
        localType: 'planner',
      },
    },
  };
}

export function diaryEntryToGoogleEvent(entry: DiaryEntry): GoogleCalendarEvent {
  const emotionText = entry.emotions ? entry.emotions.map((e) => `${e.emoji} ${e.label}`).join(', ') : '';
  const desc = `[다이어리 기록]\n\n${entry.content}${emotionText ? `\n\n감정: ${emotionText}` : ''}`;

  return {
    summary: `[다이어리] ${entry.title}`,
    description: desc,
    start: { date: entry.date },
    end: { date: getNextDayDateString(entry.date) },
    extendedProperties: {
      private: {
        source: 'chronicle_app',
        localId: entry.id,
        localType: 'diary',
      },
    },
  };
}

export function financialEntryToGoogleEvent(entry: FinancialEntry): GoogleCalendarEvent {
  const typeStr = entry.type === 'income' ? '수입' : '지출';
  const amountFormatted = `${entry.type === 'income' ? '+' : '-'}${entry.amount.toLocaleString()}원`;
  const desc = `[가계부 내역]\n\n유형: ${typeStr}\n금액: ${entry.amount.toLocaleString()}원\n카테고리: ${entry.category}\n결제수단: ${entry.paymentMethod || '미지정'}${entry.memo ? `\n메모: ${entry.memo}` : ''}`;

  return {
    summary: `[가계부] ${entry.category || typeStr} (${amountFormatted})`,
    description: desc,
    start: { date: entry.date },
    end: { date: getNextDayDateString(entry.date) },
    extendedProperties: {
      private: {
        source: 'chronicle_app',
        localId: entry.id,
        localType: 'financial',
      },
    },
  };
}

export interface SyncOptions {
  accessToken?: string;
  plannerItems: PlannerItem[];
  diaries: DiaryEntry[];
  financials?: FinancialEntry[];
}

export interface SyncResult {
  success: boolean;
  updatedPlannerItems: PlannerItem[];
  updatedDiaries: DiaryEntry[];
  syncedCount: number;
  plannerSyncedCount: number;
  diarySyncedCount: number;
  financialSyncedCount: number;
  pulledCount: number;
  errorMessage?: string;
}

export async function performTwoWayGoogleCalendarSync(
  optionsOrToken: SyncOptions | string,
  localPlannerItems?: PlannerItem[],
  localDiaries?: DiaryEntry[],
  localFinancials?: FinancialEntry[]
): Promise<SyncResult> {
  let accessToken = '';
  let plannerItems: PlannerItem[] = [];
  let diaries: DiaryEntry[] = [];
  let financials: FinancialEntry[] = [];

  if (typeof optionsOrToken === 'object') {
    accessToken = optionsOrToken.accessToken || '';
    plannerItems = optionsOrToken.plannerItems;
    diaries = optionsOrToken.diaries;
    financials = optionsOrToken.financials || [];
  } else {
    accessToken = optionsOrToken;
    plannerItems = localPlannerItems || [];
    diaries = localDiaries || [];
    financials = localFinancials || [];
  }

  if (!accessToken) {
    return {
      success: false,
      updatedPlannerItems: plannerItems,
      updatedDiaries: diaries,
      syncedCount: 0,
      plannerSyncedCount: 0,
      diarySyncedCount: 0,
      financialSyncedCount: 0,
      pulledCount: 0,
      errorMessage: 'Google Calendar OAuth access token이 없거나 만료되었습니다.',
    };
  }

  const deduplicatedLocalPlanners = deduplicatePlannerItems(plannerItems);
  const deduplicatedLocalDiaries = deduplicateDiaries(diaries);
  const deduplicatedLocalFinancials = deduplicateFinancials(financials);

  let plannerSyncedCount = 0;
  let diarySyncedCount = 0;
  let financialSyncedCount = 0;
  let pulledCount = 0;
  let hasPermissionError = false;
  let hasAuthError = false;
  const syncErrors: string[] = [];

  try {
    // 1. Fetch Google Calendar events
    const now = new Date();
    const timeMin = new Date(now.getFullYear(), now.getMonth() - 12, 1).toISOString();
    const timeMax = new Date(now.getFullYear(), now.getMonth() + 12, 28).toISOString();

    let googleEvents: GoogleCalendarEvent[] = [];
    try {
      googleEvents = await listGoogleCalendarEvents(accessToken, timeMin, timeMax);
    } catch (fetchErr: any) {
      console.error('Failed to list Google Calendar events:', fetchErr);
      const errMsg = fetchErr?.message || '';
      if (errMsg.includes('403') || errMsg.includes('Insufficient') || errMsg.includes('insufficient')) {
        hasPermissionError = true;
      }
      if (errMsg.includes('401') || errMsg.includes('Invalid') || errMsg.includes('invalid')) {
        hasAuthError = true;
      }
      syncErrors.push(errMsg);
    }

    const deletedGoogleEventIds = new Set<string>();
    const isDeleted = (id?: string) => !id || deletedGoogleEventIds.has(id);

    const plannerMap = new Map<string, PlannerItem>(deduplicatedLocalPlanners.map((p) => [p.id, { ...p }]));
    const diaryMap = new Map<string, DiaryEntry>(deduplicatedLocalDiaries.map((d) => [d.id, { ...d }]));
    const financialMap = new Map<string, FinancialEntry>(deduplicatedLocalFinancials.map((f) => [f.id, { ...f }]));

    // Helper for error analysis
    const checkErr = (err: any) => {
      const msg = err?.message || String(err);
      syncErrors.push(msg);
      if (msg.includes('403') || msg.includes('Insufficient') || msg.includes('insufficient')) {
        hasPermissionError = true;
      }
      if (msg.includes('401') || msg.includes('Invalid') || msg.includes('invalid')) {
        hasAuthError = true;
      }
    };

    // ------------------------------------------------------------------
    // PHASE 1: DEDUPLICATION ON GOOGLE CALENDAR
    // Clean up duplicate events on Google Calendar for Diaries, Financials, and Planner items
    // ------------------------------------------------------------------
    const gEventGroups = new Map<string, GoogleCalendarEvent[]>();

    for (const ge of googleEvents) {
      if (isDeleted(ge.id) || ge.status === 'cancelled' || !ge.summary || !ge.id) continue;

      const dateStr = ge.start?.date || (ge.start?.dateTime ? ge.start.dateTime.slice(0, 10) : '');
      if (!dateStr) continue;

      let groupKey = '';
      if (ge.summary.startsWith('[다이어리]')) {
        groupKey = `DIARY_${ge.summary.trim().toLowerCase()}_${dateStr}`;
      } else if (ge.summary.startsWith('[가계부]')) {
        groupKey = `FINANCIAL_${ge.summary.trim().toLowerCase()}_${dateStr}`;
      } else {
        groupKey = `PLANNER_${ge.summary.trim().toLowerCase()}_${dateStr}`;
      }

      if (!gEventGroups.has(groupKey)) {
        gEventGroups.set(groupKey, []);
      }
      gEventGroups.get(groupKey)!.push(ge);
    }

    // Delete duplicates in each group on Google Calendar
    for (const [key, events] of gEventGroups.entries()) {
      if (events.length > 1) {
        // Find if one matches googleCalendarEventId or localId
        let primaryIndex = events.findIndex((e) =>
          Array.from(plannerMap.values()).some((p) => p.googleCalendarEventId === e.id || e.extendedProperties?.private?.localId === p.id) ||
          Array.from(diaryMap.values()).some((d) => d.googleCalendarEventId === e.id || e.extendedProperties?.private?.localId === d.id)
        );
        if (primaryIndex < 0) primaryIndex = 0;

        for (let i = 0; i < events.length; i++) {
          if (i !== primaryIndex && events[i].id) {
            try {
              await deleteGoogleCalendarEvent(accessToken, events[i].id!);
              deletedGoogleEventIds.add(events[i].id!);
            } catch (e) {
              checkErr(e);
            }
          }
        }
      }
    }

    // Active (non-deleted) Google events
    const activeGoogleEvents = googleEvents.filter((ge) => !isDeleted(ge.id) && ge.status !== 'cancelled');

    // Helper to find matching Google event for a planner item
    const findMatchingGEvent = (item: PlannerItem) => {
      const cleanTitle = item.title.trim().toLowerCase();

      return activeGoogleEvents.find((ge) => {
        if (!ge.id || ge.status === 'cancelled') return false;
        if (item.googleCalendarEventId && ge.id === item.googleCalendarEventId) return true;
        if (ge.extendedProperties?.private?.localId === item.id) return true;

        if (!ge.summary) return false;
        const geTitle = ge.summary.trim().toLowerCase();
        const geDate = ge.start?.date || (ge.start?.dateTime ? ge.start.dateTime.slice(0, 10) : '');

        return geTitle === cleanTitle && geDate === item.date;
      });
    };

    // ------------------------------------------------------------------
    // PHASE 2: OUTBOUND SYNC (Create / Update Google Calendar Events)
    // ------------------------------------------------------------------

    // 2. Outbound Sync: Planner Items
    for (const item of Array.from(plannerMap.values())) {
      const payload = plannerItemToGoogleEvent(item);
      const existingGEvent = findMatchingGEvent(item);

      if (existingGEvent && existingGEvent.id) {
        try {
          await updateGoogleCalendarEvent(accessToken, existingGEvent.id, payload);
          item.isGoogleCalendarSynced = true;
          item.googleCalendarEventId = existingGEvent.id;
          plannerMap.set(item.id, item);
          plannerSyncedCount++;
        } catch (err) {
          console.error(`Failed to update planner item ${item.title}:`, err);
          checkErr(err);
        }
      } else {
        try {
          const created = await createGoogleCalendarEvent(accessToken, payload);
          if (created.id) {
            item.isGoogleCalendarSynced = true;
            item.googleCalendarEventId = created.id;
            plannerMap.set(item.id, item);
            activeGoogleEvents.push(created);
            plannerSyncedCount++;
          }
        } catch (err) {
          console.error(`Failed to create planner item ${item.title}:`, err);
          checkErr(err);
        }
      }
    }

    // 3. Outbound Sync: Diary Entries
    for (const diary of Array.from(diaryMap.values())) {
      if (diary.syncToGoogleCalendar === false) {
        // If user explicitly unchecked Google Calendar sync for this diary entry
        const existingGEvent = activeGoogleEvents.find(
          (ge) =>
            ge.id === diary.googleCalendarEventId ||
            ge.extendedProperties?.private?.localId === diary.id ||
            (ge.summary && ge.summary === `[다이어리] ${diary.title}` && ge.start?.date === diary.date)
        );
        if (existingGEvent && existingGEvent.id) {
          try {
            await deleteGoogleCalendarEvent(accessToken, existingGEvent.id);
            deletedGoogleEventIds.add(existingGEvent.id);
          } catch (e) {
            checkErr(e);
          }
        }
        diary.isGoogleCalendarSynced = false;
        diary.googleCalendarEventId = undefined;
        diaryMap.set(diary.id, diary);
        continue;
      }

      const payload = diaryEntryToGoogleEvent(diary);
      const existingGEvent = activeGoogleEvents.find(
        (ge) =>
          ge.id === diary.googleCalendarEventId ||
          ge.extendedProperties?.private?.localId === diary.id ||
          (ge.summary && ge.summary === `[다이어리] ${diary.title}` && ge.start?.date === diary.date)
      );

      if (existingGEvent && existingGEvent.id) {
        try {
          await updateGoogleCalendarEvent(accessToken, existingGEvent.id, payload);
          diary.isGoogleCalendarSynced = true;
          diary.googleCalendarEventId = existingGEvent.id;
          diaryMap.set(diary.id, diary);
          diarySyncedCount++;
        } catch (err) {
          console.error(`Failed to update diary ${diary.title}:`, err);
          checkErr(err);
        }
      } else {
        try {
          const created = await createGoogleCalendarEvent(accessToken, payload);
          if (created.id) {
            diary.isGoogleCalendarSynced = true;
            diary.googleCalendarEventId = created.id;
            diaryMap.set(diary.id, diary);
            activeGoogleEvents.push(created);
            diarySyncedCount++;
          }
        } catch (err) {
          console.error(`Failed to create diary ${diary.title}:`, err);
          checkErr(err);
        }
      }
    }

    // 4. Outbound Sync: Financial Entries
    for (const fin of Array.from(financialMap.values())) {
      const typeStr = fin.type === 'income' ? '수입' : '지출';
      const amountFormatted = `${fin.type === 'income' ? '+' : '-'}${fin.amount.toLocaleString()}원`;
      const expectedSummary = `[가계부] ${fin.category || typeStr} (${amountFormatted})`;

      const payload = financialEntryToGoogleEvent(fin);
      const existingGEvent = activeGoogleEvents.find(
        (ge) =>
          ge.extendedProperties?.private?.localId === fin.id ||
          (ge.summary === expectedSummary && ge.start?.date === fin.date)
      );

      if (existingGEvent && existingGEvent.id) {
        try {
          await updateGoogleCalendarEvent(accessToken, existingGEvent.id, payload);
          financialSyncedCount++;
        } catch (err) {
          console.error(`Failed to update financial entry:`, err);
          checkErr(err);
        }
      } else {
        try {
          const created = await createGoogleCalendarEvent(accessToken, payload);
          if (created.id) {
            activeGoogleEvents.push(created);
          }
          financialSyncedCount++;
        } catch (err) {
          console.error(`Failed to create financial entry:`, err);
          checkErr(err);
        }
      }
    }

    // ------------------------------------------------------------------
    // PHASE 3: DELETE ORPHANED EVENTS ON GOOGLE CALENDAR
    // Delete Google events whose local source item was deleted in the app
    // ------------------------------------------------------------------
    for (const gEvent of activeGoogleEvents) {
      if (!gEvent.id || isDeleted(gEvent.id) || gEvent.status === 'cancelled') continue;
      const privateProps = gEvent.extendedProperties?.private;
      const isAppEvent = privateProps?.source === 'chronicle_app';
      const localId = privateProps?.localId;
      const localType = privateProps?.localType;

      if (isAppEvent && localId && localType) {
        if (localType === 'planner' && !plannerMap.has(localId)) {
          try {
            await deleteGoogleCalendarEvent(accessToken, gEvent.id);
            deletedGoogleEventIds.add(gEvent.id);
          } catch (e) {}
        } else if (localType === 'diary' && !diaryMap.has(localId)) {
          try {
            await deleteGoogleCalendarEvent(accessToken, gEvent.id);
            deletedGoogleEventIds.add(gEvent.id);
          } catch (e) {}
        } else if (localType === 'financial' && !financialMap.has(localId)) {
          try {
            await deleteGoogleCalendarEvent(accessToken, gEvent.id);
            deletedGoogleEventIds.add(gEvent.id);
          } catch (e) {}
        }
      } else if (gEvent.summary) {
        if (gEvent.summary.startsWith('[다이어리]')) {
          const diaryTitle = gEvent.summary.replace('[다이어리]', '').trim();
          const exists = Array.from(diaryMap.values()).some(
            (d) => `[다이어리] ${d.title}` === gEvent.summary || d.title === diaryTitle
          );
          if (!exists) {
            try {
              await deleteGoogleCalendarEvent(accessToken, gEvent.id);
              deletedGoogleEventIds.add(gEvent.id);
            } catch (e) {}
          }
        } else if (gEvent.summary.startsWith('[가계부]')) {
          const dateStr = gEvent.start?.date || (gEvent.start?.dateTime ? gEvent.start.dateTime.slice(0, 10) : '');
          const exists = Array.from(financialMap.values()).some((f) => f.date === dateStr);
          if (!exists) {
            try {
              await deleteGoogleCalendarEvent(accessToken, gEvent.id);
              deletedGoogleEventIds.add(gEvent.id);
            } catch (e) {}
          }
        }
      }
    }

    // ------------------------------------------------------------------
    // PHASE 4: INBOUND SYNC (Pull Google Calendar Events to Local Planner)
    // Avoid duplicate local creation if an item with same title & date exists
    // ------------------------------------------------------------------
    const currentActiveEvents = activeGoogleEvents.filter((ge) => !isDeleted(ge.id) && ge.status !== 'cancelled');

    for (const gEvent of currentActiveEvents) {
      if (!gEvent.summary || !gEvent.id) continue;

      const isDiaryOrFinancial =
        gEvent.extendedProperties?.private?.localType === 'diary' ||
        gEvent.extendedProperties?.private?.localType === 'financial' ||
        gEvent.summary.startsWith('[다이어리]') ||
        gEvent.summary.startsWith('[가계부]');

      if (isDiaryOrFinancial) continue;

      const dateStr = gEvent.start?.date || (gEvent.start?.dateTime ? gEvent.start.dateTime.slice(0, 10) : '');
      let startTime = '';
      let endTime = '';

      if (gEvent.start?.dateTime) {
        const d = new Date(gEvent.start.dateTime);
        startTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      }
      if (gEvent.end?.dateTime) {
        const d = new Date(gEvent.end.dateTime);
        endTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      }

      // Check if local item matches by ID OR by title + date + startTime
      const cleanSummary = gEvent.summary.trim().toLowerCase();
      const gEventTime = normalizeTime(startTime);

      const existingLocal = Array.from(plannerMap.values()).find((p) => {
        if (p.googleCalendarEventId && p.googleCalendarEventId === gEvent.id) return true;
        if (p.id === gEvent.extendedProperties?.private?.localId) return true;

        const pTitle = p.title.trim().toLowerCase();
        return pTitle === cleanSummary && p.date === dateStr;
      });

      if (existingLocal) {
        let updated = false;
        if (existingLocal.title !== gEvent.summary) {
          existingLocal.title = gEvent.summary;
          updated = true;
        }
        if (dateStr && existingLocal.date !== dateStr) {
          existingLocal.date = dateStr;
          updated = true;
        }
        if (startTime && existingLocal.startTime !== startTime) {
          existingLocal.startTime = startTime;
          updated = true;
        }
        if (endTime && existingLocal.endTime !== endTime) {
          existingLocal.endTime = endTime;
          updated = true;
        }
        if (!existingLocal.googleCalendarEventId) {
          existingLocal.googleCalendarEventId = gEvent.id;
          updated = true;
        }
        existingLocal.isGoogleCalendarSynced = true;
        if (updated) {
          plannerMap.set(existingLocal.id, existingLocal);
          pulledCount++;
        }
      } else if (dateStr) {
        const newPlannerItem: PlannerItem = {
          id: gEvent.extendedProperties?.private?.localId || `gcal_${gEvent.id}`,
          title: gEvent.summary,
          description: gEvent.description || '',
          date: dateStr,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          category: 'work',
          isCompleted: false,
          location: gEvent.location || '',
          isGoogleCalendarSynced: true,
          googleCalendarEventId: gEvent.id,
          createdAt: gEvent.updated || new Date().toISOString(),
        };
        plannerMap.set(newPlannerItem.id, newPlannerItem);
        pulledCount++;
      }
    }

    const totalOutboundSynced = plannerSyncedCount + diarySyncedCount + financialSyncedCount;

    const finalPlannerList = deduplicatePlannerItems(Array.from(plannerMap.values()));
    const finalDiariesList = deduplicateDiaries(Array.from(diaryMap.values()));

    let errorMessage: string | undefined = undefined;
    if (hasPermissionError) {
      errorMessage = '⚠️ 구글 캘린더 쓰기 권한이 동의되지 않았습니다. 상단 [구글 계정 연결] 팝업에서 Google Calendar 권한 체크박스를 허용해 주세요.';
    } else if (hasAuthError) {
      errorMessage = '⚠️ 구글 계정 연동 토큰이 만료되었습니다. 상단 [구글 계정 연결] 버튼을 눌러 다시 연결해 주세요.';
    } else if (syncErrors.length > 0 && totalOutboundSynced === 0 && pulledCount === 0) {
      errorMessage = `캘린더 동기화 중 오류가 발생했습니다: ${syncErrors[0]}`;
    }

    return {
      success: !hasPermissionError && !hasAuthError,
      updatedPlannerItems: finalPlannerList,
      updatedDiaries: finalDiariesList,
      syncedCount: totalOutboundSynced,
      plannerSyncedCount,
      diarySyncedCount,
      financialSyncedCount,
      pulledCount,
      errorMessage,
    };
  } catch (err: any) {
    console.error('Error during Google Calendar sync:', err);
    return {
      success: false,
      updatedPlannerItems: plannerItems,
      updatedDiaries: diaries,
      syncedCount: 0,
      plannerSyncedCount: 0,
      diarySyncedCount: 0,
      financialSyncedCount: 0,
      pulledCount: 0,
      errorMessage: err.message || 'Unknown error occurred during Google Calendar API sync.',
    };
  }
}
