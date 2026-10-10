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
  const { accounts, counts } = await store.diagnose();
  const mask = (id: string) => (id.length > 8 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id);
  console.log(`이 UID(${mask(uid)})의 데이터: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ') || '없음'}`);
  console.log(`데이터베이스에 있는 계정 ${accounts.length}개: ${accounts.map(mask).join(', ') || '없음'}`);
  if (!cats.length) {
    console.log(
      accounts.includes(uid)
        ? '계정은 있지만 카테고리가 없습니다. 앱에서 한 번 로그인해 열어 보세요.'
        : 'PLOCK_UID와 같은 계정이 없습니다. 위 목록의 앞뒤 4자리와 내 UID를 비교하세요 (앞뒤 공백·따옴표 포함 여부도).',
    );
  }
} catch (e) {
  console.error('읽기 실패:', (e as Error).message);
  process.exit(1);
}
process.exit(0);
