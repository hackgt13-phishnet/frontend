/* Instagram Games client: Supabase Auth + Realtime, FastAPI for every write */
(function (global) {
  const cfg = () => global.GAMES_CONFIG;

  // ?player=2 gives a tab its own persistent identity so one browser can play both sides.
  const playerSlot = new URLSearchParams(location.search).get('player') || '1';
  const storageKey = (name) => `${name}:${playerSlot}`;

  let client = null;
  function supabase() {
    if (client) return client;
    if (!global.supabase?.createClient) throw new Error('Supabase SDK failed to load');
    client = global.supabase.createClient(cfg().supabaseUrl, cfg().supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: storageKey('ig_games_auth'),
      },
    });
    return client;
  }

  class ApiError extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  }

  async function session() {
    const { data, error } = await supabase().auth.getSession();
    if (error) throw error;
    return data.session;
  }

  async function ensureAuth() {
    let current = await session();
    if (!current) {
      const { data, error } = await supabase().auth.signInAnonymously();
      if (error) {
        throw new Error(`Supabase sign-in failed: ${error.message}. Is anonymous sign-in enabled?`);
      }
      current = data.session;
    }
    return current;
  }

  const NO_PROFILE = 'Choose a demo profile first';

  /** A demo reset frees every claim; quietly re-claim this phone's player once and retry. */
  async function request(path, options = {}, reclaimed = false) {
    try {
      return await send(path, options);
    } catch (err) {
      const saved = readJSON('ig_games_profile');
      if (reclaimed || err.status !== 403 || err.message !== NO_PROFILE || !saved) throw err;
      try {
        await send('/demo-sessions', { method: 'POST', body: JSON.stringify({ profile_id: saved.id }) });
      } catch {
        // Our profile sat idle and another phone took it; the UI deals us a new one.
        writeJSON('ig_games_profile', null);
        global.dispatchEvent(new CustomEvent('games:profile-lost'));
        throw new ApiError(403, 'Your player was reset. Try again to get a new one.');
      }
      return request(path, options, true);
    }
  }

  async function send(path, options = {}) {
    const current = await ensureAuth();
    const res = await fetch(`${cfg().apiBase}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${current.access_token}`,
        ...(options.headers || {}),
      },
    });
    if (res.status === 204) return null;
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { detail: text };
    }
    if (!res.ok) {
      const detail = data?.detail || res.statusText;
      throw new ApiError(res.status, typeof detail === 'string' ? detail : JSON.stringify(detail));
    }
    return data;
  }

  const post = (path, body) =>
    request(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

  function readJSON(key) {
    try {
      return JSON.parse(localStorage.getItem(storageKey(key)) || 'null');
    } catch {
      return null;
    }
  }

  function writeJSON(key, value) {
    if (value == null) localStorage.removeItem(storageKey(key));
    else localStorage.setItem(storageKey(key), JSON.stringify(value));
  }

  /**
   * Subscribe-then-hydrate per docs/realtime-contract.md. `onRow(table, row)` fires for
   * every change; `onStatus(status)` receives SUBSCRIBED / CHANNEL_ERROR / TIMED_OUT / CLOSED.
   */
  function subscribeRoom(roomId, onRow, onStatus) {
    const channel = supabase().channel(`room:${roomId}`);
    const handlers = [
      ['rooms', 'UPDATE', `id=eq.${roomId}`],
      ['room_members', 'INSERT', `room_id=eq.${roomId}`],
      ['room_members', 'UPDATE', `room_id=eq.${roomId}`],
      ['game_sessions', 'INSERT', `room_id=eq.${roomId}`],
      ['game_sessions', 'UPDATE', `room_id=eq.${roomId}`],
      ['rounds', 'INSERT', `room_id=eq.${roomId}`],
      ['rounds', 'UPDATE', `room_id=eq.${roomId}`],
      ['timeline_events', 'INSERT', `room_id=eq.${roomId}`],
    ];
    for (const [table, event, filter] of handlers) {
      channel.on('postgres_changes', { schema: 'public', table, event, filter }, (payload) =>
        onRow(table, payload.new)
      );
    }
    channel.subscribe((status) => onStatus(status));
    return () => supabase().removeChannel(channel);
  }

  /** Lightweight watcher while a chat is open: fires when a game is sent or finishes. */
  function watchThreadGames(roomId, onSession) {
    const filter = `room_id=eq.${roomId}`;
    const channel = supabase()
      .channel(`thread:${roomId}`)
      .on('postgres_changes', { schema: 'public', table: 'game_sessions', event: 'INSERT', filter }, (payload) =>
        onSession(payload.new)
      )
      .on('postgres_changes', { schema: 'public', table: 'game_sessions', event: 'UPDATE', filter }, (payload) =>
        onSession(payload.new)
      )
      .subscribe();
    return () => supabase().removeChannel(channel);
  }

  global.GamesAPI = {
    ApiError,
    playerSlot,
    ensureAuth,
    async userId() {
      return (await ensureAuth()).user.id;
    },
    releaseProfile: () => request('/demo-sessions', { method: 'DELETE' }).catch(() => {}),
    savedProfile: () => readJSON('ig_games_profile'),
    setSavedProfile: (p) => writeJSON('ig_games_profile', p),
    async profiles() {
      await ensureAuth();
      const { data, error } = await supabase()
        .from('profiles')
        .select('id,display_name,avatar_url')
        .order('display_name');
      if (error) throw error;
      return data;
    },
    health: () => fetch(`${cfg().apiBase}/health`).then((r) => r.ok),
    chooseProfile: (profileId) => post('/demo-sessions', { profile_id: profileId }),
    threadRoom: (threadKey, name) =>
      post(`/threads/${encodeURIComponent(threadKey)}/room`, { name }),
    sendGame: (threadKey, name) =>
      post(`/threads/${encodeURIComponent(threadKey)}/games`, {
        name,
        vibe: 'chaos',
        game_type: 'who_sent_this',
        mode: 'async',
      }),
    hydrate: (roomId) => request(`/rooms/${roomId}`),
    timeline: (roomId, before) =>
      request(`/rooms/${roomId}/timeline${before ? `?before=${encodeURIComponent(before)}` : ''}`),
    sendMessage: (roomId, body) => post(`/rooms/${roomId}/messages`, { body }),
    startSession: (roomId) =>
      post(`/rooms/${roomId}/sessions`, { vibe: 'chaos', game_type: 'who_sent_this' }),
    submitResponse: (roundId, value, why) =>
      post(`/rounds/${roundId}/responses`, why ? { value, why } : { value }),
    reveal: (roundId) => post(`/rounds/${roundId}/reveal`),
    advance: (roundId) => post(`/rounds/${roundId}/advance`),
    subscribeRoom,
    watchThreadGames,
  };
})(window);
