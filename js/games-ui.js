/* Instagram Games — GamePigeon-style invites in DMs, backed by Supabase Realtime rooms */
(function () {
  const api = window.GamesAPI;
  if (!api) return;

  const GAME_LABELS = {
    who_sent_this: 'Who Sent This?',
    most_likely_to: 'Most Likely To',
    hot_take: 'Hot Take',
    this_or_that: 'This or That',
  };
  const CHAOS = { title: 'Chaos', icon: '⚡', blurb: 'AI-made for your group · 3 rounds' };

  const els = {
    sheet: document.getElementById('g-sheet-backdrop'),
    sheetBody: document.getElementById('g-sheet-body'),
    messages: document.getElementById('chat-messages'),
    status: document.getElementById('chat-status'),
    hostBar: document.getElementById('g-host-bar'),
    composer: document.getElementById('dm-composer'),
    input: document.getElementById('composer-input'),
    sendBtn: document.getElementById('composer-send'),
    rightIcons: document.querySelector('.composer-right'),
    gamesBtn: document.getElementById('composer-games'),
    backBtn: document.getElementById('dm-back'),
  };

  const ready = { userId: null, profile: null, profiles: [] };
  let room = emptyRoom();
  let renderKey = '';
  // Cards already on screen skip the entrance animation when the surface is re-rendered.
  let shownCards = new Set();
  let renderedCards = new Set();
  const seen = (key) => {
    renderedCards.add(key);
    return shownCards.has(key) ? 'seen' : '';
  };
  let hostBarKey = '';
  let renderQueued = false;
  // Async players come back hours later, so picks must outlive the tab.
  const myPicks = JSON.parse(localStorage.getItem(`ig_games_picks:${api.playerSlot}`) || '{}');
  // Picked-but-not-sent opinion answers ({choice, why}) survive re-renders from Realtime updates.
  const drafts = {};
  const submitting = new Set();

  function emptyRoom() {
    return {
      id: null,
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
      timeline: new Map(),
    };
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function toast(message) {
    alert(message);
  }

  /* ---------- sheet ---------- */

  function openSheet(title, lead, innerHtml) {
    els.sheetBody.innerHTML = `
      <h3>${escapeHtml(title)}</h3>
      ${lead ? `<p class="lead">${escapeHtml(lead)}</p>` : ''}
      ${innerHtml}`;
    els.sheet.classList.remove('hidden');
  }

  function closeSheet() {
    els.sheet.classList.add('hidden');
    els.sheetBody.innerHTML = '';
  }

  /* ---------- identity ---------- */

  let readying = null;

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

    const allowed = window.GAMES_CONFIG.demoPlayers;
    const saved = api.savedProfile();
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
      toast(`You're ${profile.display_name}`);
      return true;
    }
    throw new Error('Every player slot is taken. Ask someone to leave or reset the demo.');
  }

  function profileName(id) {
    return (
      room.members.get(id)?.display_name ||
      ready.profiles.find((p) => p.id === id)?.display_name ||
      'Someone'
    );
  }

  function profileAvatar(id) {
    return (
      room.members.get(id)?.avatar_url ||
      ready.profiles.find((p) => p.id === id)?.avatar_url ||
      ''
    );
  }

  /* ---------- the open chat's room (one room per group chat, joined on open) ---------- */

  const thread = { id: null, roomId: null, unwatch: null, seq: 0 };

  function threadName() {
    return (window.DMChat?.getActiveThread()?.name || 'Group chat').slice(0, 80);
  }

  async function joinThread(threadId) {
    if (thread.id === threadId && thread.roomId) return thread.roomId;
    const seq = ++thread.seq;
    const roomRow = await api.threadRoom(threadId, threadName());
    if (seq !== thread.seq) return roomRow.id;
    thread.unwatch?.();
    thread.id = threadId;
    thread.roomId = roomRow.id;
    thread.unwatch = api.watchThreadGames(roomRow.id, () => syncInvites(threadId));
    return roomRow.id;
  }

  function leaveThread() {
    thread.seq++;
    thread.unwatch?.();
    thread.id = null;
    thread.roomId = null;
    thread.unwatch = null;
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

  function inviteSubtitle(invite) {
    if (invite.done) return 'Game over · tap to see scores';
    if (invite.myTurn == null) return invite.mine ? CHAOS.blurb : `${invite.senderName || 'A friend'} sent a game`;
    if (invite.myTurn) return invite.mine ? 'Your turn · tap to play' : `${invite.senderName || 'A friend'} sent a game · your turn`;
    return `Waiting on ${invite.waitingCount} ${invite.waitingCount === 1 ? 'player' : 'players'}`;
  }

  function ensureInviteBubble(threadId, invite) {
    const dm = window.DMChat;
    const chat = dm?.getActiveThread();
    if (!chat || dm.getActiveThreadId() !== threadId) return;
    const existing = chat.messages.find(
      (m) => m.type === 'game-invite' && m.sessionId === invite.sessionId
    );
    const subtitle = inviteSubtitle(invite);
    if (existing) {
      if (existing.subtitle !== subtitle) {
        existing.subtitle = subtitle;
        if (!room.playing) dm.refresh();
      }
      return;
    }
    const message = {
      type: 'game-invite',
      from: invite.mine ? 'out' : 'in',
      title: CHAOS.title,
      subtitle,
      roomId: invite.roomId,
      sessionId: invite.sessionId,
      isHost: invite.mine,
      joined: true,
    };
    if (room.playing) chat.messages.push(message);
    else dm.appendMessage(message);
  }

  /* ---------- picker ---------- */

  async function openGamePicker() {
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
    openSheet(
      'Games',
      `Playing as ${ready.profile.display_name}.`,
      `
      <div class="gp-grid">
        <button type="button" class="gp-tile" id="gp-chaos">
          <span class="gp-tile-icon">${CHAOS.icon}</span>
          <strong>${CHAOS.title}</strong>
          <span>${CHAOS.blurb}</span>
        </button>
        <div class="gp-tile disabled" aria-disabled="true">
          <span class="gp-tile-icon">🔒</span>
          <strong>More vibes</strong>
          <span>Coming soon</span>
        </div>
      </div>
      <div class="row" style="margin-top:12px">
        <button type="button" class="g-btn secondary" id="sheet-cancel" style="flex:1">Close</button>
      </div>`
    );
    document.getElementById('sheet-cancel')?.addEventListener('click', closeSheet);
    document.getElementById('gp-chaos')?.addEventListener('click', () => sendChaos(threadId));
  }

  async function sendChaos(threadId) {
    const tile = document.getElementById('gp-chaos');
    if (tile?.disabled) return;
    if (tile) {
      tile.disabled = true;
      tile.querySelector('span:last-child').textContent = 'The AI is writing your rounds…';
    }
    try {
      const res = await api.sendGame(threadId, threadName());
      closeSheet();
      ensureInviteBubble(threadId, {
        roomId: res.room.id,
        sessionId: res.session.id,
        mine: true,
      });
      await enterPlayMode(res.room.id, threadId);
    } catch (err) {
      if (err.status === 409 && /already running/.test(err.message)) {
        closeSheet();
        try {
          await enterPlayMode(await joinThread(threadId), threadId);
        } catch (joinErr) {
          toast(joinErr.message);
        }
        return;
      }
      closeSheet();
      toast(err.message);
    }
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
      room.timeline.set(row.id, row);
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
    if (status === 'SUBSCRIBED') {
      hydrate();
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      reconnectSoon();
    }
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
      snap = await api.hydrate(roomId);
    } catch (err) {
      if (seq !== room.hydrateSeq || roomId !== room.id) return;
      // 4xx won't fix itself on retry; only network/5xx/timeouts should reconnect.
      if (err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429) {
        exitPlayMode();
        toast(
          err.status === 403 ? err.message : err.status === 404 ? 'Game not found.' : 'Could not open the game.'
        );
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
    for (const ev of snap.timeline) room.timeline.set(ev.id, ev);

    room.hydrated = true;
    const buffered = room.buffer;
    room.buffer = [];
    for (const [table, row] of buffered) applyRow(table, row);
    scheduleRender(true);
  }

  /* ---------- derived state ---------- */

  function currentSession() {
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

  function currentRound(session, rounds) {
    if (!session || session.status !== 'active') return null;
    const live = rounds.filter((r) => r.phase === 'answering' || r.phase === 'revealed');
    return live[live.length - 1] || rounds.find((r) => r.ordinal === session.current_round_ordinal) || null;
  }

  function activeMembers() {
    return [...room.members.values()].filter((m) => !m.left_at);
  }

  function isHost() {
    return !!room.meta && room.meta.host_profile_id === room.viewer;
  }

  function sortedTimeline() {
    return [...room.timeline.values()].sort((a, b) =>
      a.created_at === b.created_at ? (a.id < b.id ? -1 : 1) : a.created_at < b.created_at ? -1 : 1
    );
  }

  function scores(rounds) {
    const totals = new Map();
    for (const r of rounds) {
      for (const res of r.reveal?.results || []) {
        totals.set(res.profile_id, (totals.get(res.profile_id) || 0) + (res.points || 0));
      }
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1]);
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
    if (!room.playing || !room.hydrated || !els.messages) return;
    const session = currentSession();
    const rounds = sessionRounds(session);
    const timeline = sortedTimeline();
    const key = JSON.stringify([
      room.meta?.revision,
      [...room.members.values()].map((m) => [m.profile_id, m.revision, m.left_at]),
      session && [session.id, session.status, session.revision],
      rounds.map((r) => [r.id, r.revision, r.phase, r.submitted_profile_ids?.length]),
      timeline.length,
      timeline[timeline.length - 1]?.id,
    ]);
    updateHeader();
    updateHostBar(session, rounds);
    if (key === renderKey) return;
    renderKey = key;
    renderSurface(session, rounds, timeline);
  }

  function updateHeader() {
    const members = activeMembers();
    if (els.status) els.status.textContent = `${members.length} in game · ${CHAOS.title}`;
  }

  const optionId = (opt) => opt.id || opt.profile_id;
  // Opinion rounds have no right answer: players add a one-line why and the AI judges the best one.
  const needsWhy = (r) => r.game_type !== 'who_sent_this';
  // Open rounds (Hot Take) have no options: each player types their own take and the AI judges.
  const isOpen = (r) => !(r.options || []).length;

  function roundPlayers(r) {
    if (r.player_profile_ids?.length) return r.player_profile_ids;
    return (r.options || []).map((o) => o.profile_id).filter(Boolean);
  }

  function roundCard(r) {
    const submitted = r.submitted_profile_ids || [];
    const iSubmitted = submitted.includes(room.viewer);
    const myPick = myPicks[r.id];
    const draft = drafts[r.id];
    const sending = submitting.has(r.id);
    const revealed = r.phase === 'revealed' || r.phase === 'complete';
    const reveal = r.reveal || {};
    const correctId = reveal.correct_profile_id;
    const judged = revealed ? !!reveal.winner_profile_id : needsWhy(r);
    const media = r.media || {};
    const label = GAME_LABELS[r.game_type] || 'Round';
    const open = isOpen(r);
    if (open && !revealed && !iSubmitted && !drafts[r.id]) drafts[r.id] = { choice: 'open', why: '' };
    const labelOf = (id) => (r.options || []).find((o) => optionId(o) === id)?.label || '';
    const tally = {};
    for (const res of reveal.results || []) tally[res.choice] = (tally[res.choice] || 0) + 1;

    const quoteHtml = media.quote ? `<p class="g-quote">“${escapeHtml(media.quote)}”</p>` : '';
    const mediaHtml = media.url
      ? `<img class="media" src="${escapeHtml(media.url)}" alt="">`
      : media.caption || media.asset_key
        ? `<div class="g-media-placeholder"><span>🎬</span><p>${escapeHtml(media.caption || media.asset_key)}</p></div>`
        : '';

    const options = (r.options || [])
      .map((opt) => {
        const id = optionId(opt);
        const picked = myPick === id || (!iSubmitted && draft?.choice === id);
        const cls = [
          'g-option',
          revealed && correctId && id === correctId ? 'correct' : '',
          picked ? 'mine' : '',
          revealed && correctId && myPick === id && id !== correctId ? 'wrong' : '',
        ]
          .filter(Boolean)
          .join(' ');
        const disabled = revealed || iSubmitted || sending || r.phase !== 'answering';
        const count = revealed && judged ? ` · ${tally[id] || 0}` : '';
        return `<button type="button" class="${cls}" data-round="${escapeHtml(r.id)}" data-value="${escapeHtml(id)}" ${disabled ? 'disabled' : ''}>${escapeHtml(opt.label)}${count}</button>`;
      })
      .join('');

    const players = roundPlayers(r);
    const lastOne = submitted.length === players.length - 1;
    const whyHtml =
      !revealed && !iSubmitted && r.phase === 'answering' && needsWhy(r) && drafts[r.id]?.choice
        ? `<div class="g-text-answer g-why">
            <input class="g-why-input" data-round="${escapeHtml(r.id)}" maxlength="140" placeholder="${open ? 'your take, one line, make it good' : 'why? one line, make it good'}" value="${escapeHtml(drafts[r.id].why || '')}" ${sending ? 'disabled' : ''}>
            <button type="button" class="g-btn primary g-why-send" data-round="${escapeHtml(r.id)}" ${sending || !(drafts[r.id].why || '').trim() ? 'disabled' : ''}>${sending ? (lastOne ? 'Judging…' : 'Sending…') : 'Send'}</button>
          </div>`
        : '';

    let footer;
    if (revealed && judged) {
      const winner = reveal.winner_profile_id;
      const rows = (reveal.results || [])
        .slice()
        .sort((a, b) => (b.profile_id === winner) - (a.profile_id === winner))
        .map(
          (res) => `
            <div class="g-answer-row ${res.profile_id === winner ? 'winner' : ''}">
              <strong>${res.profile_id === winner ? '🏆 ' : ''}${escapeHtml(profileName(res.profile_id))}${res.choice && labelOf(res.choice) ? ` <span class="g-pick">· ${escapeHtml(labelOf(res.choice))}</span>` : ''}</strong>
              ${res.why ? `<p class="g-why-text">“${escapeHtml(res.why)}”</p>` : ''}
            </div>`
        )
        .join('');
      footer = `
        ${reveal.shoutout ? `<p class="g-reveal-copy">🎲 ${escapeHtml(reveal.shoutout)}</p>` : ''}
        <div class="g-answers">${rows}</div>
        <div class="g-result ${winner === room.viewer ? 'win' : 'lose'}">${
          winner === room.viewer ? 'Your answer won · +1' : `${escapeHtml(profileName(winner))} took this one`
        }</div>`;
    } else if (revealed) {
      const mine = (reveal.results || []).find((res) => res.profile_id === room.viewer);
      const winners = (reveal.results || []).filter((res) => res.correct).map((res) => profileName(res.profile_id));
      footer = `
        <p class="g-reveal-copy">${escapeHtml(reveal.message || `${profileName(correctId)} sent it!`)}</p>
        ${mine ? `<div class="g-result ${mine.correct ? 'win' : 'lose'}">${mine.correct ? `You got it · +${mine.points}` : 'Not this time'}</div>` : ''}
        <div class="g-wait">${winners.length ? `Got it: ${escapeHtml(winners.join(', '))}` : 'Nobody got it'}</div>`;
    } else {
      const answered = submitted.length;
      const total = r.required_response_count || players.length;
      const who = submitted.map(profileName).join(', ');
      const pending = players.filter((id) => !submitted.includes(id) && id !== room.viewer).map(profileName);
      const prompt = open ? 'Type your take' : needsWhy(r) ? (draft?.choice ? 'Now say why' : 'Pick a side') : 'Your move';
      footer = `<div class="g-wait">${
        iSubmitted
          ? pending.length
            ? `Answer locked · waiting on ${escapeHtml(pending.join(', '))}`
            : 'Answer locked'
          : `${prompt} · ${answered}/${total} answered${who ? ` <span class="g-who">(${escapeHtml(who)})</span>` : ''}`
      }</div>`;
    }

    return `
      <div class="g-card ${revealed ? 'revealed' : ''} ${seen(r.id)}" data-round="${escapeHtml(r.id)}">
        <div class="accent"></div>
        <div class="body">
          <span class="label">${revealed ? 'Revealed' : CHAOS.title} · Round ${r.ordinal} · ${escapeHtml(label)}</span>
          <h4>${escapeHtml(r.prompt)}</h4>
          ${quoteHtml}
          ${mediaHtml}
          ${options ? `<div class="g-options">${options}</div>` : ''}
          ${whyHtml}
          ${footer}
        </div>
      </div>`;
  }

  function roundIdOf(ev) {
    const p = ev.payload || {};
    return p.id || p.round_id || null;
  }

  function renderSurface(session, rounds, timeline) {
    renderedCards = new Set();
    const parts = [
      `<div class="dm-row ${isHost() ? 'out' : 'in'}">
        <div class="gp-invite active ${seen('invite')}">
          <div class="gp-invite-art"><span class="gp-die">${CHAOS.icon}</span></div>
          <div class="gp-invite-meta">
            <strong>${CHAOS.title}</strong>
            <span>${escapeHtml(activeMembers().map((m) => m.display_name || profileName(m.profile_id)).join(', '))}</span>
          </div>
        </div>
      </div>`,
    ];

    const roundsById = new Map(rounds.map((r) => [r.id, r]));
    const placed = new Set();

    for (const ev of timeline) {
      const p = ev.payload || {};
      switch (ev.event_type) {
        case 'message': {
          const mine = ev.actor_profile_id === room.viewer;
          const name = profileName(ev.actor_profile_id);
          const avatar = profileAvatar(ev.actor_profile_id);
          parts.push(`
            <div class="g-msg-row ${mine ? 'out' : 'in'}">
              ${!mine && avatar ? `<img class="av" src="${escapeHtml(avatar)}" alt="">` : ''}
              <div>
                ${!mine ? `<div class="g-sender">${escapeHtml(name)}</div>` : ''}
                <div class="bubble">${escapeHtml(p.body)}</div>
              </div>
            </div>`);
          break;
        }
        case 'host_line':
          parts.push(`<div class="g-host-line"><span>🎲 Game master</span>${escapeHtml(p.text)}</div>`);
          break;
        case 'game_started':
          parts.push(`<div class="g-system">${CHAOS.title} started</div>`);
          break;
        case 'game_prompt': {
          const r = roundsById.get(roundIdOf(ev));
          if (r && !placed.has(r.id)) {
            placed.add(r.id);
            parts.push(roundCard(r));
          }
          break;
        }
        case 'game_reveal':
          if (p.game_over) parts.push(`<div class="g-system">Game over</div>`);
          break;
        case 'game_over':
          parts.push(`<div class="g-system">Game over</div>`);
          break;
        default:
          break;
      }
    }
    for (const r of rounds) if (!placed.has(r.id)) parts.push(roundCard(r));

    if (session?.status === 'complete') {
      const board = scores(rounds);
      parts.push(`
        <div class="g-card revealed ${seen(`scores:${session.id}`)}">
          <div class="accent"></div>
          <div class="body">
            <span class="label">Final scores</span>
            <div class="g-answers">${
              board.length
                ? board
                    .map(
                      ([id, pts], i) =>
                        `<div class="g-answer-row"><strong>${i === 0 ? '👑 ' : ''}${escapeHtml(profileName(id))}</strong><span>${pts} pt${pts === 1 ? '' : 's'}</span></div>`
                    )
                    .join('')
                : '<div class="g-wait">No points this time</div>'
            }</div>
          </div>
        </div>`);
    } else if (!session) {
      parts.push(`<div class="g-system">No game yet. Send one from the chat.</div>`);
    }

    const active = document.activeElement;
    const typing = active?.classList?.contains('g-why-input')
      ? { round: active.dataset.round, start: active.selectionStart, end: active.selectionEnd }
      : focusWhy
        ? { round: focusWhy, start: null, end: null }
        : null;
    focusWhy = null;
    const prevTop = els.messages.scrollTop;
    const nearBottom = els.messages.scrollHeight - els.messages.scrollTop - els.messages.clientHeight < 80;
    els.messages.innerHTML = parts.join('');
    els.messages.scrollTop = nearBottom ? els.messages.scrollHeight : prevTop;
    shownCards = renderedCards;
    if (typing) {
      const input = els.messages.querySelector(`.g-why-input[data-round="${typing.round}"]`);
      if (input) {
        input.focus({ preventScroll: true });
        const end = typing.end ?? input.value.length;
        input.setSelectionRange(typing.start ?? end, end);
      }
    }

    els.messages.querySelectorAll('.g-option:not([disabled])').forEach((btn) => {
      btn.addEventListener('click', () => pickOption(btn.dataset.round, btn.dataset.value));
    });
    els.messages.querySelectorAll('.g-why-input').forEach((input) => {
      const roundId = input.dataset.round;
      const send = els.messages.querySelector(`.g-why-send[data-round="${roundId}"]`);
      input.addEventListener('input', () => {
        if (drafts[roundId]) drafts[roundId].why = input.value;
        if (send) send.disabled = !input.value.trim();
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && input.value.trim()) sendDraft(roundId);
      });
    });
    els.messages.querySelectorAll('.g-why-send').forEach((btn) => {
      btn.addEventListener('click', () => sendDraft(btn.dataset.round));
    });
  }

  let focusWhy = null;

  function pickOption(roundId, value) {
    const round = room.rounds.get(roundId);
    if (round && needsWhy(round)) {
      drafts[roundId] = { choice: value, why: drafts[roundId]?.why || '' };
      focusWhy = roundId;
      scheduleRender(true);
      return;
    }
    submitPick(roundId, value);
  }

  function sendDraft(roundId) {
    const draft = drafts[roundId];
    if (draft?.choice && draft.why.trim()) submitPick(roundId, draft.choice, draft.why.trim());
  }

  async function submitPick(roundId, value, why) {
    if (submitting.has(roundId)) return;
    submitting.add(roundId);
    scheduleRender(true);
    try {
      const res = await api.submitResponse(roundId, value, why);
      myPicks[roundId] = value;
      delete drafts[roundId];
      localStorage.setItem(`ig_games_picks:${api.playerSlot}`, JSON.stringify(myPicks));
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

  function updateHostBar(session, rounds) {
    if (!els.hostBar) return;
    const current = currentRound(session, rounds);
    let html = '';

    if (!session || session.status !== 'active') {
      html = `<button type="button" class="g-btn primary" id="host-start">${
        session ? 'Play again' : `Start ${CHAOS.title}`
      }</button>`;
    } else if (isHost() && session.mode !== 'async') {
      if (current?.phase === 'answering') {
        const answered = current.submitted_profile_ids?.length || 0;
        const total = current.required_response_count || 0;
        html = `<button type="button" class="g-btn primary" id="host-reveal" data-round="${current.id}" ${answered < total ? 'disabled' : ''}>Reveal (${answered}/${total})</button>`;
      } else if (current?.phase === 'revealed') {
        html = `<button type="button" class="g-btn primary" id="host-advance" data-round="${current.id}">Next round</button>`;
      }
    }

    const key = html || 'empty';
    if (key === hostBarKey) return;
    hostBarKey = key;
    els.hostBar.innerHTML = html;
    els.hostBar.classList.toggle('visible', !!html);

    const run = (id, fn) =>
      document.getElementById(id)?.addEventListener('click', async (e) => {
        e.currentTarget.disabled = true;
        if (id === 'host-start') e.currentTarget.textContent = 'The AI is writing your rounds…';
        try {
          const res = await fn(e.currentTarget.dataset.round);
          if (res?.room) applyRow('rooms', res.room);
          if (res?.session) applyRow('game_sessions', res.session);
          if (res?.current_round) applyRow('rounds', res.current_round);
          if (res?.id && res?.phase) applyRow('rounds', res);
          scheduleRender(true);
        } catch (err) {
          hostBarKey = '';
          if (err.status === 409) hydrate();
          else scheduleRender(true);
          toast(err.message);
        }
      });
    run('host-start', () => api.sendGame(room.threadId, threadName()));
    run('host-reveal', (roundId) => api.reveal(roundId));
    run('host-advance', (roundId) => api.advance(roundId));
  }

  /* ---------- play mode ---------- */

  async function enterPlayMode(roomId, threadId) {
    if (!roomId) throw new Error('Could not find this chat’s game. Reopen the chat and try again.');
    if (room.playing) exitPlayMode(false);
    room = emptyRoom();
    room.id = roomId;
    room.threadId = threadId;
    room.playing = true;
    renderKey = '';
    hostBarKey = '';
    shownCards = new Set();
    window.DMChat?.setMessagesContainerMode('game');
    els.messages.innerHTML = `<div class="g-system">Connecting…</div>`;
    connect(roomId);
  }

  function exitPlayMode(refreshChat = true) {
    room.unsubscribe?.();
    clearTimeout(room.retryTimer);
    room = emptyRoom();
    renderKey = '';
    hostBarKey = '';
    shownCards = new Set();
    els.hostBar?.classList.remove('visible');
    if (els.hostBar) els.hostBar.innerHTML = '';
    window.DMChat?.setMessagesContainerMode('chat');
    if (refreshChat) {
      window.DMChat?.refresh();
      if (thread.id) syncInvites(thread.id).catch(() => {});
    }
  }

  /* ---------- wiring ---------- */

  els.gamesBtn?.addEventListener('click', () => openGamePicker());

  document.addEventListener('dm:play-game', async () => {
    const threadId = window.DMChat?.getActiveThreadId();
    if (!threadId) return;
    try {
      if (!(await ensureReady())) return;
      const roomId = await joinThread(threadId);
      await enterPlayMode(roomId, threadId);
    } catch (err) {
      toast(err.message);
    }
  });

  document.addEventListener('dm:thread-open', async (e) => {
    if (room.playing) exitPlayMode(false);
    const threadId = e.detail?.threadId;
    if (thread.id !== threadId) leaveThread();
    if (!threadId) return;
    try {
      // Opening a chat is how a phone joins its game.
      if (!(await ensureReady())) return;
      if (window.DMChat?.getActiveThreadId() !== threadId) return;
      await joinThread(threadId);
      await syncInvites(threadId);
    } catch (err) {
      toast(err.message);
    }
  });

  document.addEventListener('dm:thread-close', () => {
    if (room.playing) exitPlayMode();
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

  els.composer?.addEventListener(
    'submit',
    async (e) => {
      if (!room.playing || !room.id) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const text = els.input.value.trim();
      if (!text) return;
      try {
        const ev = await api.sendMessage(room.id, text);
        els.input.value = '';
        els.sendBtn?.classList.add('hidden');
        els.rightIcons?.classList.remove('typing');
        if (ev?.id) applyRow('timeline_events', ev);
        scheduleRender();
      } catch (err) {
        toast(err.message);
      }
    },
    true
  );

  // Demo link: messages.html?thread=roshan-group drops every phone straight into the group chat.
  const deepLinkThread = new URLSearchParams(location.search).get('thread');
  if (deepLinkThread) window.DMChat?.openThread(deepLinkThread);
})();
