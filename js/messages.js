/* Instagram DM chat interactions */
(function () {
  const threads = {
    ridham: {
      name: 'Ridham Ohri',
      status: 'Active 41m ago',
      avatars: ['https://i.pravatar.cc/150?img=11'],
      messages: [
        { type: 'time', text: '10/16/25, 10:47 PM' },
        { type: 'in', text: "Bru idek if I'm gonna go atp 😭", avatar: true },
        { type: 'out', text: 'Ay make tomorrow a first' },
        { type: 'in', text: 'Lmao no way', reaction: '❤️', avatar: true },
        { type: 'time', text: 'Yesterday, 9:12 PM' },
        {
          type: 'story-reply',
          label: "Replied to Ridham Ohri's story",
          story: 'Story unavailable',
          text: 'At work',
        },
        { type: 'in', text: 'Fair fair', avatar: true },
        { type: 'out', text: 'Call me when you land', seen: true },
      ],
    },
    'roshan-group': {
      name: 'Roshan Ram and Shrey Desai',
      status: 'Roshan Ram is active',
      avatars: [
        'https://i.pravatar.cc/150?img=20',
        'https://i.pravatar.cc/150?img=32',
      ],
      messages: [
        { type: 'time', text: 'Today, 11:04 AM' },
        {
          type: 'out-media',
          media: 'https://images.unsplash.com/photo-1635805737707-575885ab0820?w=600&h=900&fit=crop',
          caption: 'this edit goes crazy',
        },
        {
          type: 'out-media',
          media: 'https://images.unsplash.com/photo-1556157382-97eda2d62296?w=600&h=900&fit=crop',
          seenBy: 'Seen by Roshan Ram',
        },
      ],
    },
    chris: {
      name: 'Chris Park',
      status: 'Active now',
      avatars: ['https://i.pravatar.cc/150?img=33'],
      messages: [
        { type: 'time', text: 'Yesterday, 6:20 PM' },
        { type: 'in', text: 'You free later?', avatar: true },
        { type: 'out', text: 'Yeah after 8' },
        { type: 'in', text: 'Bet', reaction: '😂', avatar: true },
        { type: 'out', text: 'Pull up to the spot', seen: true },
      ],
    },
    veer: {
      name: 'Veer Dabbi',
      status: 'Active 1h ago',
      avatars: ['https://i.pravatar.cc/150?img=52'],
      messages: [
        { type: 'time', text: 'Monday, 4:03 PM' },
        { type: 'out', text: 'Gym today?' },
        { type: 'in', text: 'Already here 💪', avatar: true },
        {
          type: 'out-media',
          media: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&h=800&fit=crop',
          seen: true,
        },
      ],
    },
    ananya: {
      name: 'Ananya Sharma',
      status: 'Active yesterday',
      avatars: ['https://i.pravatar.cc/150?img=47'],
      messages: [
        { type: 'time', text: 'Sunday, 7:45 PM' },
        { type: 'in', text: 'See you at 7?', avatar: true },
        { type: 'out', text: 'Yes — cafe on Main?' },
        { type: 'in', text: 'Perfect', avatar: true },
      ],
    },
    ram: {
      name: 'Ram Bontha',
      status: 'Active now',
      avatars: ['https://i.pravatar.cc/150?img=12'],
      messages: [
        { type: 'time', text: 'Saturday, 2:11 PM' },
        { type: 'out', text: 'Bro that note 🔥' },
        { type: 'in', text: 'Current obsession is real', avatar: true },
      ],
    },
    'group-shourya': {
      name: 'Anyone but Shourya',
      status: 'Active 3h ago',
      avatars: [
        'https://i.pravatar.cc/150?img=15',
        'https://i.pravatar.cc/150?img=25',
      ],
      messages: [
        { type: 'time', text: 'Today, 9:01 AM' },
        { type: 'in', text: 'Who is bringing snacks?', avatar: true, name: 'Ayaan' },
        { type: 'out', text: 'I got chips' },
        { type: 'in', text: 'Legend', avatar: true, name: 'Kabir' },
      ],
    },
    founders: {
      name: 'Startup founders',
      status: 'Mia Chen is active',
      avatars: [
        'https://i.pravatar.cc/150?img=5',
        'https://i.pravatar.cc/150?img=41',
      ],
      messages: [
        { type: 'time', text: 'Friday, 1:20 PM' },
        { type: 'in', text: 'deck looks good', avatar: true, name: 'Mia' },
        { type: 'out', text: 'Ship notes tonight?' },
        { type: 'in', text: 'Yes', avatar: true, name: 'Alex' },
      ],
    },
  };

  const emptyEl = document.getElementById('dm-empty');
  const chatEl = document.getElementById('dm-chat');
  const messagesEl = document.getElementById('chat-messages');
  const nameEl = document.getElementById('chat-name');
  const statusEl = document.getElementById('chat-status');
  const avatarsEl = document.getElementById('chat-avatars');
  const composer = document.getElementById('dm-composer');
  const input = document.getElementById('composer-input');
  const sendBtn = document.getElementById('composer-send');
  const rightIcons = document.querySelector('.composer-right');
  const cta = document.getElementById('dm-send-cta');
  const phoneShell = document.getElementById('phone-shell');
  const backBtn = document.getElementById('dm-back');

  let activeId = null;
  let activeRoomId = null;
  let stopMessageWatch = null;

  function timelineMessage(row) {
    const payload = row.payload || row.data || row.metadata || {};
    const body = row.body || payload.body || payload.text;
    if (!body || row.event_type === 'game_invite' || payload.event_type === 'game_invite') return null;
    const profileId = row.profile_id || payload.profile_id;
    const ownProfileId = window.GamesAPI?.savedProfile?.()?.id;
    return {
      id: row.id,
      type: profileId && profileId === ownProfileId ? 'out' : 'in',
      text: body,
      avatar: profileId !== ownProfileId,
      name: row.display_name || payload.display_name,
    };
  }

  function addRemoteMessage(row) {
    const message = timelineMessage(row);
    if (!message || !activeId) return;
    const data = threads[activeId];
    if (message.id && data.messages.some((item) => item.id === message.id)) return;
    const pending = data.messages.find(
      (item) => !item.id && item.type === 'out' && item.text === message.text
    );
    if (pending) {
      pending.id = message.id;
      return;
    }
    data.messages.push(message);
    renderMessages(data.messages);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function syncThreadMessages(id) {
    const api = window.GamesAPI;
    if (!api) return;
    try {
      const room = await api.threadRoom(id, threads[id].name);
      if (activeId !== id) return;
      activeRoomId = room.id;
      stopMessageWatch = api.watchThreadMessages(room.id, addRemoteMessage);
      const timeline = await api.timeline(room.id);
      const rows = timeline?.events || timeline?.timeline || timeline?.items || timeline || [];
      rows.map(timelineMessage).filter(Boolean).forEach((message) => {
        if (!message.id || !threads[id].messages.some((item) => item.id === message.id)) {
          threads[id].messages.push(message);
        }
      });
      renderMessages(threads[id].messages);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    } catch (error) {
      console.warn('Could not sync chat messages:', error);
    }
  }

  function openThread(id) {
    const data = threads[id];
    if (!data) return;

    activeId = id;
    stopMessageWatch?.();
    stopMessageWatch = null;
    activeRoomId = null;
    if (emptyEl) emptyEl.classList.add('hidden');
    chatEl.classList.remove('hidden');
    phoneShell?.classList.add('chat-open');

    document.querySelectorAll('.dm-thread').forEach((t) => {
      t.classList.toggle('active', t.dataset.thread === id);
      if (t.dataset.thread === id) {
        t.classList.remove('unread');
        const dot = t.querySelector('.unread-dot');
        if (dot) dot.remove();
      }
    });

    nameEl.textContent = data.name;
    statusEl.textContent = data.status;
    avatarsEl.className =
      'dm-chat-avatars' + (data.avatars.length > 1 ? ' stacked' : '');
    avatarsEl.innerHTML = data.avatars
      .map((src) => `<img src="${src}" alt="">`)
      .join('');

    renderMessages(data.messages);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    input.focus();
    document.dispatchEvent(
      new CustomEvent('dm:thread-open', { detail: { threadId: id, thread: data } })
    );
    syncThreadMessages(id);
  }

  function closeThread() {
    const prev = activeId;
    activeId = null;
    chatEl.classList.add('hidden');
    phoneShell?.classList.remove('chat-open');
    document.querySelectorAll('.dm-thread').forEach((t) => t.classList.remove('active'));
    document.dispatchEvent(
      new CustomEvent('dm:thread-close', { detail: { threadId: prev } })
    );
    stopMessageWatch?.();
    stopMessageWatch = null;
    activeRoomId = null;
  }

  function renderMessages(list) {
    messagesEl.innerHTML = list.map(messageHTML).join('');
    messagesEl.querySelectorAll('.gp-invite').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.dispatchEvent(
          new CustomEvent('dm:play-game', {
            detail: {
              threadId: activeId,
              roomId: btn.dataset.room,
              isHost: btn.dataset.host === '1',
            },
          })
        );
      });
    });
  }

  function messageHTML(msg) {
    if (msg.type === 'time') {
      return `<div class="dm-time">${escapeHtml(msg.text)}</div>`;
    }

    if (msg.type === 'story-reply') {
      return `
        <div class="dm-row out">
          <div class="dm-story-reply">
            <span class="story-label">${escapeHtml(msg.label)}</span>
            <div class="story-box">${escapeHtml(msg.story)}</div>
            <div class="dm-bubble out">${escapeHtml(msg.text)}</div>
          </div>
        </div>`;
    }

    if (msg.type === 'out-media') {
      return `
        <div class="dm-row out">
          <div class="dm-media-wrap">
            <div class="dm-media-actions">
              <button type="button" title="More">⋯</button>
              <button type="button" title="Reply">↩</button>
              <button type="button" title="React">☺</button>
            </div>
            <div class="dm-media">
              <img src="${msg.media}" alt="">
              ${msg.caption ? `<p>${escapeHtml(msg.caption)}</p>` : ''}
            </div>
            ${
              msg.seenBy
                ? `<div class="dm-seen">${escapeHtml(msg.seenBy)}</div>`
                : msg.seen
                  ? `<div class="dm-seen">${escapeHtml(msg.receipt || 'Seen')}</div>`
                  : ''
            }
          </div>
        </div>`;
    }

    if (msg.type === 'game-invite') {
      const side = msg.from === 'in' ? 'in' : 'out';
      return `
        <div class="dm-row ${side}">
          <button type="button" class="gp-invite" data-room="${escapeHtml(msg.roomId || '')}" data-host="${msg.isHost ? '1' : '0'}">
            <div class="gp-invite-art" aria-hidden="true">
              <img src="./images/chaos-logo-blue.svg" alt="">
            </div>
            <div class="gp-invite-meta">
              <strong>${escapeHtml(msg.title || 'Chaos')}</strong>
              <span>${escapeHtml(msg.subtitle || 'Tap to play')}</span>
            </div>
            <span class="gp-play">${escapeHtml(msg.action || 'Play')}</span>
          </button>
        </div>`;
    }

    const side = msg.type === 'out' ? 'out' : 'in';
    const avatar =
      side === 'in' && msg.avatar
        ? `<img class="dm-msg-avatar" src="${
            threads[activeId].avatars[0]
          }" alt="">`
        : side === 'in'
          ? `<span class="dm-msg-avatar spacer"></span>`
          : '';

    return `
      <div class="dm-row ${side}">
        ${avatar}
        <div class="dm-bubble-col">
          ${msg.name ? `<span class="dm-sender">${escapeHtml(msg.name)}</span>` : ''}
          <div class="dm-bubble ${side}">${escapeHtml(msg.text)}</div>
          ${
            msg.reaction
              ? `<span class="dm-reaction">${msg.reaction}</span>`
              : ''
          }
          ${
            msg.seen
              ? `<div class="dm-seen">${escapeHtml(msg.receipt || 'Seen')}</div>`
              : ''
          }
        </div>
      </div>`;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function clearReceipts(data) {
    data.messages.forEach((msg) => {
      delete msg.seen;
      delete msg.seenBy;
    });
  }

  async function appendOutgoing(text) {
    if (!activeId) return;
    const data = threads[activeId];
    clearReceipts(data);
    const localMessage = { type: 'out', text, seen: true, receipt: 'Delivered' };
    data.messages.push(localMessage);
    renderMessages(data.messages);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    const api = window.GamesAPI;
    if (!api || !activeRoomId) return;
    try {
      await api.sendMessage(activeRoomId, text);
    } catch (error) {
      data.messages = data.messages.filter((message) => message !== localMessage);
      renderMessages(data.messages);
      console.warn('Could not send chat message:', error);
    }

    const thread = document.querySelector(`.dm-thread[data-thread="${activeId}"]`);
    if (thread) {
      const preview = thread.querySelector('.preview');
      if (preview) preview.textContent = `You: ${text}`;
    }
  }

  function syncComposer() {
    const hasText = input.value.trim().length > 0;
    sendBtn.classList.toggle('hidden', !hasText);
    rightIcons.classList.toggle('typing', hasText);
  }

  document.querySelectorAll('.dm-thread').forEach((thread) => {
    thread.addEventListener('click', (e) => {
      e.preventDefault();
      openThread(thread.dataset.thread);
    });
  });

  if (cta) {
    cta.addEventListener('click', (e) => {
      e.preventDefault();
      openThread('ridham');
    });
  }

  if (backBtn) {
    backBtn.addEventListener('click', closeThread);
  }

  composer.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || !activeId) return;
    await appendOutgoing(text);
    input.value = '';
    syncComposer();
  });

  input.addEventListener('input', syncComposer);

  // Keep composer icons interactive without side effects for now
  document
    .querySelector('.composer-right .composer-icon[title="Sticker"]')
    ?.addEventListener('click', () => {
      if (!activeId) return;
      appendOutgoing('😊');
    });

  window.DMChat = {
    getActiveThreadId: () => activeId,
    getActiveThread: () => (activeId ? threads[activeId] : null),
    openThread,
    closeThread,
    appendMessage(msg) {
      if (!activeId) return;
      const data = threads[activeId];
      data.messages.push(msg);
      renderMessages(data.messages);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      const thread = document.querySelector(`.dm-thread[data-thread="${activeId}"]`);
      if (thread) {
        const preview = thread.querySelector('.preview');
        if (preview) {
          preview.textContent =
            msg.type === 'game-invite' ? `Game: ${msg.title || 'Chaos'}` : preview.textContent;
        }
      }
    },
    refresh() {
      if (!activeId) return;
      renderMessages(threads[activeId].messages);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    },
    setMessagesContainerMode(mode) {
      messagesEl.dataset.mode = mode || 'chat';
    },
  };
})();
