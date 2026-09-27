/**
 * Motion layer for the Chaos game screens. games-ui.js repaints with innerHTML, so everything here
 * runs after a paint: entrances on a new screen, feedback on a reveal, and small touches on picks.
 * Borrowed from the app_view feel (spring pops, win burst, miss shake, pulsing waits), kept light.
 */
(function () {
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SPRING = 'cubic-bezier(.34,1.56,.64,1)';
  const BURST = ['#3797f0', '#5ec4ff', '#2563eb', '#ffc83d', '#ff5fa2'];
  let lastPick = null;
  let celebrated = new Set();

  // Stagger children so a new screen builds in top to bottom instead of snapping.
  function stagger(root) {
    const groups = [
      root.querySelectorAll('.g-scroll > *'),
      root.querySelectorAll('.g-people > *, .g-scenes > *, .g-rows > *'),
      root.querySelectorAll('.g-board-row'),
      root.querySelectorAll('.g-recap-row'),
      root.querySelectorAll('.g-group, .g-said'),
    ];
    for (const list of groups) list.forEach((el, i) => el.style.setProperty('--i', i));
  }

  function burst(root, from) {
    const box = root.getBoundingClientRect();
    const at = from.getBoundingClientRect();
    const x = at.left - box.left + at.width / 2;
    const y = at.top - box.top + at.height / 2;
    for (let i = 0; i < 22; i++) {
      const dot = document.createElement('i');
      dot.className = 'm-spark';
      dot.style.left = `${x}px`;
      dot.style.top = `${y}px`;
      dot.style.background = BURST[i % BURST.length];
      root.appendChild(dot);
      const angle = (Math.PI * 2 * i) / 22 + Math.random() * 0.3;
      const dist = 70 + Math.random() * 90;
      dot
        .animate(
          [
            { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
            {
              transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist + 40}px)) scale(.3)`,
              opacity: 0,
            },
          ],
          { duration: 900 + Math.random() * 300, easing: 'cubic-bezier(.2,.7,.3,1)' }
        )
        .finished.then(() => dot.remove(), () => dot.remove());
    }
  }

  function countUp(el) {
    const m = el.textContent.match(/^(\d+)(.*)$/);
    if (!m || m[1] === '0') return;
    const end = Number(m[1]);
    const rest = m[2];
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / 700);
      el.textContent = `${Math.round(end * (1 - Math.pow(1 - t, 3)))}${rest}`;
      if (t < 1) requestAnimationFrame(step);
    };
    el.textContent = `0${rest}`;
    requestAnimationFrame(step);
  }

  function celebrate(root, key, mood) {
    // Once per reveal per tab: coming back to the same results screen shouldn't re-fire it.
    if (!mood || celebrated.has(key)) return;
    celebrated.add(key);
    const title = root.querySelector('.g-reveal-title');
    if (mood === 'miss') {
      title?.animate(
        [0, -10, 10, -10, 10, -6, 6, 0].map((x) => ({ transform: `translateX(${x}px)` })),
        { duration: 420, easing: 'ease-in-out' }
      );
      navigator.vibrate?.(40);
      return;
    }
    const anchor = root.querySelector('.g-said.is-best, .g-winner') || title;
    if (anchor) setTimeout(() => burst(root, anchor), 180);
    title?.classList.add('m-gold');
    navigator.vibrate?.([12, 50, 12]);
  }

  function painted(root, { key, changed, mood }) {
    root.querySelectorAll('.g-said').forEach((el) => {
      if (el.querySelector('.g-best')) el.classList.add('is-best');
    });
    if (!changed) root.classList.remove('m-enter');
    if (reduced()) return;
    if (changed) {
      stagger(root);
      root.classList.remove('m-enter');
      void root.offsetWidth;
      root.classList.add('m-enter');
      if (key.startsWith('s:')) root.querySelectorAll('.g-pts').forEach(countUp);
    }
    if (key.startsWith('r:') || key.startsWith('s:')) celebrate(root, key, mood);
    if (lastPick) {
      const el = root.querySelector(`[data-pick="${CSS.escape(lastPick)}"].on`);
      el?.animate([{ transform: 'scale(.92)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' }], {
        duration: 360,
        easing: SPRING,
      });
      lastPick = null;
    }
  }

  document.addEventListener(
    'click',
    (e) => {
      const pick = e.target.closest?.('[data-pick]');
      if (pick) {
        lastPick = pick.dataset.pick;
        navigator.vibrate?.(8);
      }
    },
    true
  );

  // Invites in the chat: the ones waiting on you get a glow so they stand out from finished games.
  function markInvites(scope) {
    scope.querySelectorAll?.('.gp-invite').forEach((btn) => {
      const text = btn.querySelector('.gp-invite-meta span')?.textContent || '';
      btn.classList.toggle('m-turn', /your turn/i.test(text));
    });
  }
  function watchChat() {
    const chat = document.getElementById('chat-messages');
    if (!chat) return;
    markInvites(chat);
    new MutationObserver(() => markInvites(chat)).observe(chat, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchChat);
  else watchChat();

  window.GameMotion = { painted };
})();
