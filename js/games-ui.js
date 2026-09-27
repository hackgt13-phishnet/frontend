/* Instagram Games — Chaos: GamePigeon-style rounds for a group chat, backed by Supabase Realtime rooms */
(function () {
  const api = window.GamesAPI;
  if (!api) return;
  const config = window.GAMES_CONFIG || {};

  const WHY_MAX = 60;
  const LOGO = './images/chaos-logo.svg';
  const HERO = './images/chaos-hero-blue.svg';

  const ICONS = {
    close: '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    more: '<svg viewBox="0 0 24 24" width="24" height="24"><circle cx="5" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="19" cy="12" r="1.8" fill="currentColor"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="m6 12.5 4 4 8-9" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    ig: '<svg viewBox="0 0 24 24" class="g-pill-svg"><defs><linearGradient id="g-ig" x1="0" y1="24" x2="24" y2="0"><stop offset="0" stop-color="#FEC053"/><stop offset=".45" stop-color="#F2203E"/><stop offset="1" stop-color="#5258CF"/></linearGradient></defs><rect x="1" y="1" width="22" height="22" rx="6.5" fill="url(#g-ig)"/><rect x="6" y="6" width="12" height="12" rx="3.8" stroke="#fff" stroke-width="1.9" fill="none"/><circle cx="12" cy="12" r="2.9" stroke="#fff" stroke-width="1.9" fill="none"/><circle cx="16.4" cy="7.6" r="1.1" fill="#fff"/></svg>',
    swap: '<svg viewBox="0 0 24 24" class="g-pill-svg"><rect x="1" y="1" width="22" height="22" rx="6.5" fill="#3797F0"/><path d="M7 9h10l-3-3M17 15H7l3 3" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    crown: '<svg viewBox="0 0 52 36" class="g-crown"><defs><linearGradient id="g-gold" x1="0" y1="0" x2="0" y2="36"><stop offset="0" stop-color="#FFE27A"/><stop offset="1" stop-color="#FFB000"/></linearGradient></defs><path d="M6 12l10 9L26 5l10 16 10-9-4 20H10z" fill="url(#g-gold)" stroke="#E79A00" stroke-width="1.6" stroke-linejoin="round"/><circle cx="6" cy="11" r="3.4" fill="#FFC21F"/><circle cx="26" cy="4.5" r="3.4" fill="#FFC21F"/><circle cx="46" cy="11" r="3.4" fill="#FFC21F"/></svg>',
    sparkle: '<svg viewBox="0 0 24 24"><path d="M12 3.5c.9 4.6 2 5.7 6.6 6.6-4.6.9-5.7 2-6.6 6.6-.9-4.6-2-5.7-6.6-6.6 4.6-.9 5.7-2 6.6-6.6Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M18.5 15.5c.4 1.9.8 2.3 2.7 2.7-1.9.4-2.3.8-2.7 2.7-.4-1.9-.8-2.3-2.7-2.7 1.9-.4 2.3-.8 2.7-2.7Z" fill="currentColor"/></svg>',
    people: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8.5" r="3.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="16.5" cy="9" r="2.6" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M16 14.2c2.4 0 4 1.5 4.5 4.3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  };

  const TYPES = {
    who_sent_this: { pill: 'who', icon: ICONS.ig },
    this_or_that: { label: 'This or That', pill: 'tot', icon: ICONS.swap },
    hot_take: { label: 'Hot Take', pill: 'hot', icon: '<span class="g-pill-emoji">🔥</span>' },
    most_likely_to: { label: 'Most Likely To', pill: 'mlt', icon: '<span class="g-pill-emoji">🎉</span>' },
  };

  const els = {
    sheet: document.getElementById('g-sheet-backdrop'),
    sheetBody: document.getElementById('g-sheet-body'),
    plusBtn: document.getElementById('composer-plus'),
    tray: document.getElementById('g-tray'),
    trayGames: document.getElementById('g-tray-games'),
    play: document.getElementById('g-play'),
    toast: document.getElementById('g-toast'),
    messages: document.getElementById('chat-messages'),
    input: document.getElementById('composer-input'),
    backBtn: document.getElementById('dm-back'),
  };

  const ready = { userId: null, profile: null, profiles: [] };
  let room = emptyRoom();
  let renderKey = '';
  let renderQueued = false;
  let screenKey = '';
  // Async players come back hours later, so picks and "seen this reveal" must outlive the tab.
  const picksKey = `ig_games_picks:${api.playerSlot}`;
  const seenKey = `ig_games_seen:${api.playerSlot}`;
  const myPicks = JSON.parse(localStorage.getItem(picksKey) || '{}');
  const seenResults = new Set(JSON.parse(localStorage.getItem(seenKey) || '[]'));
  // Picked-but-not-sent answers ({choice, why}) survive re-renders from Realtime updates.
  const drafts = {};
  const submitting = new Set();
  let view = { roundId: null, summary: false };
  let playingAgain = false;

  function emptyRoom() {
    return {
      id: null,
      threadId: null,
      // Set when a card for a specific game was tapped; otherwise play mode follows the newest game.
      sessionId: null,
      playing: false,
      hydrated: false,
      hydrateSeq: 0,
      buffer: [],
      unsubscribe: null,
      retryTimer: null,
      viewer: null,
      meta: null,
      members: new Map(),
      sessions: new Map(),
      rounds: new Map(),
      // The game master's own voice: reveal lines (by round) and the closing recap (by session).
      hostLines: new Map(),
      recaps: new Map(),
    };
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  const cap = (s) => {
    const text = String(s ?? '').trim();
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  let toastTimer = null;
  function toast(message) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2800);
  }

  /* ---------- people ---------- */

  function profileName(id) {
    return (
      room.members.get(id)?.display_name ||
      ready.profiles.find((p) => p.id === id)?.display_name ||
      'Someone'
    );
  }

  function viewerId() {
    return room.viewer || ready.profile?.id || null;
  }

  const displayName = (id) => (id === viewerId() ? 'You' : profileName(id));

  function avatarUrl(id) {
    const name = profileName(id);
    return (
      room.members.get(id)?.avatar_url ||
      ready.profiles.find((p) => p.id === id)?.avatar_url ||
      config.avatars?.[name] ||
      ''
    );
  }

  function avatar(id, cls = '') {
    const url = avatarUrl(id);
    return url
      ? `<img class="g-av ${cls}" src="${escapeHtml(url)}" alt="">`
      : `<span class="g-av g-av-fallback ${cls}">${escapeHtml(profileName(id).charAt(0))}</span>`;
  }

  const youFirst = (ids) => {
    const me = viewerId();
    return [...ids].sort((a, b) => (b === me) - (a === me));
  };

  /* ---------- sheet + tray ---------- */

  function openSheet(html, variant = '') {
    closeTray();
    els.sheetBody.className = `g-sheet ${variant}`;
    els.sheetBody.innerHTML = `
      <span class="g-sheet-grip" aria-hidden="true"></span>
      <button type="button" class="g-sheet-x" aria-label="Close">${ICONS.close}</button>
      ${html}`;
    els.sheetBody.querySelector('.g-sheet-x').addEventListener('click', closeSheet);
    els.sheet.classList.remove('hidden');
  }

  function closeSheet() {
    els.sheet.classList.add('hidden');
    els.sheetBody.innerHTML = '';
  }

  function toggleTray(force) {
    if (!els.tray) return;
    const open = force ?? els.tray.classList.contains('hidden');
    els.tray.classList.toggle('hidden', !open);
    els.plusBtn?.classList.toggle('active', open);
    els.plusBtn?.setAttribute('aria-expanded', String(open));
    if (open && els.messages) els.messages.scrollTop = els.messages.scrollHeight;
  }

  const closeTray = () => toggleTray(false);

  /* ---------- identity ---------- */

  let readying = null;

  window.addEventListener('games:profile-lost', () => {
    ready.profile = null;
    ready.userId = null;
  });

  function ensureReady() {
    readying ||= claimIdentity().finally(() => {
      readying = null;
    });
    return readying;
  }

  /** Every anonymous Supabase user is dealt a free demo profile at random; nobody picks. */
  async function claimIdentity() {
    const userId = await api.userId();
    if (ready.userId === userId && ready.profile) return true;
    ready.userId = userId;
    if (!ready.profiles.length) ready.profiles = await api.profiles();

    const allowed = config.demoPlayers;
    const saved = api.savedProfile();

    const wanted = new URLSearchParams(location.search).get('as');
    if (wanted) {
      const profile = ready.profiles.find((p) => p.display_name.toLowerCase() === wanted.toLowerCase());
      if (!profile) throw new Error(`No player named “${wanted}”. Try one of: ${(allowed || []).join(', ')}.`);
      if (!(saved && saved.userId === userId && saved.id === profile.id)) await api.releaseProfile();
      try {
        await api.chooseProfile(profile.id);
      } catch (err) {
        if (err.status !== 409) throw err;
        throw new Error(`${profile.display_name} is open in another tab. Close it, or wait 15 minutes for it to free up.`);
      }
      ready.profile = { ...profile, userId };
      api.setSavedProfile(ready.profile);
      return true;
    }

    if (saved && saved.userId === userId && (!allowed?.length || allowed.includes(saved.display_name))) {
      try {
        await api.chooseProfile(saved.id);
        ready.profile = saved;
        return true;
      } catch (err) {
        if (err.status !== 409) throw err;
        api.setSavedProfile(null);
      }
    }

    await api.releaseProfile();
    const pool = allowed?.length
      ? ready.profiles.filter((p) => allowed.includes(p.display_name))
      : ready.profiles;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    for (const profile of shuffled) {
      try {
        await api.chooseProfile(profile.id);
      } catch (err) {
        if (err.status === 409) continue;
        throw err;
      }
      ready.profile = { ...profile, userId };
      api.setSavedProfile(ready.profile);
      toast(`You're playing as ${profile.display_name}`);
      return true;
    }
    throw new Error('All players are in use right now. A spot frees up after 15 minutes idle.');
  }

  /* ---------- the open chat's room (one room per group chat, joined on open) ---------- */

  const thread = { id: null, roomId: null, unwatch: null, seq: 0 };
  let roundCount = 0;

  function threadName() {
    return (window.DMChat?.getActiveThread()?.name || 'Group chat').slice(0, 80);
  }

  // Who is in each chat: the names under its title (e.g. "Dev, Kofi, Ana").
  function chatMembers(threadId) {
    const t = window.DMChat?.getActiveThreadId() === threadId ? window.DMChat.getActiveThread() : null;
    return (t?.status || '').split(',').map((n) => n.trim()).filter(Boolean);
  }

  async function joinThread(threadId) {
    // Only the chat's own members join its game room, so nobody from outside gets dealt in
    // (and the chat's history stays eligible: rounds only quote a chat when all its members play).
    const members = chatMembers(threadId);
    const me = ready.profile?.display_name;
    if (members.length && me && !members.includes(me)) {
      throw new Error(`You're ${me}, who isn't in this chat. Open it as ${members.join(', ').replace(/, ([^,]*)$/, ' or $1')}.`);
    }
    if (thread.id === threadId && thread.roomId) return thread.roomId;
    const seq = ++thread.seq;
    const roomRow = await api.threadRoom(threadId, threadName());
    if (seq !== thread.seq) return roomRow.id;
    thread.unwatch?.();
    thread.id = threadId;
    thread.roomId = roomRow.id;
    thread.unwatch = api.watchThreadGames(
      roomRow.id,
      () => syncInvites(threadId),
      (event) => thread.id === threadId && chatEvent(event)
    );
    return roomRow.id;
  }

  function leaveThread() {
    thread.seq++;
    thread.unwatch?.();
    thread.id = null;
    thread.roomId = null;
    thread.unwatch = null;
  }

  /* ---------- the chat itself: real messages, the game master's lines, round results ---------- */

  function chatEvent(e) {
    const dm = window.DMChat;
    if (!dm || !e?.id) return;
    const p = e.payload || {};
    const me = ready.profile?.id;
    // A person's message always has its sender; the game master's lines are written by the server
    // with no sender. Keeping both rules strict means a player can never show up as the game master.
    const person = e.actor_profile_id;
    if (e.event_type === 'message' && p.body && person) {
      const mine = Boolean(me) && person === me;
      dm.appendMessage({
        eventId: e.id,
        type: mine ? 'out' : 'in',
        text: p.body,
        name: mine ? null : profileName(e.actor_profile_id),
        avatar: !mine,
        avatarUrl: mine ? null : avatarUrl(e.actor_profile_id),
      });
    } else if ((e.event_type === 'host_line' || e.event_type === 'game_recap') && p.text && !person) {
      dm.appendMessage({ eventId: e.id, type: 'gm', text: p.text });
    } else if (e.event_type === 'game_reveal' && p.reveal) {
      dm.appendMessage({ eventId: e.id, type: 'gm-result', roomId: e.room_id, roundId: p.id, sessionId: p.session_id, ...resultCard(p) });
    } else if (e.event_type === 'game_prompt' && p.ordinal > 1) {
      dm.appendMessage({ eventId: e.id, type: 'sys', text: `Round ${p.ordinal} is open` });
      syncInvites(thread.id).catch(() => {});
    }
  }

  function resultCard(r) {
    const reveal = r.reveal || {};
    const label = `Round ${r.ordinal} results`;
    if (r.game_type === 'who_sent_this' && reveal.correct_profile_id) {
      const results = reveal.results || [];
      const right = results.filter((x) => x.correct).length;
      const who = reveal.correct_profile_id === ready.profile?.id ? 'you' : profileName(reveal.correct_profile_id);
      return { label, title: `It was ${who}`, sub: `${right}/${results.length} guessed right · tap to see` };
    }
    if (reveal.winner_profile_id) {
      const best = (reveal.results || []).find((x) => x.profile_id === reveal.winner_profile_id);
      const who = reveal.winner_profile_id === ready.profile?.id ? 'You' : profileName(reveal.winner_profile_id);
      return { label, title: `${who} had the best take`, sub: best?.why ? `“${best.why}”` : 'tap to see everyone’s' };
    }
    return { label, title: cap(r.prompt || 'See the results'), sub: 'tap to see' };
  }

  async function loadChat(threadId) {
    if (!thread.roomId || thread.id !== threadId) return;
    const { events } = await api.timeline(thread.roomId);
    if (thread.id !== threadId) return;
    for (const e of events) chatEvent({ ...e, room_id: thread.roomId });
  }

  function sendChat(text) {
    const threadId = thread.id;
    if (!threadId || !thread.roomId || window.DMChat?.getActiveThreadId() !== threadId) return false;
    api
      .sendMessage(thread.roomId, text)
      .then((e) => thread.id === threadId && chatEvent({ ...e, room_id: thread.roomId }))
      .catch((err) => toast(err.message || 'Message not sent'));
    return true;
  }

  function roundPlayers(r) {
    if (r.player_profile_ids?.length) return r.player_profile_ids;
    return (r.options || []).map((o) => o.profile_id).filter(Boolean);
  }

  async function syncInvites(threadId) {
    if (!thread.roomId || thread.id !== threadId) return;
    const snap = await api.hydrate(thread.roomId);
    const session = snap.active_session || snap.last_session;
    if (!session || thread.id !== threadId) return;
    const host = snap.members.find((m) => m.profile_id === snap.room.host_profile_id);
    const open = snap.rounds.filter((r) => r.session_id === session.id && r.phase === 'answering');
    const waitingOn = new Set();
    for (const r of open) {
      for (const id of roundPlayers(r)) {
        if (!(r.submitted_profile_ids || []).includes(id)) waitingOn.add(id);
      }
    }
    ensureInviteBubble(threadId, {
      roomId: snap.room.id,
      sessionId: session.id,
      mine: snap.room.host_profile_id === snap.viewer_profile_id,
      senderName: host?.display_name,
      done: session.status === 'complete',
      myTurn: waitingOn.has(snap.viewer_profile_id),
      waitingCount: waitingOn.size,
    });
  }

  function inviteText(invite) {
    const sender = invite.senderName || 'A friend';
    if (invite.done) return ['Game over · see the results', 'View'];
    if (invite.myTurn == null) return [invite.mine ? '3 rounds, made for your group' : `${sender} sent a game`, 'Play'];
    if (invite.myTurn) return [invite.mine ? 'Ready to play' : `${sender} sent a game · tap to play`, 'Play'];
    // Everyone's answered the open round: the game master opens the next one once the chat goes quiet.
    if (!invite.waitingCount) return ['Next round opens when the chat goes quiet', 'View'];
    return [`Waiting on ${invite.waitingCount} ${invite.waitingCount === 1 ? 'player' : 'players'}`, 'Open'];
  }

  function ensureInviteBubble(threadId, invite) {
    const dm = window.DMChat;
    const chat = dm?.getActiveThread();
    if (!chat || dm.getActiveThreadId() !== threadId) return;
    const [subtitle, action] = inviteText(invite);
    const existing = chat.messages.find((m) => m.type === 'game-invite' && m.sessionId === invite.sessionId);
    if (existing) {
      if (existing.subtitle !== subtitle || existing.action !== action) {
        existing.subtitle = subtitle;
        existing.action = action;
        dm.refresh();
      }
      return;
    }
    dm.appendMessage({
      type: 'game-invite',
      from: invite.mine ? 'out' : 'in',
      title: 'Chaos',
      subtitle,
      action,
      roomId: invite.roomId,
      sessionId: invite.sessionId,
      isHost: invite.mine,
    });
  }

  /* ---------- Chaos sheet (send) + lobby sheet (start) ---------- */

  async function openChaosSheet() {
    const threadId = window.DMChat?.getActiveThreadId();
    if (!threadId) {
      toast('Open a chat first, then send a game.');
      return;
    }
    try {
      if (!(await ensureReady())) return;
      await joinThread(threadId);
    } catch (err) {
      toast(err.message);
      return;
    }
    const feature = (icon, title, text) => `
      <li>
        <span class="g-feature-icon">${icon}</span>
        <div><strong>${title}</strong><p>${text}</p></div>
      </li>`;
    openSheet(`
      <img class="g-hero" src="${HERO}" alt="">
      <h3 class="g-sheet-title">Chaos</h3>
      <p class="g-sheet-lead">A custom game for <strong>your group</strong>, powered by <strong>Meta Muse</strong>.</p>
      <ul class="g-features">
        ${feature(ICONS.sparkle, 'Personalized', 'Rounds based on your chat history, posts, stories, and interests.')}
        ${feature(ICONS.people, 'Made for Your Group', 'Each game is unique to your friends.')}
        ${feature(ICONS.clock, 'Play on Your Own Time', 'Answer whenever you open the chat. After each round, talk it over; the next one opens once the chat goes quiet.')}
      </ul>
      <button type="button" class="g-cta" id="g-send-chaos">Send Chaos 🎮</button>`);
    document.getElementById('g-send-chaos').addEventListener('click', (e) => sendChaos(threadId, e.currentTarget));
  }

  const busy = (label) => `<span class="g-spin" aria-hidden="true"></span>${label}`;

  async function sendChaos(threadId, btn) {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.innerHTML = busy('Writing your rounds…');
    try {
      const res = await api.sendGame(threadId, threadName());
      ensureInviteBubble(threadId, { roomId: res.room.id, sessionId: res.session.id, mine: true });
      await openLobby(threadId, res.room.id);
    } catch (err) {
      if (err.status === 409 && /already running/.test(err.message)) {
        await openLobby(threadId, await joinThread(threadId));
        return;
      }
      closeSheet();
      toast(err.message);
    }
  }

  async function openLobby(threadId, roomId, sessionId = null) {
    let snap;
    try {
      snap = await api.hydrate(roomId, sessionId);
    } catch (err) {
      closeSheet();
      toast(err.message);
      return;
    }
    const session = snap.active_session || snap.last_session;
    if (!session) {
      closeSheet();
      toast('No game in this chat yet. Send one from the Games tray.');
      return;
    }
    room.viewer ||= snap.viewer_profile_id;
    for (const m of snap.members) if (!room.members.has(m.profile_id)) room.members.set(m.profile_id, m);
    const me = snap.viewer_profile_id;
    const rounds = snap.rounds.filter((r) => r.session_id === session.id);
    const ids = [...new Set(rounds.flatMap(roundPlayers))];
    const players = ids.length ? ids : snap.members.filter((m) => !m.left_at).map((m) => m.profile_id);
    const others = players.filter((id) => id !== me);
    const answered = rounds.some((r) => (r.submitted_profile_ids || []).includes(me));
    const label = session.status === 'complete' ? 'View Results' : answered ? 'Continue Game' : 'Start Game';
    const names = others.map(profileName);

    openSheet(
      `
      <img class="g-hero sm" src="${HERO}" alt="">
      <h3 class="g-sheet-title">Chaos</h3>
      <p class="g-sheet-lead">${snap.round_count || 3} rounds, made for your group</p>
      <div class="g-lobby-avs">${youFirst(players).reverse().map((id) => avatar(id)).join('')}</div>
      <p class="g-lobby-names">${escapeHtml(names.join(', '))}${players.includes(me) ? `${names.length ? ' + ' : ''}you` : ''}</p>
      <button type="button" class="g-cta violet" id="g-start">${label}</button>`,
      'lobby'
    );
    document.getElementById('g-start').addEventListener('click', () => {
      closeSheet();
      enterPlayMode(roomId, threadId, sessionId);
    });
  }

  /* ---------- realtime store ---------- */

  const newer = (incoming, stored) =>
    !stored || incoming.revision == null || stored.revision == null || incoming.revision > stored.revision;

  function applyRow(table, row) {
    if (!row) return;
    if (table === 'rooms') {
      if (newer(row, room.meta)) room.meta = { ...room.meta, ...row };
    } else if (table === 'room_members') {
      const stored = room.members.get(row.profile_id);
      if (newer(row, stored)) room.members.set(row.profile_id, { ...stored, ...row });
    } else if (table === 'game_sessions') {
      if (newer(row, room.sessions.get(row.id))) room.sessions.set(row.id, { ...room.sessions.get(row.id), ...row });
    } else if (table === 'rounds') {
      if (newer(row, room.rounds.get(row.id))) room.rounds.set(row.id, { ...room.rounds.get(row.id), ...row });
    } else if (table === 'timeline_events') {
      const p = row.payload || {};
      if (row.actor_profile_id) return;
      if (row.event_type === 'host_line' && p.round_id && p.text) room.hostLines.set(p.round_id, p);
      else if (row.event_type === 'game_recap' && p.session_id && p.text) room.recaps.set(p.session_id, p);
    }
  }

  function onRealtimeRow(table, row) {
    if (!room.hydrated) {
      room.buffer.push([table, row]);
      return;
    }
    applyRow(table, row);
    scheduleRender();
  }

  function onChannelStatus(status) {
    if (status === 'SUBSCRIBED') hydrate();
    else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reconnectSoon();
  }

  function reconnectSoon() {
    if (!room.playing || room.retryTimer) return;
    room.retryTimer = setTimeout(() => {
      room.retryTimer = null;
      if (room.playing) connect(room.id);
    }, 1500);
  }

  function connect(roomId) {
    room.unsubscribe?.();
    room.hydrated = false;
    room.buffer = [];
    room.unsubscribe = api.subscribeRoom(roomId, onRealtimeRow, onChannelStatus);
  }

  async function hydrate() {
    const seq = ++room.hydrateSeq;
    const roomId = room.id;
    let snap;
    try {
      snap = await api.hydrate(roomId, room.sessionId);
    } catch (err) {
      if (seq !== room.hydrateSeq || roomId !== room.id) return;
      // 4xx won't fix itself on retry; only network/5xx/timeouts should reconnect.
      if (err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429) {
        exitPlayMode();
        toast(err.status === 403 ? err.message : err.status === 404 ? 'Game not found.' : 'Could not open the game.');
        return;
      }
      reconnectSoon();
      return;
    }
    if (seq !== room.hydrateSeq || roomId !== room.id) return;

    room.viewer = snap.viewer_profile_id;
    room.meta = snap.room;
    room.members = new Map(snap.members.map((m) => [m.profile_id, m]));
    room.sessions = new Map();
    for (const s of [snap.active_session, snap.last_session]) if (s) room.sessions.set(s.id, s);
    room.rounds = new Map(snap.rounds.map((r) => [r.id, r]));
    roundCount = snap.round_count || 0;
    room.hostLines = new Map();
    room.recaps = new Map();
    for (const e of snap.timeline || []) applyRow('timeline_events', e);

    room.hydrated = true;
    const buffered = room.buffer;
    room.buffer = [];
    for (const [table, row] of buffered) applyRow(table, row);
    scheduleRender(true);
  }

  /* ---------- derived state ---------- */

  function currentSession() {
    if (room.sessionId) return room.sessions.get(room.sessionId) || null;
    let best = null;
    for (const s of room.sessions.values()) {
      if (!best) best = s;
      else if ((s.status === 'active') !== (best.status === 'active')) best = s.status === 'active' ? s : best;
      else if (s.created_at > best.created_at) best = s;
    }
    return best;
  }

  function sessionRounds(session) {
    if (!session) return [];
    return [...room.rounds.values()]
      .filter((r) => r.session_id === session.id && r.phase !== 'pending')
      .sort((a, b) => a.ordinal - b.ordinal);
  }

  const isRevealed = (r) => r.phase === 'revealed' || r.phase === 'complete';
  const answeredBy = (r, id) => (r.submitted_profile_ids || []).includes(id);
  const optionId = (opt) => opt.id || opt.profile_id;
  // Opinion rounds have no right answer: players add a one-line why and the AI judges the best one.
  const needsWhy = (r) => r.game_type !== 'who_sent_this';
  // Open rounds (e.g. an open Hot Take) have no options: the typed take is the whole answer.
  const OPEN = 'open';
  const isOpen = (r) => needsWhy(r) && !(r.options || []).length;
  const answerFor = (r) => (isOpen(r) ? OPEN : drafts[r.id]?.choice);

  function scores(rounds) {
    const totals = new Map();
    for (const r of rounds) for (const id of roundPlayers(r)) totals.set(id, totals.get(id) || 0);
    for (const r of rounds) {
      for (const res of r.reveal?.results || []) {
        totals.set(res.profile_id, (totals.get(res.profile_id) || 0) + (res.points || 0));
      }
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1]);
  }

  function defaultRound(rounds) {
    const me = viewerId();
    return (
      rounds.find((r) => isRevealed(r) && !seenResults.has(r.id)) ||
      rounds.find(
        (r) =>
          r.phase === 'answering' &&
          (roundPlayers(r).includes(me) ? !answeredBy(r, me) : !seenResults.has(`sat:${r.id}`))
      ) ||
      rounds.find((r) => r.phase === 'answering') ||
      null
    );
  }

  function resolveView(session, rounds) {
    if (view.summary && session?.status === 'complete') return { summary: true };
    view.summary = false;
    const pinned = view.roundId && rounds.find((r) => r.id === view.roundId);
    if (pinned) return { round: pinned };
    const next = defaultRound(rounds);
    if (next) {
      view.roundId = next.id;
      return { round: next };
    }
    if (session?.status === 'complete') {
      view.summary = true;
      return { summary: true };
    }
    return rounds.length ? { round: rounds[rounds.length - 1] } : { empty: true };
  }

  function markSeen(roundId) {
    seenResults.add(roundId);
    localStorage.setItem(seenKey, JSON.stringify([...seenResults].slice(-200)));
  }

  function goNext(round, rounds, session) {
    markSeen(round.id);
    const next = rounds.find((r) => r.ordinal > round.ordinal);
    if (next) view = { roundId: next.id, summary: false };
    else if (session?.status === 'complete') view = { roundId: null, summary: true };
    else view = { roundId: null, summary: false };
    scheduleRender(true);
  }

  /* ---------- rendering ---------- */

  function scheduleRender(force) {
    if (force) renderKey = '';
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      render();
    });
  }

  function render() {
    if (!room.playing || !els.play) return;
    if (!room.hydrated) return;
    const session = currentSession();
    const rounds = sessionRounds(session);
    const key = JSON.stringify([
      [...room.members.values()].map((m) => [m.profile_id, m.revision, m.left_at]),
      session && [session.id, session.status, session.revision],
      rounds.map((r) => [r.id, r.revision, r.phase, r.submitted_profile_ids?.length]),
      view,
      [...submitting],
      playingAgain,
      room.hostLines.size,
      room.recaps.size,
    ]);
    if (key === renderKey) return;
    renderKey = key;
    paintScreen(session, rounds);
  }

  const totalRounds = (rounds) => Math.max(roundCount, rounds.length);

  function pill(r) {
    const type = TYPES[r.game_type] || TYPES.hot_take;
    const label =
      r.game_type === 'who_sent_this'
        ? r.media?.type === 'message'
          ? 'Who Sent This?'
          : 'Who Posted This?'
        : type.label;
    return `<span class="g-pill ${type.pill}">${type.icon}${escapeHtml(label)}</span>`;
  }

  const promptHtml = (r) =>
    `<h3 class="g-prompt ${String(r.prompt || '').length > 60 ? 'long' : ''}">${escapeHtml(cap(r.prompt))}</h3>`;

  const isAgreeDisagree = (r) =>
    (r.options || []).map((o) => String(o.label).trim().toLowerCase()).join('|') === 'agree|disagree';

  function hint(r) {
    switch (r.game_type) {
      case 'this_or_that':
        return 'Pick a side and give a one-line reason.';
      case 'hot_take':
        if (isOpen(r)) return 'Type your take. One line is enough.';
        return isAgreeDisagree(r) ? 'Agree or disagree, then give a one-line reason.' : 'Pick one, then give a one-line reason.';
      case 'most_likely_to':
        return 'Vote for one friend and say why.';
      default:
        return r.media?.type === 'message' ? 'Guess which friend sent it.' : 'Guess which friend posted it.';
    }
  }

  function cubes(extra) {
    const n = extra ? 9 : 5;
    return Array.from({ length: n }, (_, i) => `<i class="g-cube c${i + 1}"></i>`).join('');
  }

  function steps(rounds, current) {
    return `<div class="g-steps">${rounds
      .map(
        (r) =>
          `<button type="button" class="g-step ${current && r.id === current.id ? 'on' : ''}" data-round="${escapeHtml(r.id)}" aria-label="Round ${r.ordinal}"></button>`
      )
      .join('')}</div>`;
  }

  function paint({ subtitle, stepsHtml = '', body, foot = '', confetti = false, key, mood = null }) {
    const scroller = els.play.querySelector('.g-scroll');
    const keepScroll = key === screenKey && scroller ? scroller.scrollTop : 0;
    const active = document.activeElement;
    const typing = active?.classList?.contains('g-why-input')
      ? { round: active.dataset.round, start: active.selectionStart, end: active.selectionEnd }
      : null;

    els.play.innerHTML = `
      <div class="g-bg ${confetti ? 'confetti' : ''}" aria-hidden="true">${cubes(confetti)}</div>
      <header class="g-top">
        <button type="button" class="g-icon-btn" data-act="close" aria-label="Close game">${ICONS.close}</button>
        <button type="button" class="g-icon-btn" data-act="more" aria-label="More">${ICONS.more}</button>
      </header>
      <div class="g-scroll">
        <div class="g-head">
          <img class="g-logo" src="${LOGO}" alt="">
          <h2>Chaos</h2>
          <p>${escapeHtml(subtitle)}</p>
          ${stepsHtml}
        </div>
        ${body}
      </div>
      <div class="g-foot ${foot ? '' : 'empty'}">${foot}</div>`;

    const nextScroller = els.play.querySelector('.g-scroll');
    if (nextScroller) nextScroller.scrollTop = keepScroll;
    const changed = key !== screenKey;
    screenKey = key;
    window.GameMotion?.painted(els.play, { key, changed, mood });
    fillSources();
    if (typing) {
      const input = els.play.querySelector(`.g-why-input[data-round="${typing.round}"]`);
      if (input) {
        input.focus({ preventScroll: true });
        input.setSelectionRange(typing.start, typing.end);
      }
    }
  }

  function paintLoading(text = 'Loading your game…') {
    els.play.innerHTML = `
      <div class="g-bg" aria-hidden="true">${cubes()}</div>
      <header class="g-top">
        <button type="button" class="g-icon-btn" data-act="close" aria-label="Close game">${ICONS.close}</button>
        <span></span>
      </header>
      <div class="g-scroll g-center">
        <img class="g-logo lg" src="${LOGO}" alt="">
        <h2 class="g-loading-title">Chaos</h2>
        <div class="g-waiting"><span class="g-dots"><i></i><i></i><i></i></span>${escapeHtml(text)}</div>
      </div>`;
    screenKey = 'loading';
  }

  function paintScreen(session, rounds) {
    const target = resolveView(session, rounds);
    if (target.summary) return paintSummary(session, rounds);
    if (target.empty) {
      return paint({
        subtitle: 'No game yet',
        body: `<div class="g-waiting">Send a game from the Games tray to start.</div>`,
        key: 'empty',
      });
    }
    const r = target.round;
    const me = viewerId();
    if (isRevealed(r)) return paintResults(r, rounds, session);
    if (answeredBy(r, me) || !roundPlayers(r).includes(me)) return paintWaiting(r, rounds);
    return paintQuestion(r, rounds);
  }

  /* ----- question ----- */

  function peopleChoices(r, selected) {
    const opts = (r.options || []).filter((o) => o.profile_id);
    const ordered = youFirst(opts.map((o) => o.profile_id)).map((id) => opts.find((o) => o.profile_id === id));
    return `<div class="g-people">${ordered
      .map((o) => {
        const id = optionId(o);
        return `
          <button type="button" class="g-person ${selected === id ? 'on' : ''}" data-pick="${escapeHtml(id)}">
            <span class="g-av-wrap">${avatar(o.profile_id)}<span class="g-tick">${ICONS.check}</span></span>
            <span class="g-person-name">${escapeHtml(displayName(o.profile_id))}</span>
          </button>`;
      })
      .join('')}</div>`;
  }

  function postCard(r, compact = false) {
    const media = r.media || {};
    const quote = media.quote || media.caption || '';
    return `
      <div class="g-post-card ${compact ? 'compact' : ''}">
        ${compact ? '' : pill(r)}
        <div class="g-post-media ${media.url ? '' : 'noimg'}">
          ${media.url ? `<img src="${escapeHtml(media.url)}" alt="">` : '<span class="g-sun"></span><span class="g-hills"></span>'}
          ${quote ? `<div class="g-post-quote">“${escapeHtml(quote)}”<span class="g-heart">❤️</span></div>` : ''}
        </div>
      </div>`;
  }

  function whyBox(r, draft) {
    const why = draft.why || '';
    const placeholder = isOpen(r)
      ? 'Type your take…'
      : {
          this_or_that: 'Why did you choose this?',
          hot_take: 'Why? One line is enough',
          most_likely_to: 'Why them?',
        }[r.game_type];
    return `
      <label class="g-why">
        <input class="g-why-input" data-round="${escapeHtml(r.id)}" maxlength="${WHY_MAX}" placeholder="${placeholder || 'Why?'}" value="${escapeHtml(why)}" ${submitting.has(r.id) ? 'disabled' : ''}>
        <span class="g-count">${why.length}/${WHY_MAX}</span>
      </label>`;
  }

  function canSubmit(r) {
    const draft = drafts[r.id] || {};
    if (!answerFor(r) || submitting.has(r.id)) return false;
    return !needsWhy(r) || !!(draft.why || '').trim();
  }

  function submitLabel(r) {
    if (submitting.has(r.id)) {
      const players = roundPlayers(r);
      const last = (r.submitted_profile_ids || []).length === players.length - 1;
      return busy(last && needsWhy(r) ? 'Judging answers…' : 'Sending…');
    }
    return r.game_type === 'most_likely_to' ? 'Submit Vote' : 'Submit Answer';
  }

  /* ----- where a round came from: the exact messages and posts behind it ----- */

  const sourceCache = new Map();
  const KIND = { message: 'message', reel: 'reel', photo: 'photo', post: 'post', story: 'story', saved: 'save', like: 'like', liked: 'like' };
  const kindWord = (k) => KIND[k] || k || 'item';
  const shortDate = (iso) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';

  // A placeholder the painter fills once the sources load (and instantly from cache on repaints).
  const srcBox = (r, open = false) =>
    `<div class="g-src ${open ? 'open' : ''}" data-src="${escapeHtml(r.id)}" data-open="${open ? 1 : 0}"></div>`;

  function srcHtml(data, open) {
    const items = data.items || [];
    if (!items.length) return '';
    const counts = {};
    for (const it of items) counts[kindWord(it.kind)] = (counts[kindWord(it.kind)] || 0) + 1;
    const summary = Object.entries(counts)
      .map(([k, n]) => `${n} ${n > 1 ? (k === 'story' ? 'stories' : `${k}s`) : k}`)
      .join(' + ');
    const rows = items
      .map((it) => {
        const where = it.author ? `${escapeHtml(it.author)}'s ${kindWord(it.kind)}` : escapeHtml(it.where || kindWord(it.kind));
        const text = it.private
          ? `<em>A private ${kindWord(it.kind)}: only its topic was used, never quoted</em>`
          : it.text
            ? `“${escapeHtml(it.text)}”`
            : '<em>photo</em>';
        return `
          <li>
            ${it.media_url && !it.private ? `<img src="${escapeHtml(it.media_url)}" alt="">` : ''}
            <div><span>${where}${it.when ? ` · ${shortDate(it.when)}` : ''}</span><p>${text}</p></div>
          </li>`;
      })
      .join('');
    const m = data.moment;
    const moment = m
      ? `<p class="g-src-moment">Part of the moment “${escapeHtml(m.moment)}” · ${m.messages} messages${
          m.people?.length ? ` · ${escapeHtml(m.people.join(', '))} were in it` : ''
        }</p>`
      : '';
    return `
      <button type="button" class="g-src-chip" data-src-toggle>
        <span class="g-src-mark">✦</span>Made from ${summary}
        <span class="g-src-caret">${open ? '▴' : '▾'}</span>
      </button>
      <div class="g-src-body"><ul>${rows}</ul>${moment}</div>`;
  }

  function fillSources() {
    els.play.querySelectorAll('[data-src]').forEach((el) => {
      const r = room.rounds.get(el.dataset.src);
      if (!r) return;
      const key = `${r.id}:${isRevealed(r)}`;
      const open = el.classList.contains('open');
      const cached = sourceCache.get(key);
      if (cached) {
        el.innerHTML = srcHtml(cached, open);
        return;
      }
      if (cached === null) return;
      sourceCache.set(key, null);
      api
        .sources(r.id)
        .then((data) => {
          sourceCache.set(key, data);
          const live = els.play.querySelector(`[data-src="${CSS.escape(r.id)}"]`);
          if (live) live.innerHTML = srcHtml(data, live.classList.contains('open'));
        })
        .catch(() => sourceCache.delete(key));
    });
  }

  els.play?.addEventListener('click', (e) => {
    const t = e.target.closest('[data-src-toggle]');
    if (!t) return;
    const box = t.closest('.g-src');
    box.classList.toggle('open');
    const caret = box.querySelector('.g-src-caret');
    if (caret) caret.textContent = box.classList.contains('open') ? '▴' : '▾';
  });

  function paintQuestion(r, rounds) {
    const draft = drafts[r.id] || {};
    const choice = draft.choice;
    let body;
    if (r.game_type === 'who_sent_this') {
      body = `
        ${postCard(r)}
        ${srcBox(r)}
        <h4 class="g-ask">${escapeHtml(cap(r.prompt || 'Who posted this?'))}</h4>
        ${peopleChoices(r, choice)}`;
    } else {
      const intro = `
        <div class="g-q">
          ${pill(r)}
          ${promptHtml(r)}
          <p class="g-hint">${hint(r)}</p>
          ${srcBox(r)}
        </div>`;
      let options;
      if (isOpen(r)) {
        options = '';
      } else if (r.game_type === 'most_likely_to' && (r.options || []).some((o) => o.profile_id)) {
        options = peopleChoices(r, choice);
      } else if (r.game_type === 'this_or_that') {
        options = `<div class="g-scenes">${(r.options || [])
          .map(
            (o, i) => `
              <button type="button" class="g-scene s${i % 4} ${choice === optionId(o) ? 'on' : ''}" data-pick="${escapeHtml(optionId(o))}">
                <span class="g-scene-label">${escapeHtml(cap(o.label))}</span>
                <span class="g-radio">${ICONS.check}</span>
              </button>`
          )
          .join('')}</div>`;
      } else {
        options = `<div class="g-rows">${(r.options || [])
          .map(
            (o) => `
              <button type="button" class="g-row-opt ${choice === optionId(o) ? 'on' : ''}" data-pick="${escapeHtml(optionId(o))}">
                <span class="g-check">${ICONS.check}</span>${escapeHtml(cap(o.label))}
              </button>`
          )
          .join('')}</div>`;
      }
      body = `${intro}${options}${whyBox(r, draft)}`;
    }
    paint({
      subtitle: `Round ${r.ordinal} of ${totalRounds(rounds)}`,
      stepsHtml: r.game_type === 'who_sent_this' ? '' : steps(rounds, r),
      body,
      foot: `<button type="button" class="g-cta" data-act="submit" data-round="${escapeHtml(r.id)}" ${canSubmit(r) ? '' : 'disabled'}>${submitLabel(r)}</button>`,
      key: `q:${r.id}`,
    });
  }

  /* ----- waiting ----- */

  function paintWaiting(r, rounds) {
    const players = youFirst(roundPlayers(r));
    const done = r.submitted_profile_ids || [];
    const pending = players.filter((id) => !done.includes(id));
    const names = pending.map(displayName);
    const judging = !pending.length;
    const status = judging
      ? `<div class="g-waiting"><span class="g-dots"><i></i><i></i><i></i></span>The AI is judging the answers…</div>`
      : pending.length === 1
        ? `<div class="g-waiting"><span class="g-dots"><i></i><i></i><i></i></span>Waiting for ${escapeHtml(names[0])} to answer...</div>`
        : `<div class="g-waiting"><span class="g-dots"><i></i><i></i><i></i></span>Round reveals when the last person answers.</div>
           <p class="g-waiting-sub">Waiting for ${escapeHtml(names.join(', '))}...</p>`;

    const me = viewerId();
    const other = rounds.find((x) => x.id !== r.id && x.phase === 'answering' && roundPlayers(x).includes(me) && !answeredBy(x, me));
    // The person whose post it is can't guess it, so they sit the round out and watch.
    const sittingOut = !players.includes(me);
    if (sittingOut) markSeen(`sat:${r.id}`);

    paint({
      subtitle: `Round ${r.ordinal} of ${totalRounds(rounds)}`,
      stepsHtml: steps(rounds, r),
      body: `
        <div class="g-q">
          ${pill(r)}
          ${promptHtml(r)}
        </div>
        ${r.game_type === 'who_sent_this' && (r.media?.quote || r.media?.caption) ? `<p class="g-quote-chip">“${escapeHtml(r.media.quote || r.media.caption)}”</p>` : ''}
        ${srcBox(r)}
        <div class="g-panel g-answered">
          <p class="g-answered-title">${done.length}/${players.length} have answered</p>
          <div class="g-people static">${players
            .map(
              (id) => `
              <div class="g-person">
                <span class="g-av-wrap">${avatar(id)}<span class="g-badge-dot ${done.includes(id) ? 'done' : ''}">${done.includes(id) ? ICONS.check : ''}</span></span>
                <span class="g-person-name">${escapeHtml(displayName(id))}</span>
              </div>`
            )
            .join('')}</div>
        </div>
        ${
          !sittingOut
            ? ''
            : rounds.some((x) => roundPlayers(x).includes(me))
              ? `<p class="g-sitout">This one is yours, so you sit it out. You'll see who guessed it when everyone's in.</p>`
              : `<p class="g-sitout">This game started before you joined, so you're watching this one. You'll be in the next game.</p>`
        }
        ${status}`,
      foot: other
        ? `<button type="button" class="g-cta ghost" data-go="${escapeHtml(other.id)}">Play Round ${other.ordinal} while you wait</button>`
        : '',
      key: `w:${r.id}`,
    });
  }

  /* ----- results ----- */

  function nextFoot(r, rounds) {
    const next = rounds.find((x) => x.ordinal > r.ordinal);
    // Between rounds the game steps back: talk about it in the chat; the game master opens the next one.
    if (!next && r.ordinal < totalRounds(rounds)) {
      return `<p class="g-foot-note">Round ${r.ordinal + 1} opens once the chat goes quiet.</p>
        <button type="button" class="g-cta" data-act="close">Back to chat</button>`;
    }
    if (next) {
      const label = r.game_type === 'who_sent_this' ? `Start Round ${next.ordinal}` : 'Next Round';
      return `<button type="button" class="g-cta ${r.game_type === 'who_sent_this' ? 'reverse' : 'violet'}" data-act="next" data-round="${escapeHtml(r.id)}">${label}</button>`;
    }
    const allDone = rounds.every(isRevealed);
    return `<button type="button" class="g-cta" data-act="next" data-round="${escapeHtml(r.id)}">${allDone ? 'View Final Summary' : 'Next Round'}</button>`;
  }

  function saidRow(res, winner) {
    return `
      <div class="g-said">
        ${avatar(res.profile_id)}
        <div class="g-said-bubble">
          <strong>${escapeHtml(displayName(res.profile_id))}${res.profile_id === winner ? '<span class="g-best">👑 Best answer</span>' : ''}</strong>
          ${res.why ? `<p>“${escapeHtml(res.why)}”</p>` : ''}
        </div>
      </div>`;
  }

  function hostLine(p) {
    if (!p?.text) return '';
    return `
      <div class="g-host" data-host>
        <span class="g-host-mark" aria-hidden="true">✦</span>
        <div><b>Game master</b><p>${escapeHtml(p.text)}</p></div>
      </div>`;
  }

  function paintResults(r, rounds, session) {
    const reveal = r.reveal || {};
    const results = reveal.results || [];
    const winner = reveal.winner_profile_id;
    const mine = results.find((res) => res.profile_id === viewerId());
    // win: you guessed right or the AI picked your take; miss: you guessed wrong.
    const mood =
      r.game_type === 'who_sent_this' ? (mine ? (mine.correct ? 'win' : 'miss') : null) : winner && winner === viewerId() ? 'win' : null;

    if (r.game_type === 'who_sent_this') {
      const correct = reveal.correct_profile_id;
      const right = results.filter((res) => res.correct).length;
      const total = results.length || roundPlayers(r).length;
      const next = rounds.find((x) => x.ordinal > r.ordinal);
      const quote = r.media?.quote || r.media?.caption;
      return paint({
        subtitle: `Round ${r.ordinal} Results`,
        confetti: true,
        body: `
          <div class="g-winner">
            <span class="g-rays" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>
            ${ICONS.crown}
            <span class="g-ring">${avatar(correct, 'xl')}</span>
          </div>
          <h3 class="g-reveal-title">It was ${correct === viewerId() ? 'you' : escapeHtml(profileName(correct))}!</h3>
          <p class="g-reveal-sub">${right}/${total} got it right</p>
          ${quote ? `<p class="g-quote-chip">“${escapeHtml(quote)}”</p>` : ''}
          ${srcBox(r, true)}
          ${
            next
              ? `<div class="g-divider"><span>Next up...</span></div>
                 <div class="g-panel g-next">
                   ${pill(next)}
                   <p class="g-next-round">Round ${next.ordinal} of ${totalRounds(rounds)}</p>
                   <h3>${escapeHtml(cap(next.prompt))}</h3>
                   <p class="g-hint">${hint(next)}</p>
                 </div>`
              : ''
          }`,
        foot: nextFoot(r, rounds, session),
        key: `r:${r.id}`,
        mood,
      });
    }

    let groups;
    if (isOpen(r)) {
      const takes = [...results].sort((a, b) => (b.profile_id === winner) - (a.profile_id === winner));
      groups = `
          <div class="g-group tint t0">
            <div class="g-group-head">
              <span>Everyone's takes</span>
              <b class="g-count-badge">${takes.length}</b>
            </div>
            <div class="g-group-rows">${takes.map((res) => saidRow(res, winner)).join('')}</div>
          </div>`;
    } else if (r.game_type === 'most_likely_to' && (r.options || []).some((o) => o.profile_id)) {
      groups = (r.options || [])
        .map((o) => ({ o, rows: results.filter((res) => res.choice === optionId(o)) }))
        .filter((g) => g.rows.length)
        .sort((a, b) => b.rows.length - a.rows.length)
        .map(
          ({ o, rows }, i) => `
          <div class="g-group person ${i === 0 ? 'top' : ''}">
            <div class="g-group-head">
              <span class="g-group-who">${avatar(o.profile_id)}${escapeHtml(displayName(o.profile_id))}</span>
              <b class="g-count-badge">${rows.length}</b>
            </div>
            <div class="g-group-rows">${rows.map((res) => saidRow(res, winner)).join('')}</div>
          </div>`
        )
        .join('');
    } else {
      const scene = r.game_type === 'this_or_that';
      groups = (r.options || [])
        .map((o, i) => {
          const rows = results.filter((res) => res.choice === optionId(o));
          return `
          <div class="g-group ${scene ? `scene s${i % 4}` : `tint t${i % 2}`}">
            <div class="g-group-head">
              <span>${escapeHtml(cap(o.label))}</span>
              <b class="g-count-badge">${rows.length}</b>
            </div>
            <div class="g-group-rows">${rows.length ? rows.map((res) => saidRow(res, winner)).join('') : '<p class="g-empty">No votes</p>'}</div>
          </div>`;
        })
        .join('');
    }

    paint({
      subtitle: r.game_type === 'this_or_that' ? `Round ${r.ordinal} of ${totalRounds(rounds)}` : `Round ${r.ordinal} Results`,
      stepsHtml: r.game_type === 'this_or_that' ? steps(rounds, r) : '',
      body: `
        <div class="g-q">
          ${pill(r)}
          ${promptHtml(r)}
          ${r.game_type === 'this_or_that' ? `<p class="g-hint">Here's what everyone said...</p>` : ''}
        </div>
        <div class="g-groups">${groups}</div>
        ${srcBox(r, true)}`,
      foot: nextFoot(r, rounds, session),
      key: `r:${r.id}`,
      mood,
    });
  }

  /* ----- final summary ----- */

  function paintSummary(session, rounds) {
    const board = scores(rounds);
    const top = board[0];
    const tie = board.length > 1 && board[1][1] === top?.[1];
    const me = viewerId();
    const title = !top ? 'Game over' : tie ? "It's a tie!" : top[0] === me ? 'You won!' : `${profileName(top[0])} wins!`;
    paint({
      subtitle: 'Final Results',
      confetti: true,
      body: `
        ${
          top
            ? `<div class="g-winner">
                 <span class="g-rays" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>
                 ${ICONS.crown}
                 <span class="g-ring">${avatar(top[0], 'xl')}</span>
               </div>`
            : ''
        }
        <h3 class="g-reveal-title">${escapeHtml(title)}</h3>
        <p class="g-reveal-sub">${top ? `${top[1]} ${top[1] === 1 ? 'point' : 'points'} · ` : ''}${totalRounds(rounds)} rounds</p>
        ${hostLine(room.recaps.get(session.id))}
        <div class="g-board">${board
          .map(
            ([id, pts], i) => `
            <div class="g-board-row ${i === 0 ? 'first' : ''}">
              <span class="g-rank">${i + 1}</span>
              ${avatar(id)}
              <span class="g-board-name">${escapeHtml(displayName(id))}</span>
              <span class="g-pts">${pts} ${pts === 1 ? 'pt' : 'pts'}</span>
            </div>`
          )
          .join('')}</div>
        <div class="g-recap">${rounds
          .map(
            (r) => `
            <button type="button" class="g-recap-row" data-go="${escapeHtml(r.id)}">
              ${pill(r)}<span>${escapeHtml(cap(r.prompt))}</span>
            </button>`
          )
          .join('')}</div>`,
      foot: `<button type="button" class="g-cta" data-act="again" ${playingAgain ? 'disabled' : ''}>${playingAgain ? busy('Writing your rounds…') : 'Play Again 🎮'}</button>`,
      key: `s:${session.id}`,
      mood: top && !tie && top[0] === me ? 'win' : null,
    });
  }

  /* ---------- answering ---------- */

  function pick(roundId, value) {
    const r = room.rounds.get(roundId);
    if (!r || r.phase !== 'answering' || submitting.has(roundId)) return;
    drafts[roundId] = { choice: value, why: drafts[roundId]?.why || '' };
    scheduleRender(true);
  }

  async function submit(roundId) {
    const r = room.rounds.get(roundId);
    const draft = drafts[roundId];
    const choice = r && answerFor(r);
    if (!choice || submitting.has(roundId)) return;
    const why = needsWhy(r) ? (draft?.why || '').trim() : undefined;
    if (needsWhy(r) && !why) return;
    submitting.add(roundId);
    scheduleRender(true);
    try {
      const res = await api.submitResponse(roundId, choice, why);
      myPicks[roundId] = choice;
      delete drafts[roundId];
      localStorage.setItem(picksKey, JSON.stringify(myPicks));
      const stored = room.rounds.get(roundId);
      if (stored) {
        applyRow('rounds', {
          ...stored,
          submitted_profile_ids: res.submitted_profile_ids,
          required_response_count: res.required_response_count,
          revision: res.revision,
        });
      }
      if (res.round) applyRow('rounds', res.round);
      if (res.session) applyRow('game_sessions', res.session);
    } catch (err) {
      if (err.status === 409) hydrate();
      toast(err.message);
    } finally {
      submitting.delete(roundId);
      scheduleRender(true);
    }
  }

  async function playAgain() {
    if (playingAgain || !room.threadId) return;
    playingAgain = true;
    scheduleRender(true);
    try {
      const res = await api.sendGame(room.threadId, threadName());
      if (res?.session) applyRow('game_sessions', res.session);
      room.sessionId = null;
      view = { roundId: null, summary: false };
      ensureInviteBubble(room.threadId, { roomId: res.room.id, sessionId: res.session.id, mine: true });
      await hydrate();
    } catch (err) {
      toast(err.message);
    } finally {
      playingAgain = false;
      scheduleRender(true);
    }
  }

  els.play?.addEventListener('click', (e) => {
    const el = e.target.closest('button');
    if (!el || el.disabled || !els.play.contains(el)) return;
    const session = currentSession();
    const rounds = sessionRounds(session);
    if (el.dataset.act === 'close') {
      // Leaving a results screen counts as having seen it, so reopening goes to what's new.
      if (screenKey.startsWith('r:')) markSeen(screenKey.slice(2));
      return exitPlayMode();
    }
    if (el.dataset.act === 'more') return toast('Chaos · AI-made rounds for your group');
    if (el.dataset.pick) return pick(view.roundId, el.dataset.pick);
    if (el.dataset.act === 'submit') return submit(el.dataset.round);
    if (el.dataset.act === 'again') return playAgain();
    if (el.dataset.act === 'next') {
      const r = rounds.find((x) => x.id === el.dataset.round);
      if (r) goNext(r, rounds, session);
      return;
    }
    const jump = el.dataset.go || (el.classList.contains('g-step') && el.dataset.round);
    if (jump) {
      view = { roundId: jump, summary: false };
      scheduleRender(true);
    }
  });

  els.play?.addEventListener('input', (e) => {
    const input = e.target.closest('.g-why-input');
    if (!input) return;
    const roundId = input.dataset.round;
    drafts[roundId] = { ...(drafts[roundId] || {}), why: input.value };
    const counter = input.parentElement.querySelector('.g-count');
    if (counter) counter.textContent = `${input.value.length}/${WHY_MAX}`;
    const r = room.rounds.get(roundId);
    const btn = els.play.querySelector('[data-act="submit"]');
    if (btn && r) btn.disabled = !canSubmit(r);
  });

  els.play?.addEventListener('keydown', (e) => {
    const input = e.target.closest('.g-why-input');
    if (input && e.key === 'Enter') {
      const r = room.rounds.get(input.dataset.round);
      if (r && canSubmit(r)) submit(r.id);
    }
  });

  /* ---------- play mode (full-screen game over the chat) ---------- */

  function enterPlayMode(roomId, threadId, sessionId = null) {
    if (!roomId) {
      toast('Could not find this chat’s game. Reopen the chat and try again.');
      return;
    }
    if (room.playing) exitPlayMode(false);
    room = emptyRoom();
    room.id = roomId;
    room.threadId = threadId;
    room.sessionId = sessionId;
    room.playing = true;
    renderKey = '';
    view = { roundId: null, summary: false };
    closeTray();
    els.play.classList.remove('hidden');
    paintLoading();
    connect(roomId);
  }

  function exitPlayMode(refreshChat = true) {
    room.unsubscribe?.();
    clearTimeout(room.retryTimer);
    room = emptyRoom();
    renderKey = '';
    screenKey = '';
    els.play?.classList.add('hidden');
    if (els.play) els.play.innerHTML = '';
    if (refreshChat && thread.id) syncInvites(thread.id).catch(() => {});
  }

  /* ---------- wiring ---------- */

  els.plusBtn?.addEventListener('click', () => toggleTray());
  els.trayGames?.addEventListener('click', () => {
    closeTray();
    openChaosSheet();
  });
  els.messages?.addEventListener('click', (e) => {
    if (!e.target.closest('.gp-invite')) closeTray();
  });
  els.input?.addEventListener('focus', closeTray);

  document.addEventListener('dm:play-game', async (e) => {
    const threadId = window.DMChat?.getActiveThreadId();
    if (!threadId) return;
    try {
      if (!(await ensureReady())) return;
      const roomId = await joinThread(threadId);
      // A result card in the chat opens straight to that round's results.
      const sessionId = e.detail?.sessionId || null;
      if (e.detail?.roundId) {
        enterPlayMode(roomId, threadId, sessionId);
        view = { roundId: e.detail.roundId, summary: false };
        return;
      }
      await openLobby(threadId, roomId, sessionId);
    } catch (err) {
      toast(err.message);
    }
  });

  document.addEventListener('dm:thread-open', async (e) => {
    if (room.playing) exitPlayMode(false);
    closeTray();
    closeSheet();
    const threadId = e.detail?.threadId;
    if (thread.id !== threadId) leaveThread();
    if (!threadId) return;
    try {
      // Opening a chat is how a phone joins its game.
      if (!(await ensureReady())) return;
      if (window.DMChat?.getActiveThreadId() !== threadId) return;
      // The seeded history shows this phone's own lines on the sent side.
      if (window.DMChat && window.DMChat.me !== ready.profile?.display_name) {
        window.DMChat.me = ready.profile?.display_name;
        window.DMChat.refresh();
      }
      // Always show who this tab is playing as.
      const status = document.getElementById('chat-status');
      const members = window.DMChat?.getActiveThread()?.status || '';
      if (status && ready.profile) status.textContent = `${members}${members ? ' · ' : ''}you're ${ready.profile.display_name}`;
      await joinThread(threadId);
      await loadChat(threadId);
      await syncInvites(threadId);
    } catch (err) {
      toast(err.message);
    }
  });

  if (window.DMChat) window.DMChat.sendHook = (text) => (thread.roomId ? sendChat(text) : false);

  document.addEventListener('dm:thread-close', () => {
    if (room.playing) exitPlayMode(false);
    closeTray();
    closeSheet();
    leaveThread();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && room.playing) hydrate();
  });

  els.sheet?.addEventListener('click', (e) => {
    if (e.target === els.sheet) closeSheet();
  });

  els.backBtn?.addEventListener(
    'click',
    (e) => {
      if (room.playing) {
        e.stopImmediatePropagation();
        exitPlayMode();
      }
    },
    true
  );

  // Demo link: messages.html?thread=roshan-group drops every phone straight into the group chat.
  const deepLinkThread = new URLSearchParams(location.search).get('thread');
  if (deepLinkThread) window.DMChat?.openThread(deepLinkThread);
})();
