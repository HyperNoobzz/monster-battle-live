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

// The connector's event data follows TikTok's current schema (v3): the @handle is
// user.displayId, chat text is `content`, gift details sit in `gift`, likes in `count`.
// Older field names are still accepted as fallbacks.
const firstUrl = img => { const l = img && (img.urlList || img.url_list || img.url || img.urls); return Array.isArray(l) ? l[0] || '' : ''; };
function userOf(d) {
  const u = d.user || d;
  return {
    user: String(u.uniqueId || u.displayId || u.id || u.userId || d.uniqueId || 'unknown'),
    nickname: String(u.nickname || u.displayId || u.uniqueId || 'Viewer'),
    avatar: firstUrl(u.avatarThumb) || firstUrl(u.profilePicture)
  };
}

function createBridge({ port = 8080, log = console.log, onStatus = () => {} } = {}) {
  const wss = new WebSocketServer({ port, host: '127.0.0.1' });
  let status = 'idle', username = '', conn = null, retryTimer = null, retryDelay = 5000, stopped = true;
  let attempt = 0;
  let skipLiveCheck = false; // alternate attempts skip TikTok's "is live" check, which can wrongly say offline
  let giftList = null; // [{ name, coins, image }] from TikTok, sent to the game for the gift guide

  function broadcast(msg) {
    const json = JSON.stringify(msg);
    for (const c of wss.clients) if (c.readyState === 1) c.send(json);
  }
  function setStatus(s, detail) {
    status = s;
    broadcast({ type: 'status', status: s, username });
    onStatus({ status: s, username, detail });
  }
  wss.on('connection', ws => {
    ws.send(JSON.stringify({ type: 'status', status, username }));
    if (giftList) ws.send(JSON.stringify({ type: 'giftlist', gifts: giftList }));
  });
  wss.on('error', err => log('[bridge] WebSocket server error: ' + err.message));
  log(`[bridge] WebSocket server on ws://localhost:${port}`);

  function attach(c) {
    const { WebcastEvent, ControlEvent } = lib;
    c.on(ControlEvent.DISCONNECTED, () => { if (c !== conn || stopped) return; log('[tiktok] disconnected, retrying ...'); setStatus('offline'); scheduleRetry(); });
    c.on(WebcastEvent.STREAM_END, () => { log('[tiktok] stream ended'); setStatus('ended'); });
    c.on(WebcastEvent.CHAT, d => broadcast({ type: 'comment', ...userOf(d), text: String(d.content ?? d.comment ?? '') }));
    c.on(WebcastEvent.GIFT, d => {
      const g = d.gift || d.giftDetails || d.extendedGiftInfo || {};
      const giftType = g.type ?? g.giftType ?? d.giftType;
      if (giftType === 1 && !d.repeatEnd) return; // streak gifts: count once, when the streak ends (repeatEnd is 1/true)
      const coins = Number(g.diamondCount || d.diamondCount) || 1;
      const repeat = Number(d.repeatCount || d.comboCount) || 1;
      const name = g.name || g.giftName || d.giftName || 'Gift';
      const image = firstUrl(g.image) || firstUrl(g.icon) || firstUrl(g.giftImage) || d.giftPictureUrl || '';
      broadcast({ type: 'gift', ...userOf(d), giftName: name, coins, repeat, image });
      log(`[gift] ${userOf(d).nickname}: ${name} x${repeat} (${coins} coins each)`);
    });
    c.on(WebcastEvent.LIKE, d => broadcast({ type: 'like', ...userOf(d), count: Number(d.count ?? d.likeCount) || 1, total: Number(d.total ?? d.totalLikeCount) || 0 }));
    c.on(WebcastEvent.SHARE, d => broadcast({ type: 'share', ...userOf(d) }));
    c.on(WebcastEvent.FOLLOW, d => broadcast({ type: 'follow', ...userOf(d) }));
    c.on(WebcastEvent.MEMBER, d => broadcast({ type: 'member', ...userOf(d) }));
    c.on(WebcastEvent.ROOM_USER, d => { const n = d.viewerCount ?? d.total; if (n != null) broadcast({ type: 'viewers', count: Number(n) }); });
  }

  function scheduleRetry() {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(tryConnect, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 60000);
  }
  function makeConn() {
    if (conn) { try { conn.removeAllListeners && conn.removeAllListeners(); conn.disconnect(); } catch (e) {} }
    // enableExtendedGiftInfo stays off: it fetches gifts during connect and a failure there
    // would fail the whole connection. loadGiftList() fetches them afterwards instead.
    conn = new lib.TikTokLiveConnection(username, { enableExtendedGiftInfo: false, fetchRoomInfoOnConnect: !skipLiveCheck });
    attach(conn);
  }
  function tryConnect() {
    if (stopped) return;
    attempt++;
    log(`[tiktok] connecting to @${username}${skipLiveCheck ? ' (skipping live check)' : ''} ...`);
    setStatus('connecting', `attempt ${attempt}${skipLiveCheck ? ', direct to live room' : ''}`);
    // Never wait forever on one attempt: give up after 25s and try again.
    const c = conn;
    let timer;
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => {
      const e = new Error('TikTok did not answer within 25 seconds'); e.timedOut = true; reject(e);
    }, 25000); });
    Promise.race([c.connect(), timeout])
      .finally(() => clearTimeout(timer))
      .then(state => {
        if (c !== conn || stopped) return; retryDelay = 5000; log(`[tiktok] connected, roomId ${state.roomId}`); setStatus('live'); loadGiftList(); })
      .catch(err => {
        if (c !== conn || stopped) return;
        const msg = err && err.message ? err.message : String(err);
        log('[tiktok] connect failed: ' + msg);
        // Not live yet is the usual case before a stream starts: keep checking every 10s
        // instead of backing off, so the game connects soon after the LIVE begins.
        const notLive = /isn't online|not online|offline/i.test(msg) || (err && err.name === 'UserOfflineError');
        if (notLive){ skipLiveCheck = !skipLiveCheck; makeConn(); retryDelay = skipLiveCheck ? 1000 : 10000; }
        else if (err && err.timedOut) makeConn(); // drop the stuck attempt; a late answer from it is ignored
        setStatus(notLive ? 'notlive' : 'offline', msg);
        scheduleRetry();
        if (notLive) retryDelay = 10000;
      });
  }

  // Gift names, coin prices and pictures for this room (shown in the game's gift guide).
  function loadGiftList() {
    if (!conn || typeof conn.fetchAvailableGifts !== 'function') return;
    conn.fetchAvailableGifts().then(res => {
      const raw = Array.isArray(res) ? res : (res && (res.gifts || res.giftList || (res.data && res.data.gifts))) || [];
      const pic = g => { const im = g.image || g.icon || g.giftImage || {}; const l = im.url_list || im.urlList || im.url || []; return Array.isArray(l) ? l[0] || '' : ''; };
      giftList = raw.map(g => ({ name: g.name || g.giftName, coins: g.diamond_count ?? g.diamondCount, image: pic(g) }))
                    .filter(g => g.name && g.coins > 0);
      log(`[tiktok] loaded ${giftList.length} gifts`);
      if (giftList.length) broadcast({ type: 'giftlist', gifts: giftList });
    }).catch(err => log('[tiktok] could not load gift list: ' + (err && err.message ? err.message : err)));
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
    stopped = false; retryDelay = 5000; attempt = 0;
    setStatus('connecting');
    const want = username;
    loadLib().then(() => {
      if (stopped || want !== username) return;
      skipLiveCheck = false;
      makeConn();
      tryConnect();
    }).catch(err => { log('[bridge] could not load tiktok-live-connector: ' + err.message); setStatus('offline', err.message); });
  }
  function close() { disconnect(); wss.close(); }

  return { connect, disconnect, close, broadcast, getStatus: () => ({ status, username }), _conn: () => conn };
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
