/* Instagram DM chat interactions */
(function () {
  const threads = {
    "roshan-group": {
      "name": "the group 🍚",
      "status": "Maya, Dev, Sam, Ana, Kofi",
      "avatars": [
        "https://i.pravatar.cc/150?img=47",
        "https://i.pravatar.cc/150?img=12"
      ],
      "messages": [
        {
          "type": "time",
          "text": "Feb 3, 2026"
        },
        {
          "type": "in",
          "text": "🎬 this reel is literally me",
          "avatar": true,
          "name": "Sam"
        },
        {
          "type": "time",
          "text": "Feb 5, 2026"
        },
        {
          "type": "in",
          "text": "the group project guy ghosted us again",
          "avatar": true,
          "name": "Dev"
        },
        {
          "type": "time",
          "text": "Feb 6, 2026"
        },
        {
          "type": "in",
          "text": "my mom just texted 'k' im scared",
          "avatar": true,
          "name": "Ana"
        },
        {
          "type": "time",
          "text": "Feb 14, 2026"
        },
        {
          "type": "in",
          "text": "kofi said the rice cooker has a name and it's 'mama' i'm crying",
          "avatar": true,
          "name": "Ana"
        },
        {
          "type": "time",
          "text": "Mar 1, 2026"
        },
        {
          "type": "in",
          "text": "the weather cannot make up its mind",
          "avatar": true,
          "name": "Maya"
        },
        {
          "type": "time",
          "text": "Mar 17, 2026"
        },
        {
          "type": "in",
          "text": "📷 who stole the traffic cone from outside",
          "avatar": true,
          "name": "Kofi"
        },
        {
          "type": "time",
          "text": "Mar 21, 2026"
        },
        {
          "type": "in",
          "text": "why do people send venmo requests for $2",
          "avatar": true,
          "name": "Sam"
        },
        {
          "type": "time",
          "text": "Mar 27, 2026"
        },
        {
          "type": "in",
          "text": "🎬 i've watched this reel 30 times",
          "avatar": true,
          "name": "Dev"
        },
        {
          "type": "time",
          "text": "Apr 21, 2026"
        },
        {
          "type": "in",
          "text": "someone come to target with me",
          "avatar": true,
          "name": "Ana"
        }
      ]
    },
    "mario-kart": {
      "name": "mario kart council 🏎️",
      "status": "Dev, Kofi, Ana",
      "avatars": [
        "https://i.pravatar.cc/150?img=12",
        "https://i.pravatar.cc/150?img=59"
      ],
      "messages": [
        {
          "type": "time",
          "text": "Jan 2, 2026"
        },
        {
          "type": "in",
          "text": "a blue shell on the final lap should be illegal",
          "avatar": true,
          "name": "Dev"
        },
        {
          "type": "time",
          "text": "Jan 16, 2026"
        },
        {
          "type": "in",
          "text": "dev plays mario kart like he has a gambling addiction",
          "avatar": true,
          "name": "Ana"
        },
        {
          "type": "time",
          "text": "Feb 3, 2026"
        },
        {
          "type": "in",
          "text": "we need a mario kart rematch this is not over",
          "avatar": true,
          "name": "Kofi"
        },
        {
          "type": "time",
          "text": "Feb 9, 2026"
        },
        {
          "type": "in",
          "text": "the mario kart beef is back on, kofi said something about my kart",
          "avatar": true,
          "name": "Dev"
        },
        {
          "type": "time",
          "text": "Mar 1, 2026"
        },
        {
          "type": "in",
          "text": "dev still hasn't recovered from the rainbow road incident",
          "avatar": true,
          "name": "Ana"
        },
        {
          "type": "time",
          "text": "Mar 5, 2026"
        },
        {
          "type": "in",
          "text": "mario kart night got so heated the RA came up",
          "avatar": true,
          "name": "Kofi"
        }
      ]
    },
    "lisbon": {
      "name": "Maya & Sam",
      "status": "Maya, Sam",
      "avatars": [
        "https://i.pravatar.cc/150?img=47",
        "https://i.pravatar.cc/150?img=15"
      ],
      "messages": [
        {
          "type": "time",
          "text": "Jul 18, 2025"
        },
        {
          "type": "in",
          "text": "lisbon has me thinking abt dropping out and selling sardines",
          "avatar": true,
          "name": "Maya"
        },
        {
          "type": "time",
          "text": "Jul 20, 2025"
        },
        {
          "type": "in",
          "text": "bffr you are not selling sardines in lisbon",
          "avatar": true,
          "name": "Sam"
        },
        {
          "type": "in",
          "text": "the lisbon hostel ppl adopted me im their emotional support american",
          "avatar": true,
          "name": "Maya"
        },
        {
          "type": "time",
          "text": "Jul 21, 2025"
        },
        {
          "type": "in",
          "text": "last night in lisbon im gonna cry",
          "avatar": true,
          "name": "Maya"
        },
        {
          "type": "time",
          "text": "Jul 24, 2025"
        },
        {
          "type": "in",
          "text": "flight home from lisbon delayed 6 hrs. portugal doesn't want me to leave fr",
          "avatar": true,
          "name": "Maya"
        },
        {
          "type": "in",
          "text": "u better bring me back a pastel de nata from portugal or dont come back at all",
          "avatar": true,
          "name": "Sam"
        }
      ]
    },
    "f1-club": {
      "name": "5am f1 club 🏁",
      "status": "Dev, Riya",
      "avatars": [
        "https://i.pravatar.cc/150?img=12",
        "https://i.pravatar.cc/150?img=49"
      ],
      "messages": [
        {
          "type": "time",
          "text": "Today"
        },
        {
          "type": "in",
          "text": "made this so we stop spamming the main chat about f1",
          "avatar": true,
          "name": "Dev"
        }
      ]
    }
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
  function openThread(id) {
    const data = threads[id];
    if (!data) return;

    activeId = id;
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
  }

  function renderMessages(list) {
    messagesEl.innerHTML = list.map(messageHTML).join('');
    messagesEl.querySelectorAll('.gp-invite, .gm-result').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.dispatchEvent(
          new CustomEvent('dm:play-game', {
            detail: {
              threadId: activeId,
              roomId: btn.dataset.room,
              roundId: btn.dataset.round || null,
              sessionId: btn.dataset.session || null,
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

    if (msg.type === 'gm') {
      return `
        <div class="dm-row in gm-row">
          <span class="gm-av" aria-hidden="true">✦</span>
          <div class="dm-bubble-col">
            <span class="dm-sender">Game master</span>
            <div class="dm-bubble in gm-bubble">${escapeHtml(msg.text)}</div>
          </div>
        </div>`;
    }

    if (msg.type === 'gm-result') {
      return `
        <div class="dm-row gm-result-row">
          <button type="button" class="gm-result" data-room="${escapeHtml(msg.roomId || '')}" data-round="${escapeHtml(msg.roundId || '')}" data-session="${escapeHtml(msg.sessionId || '')}">
            <span class="gm-result-label">${escapeHtml(msg.label)}</span>
            <strong>${escapeHtml(msg.title)}</strong>
            ${msg.sub ? `<span class="gm-result-sub">${escapeHtml(msg.sub)}</span>` : ''}
          </button>
        </div>`;
    }

    if (msg.type === 'sys') {
      return `<div class="dm-time gm-sys">${escapeHtml(msg.text)}</div>`;
    }

    if (msg.type === 'game-invite') {
      const side = msg.from === 'in' ? 'in' : 'out';
      return `
        <div class="dm-row ${side}">
          <button type="button" class="gp-invite ${msg.action === 'Play' ? 'm-ready' : ''}" data-room="${escapeHtml(msg.roomId || '')}" data-session="${escapeHtml(msg.sessionId || '')}" data-host="${msg.isHost ? '1' : '0'}">
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

    // Seeded history is written from the group's side; whoever this phone plays as sees their own lines as sent.
    const mine = msg.type === 'out' || (msg.name && msg.name === window.DMChat?.me);
    const side = mine ? 'out' : 'in';
    const face = msg.avatarUrl || window.GAMES_CONFIG?.avatars?.[msg.name] || threads[activeId].avatars[0];
    const avatar =
      side === 'in' && msg.avatar
        ? `<img class="dm-msg-avatar" src="${escapeHtml(face)}" alt="">`
        : side === 'in'
          ? `<span class="dm-msg-avatar spacer"></span>`
          : '';

    return `
      <div class="dm-row ${side}">
        ${avatar}
        <div class="dm-bubble-col">
          ${msg.name && !mine ? `<span class="dm-sender">${escapeHtml(msg.name)}</span>` : ''}
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

  function appendOutgoing(text) {
    if (!activeId) return;
    const data = threads[activeId];
    clearReceipts(data);
    data.messages.push({ type: 'out', text, seen: true, receipt: 'Delivered' });
    renderMessages(data.messages);
    messagesEl.scrollTop = messagesEl.scrollHeight;

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
      openThread('roshan-group');
    });
  }

  if (backBtn) {
    backBtn.addEventListener('click', closeThread);
  }

  composer.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || !activeId) return;
    // When the chat has a live room, the games layer posts it and it comes back as a timeline event
    // (one feed for messages, game master lines and results: see chatEvent in games-ui.js).
    if (!window.DMChat.sendHook?.(text)) appendOutgoing(text);
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
      if (msg.eventId && data.messages.some((m) => m.eventId === msg.eventId)) return;
      if (msg.type === 'out') clearReceipts(data);
      data.messages.push(msg);
      renderMessages(data.messages);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      const thread = document.querySelector(`.dm-thread[data-thread="${activeId}"]`);
      if (thread) {
        const preview = thread.querySelector('.preview');
        if (preview) {
          preview.textContent =
            msg.type === 'game-invite'
              ? `Game: ${msg.title || 'Chaos'}`
              : msg.type === 'out'
                ? `You: ${msg.text}`
                : msg.type === 'in'
                  ? `${msg.name ? `${msg.name}: ` : ''}${msg.text}`
                  : preview.textContent;
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
