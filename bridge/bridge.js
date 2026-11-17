// Monster Battle — TikTok Live bridge
// CLI:     node bridge.js <tiktok_username> [port]
// Module:  const { createBridge } = require('./bridge'); const b = createBridge({ port }); b.connect('username');
// The game page connects to ws://localhost:<port> (default 8080).

// tiktok-live-connector ships as an ES module, so it is loaded with import() (works in Node and Electron).
let lib = null;
function loadLib() {
  if (lib) return Promise.resolve(lib);
  return import('tiktok-live-connector').then(m => (lib = m.TikTokLiveConnection ? m : m.default));
}
const { WebSocketServer } = require('ws');

function userOf(d) {
  const u = d.user || d;
  const pic = u.profilePicture && (u.profilePicture.url || u.profilePicture.urls);
  return {
    user: u.uniqueId || u.userId || 'unknown',
    nickname: u.nickname || u.uniqueId || 'Viewer',
    avatar: Array.isArray(pic) ? pic[0] : ''
  };
}

function createBridge({ port = 8080, log = console.log, onStatus = () => {} } = {}) {
  const wss = new WebSocketServer({ port, host: '127.0.0.1' });
  let status = 'idle', username = '', conn = null, retryTimer = null, retryDelay = 5000, stopped = true;

  function broadcast(msg) {
    const json = JSON.stringify(msg);
    for (const c of wss.clients) if (c.readyState === 1) c.send(json);
  }
  function setStatus(s, detail) {
    status = s;
    broadcast({ type: 'status', status: s, username });
    onStatus({ status: s, username, detail });
  }
  wss.on('connection', ws => ws.send(JSON.stringify({ type: 'status', status, username })));
  wss.on('error', err => log('[bridge] WebSocket server error: ' + err.message));
  log(`[bridge] WebSocket server on ws://localhost:${port}`);

  function attach(c) {
    const { WebcastEvent, ControlEvent } = lib;
    c.on(ControlEvent.DISCONNECTED, () => { if (c !== conn || stopped) return; log('[tiktok] disconnected, retrying ...'); setStatus('offline'); scheduleRetry(); });
    c.on(WebcastEvent.STREAM_END, () => { log('[tiktok] stream ended'); setStatus('ended'); });
    c.on(WebcastEvent.CHAT, d => broadcast({ type: 'comment', ...userOf(d), text: d.comment || '' }));
    c.on(WebcastEvent.GIFT, d => {
      const det = d.giftDetails || d.extendedGiftInfo || {};
      const giftType = det.giftType != null ? det.giftType : d.giftType;
      if (giftType === 1 && !d.repeatEnd) return; // count streak gifts once, when the streak ends
      const coins = det.diamondCount || d.diamondCount || 1, repeat = d.repeatCount || 1;
      broadcast({ type: 'gift', ...userOf(d), giftName: det.giftName || 'Gift', coins, repeat });
      log(`[gift] ${userOf(d).nickname}: ${det.giftName || 'gift'} x${repeat} (${coins} coins each)`);
    });
    c.on(WebcastEvent.LIKE, d => broadcast({ type: 'like', ...userOf(d), count: d.likeCount || 1, total: d.totalLikeCount || 0 }));
    c.on(WebcastEvent.SHARE, d => broadcast({ type: 'share', ...userOf(d) }));
    c.on(WebcastEvent.FOLLOW, d => broadcast({ type: 'follow', ...userOf(d) }));
    c.on(WebcastEvent.MEMBER, d => broadcast({ type: 'member', ...userOf(d) }));
    c.on(WebcastEvent.ROOM_USER, d => { if (d.viewerCount != null) broadcast({ type: 'viewers', count: d.viewerCount }); });
  }

  function scheduleRetry() {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(tryConnect, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 60000);
  }
  function tryConnect() {
    if (stopped) return;
    log(`[tiktok] connecting to @${username} ...`);
    setStatus('connecting');
    conn.connect()
      .then(state => { retryDelay = 5000; log(`[tiktok] connected, roomId ${state.roomId}`); setStatus('live'); })
      .catch(err => {
        const msg = err && err.message ? err.message : String(err);
        log('[tiktok] connect failed: ' + msg);
        setStatus('offline', msg);
        scheduleRetry();
      });
  }

  function disconnect() {
    stopped = true; clearTimeout(retryTimer);
    if (conn) { try { conn.disconnect(); } catch (e) {} conn = null; }
    setStatus('idle');
  }
  function connect(name) {
    disconnect();
    username = String(name || '').trim().replace(/^.*tiktok\.com\/@?/, '').replace(/^@/, '').replace(/\/.*$/, '');
    if (!username) return;
    stopped = false; retryDelay = 5000;
    setStatus('connecting');
    const want = username;
    loadLib().then(() => {
      if (stopped || want !== username) return;
      conn = new lib.TikTokLiveConnection(username, { enableExtendedGiftInfo: true });
      attach(conn);
      tryConnect();
    }).catch(err => { log('[bridge] could not load tiktok-live-connector: ' + err.message); setStatus('offline', err.message); });
  }
  function close() { disconnect(); wss.close(); }

  return { connect, disconnect, close, broadcast, getStatus: () => ({ status, username }) };
}

module.exports = { createBridge };

if (require.main === module) {
  const name = process.argv[2] || process.env.TIKTOK_USERNAME;
  const port = Number(process.argv[3] || process.env.PORT || 8080);
  if (!name) {
    console.log('Usage: node bridge.js <tiktok_username> [port]');
    console.log('Example: node bridge.js mychannel 8080');
    process.exit(1);
  }
  createBridge({ port }).connect(name);
}
