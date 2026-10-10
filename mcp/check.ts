// Quick check that the MCP server's credentials can read your Plock data, without an MCP client:
//   $env:PLOCK_UID="..."; npm run mcp:check
import { PlockStore } from './plockStore';
import { addDays, today } from '../src/lib/date';

const uid = process.env.PLOCK_UID?.trim();
if (!uid) {
  console.error('PLOCK_UID 환경 변수가 필요합니다.');
  process.exit(1);
}
const store = new PlockStore({ uid });
const from = today();
const to = addDays(from, 7);
try {
  const [cats, events] = await Promise.all([store.categories(), store.listEvents(from, to)]);
  console.log(`읽기 성공: 카테고리 ${cats.length}개, ${from}~${to} 일정 ${events.length}건`);
  for (const e of events.slice(0, 5)) console.log(`- ${e.startDate} ${e.startTime ?? '종일'} ${e.title}`);
  if (!cats.length) console.log('카테고리가 0개입니다. PLOCK_UID가 로그인한 계정의 UID가 맞는지 확인하세요.');
} catch (e) {
  console.error('읽기 실패:', (e as Error).message);
  process.exit(1);
}
process.exit(0);
