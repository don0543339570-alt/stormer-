(function () {
  const { esc, fmt } = Site;
  const LS = "price-settings-conn";
  const form = document.getElementById("connect");
  const editor = document.getElementById("editor");
  const statusEl = document.getElementById("status");
  let conn = null, data = null, sha = null, dirty = false;

  const status = (msg, kind = "ok") => { statusEl.innerHTML = msg ? `<div class="flash ${kind}">${msg}</div>` : ""; };
  const periods = ["yr", "mo", "once"];

  function b64decode(b64) {
    const bin = atob(b64.replace(/\s/g, ""));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  }
  function b64encode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  const apiUrl = () => `https://api.github.com/repos/${encodeURIComponent(conn.owner)}/${encodeURIComponent(conn.repo)}/contents/${conn.path.split("/").map(encodeURIComponent).join("/")}`;
  const headers = () => {
    const h = { Accept: "application/vnd.github+json" };
    if (conn.token) h.Authorization = "Bearer " + conn.token;
    return h;
  };

  function initForm() {
    const saved = JSON.parse(localStorage.getItem(LS) || "null") || {};
    const C = Site.config;
    form.owner.value = saved.owner || C.githubOwner || "";
    form.repo.value = saved.repo || C.githubRepo || "";
    form.branch.value = saved.branch || C.githubBranch || "main";
    form.path.value = saved.path || C.pricesPath || "prices.json";
    form.token.value = saved.token || "";
  }

  async function load() {
    conn = { owner: form.owner.value.trim(), repo: form.repo.value.trim(), branch: form.branch.value.trim(), path: form.path.value.trim(), token: form.token.value.trim() };
    if (form.remember.checked) localStorage.setItem(LS, JSON.stringify(conn));
    status("Loading…");
    try {
      const r = await fetch(apiUrl() + "?ref=" + encodeURIComponent(conn.branch) + "&t=" + Date.now(), { headers: headers(), cache: "no-store" });
      if (r.status === 404) {
        sha = null;
        data = await (await fetch("prices.json?t=" + Date.now())).json();
        status(conn.token ? "prices.json was not found in the repo (or the token can't see it). Saving will create it." : "Repo not found. If it is private, add a token.", "error");
      } else if (!r.ok) {
        const msg = (await r.json().catch(() => ({}))).message || r.status;
        if (conn.token) throw new Error(msg);
        sha = null;
        data = await Site.loadData();
        status("Prices loaded in read-only mode. Add a token to save changes.", "error");
      } else {
        const j = await r.json();
        sha = j.sha;
        data = JSON.parse(b64decode(j.content));
        status(conn.token ? "Prices loaded. Edit below, then click <b>Save to GitHub</b>." : "Prices loaded in read-only mode. Add a token to save changes.", conn.token ? "ok" : "error");
      }
      dirty = false;
      draw();
    } catch (e) {
      status("Could not load prices: " + esc(e.message), "error");
    }
  }

  function field(label, path, value, cls = "", type = "text") {
    return `<label class="${cls}">${label}<input data-path="${path}" data-type="${type}" value="${esc(value)}" ${type === "number" ? 'inputmode="decimal"' : ""}></label>`;
  }

  function draw() {
    const cur = esc(data.settings.currency_symbol || "₵");
    const groupsOrder = data.groups.map((g) => g.key);
    const cats = data.categories.map((c, i) => ({ c, i })).sort((a, b) => groupsOrder.indexOf(a.c.group) - groupsOrder.indexOf(b.c.group));
    editor.innerHTML = `
      <nav class="jump"><a href="#bulk">Set all</a><a href="#domains">Domains</a>${cats.map(({ c, i }) => `<a href="#cat-${i}">${esc(c.name)}</a>`).join("")}<a href="#site">Site details</a></nav>

      <div class="card" id="bulk"><h3>Set every price at once</h3>
        <div class="row">
          <label>Price (${cur})<input id="bulk-price" inputmode="decimal" value="200"></label>
          <label class="check"><input type="checkbox" id="bulk-domains" checked> Include domain prices</label>
          <button type="button" class="btn" data-act="bulk">Apply to all</button>
        </div>
      </div>

      <div class="card" id="domains"><h3>Domain prices (per year)</h3>
        <div class="tld-grid">${data.tlds.map((t, i) => `
          <div>${field(esc(t.ext), `tlds.${i}.price`, fmt(t.price), "", "number")}
          <button type="button" class="link danger" data-act="del-tld" data-i="${i}">remove</button></div>`).join("")}
        </div>
        <div class="row" style="margin-top:14px">
          <label>New extension<input id="new-tld" placeholder=".gh"></label>
          <label class="price-in">Price<input id="new-tld-price" inputmode="decimal" value="200"></label>
          <button type="button" class="btn btn-outline" data-act="add-tld">Add extension</button>
        </div>
      </div>

      ${cats.map(({ c, i }) => `
      <div class="card" id="cat-${i}">
        <h3>${esc(c.name)} <a class="muted small-link" href="hosting.html?c=${encodeURIComponent(c.slug)}" target="_blank">view page ↗</a></h3>
        ${c.plans.map((p, j) => {
          const base = `categories.${i}.plans.${j}`;
          return `<div class="plan-edit">
            ${field("Name", base + ".name", p.name)}
            ${field(`Price (${cur})`, base + ".price", fmt(p.price), "price-in", "number")}
            <label class="per-in">Per<select data-path="${base}.period">${[...new Set([...periods, p.period])].map((o) => `<option ${o === p.period ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></label>
            <label class="check"><input type="checkbox" data-path="${base}.featured" data-type="bool" ${p.featured ? "checked" : ""}> Popular</label>
            <details><summary>Description &amp; features</summary>
              ${field("Short description", base + ".description", p.description || "")}
              <label>Features (one per line)<textarea rows="6" data-path="${base}.features" data-type="lines">${esc((p.features || []).join("\n"))}</textarea></label>
              <button type="button" class="link danger" data-act="del-plan" data-i="${i}" data-j="${j}">Delete this plan</button>
            </details>
          </div>`;
        }).join("")}
        <button type="button" class="btn btn-outline small" data-act="add-plan" data-i="${i}">+ Add plan</button>
      </div>`).join("")}

      <div class="card" id="site"><h3>Site details</h3>
        <div class="settings-grid">
          ${[["site_name", "Site name"], ["tagline", "Tagline"], ["currency_symbol", "Currency symbol"], ["phone", "Phone"],
             ["whatsapp", "WhatsApp number (orders go here, e.g. 233241234567)"], ["email", "Email"], ["address", "Address"], ["since_year", "In business since"]]
            .map(([k, l]) => field(l, "settings." + k, data.settings[k] || "")).join("")}
        </div>
      </div>

      <div class="savebar">
        <button type="button" class="btn btn-outline" data-act="download">Download prices.json</button>
        <button type="button" class="btn" data-act="save">Save to GitHub</button>
      </div>`;
  }

  function setPath(path, value) {
    const keys = path.split(".");
    let o = data;
    for (const k of keys.slice(0, -1)) o = o[k];
    o[keys[keys.length - 1]] = value;
  }

  function parsePrice(raw) {
    const v = Number(String(raw).replace(/,/g, "").trim());
    return String(raw).trim() !== "" && isFinite(v) && v >= 0 ? v : null;
  }

  editor.addEventListener("input", (e) => {
    const el = e.target, path = el.dataset.path;
    if (!path) return;
    const t = el.dataset.type;
    if (t === "number") {
      const v = parsePrice(el.value);
      el.style.borderColor = v === null ? "#c0392b" : "";
      if (v === null) return;
      setPath(path, v);
    } else if (t === "bool") setPath(path, el.checked);
    else if (t === "lines") setPath(path, el.value.split("\n").map((s) => s.trim()).filter(Boolean));
    else setPath(path, el.value);
    dirty = true;
  });
  editor.addEventListener("change", (e) => { if (e.target.dataset.path) { e.target.dispatchEvent(new Event("input", { bubbles: true })); } });

  editor.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const act = b.dataset.act, i = +b.dataset.i, j = +b.dataset.j;
    const y = window.scrollY;
    if (act === "bulk") {
      const v = parsePrice(document.getElementById("bulk-price").value);
      if (v === null) return status("Enter a valid price.", "error");
      data.categories.forEach((c) => c.plans.forEach((p) => (p.price = v)));
      if (document.getElementById("bulk-domains").checked) data.tlds.forEach((t) => (t.price = v));
      status(`All prices set to ${fmt(v)}. Click <b>Save to GitHub</b> to publish.`);
    } else if (act === "del-tld") {
      if (!confirm(`Remove ${data.tlds[i].ext}?`)) return;
      data.tlds.splice(i, 1);
    } else if (act === "add-tld") {
      let ext = document.getElementById("new-tld").value.trim().toLowerCase();
      if (ext && !ext.startsWith(".")) ext = "." + ext;
      if (ext.length < 2 || data.tlds.some((t) => t.ext === ext)) return status("Invalid or duplicate extension.", "error");
      data.tlds.push({ ext, price: parsePrice(document.getElementById("new-tld-price").value) ?? 200 });
    } else if (act === "add-plan") {
      const c = data.categories[i];
      c.plans.push({ name: "New plan", description: "", price: 200, period: c.plans[0]?.period || "yr", featured: false, features: [] });
    } else if (act === "del-plan") {
      if (!confirm(`Delete plan ${data.categories[i].plans[j].name}?`)) return;
      data.categories[i].plans.splice(j, 1);
    } else if (act === "download") {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2) + "\n"], { type: "application/json" }));
      a.download = "prices.json";
      a.click();
      return;
    } else if (act === "save") {
      return save(b);
    }
    dirty = true;
    draw();
    window.scrollTo(0, y);
  });

  async function save(btn) {
    if (!conn || !conn.token) return status("Add your GitHub token above, click Connect, then save.", "error");
    const bad = editor.querySelectorAll('input[data-type="number"]');
    for (const el of bad) if (parsePrice(el.value) === null) { el.focus(); return status("Fix the highlighted price first.", "error"); }
    btn.disabled = true; btn.textContent = "Saving…";
    try {
      const body = { message: "Update prices from settings page", content: b64encode(JSON.stringify(data, null, 2) + "\n"), branch: conn.branch };
      if (sha) body.sha = sha;
      const r = await fetch(apiUrl(), { method: "PUT", headers: { ...headers(), "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 409 || r.status === 422 && /sha/i.test(j.message || "")) throw new Error("The prices were changed somewhere else. Click Connect to reload, then redo your edits.");
      if (r.status === 401) throw new Error("GitHub rejected the token. Check it hasn't expired.");
      if (r.status === 403 || r.status === 404) throw new Error("The token doesn't have write access to this repo (needs Contents: read & write).");
      if (!r.ok) throw new Error(j.message || r.status);
      sha = j.content.sha;
      dirty = false;
      Site.clearCache();
      status("Saved! The live site shows the new prices within about a minute.");
    } catch (e) {
      status("Save failed: " + esc(e.message), "error");
    } finally {
      btn.disabled = false; btn.textContent = "Save to GitHub";
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  form.addEventListener("submit", (e) => { e.preventDefault(); load(); });
  document.getElementById("forget").addEventListener("click", () => {
    localStorage.removeItem(LS); form.token.value = ""; if (conn) conn.token = ""; status("Token removed from this browser.");
  });
  window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  initForm();
  load();
})();
