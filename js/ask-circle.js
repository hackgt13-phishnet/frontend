(() => {
  const EXAMPLES = [
    "Who knows good cafes in Kyoto that locals actually go to?",
    "I want to join an ML or coding club on campus — who should I ask?",
    "Who can recommend cheap vegan lunches near NYU?",
    "Looking for someone who's surfed in Portugal and knows beginner spots",
  ];

  const overlay = document.createElement("div");
  overlay.className = "ask-circle-overlay";
  overlay.id = "ask_circle_overlay";
  overlay.innerHTML = `
    <div class="ask-circle-panel" role="dialog" aria-modal="true" aria-labelledby="ask_circle_title">
      <div class="ask-circle-header">
        <div>
          <h2 id="ask_circle_title">Ask your circle</h2>
          <p>Get closer by asking for something only they can give — powered by Muse.</p>
        </div>
        <button type="button" class="ask-circle-close" aria-label="Close">&times;</button>
      </div>
      <div class="ask-circle-body">
        <form class="ask-circle-form" id="ask_circle_form">
          <label for="ask_circle_query">What do you need help with?</label>
          <textarea id="ask_circle_query" placeholder="e.g. Who knows quiet temples in Kyoto after 4pm?" required></textarea>
          <div class="ask-examples" id="ask_examples"></div>
          <button class="ask-submit" type="submit" id="ask_submit">Find people</button>
        </form>
        <div class="ask-status" id="ask_status" hidden></div>
        <div class="ask-summary" id="ask_summary" hidden></div>
        <div class="ask-matches" id="ask_matches"></div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const toast = document.createElement("div");
  toast.className = "ask-toast";
  toast.id = "ask_toast";
  document.body.appendChild(toast);

  const fab = document.createElement("button");
  fab.type = "button";
  fab.className = "ask-circle-fab";
  fab.id = "ask_circle_fab";
  fab.innerHTML = `<span class="fab-spark" aria-hidden="true"></span><span>Ask your circle</span>`;
  document.body.appendChild(fab);

  const examplesEl = document.getElementById("ask_examples");
  EXAMPLES.forEach((text) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = text.length > 42 ? text.slice(0, 40) + "…" : text;
    btn.title = text;
    btn.addEventListener("click", () => {
      document.getElementById("ask_circle_query").value = text;
    });
    examplesEl.appendChild(btn);
  });

  const form = document.getElementById("ask_circle_form");
  const statusEl = document.getElementById("ask_status");
  const summaryEl = document.getElementById("ask_summary");
  const matchesEl = document.getElementById("ask_matches");
  const submitBtn = document.getElementById("ask_submit");

  function openPanel() {
    overlay.classList.add("open");
    document.getElementById("ask_circle_query").focus();
  }

  function closePanel() {
    overlay.classList.remove("open");
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2200);
  }

  fab.addEventListener("click", openPanel);
  overlay.querySelector(".ask-circle-close").addEventListener("click", closePanel);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closePanel();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("open")) closePanel();
  });

  // Optional: also wire a nav item if present
  const navAsk = document.getElementById("ask_circle_nav");
  if (navAsk) navAsk.addEventListener("click", (e) => {
    e.preventDefault();
    openPanel();
  });

  function renderMatches(data) {
    matchesEl.innerHTML = "";
    const matches = data.matches || [];
    if (!matches.length) {
      statusEl.hidden = false;
      statusEl.classList.add("error");
      statusEl.textContent =
        data.summary || "No strong matches — try a more specific favor.";
      return;
    }

    if (data.summary) {
      summaryEl.hidden = false;
      const mode = data.mode === "muse" ? "muse" : "local";
      const pill =
        mode === "muse"
          ? '<span class="ask-mode-pill muse">Muse</span>'
          : '<span class="ask-mode-pill">Local demo</span>';
      summaryEl.innerHTML = `${escapeHtml(data.summary)} ${pill}`;
    }

    matches.forEach((m) => {
      const card = document.createElement("article");
      card.className = "ask-match-card";
      const reasons = (m.reasons || [])
        .map((r) => `<li>${escapeHtml(r)}</li>`)
        .join("");
      const evidence = (m.evidence || [])
        .map(
          (ev) =>
            `<div class="ask-evidence-item"><strong>${escapeHtml(
              ev.type || "signal"
            )}</strong>${escapeHtml(ev.text || "")}</div>`
        )
        .join("");
      const scorePct = Math.round((Number(m.score) || 0) * 100);
      card.innerHTML = `
        <div class="ask-match-top">
          <img src="${escapeAttr(m.avatar || "")}" alt="">
          <div class="ask-match-meta">
            <div class="name">${escapeHtml(m.display_name || "")}</div>
            <div class="username">@${escapeHtml(m.username || "")}</div>
          </div>
          <div class="ask-score">${scorePct}% match</div>
        </div>
        <ul class="ask-reasons">${reasons}</ul>
        <div class="ask-evidence">${evidence}</div>
        <div class="ask-draft">
          <label>Suggested ask (Ben Franklin)</label>
          <textarea>${escapeHtml(m.draft_ask || "")}</textarea>
          <div class="ask-draft-actions">
            <button type="button" class="primary copy-ask">Copy DM</button>
            <button type="button" class="ghost open-messages">Open Messages</button>
          </div>
        </div>
      `;
      card.querySelector(".copy-ask").addEventListener("click", async () => {
        const text = card.querySelector("textarea").value;
        try {
          await navigator.clipboard.writeText(text);
          showToast("Ask copied — send it to get closer");
        } catch {
          showToast("Could not copy — select the text manually");
        }
      });
      card.querySelector(".open-messages").addEventListener("click", () => {
        window.location.href = "./messages.html";
      });
      matchesEl.appendChild(card);
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const query = document.getElementById("ask_circle_query").value.trim();
    if (!query) return;

    submitBtn.disabled = true;
    statusEl.hidden = false;
    statusEl.classList.remove("error");
    statusEl.textContent = "Muse is scanning your circle…";
    summaryEl.hidden = true;
    matchesEl.innerHTML = "";

    try {
      const res = await fetch("/api/ask-circle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok && data.error && !data.matches) {
        throw new Error(data.error);
      }
      statusEl.hidden = true;
      renderMatches(data);
      if (data.error) {
        statusEl.hidden = false;
        statusEl.classList.remove("error");
        statusEl.textContent = `Note: ${data.error} — showing fallback matches.`;
      }
    } catch (err) {
      statusEl.hidden = false;
      statusEl.classList.add("error");
      statusEl.textContent =
        err.message ||
        "Could not reach Ask Circle API. Start the server: python server/app.py";
    } finally {
      submitBtn.disabled = false;
    }
  });

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, "&#39;");
  }
})();
