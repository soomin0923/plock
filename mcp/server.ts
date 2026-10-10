// Plock MCP server: lets an MCP client (Claude Desktop, Claude Code, …) read and add planner events.
//
//   GOOGLE_APPLICATION_CREDENTIALS=<service-account.json> PLOCK_UID=<Firebase Auth uid> npx tsx mcp/server.ts
//
// Runs on your own PC over stdio. The service-account key bypasses Firestore rules, so the server is
// pinned to one account (PLOCK_UID) and only exposes two narrow tools. Never commit the key.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { PlockStore } from './plockStore';
import { WEEKDAYS_KR, weekday } from '../src/lib/date';

const uid = process.env.PLOCK_UID?.trim();
if (!uid) {
  console.error('PLOCK_UID 환경 변수가 필요합니다 (Firebase 콘솔 → Authentication → 사용자 UID).');
  process.exit(1);
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS 환경 변수에 서비스 계정 키(JSON) 경로를 넣어 주세요. (mcp/README.md)');
  process.exit(1);
}
const store = new PlockStore({ uid });

const server = new McpServer({ name: 'plock', version: '1.0.0' });

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');
const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:mm (24h)');
const day = (d: string) => `${d}(${WEEKDAYS_KR[weekday(d)]})`;

server.registerTool(
  'list_events',
  {
    title: '일정 조회',
    description:
      'Plock 플래너에서 기간 [from, to] (양 끝 포함)과 겹치는 일정을 날짜순으로 돌려준다. 날짜는 Asia/Seoul 기준 YYYY-MM-DD. ' +
      '"이번 주", "내일" 같은 표현은 호출 전에 날짜로 바꿔서 넘긴다. 한 번에 최대 366일.',
    inputSchema: { from: ymd.describe('시작일'), to: ymd.describe('종료일 (포함)') },
  },
  async ({ from, to }) => {
    try {
      const events = await store.listEvents(from, to);
      const lines = events.map((e) => {
        const when = e.endDate && e.endDate !== e.startDate ? `${day(e.startDate)}~${day(e.endDate)}` : day(e.startDate);
        const time = e.startTime ? ` ${e.startTime}${e.endTime ? `–${e.endTime}` : ''}` : ' 종일';
        return `- ${when}${time} ${e.title}${e.categoryName ? ` [${e.categoryName}]` : ''}${e.location ? ` @${e.location}` : ''} (id: ${e.id})`;
      });
      return {
        content: [{ type: 'text', text: events.length ? `${from}~${to} 일정 ${events.length}건\n${lines.join('\n')}` : `${from}~${to}에 일정이 없습니다.` }],
        structuredContent: { events: events.map(({ photos: _p, ...e }) => e) },
      };
    } catch (e) {
      return { isError: true, content: [{ type: 'text', text: (e as Error).message }] };
    }
  },
);

server.registerTool(
  'create_event',
  {
    title: '일정 추가',
    description:
      'Plock 플래너에 일정 하나를 추가한다. 날짜·시각은 호출 전에 확정해서 넘긴다 (Asia/Seoul, 24시간제). ' +
      '시각이 없으면 종일 일정. 여러 날이면 endDate. 같은 날짜·제목·시작 시각의 일정이 이미 있으면 새로 만들지 않고 기존 것을 돌려준다.',
    inputSchema: {
      title: z.string().min(1).max(200).describe('일정 제목 (날짜·시간 표현 제외)'),
      date: ymd.describe('시작일'),
      endDate: ymd.optional().describe('여러 날 일정의 마지막 날 (포함)'),
      startTime: hm.optional().describe('시작 시각'),
      endTime: hm.optional().describe('끝 시각 (없으면 시작 1시간 뒤)'),
      category: z.string().optional().describe('카테고리 이름 (예: 업무, 약속). 없거나 모르면 첫 카테고리'),
      location: z.string().max(200).optional(),
      memo: z.string().max(2000).optional(),
    },
  },
  async (input) => {
    try {
      const { event, created } = await store.createEvent(input);
      const time = event.startTime ? ` ${event.startTime}–${event.endTime}` : ' 종일';
      const span = event.endDate !== event.startDate ? `~${day(event.endDate)}` : '';
      return {
        content: [{ type: 'text', text: `${created ? '추가했습니다' : '이미 있는 일정입니다 (새로 만들지 않음)'}: ${day(event.startDate)}${span}${time} ${event.title} (id: ${event.id})` }],
        structuredContent: { created, event },
      };
    } catch (e) {
      return { isError: true, content: [{ type: 'text', text: (e as Error).message }] };
    }
  },
);

await server.connect(new StdioServerTransport());
console.error(`plock MCP server ready (uid …${uid.slice(-4)})`);
