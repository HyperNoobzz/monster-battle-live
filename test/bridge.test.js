// Bridge test: TikTok events (current v3 field names) must reach the game as the right
// comment / gift / like messages. Run with: npm test
const test = require('node:test');
const assert = require('node:assert');
const WebSocket = require('ws');
const { createBridge } = require('../bridge/bridge');

test('TikTok events reach the game page', { timeout: 15000 }, async () => {
  const port = 8190 + Math.floor(Math.random() * 50);
  const b = createBridge({ port, log: () => {}, search: async q => [{ id: 'x', title: q, seconds: 100 }] });
  let ws;
  try {
  b.connect('someone');
  for (let i = 0; i < 100 && !b._conn(); i++) await new Promise(r => setTimeout(r, 50));
  const conn = b._conn();
  assert.ok(conn, 'connection object created');

  ws = new WebSocket(`ws://127.0.0.1:${port}`);
  const got = [];
  ws.on('message', m => { const e = JSON.parse(m); if (e.type !== 'status') got.push(e); });
  await new Promise(r => ws.on('open', r));

  const ana = { id: '11', displayId: 'ana_h', nickname: 'Ana' };
  const budi = { id: '22', displayId: 'budi_h', nickname: 'Budi' };
  conn.emit('chat', { user: ana, content: '1' });
  conn.emit('chat', { user: budi, content: 'A' });
  conn.emit('gift', { user: ana, gift: { name: 'Rose', diamondCount: 1, type: 1, image: { urlList: ['https://x/rose.png'] } }, repeatCount: 3, repeatEnd: 0 });
  conn.emit('gift', { user: ana, gift: { name: 'Rose', diamondCount: 1, type: 1, image: { urlList: ['https://x/rose.png'] } }, repeatCount: 5, repeatEnd: 1 });
  conn.emit('like', { user: budi, count: 15, total: '500' });
  ws.send(JSON.stringify({ type: 'ytsearch', id: 7, q: 'some song' }));
  await new Promise(r => setTimeout(r, 400));

  const comments = got.filter(e => e.type === 'comment');
  assert.deepStrictEqual(comments.map(c => [c.user, c.nickname, c.text]), [['ana_h', 'Ana', '1'], ['budi_h', 'Budi', 'A']]);
  const gifts = got.filter(e => e.type === 'gift');
  assert.strictEqual(gifts.length, 1, 'a gift combo is sent once, when it ends');
  assert.deepStrictEqual([gifts[0].user, gifts[0].giftName, gifts[0].coins, gifts[0].repeat, gifts[0].image], ['ana_h', 'Rose', 1, 5, 'https://x/rose.png']);
  const like = got.find(e => e.type === 'like');
  assert.deepStrictEqual([like.user, like.count], ['budi_h', 15]);
  const yt = got.find(e => e.type === 'ytresult');
  assert.strictEqual(yt.id, 7); assert.strictEqual(yt.results[0].title, 'some song');

  } finally {
    if (ws) ws.close();
    b.close();
  }
});
