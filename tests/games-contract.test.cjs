const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = name => fs.readFileSync(path.join(__dirname, '../js', name), 'utf8');
function storage() {
  const map = new Map();
  return { getItem: k => map.get(k) || null, setItem: (k,v) => map.set(k,v), removeItem: k => map.delete(k) };
}

test('API uses existing routes and strict backend request shapes', async () => {
  const calls = [];
  const window = { GAMES_CONFIG: { apiBase: '/v1' }, supabase: { createClient: () => ({ auth: {
    getSession: async () => ({ data: { session: { access_token: 'test', user: { id: 'u' } } } })
  } }) } };
  vm.runInNewContext(source('games-api.js'), { window, location: { search: '' }, URLSearchParams,
    localStorage: storage(), fetch: async (url, options) => {
      calls.push([url, options.method, JSON.parse(options.body || 'null')]);
      return { ok: true, status: 200, text: async () => '{}' };
    } });
  const api = window.GamesAPI;
  await api.createRoom('Friends');
  await api.joinRoom(' abcdef12 ');
  await api.startSession('room');
  await api.submitResponse('round', 'profile', 'not supported');
  await api.sendMessage('room', 'Hello');
  assert.deepEqual(calls, [
    ['/v1/rooms', 'POST', { name: 'Friends' }],
    ['/v1/rooms/join', 'POST', { code: 'ABCDEF12' }],
    ['/v1/rooms/room/sessions', 'POST', { vibe: 'chaos' }],
    ['/v1/rounds/round/responses', 'POST', { value: 'profile' }],
    ['/v1/rooms/room/messages', 'POST', { body: 'Hello' }],
  ]);
  assert.equal(api.threadRoom, undefined);
  assert.equal(api.sendGame, undefined);
  await api.startThreadGame('group', 'Friends');
  await api.joinThreadGame('group', 'session');
  assert.deepEqual(calls.slice(-2), [
    ['/v1/threads/group/games','POST',{name:'Friends',vibe:'chaos'}],
    ['/v1/threads/group/games/session/join','POST',null],
  ]);
  assert.equal(api.releaseProfile, undefined);
  api.setSavedRoom('thread', { id: 'room', join_code: 'ABCDEF12' });
  assert.equal(api.savedRoom('thread').id, 'room');
  assert.equal(api.savedRoom('other'), null);
});

function ui({ saved = null, host = true, count = 2, active = false } = {}) {
  const nodes = new Map();
  const timers = new Map();
  let timerId = 0;
  function element(id) {
    if (!nodes.has(id)) nodes.set(id, { innerHTML: '', value: '', handlers: {},
      addEventListener(event, fn) { this.handlers[event] = fn; },
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      querySelector() { return element('close'); }, setAttribute() {} });
    return nodes.get(id);
  }
  const calls = [];
  let savedRoom = saved;
  const row = { id: 'room', join_code: 'ABCDEF12', host_profile_id: 'host' };
  const snapshot = { room: row, viewer_profile_id: host ? 'host' : 'guest',
    members: Array.from({length: count}, (_,i) => ({profile_id: `p${i}`})), rounds: [], timeline: [],
    active_session: active ? {id: 'session', status: 'active'} : null };
  const api = { playerSlot: '1', userId: async () => 'u', profiles: async () => [],
    savedProfile: () => ({id: 'profile', userId: 'u'}), chooseProfile: async () => {},
    savedRoom: () => savedRoom, setSavedRoom: (_, val) => { savedRoom = val; },
    createRoom: async () => { calls.push('create'); return row; },
    joinRoom: async code => { calls.push(['join',code]); return row; },
    subscribeRoom: () => () => {}, watchThreadGames: () => () => {}, hydrate: async () => snapshot,
    threadGames: async () => ({can_start:host, games:active ? [{session_id:'session',room_id:'room',status:'active',is_member:false,is_participant:false,has_unrevealed_rounds:true}] : []}),
    joinThreadGame: async (key,id) => { calls.push(['joinInvite',key,id]); return {room:row,session:{id}}; },
    startThreadGame: async (key,name) => { calls.push(['startThread',key,name]); return {session:{id:'session',room_id:'room'}}; },
    startSession: async id => { calls.push(['start',id]); return {session: {id: 'session',room_id: id}}; }
  };
  const chat = { name: 'Friends', messages: [] };
  const window = { GamesAPI: api, GAMES_CONFIG: {}, addEventListener() {}, DMChat: {
    getActiveThreadId: () => 'thread', getActiveThread: () => chat,
    appendMessage: m => chat.messages.push(m), refresh() {} } };
  const text = source('games-ui.js').replace(/\}\)\(\);\s*$/, `window.testUI = {
    openChaosSheet, sessionRounds, nextFoot, showChatEvent, sendChaos, discoverInvites, openInvite,
    roundPlayers, watchInvites, stopInvites,
    setRoom: value => { room = {...room, ...value}; }
  }; })();`);
  vm.runInNewContext(text, {window, document: { getElementById: element, addEventListener() {} },
    location: {search:''}, URLSearchParams, localStorage: storage(), setTimeout: (fn,ms) => { timers.set(++timerId,{fn,ms}); return timerId; },
    clearTimeout(id) { timers.delete(id); }, requestAnimationFrame() {} });
  return { ...window.testUI, nodes, element, calls, api, chat, snapshot, timers };
}

test('new chat starts without a code and only the host can start subsequent games', async () => {
  for (const host of [true,false]) {
    const u = ui({host});
    await u.openChaosSheet();
    const html = u.nodes.get('g-sheet-body').innerHTML;
    assert.match(html, /Use a Room Code Instead/);
    assert.equal(/id="g-send-chaos" disabled/.test(html), !host);
    assert.equal(u.calls.length, 0);
  }
});

test('nonmember discovers a deduplicated invite without joining', async () => {
  const u = ui({active:true});
  await u.discoverInvites('thread');
  await u.discoverInvites('thread');
  assert.equal(u.chat.messages.length,1);
  assert.equal(u.chat.messages[0].action,'Join Game');
  assert.equal(u.calls.length,0);
});

test('late participant eligibility uses roster, not answer options', () => {
  const u = ui();
  const r = {player_profile_ids:['host','late'],options:[{profile_id:'host'}]};
  assert.deepEqual([...u.roundPlayers(r)], ['host','late']);
});

test('pending rounds stay hidden and partial reveals do not show final summary', () => {
  const u = ui();
  const session = {id:'session',status:'active'};
  const first = {id:'r1',session_id:'session',ordinal:1,phase:'revealed'};
  u.setRoom({sessions:new Map([['session',session]]), rounds:new Map([
    ['r1',first], ['r2',{id:'r2',session_id:'session',ordinal:2,phase:'pending'}]
  ])});
  assert.equal(u.sessionRounds(session).length, 1);
  assert.match(u.nextFoot(first,[first]), /Discussion Time/);
  session.status = 'complete';
  assert.match(u.nextFoot(first,[first]), /View Final Summary/);
});

test('realtime and hydration duplicates produce only one chat message', () => {
  const u = ui();
  const event = {id:'event',event_type:'message',actor_profile_id:'p1',payload:{body:'Hello'}};
  u.showChatEvent('thread',event);
  u.showChatEvent('thread',event);
  assert.equal(u.chat.messages.length,1);
});

test('start uses thread endpoint and never creates or joins by code', async () => {
  const u = ui();
  await u.openChaosSheet();
  await u.sendChaos('thread', {disabled:false,innerHTML:''});
  assert.ok(u.calls.some(c => c[0] === 'startThread' && c[1] === 'thread'));
  assert.ok(!u.calls.some(c => c === 'create' || c[0] === 'join'));
});


test('invite click enrolls by session without asking for a room code', async () => {
  const u = ui({active:true});
  await u.openInvite('thread','session');
  assert.ok(u.calls.some(c => c[0] === 'joinInvite' && c[2] === 'session'));
  assert.ok(!u.calls.some(c => c[0] === 'join'));
});


test('discovery polls every five seconds and stops cleanly', async () => {
  const u = ui();
  u.watchInvites('thread');
  await new Promise(setImmediate);
  assert.ok([...u.timers.values()].some(t => t.ms === 5000));
  u.stopInvites();
  assert.equal(u.timers.size,0);
});

test('completed invite is disabled for someone who never joined', async () => {
  const u = ui();
  u.api.threadGames = async () => ({can_start:false,games:[{session_id:'done',room_id:'room',status:'complete',is_member:false,is_participant:false,has_unrevealed_rounds:false}]});
  await u.discoverInvites('thread');
  assert.equal(u.chat.messages[0].disabled,true);
  assert.equal(u.chat.messages[0].action,'Game Ended');
  await assert.rejects(u.openInvite('thread','done'), /no longer accepting/);
  assert.ok(!u.calls.some(c => c[0] === 'joinInvite'));
});
