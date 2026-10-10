// End-to-end check of the MCP server against the Firestore emulator:
//   firebase emulators:start --only firestore   (then)   npx tsx mcp/e2e.test.ts
// Spawns mcp/server.ts over stdio with the real MCP client and calls both tools.
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import config from '../firebase-applet-config.json' with { type: 'json' };

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
const uid = `test-${Date.now()}`;
const db = getFirestore(initializeApp({ projectId: config.projectId }), config.firestoreDatabaseId);
const base = db.collection('accounts').doc(uid);
const now = new Date().toISOString();
await base.collection('categories').doc('cat_work').set({ id: 'cat_work', name: '업무', color: '#000', order: 0, createdAt: now, updatedAt: now });
await base.collection('categories').doc('cat_meet').set({ id: 'cat_meet', name: '약속', color: '#000', order: 1, createdAt: now, updatedAt: now });
await base.collection('events').doc('ev_trip').set({ id: 'ev_trip', title: '제주 여행', startDate: '2026-10-08', endDate: '2026-10-11', categoryId: 'cat_meet', createdAt: now, updatedAt: now });
await base.collection('events').doc('ev_old').set({ id: 'ev_old', title: '지난 회의', startDate: '2026-09-01', endDate: '2026-09-01', startTime: '10:00', categoryId: 'cat_work', createdAt: now, updatedAt: now });

const client = new Client({ name: 'plock-e2e', version: '1.0.0' });
await client.connect(
  new StdioClientTransport({
    command: process.execPath,
    args: ['node_modules/tsx/dist/cli.mjs', 'mcp/server.ts'],
    env: { ...process.env, PLOCK_UID: uid } as Record<string, string>,
    stderr: 'pipe',
  }),
);
const text = (r: Awaited<ReturnType<typeof client.callTool>>) => (r.content as { text: string }[]).map((c) => c.text).join('\n');

const tools = (await client.listTools()).tools.map((t) => t.name).sort();
assert.deepEqual(tools, ['create_event', 'list_events']);

let r = await client.callTool({ name: 'list_events', arguments: { from: '2026-10-10', to: '2026-10-16' } });
console.log(text(r));
assert.match(text(r), /제주 여행/); // multi-day event overlapping the range
assert.doesNotMatch(text(r), /지난 회의/);

r = await client.callTool({ name: 'create_event', arguments: { title: '동기 모임', date: '2026-10-16', startTime: '19:00', category: '약속' } });
console.log(text(r));
assert.equal((r.structuredContent as { created: boolean }).created, true);
const ev = (r.structuredContent as { event: Record<string, unknown> }).event;
assert.equal(ev.endTime, '20:00');
assert.equal(ev.categoryId, 'cat_meet');

// Retrying the same call must not duplicate.
r = await client.callTool({ name: 'create_event', arguments: { title: '동기 모임', date: '2026-10-16', startTime: '19:00' } });
console.log(text(r));
assert.equal((r.structuredContent as { created: boolean }).created, false);
assert.equal((await base.collection('events').where('title', '==', '동기 모임').get()).size, 1);

// Bad input is an error result, not a crash.
r = await client.callTool({ name: 'create_event', arguments: { title: '회의', date: '2026-10-16', startTime: '15:00', endTime: '14:00' } });
console.log(text(r));
assert.equal(r.isError, true);
r = await client.callTool({ name: 'create_event', arguments: { title: '회의', date: '10/16' } });
assert.equal(r.isError, true);

// The created document has the shape the app writes.
const saved = (await base.collection('events').doc(String(ev.id)).get()).data()!;
assert.deepEqual(Object.keys(saved).sort(), ['categoryId', 'createdAt', 'done', 'endDate', 'endTime', 'id', 'photos', 'startDate', 'startTime', 'title', 'updatedAt']);

r = await client.callTool({ name: 'list_events', arguments: { from: '2026-10-16', to: '2026-10-16' } });
console.log(text(r));
assert.match(text(r), /19:00–20:00 동기 모임 \[약속\]/);

await client.close();
await base.collection('events').get().then((s) => Promise.all(s.docs.map((d) => d.ref.delete())));
await base.collection('categories').get().then((s) => Promise.all(s.docs.map((d) => d.ref.delete())));
console.log('MCP_E2E_OK');
process.exit(0);
