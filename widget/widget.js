(function () {
  const cfg = window.SSB_CHAT || {};
  const siteId = cfg.siteId;
  const apiBase = cfg.apiBase || "http://localhost:5000";

  if (!siteId) {
    console.error("[SSB_CHAT] Missing siteId");
    return;
  }

  // Shadow DOM container to avoid CSS collisions
  const host = document.createElement("div");
  host.id = "ssb-chat-host";
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    .btn{position:fixed;right:18px;bottom:18px;z-index:2147483647;
      border:none;border-radius:999px;padding:12px 14px;cursor:pointer;
      font:14px system-ui, -apple-system, Segoe UI, Roboto;}
    .panel{position:fixed;right:18px;bottom:70px;z-index:2147483647;
      width:340px;max-width:calc(100vw - 36px);height:460px;max-height:calc(100vh - 110px);
      border-radius:16px; box-shadow:0 10px 30px rgba(0,0,0,.2); overflow:hidden;
      display:none; background:#fff; border:1px solid rgba(0,0,0,.08);}
    .head{padding:10px 12px; font:600 14px system-ui; border-bottom:1px solid rgba(0,0,0,.08); display:flex; justify-content:space-between; align-items:center;}
    .body{padding:10px 12px; height:360px; overflow:auto; font:13px system-ui;}
    .row{margin:8px 0;}
    .me{ text-align:right; }
    .bubble{display:inline-block; padding:8px 10px; border-radius:12px; max-width:85%; white-space:pre-wrap; }
    .me .bubble{ background:#111; color:#fff; }
    .bot .bubble{ background:#f2f2f2; color:#111; }
    .foot{display:flex; gap:8px; padding:10px 12px; border-top:1px solid rgba(0,0,0,.08);}
    input{flex:1; padding:10px 12px; border-radius:12px; border:1px solid rgba(0,0,0,.15); font:13px system-ui;}
    .send{padding:10px 12px; border-radius:12px; border:none; cursor:pointer; font:600 13px system-ui;}
    .close{border:none;background:transparent;cursor:pointer;font:16px system-ui;}
    .src{margin-top:6px; font-size:11px; opacity:.75;}
    a{color:inherit}
  `;
  shadow.appendChild(style);

  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = cfg.buttonText || "Chat";
  shadow.appendChild(btn);

  const panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = `
    <div class="head">
      <div>${cfg.title || "Support"}</div>
      <button class="close" aria-label="Close">×</button>
    </div>
    <div class="body" id="ssb-body"></div>
    <div class="foot">
      <input id="ssb-input" placeholder="${cfg.placeholder || "Nachricht schreiben..."}" />
      <button class="send" id="ssb-send">Senden</button>
    </div>
  `;
  shadow.appendChild(panel);

  const body = panel.querySelector("#ssb-body");
  const input = panel.querySelector("#ssb-input");
  const send = panel.querySelector("#ssb-send");
  const close = panel.querySelector(".close");

  function addMsg(text, who, sources) {
    const row = document.createElement("div");
    row.className = "row " + who;
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = text;

    row.appendChild(bubble);

    if (who === "bot" && Array.isArray(sources) && sources.length) {
      const src = document.createElement("div");
      src.className = "src";
      const top = sources.slice(0, 3).map(s => {
        const label = s.url ? (s.title || s.url) : (s.title || "Quelle");
        return s.url ? `<a href="${s.url}" target="_blank" rel="noopener">${escapeHtml(label)}</a>` : escapeHtml(label);
      });
      src.innerHTML = `Quellen: ${top.join(" · ")}`;
      row.appendChild(src);
    }

    body.appendChild(row);
    body.scrollTop = body.scrollHeight;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[m]));
  }

  async function sendMsg() {
    const text = (input.value || "").trim();
    if (!text) return;
    input.value = "";

    addMsg(text, "me");

    try {
      const res = await fetch(apiBase + "/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, message: text })
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      addMsg(data.answer || "(keine Antwort)", "bot", data.sources || []);
    } catch (e) {
      addMsg("Fehler beim Verbinden. Bitte später erneut versuchen.", "bot");
      console.error(e);
    }
  }

  btn.addEventListener("click", () => {
    panel.style.display = panel.style.display === "none" || !panel.style.display ? "block" : "none";
    if (panel.style.display === "block" && body.childNodes.length === 0) {
      addMsg(cfg.greeting || "Hi! Wie kann ich helfen?", "bot");
    }
  });
  close.addEventListener("click", () => (panel.style.display = "none"));
  send.addEventListener("click", sendMsg);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMsg();
  });
})();