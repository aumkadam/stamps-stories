/* Stamps & Stories — GitHub Pages storage layer.
   Visitors: reads data.json and images/ from this site (read-only, no edit controls).
   Owner: signs in once with a fine-grained GitHub token (open the site with ?owner);
   every change is committed straight to the repo through the GitHub API. */
(() => {
  const KEY = "ss-owner";
  const getCfg = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } };
  const setCfg = v => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch {} };
  const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  window.__localImg = {};

  // ---------- GitHub API ----------
  const gh = async (path, opts = {}, cfg = getCfg()) => {
    const r = await fetch(`https://api.github.com/repos/${cfg.repo}${path ? "/" + path : ""}`, {
      ...opts, cache: "no-store",
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${cfg.token}`, ...(opts.body ? { "Content-Type": "application/json" } : {}) },
    });
    if (!r.ok) { const j = await r.json().catch(() => ({})); const e = new Error(j.message || r.statusText); e.status = r.status; throw e; }
    return r.status === 204 ? null : r.json();
  };
  const b64 = str => { const bytes = new TextEncoder().encode(str); let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(bin); };
  const unb64 = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, "")), c => c.charCodeAt(0)));
  const blobB64 = blob => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1]); fr.onerror = rej; fr.readAsDataURL(blob); });
  let queue = Promise.resolve();
  const enqueue = fn => (queue = queue.then(() => withRetry(fn), () => withRetry(fn)));
  const withRetry = async fn => { try { return await fn(); } catch (e) { if (e.status === 409 || e.status === 422) { await new Promise(r => setTimeout(r, 1200)); return fn(true); } throw e; } };

  const notify = msg => {
    let t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.remove("show"); void t.offsetWidth; t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 3200);
  };

  // ---------- owner check ----------
  const ownerCheck = (async () => {
    const cfg = getCfg(); if (!cfg) return false;
    try { const repo = await gh("", {}, cfg); return !!repo.permissions?.push; }
    catch (e) { notify("Owner sign-in failed: " + e.message + ". Open the site with ?owner to sign in again."); return false; }
  })();

  // ---------- data ----------
  let data = { site: { profile: {} }, places: {}, photos: {} }, sha = null;
  const ready = ownerCheck.then(async owner => {
    let j = {};
    try {
      if (owner) {
        const cfg = getCfg();
        try { const f = await gh(`contents/data.json?ref=${encodeURIComponent(cfg.branch)}`); sha = f.sha; j = JSON.parse(unb64(f.content)); }
        catch (e) { if (e.status !== 404) throw e; }
      } else {
        const r = await fetch("data.json?t=" + Date.now(), { cache: "no-store" }); if (r.ok) j = await r.json();
      }
    } catch (e) { console.warn("Could not load data.json", e); }
    data = { site: { profile: j.profile || {} }, places: j.places || {}, photos: j.photos || {} };
  });

  const docSubs = new Set(), subs = { places: new Set(), photos: new Set() };
  const docSnap = () => ({ id: "profile", exists: Object.keys(data.site.profile || {}).length > 0, data: () => ({ ...data.site.profile }) });
  const collSnap = c => { const docs = Object.entries(data[c] || {}).map(([id, d]) => ({ id, exists: true, data: () => ({ ...d }) })); return { docs, size: docs.length, empty: !docs.length }; };
  const fire = c => c === "site" ? docSubs.forEach(f => f(docSnap())) : subs[c]?.forEach(f => f(collSnap(c)));

  let saveTimer = null;
  const persist = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => enqueue(async retry => {
      const cfg = getCfg();
      if (retry) { try { sha = (await gh(`contents/data.json?ref=${encodeURIComponent(cfg.branch)}`)).sha; } catch {} }
      const body = JSON.stringify({ profile: data.site.profile || {}, places: data.places, photos: data.photos }, null, 2) + "\n";
      const res = await gh("contents/data.json", { method: "PUT", body: JSON.stringify({ message: "Update travel data", content: b64(body), branch: cfg.branch, ...(sha ? { sha } : {}) }) });
      sha = res.content.sha;
      notify("Saved to GitHub · visitors see it in about a minute");
    }).catch(e => notify("Couldn't save to GitHub: " + e.message)), 500);
  };
  const owned = async () => { if (!(await ownerCheck)) throw Object.assign(new Error("Only the owner can make changes."), { code: "not_granted" }); };
  const target = (c, id) => c === "site" ? "profile" : id;

  const db = {
    doc(path) {
      const [c, id] = path.split("/");
      return {
        onSnapshot(cb) { ready.then(() => { if (c === "site") { docSubs.add(cb); cb(docSnap()); } }); return () => docSubs.delete(cb); },
        async get() { await ready; return c === "site" ? docSnap() : { id, exists: !!data[c]?.[id], data: () => ({ ...data[c][id] }) }; },
        async set(d) { await owned(); if (c === "site") data.site.profile = { ...d }; else data[c][target(c, id)] = { ...d }; fire(c); persist(); },
        async update(d) { await owned(); const cur = c === "site" ? data.site.profile : (data[c][id] ||= {}); for (const [k, v] of Object.entries(d)) v === null ? delete cur[k] : cur[k] = v; fire(c); persist(); },
        async delete() { await owned(); if (c === "site") data.site.profile = {}; else delete data[c][id]; fire(c); persist(); },
      };
    },
    collection(c) {
      return {
        onSnapshot(cb) { ready.then(() => { (subs[c] ||= new Set()).add(cb); cb(collSnap(c)); }); return () => subs[c].delete(cb); },
        async add(d) { await owned(); const id = rid(); (data[c] ||= {})[id] = { ...d }; fire(c); persist(); return { id }; },
        doc(id) { return db.doc(c + "/" + id); },
      };
    },
  };

  const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
  const assets = {
    async upload(blob) {
      await owned();
      const ext = EXT[blob.type]; if (!ext) throw Object.assign(new Error("Unsupported image type"), { code: "unsupported_type" });
      if (blob.size > 20 * 1024 * 1024) throw Object.assign(new Error("Too large"), { code: "too_large" });
      const id = rid() + "." + ext, content = await blobB64(blob), cfg = getCfg();
      await enqueue(() => gh(`contents/images/${id}`, { method: "PUT", body: JSON.stringify({ message: "Add photo " + id, content, branch: cfg.branch }) }));
      window.__localImg[id] = URL.createObjectURL(blob);
      return { id, url: window.__localImg[id], sizeBytes: blob.size, contentType: blob.type };
    },
    async delete(id) {
      await owned();
      const file = id.includes(".") ? id : id + ".jpg", cfg = getCfg();
      await enqueue(async () => { const meta = await gh(`contents/images/${file}?ref=${encodeURIComponent(cfg.branch)}`); await gh(`contents/images/${file}`, { method: "DELETE", body: JSON.stringify({ message: "Remove photo " + file, sha: meta.sha, branch: cfg.branch }) }); });
      return { deleted: true };
    },
  };
  const user = { canEdit: async () => ownerCheck, isOwner: async () => ownerCheck };

  window.claude = { use: async name => { const owner = await ownerCheck; return name === "db" ? db : name === "user" ? user : name === "assets" ? (owner ? assets : null) : null; } };

  // ---------- owner sign-in / sign-out ----------
  const guessRepo = () => {
    const host = location.hostname, seg = location.pathname.split("/").filter(Boolean)[0];
    if (!host.endsWith(".github.io")) return "";
    const user = host.split(".")[0];
    return seg && !seg.includes(".") ? `${user}/${seg}` : `${user}/${host}`;
  };
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function signInDialog() {
    const cur = getCfg() || {};
    const m = document.createElement("div"); m.className = "modal"; m.id = "owner-modal";
    m.innerHTML = `<form class="sheet" id="owner-form">
      <h2>Owner sign-in</h2>
      <p class="hint" style="margin:0;font-size:14px">Paste a fine-grained GitHub token that can edit this site's repository. It stays in this browser only; visitors never see edit controls.</p>
      <label>Repository<input id="o-repo" required placeholder="username/repo-name" value="${esc(cur.repo || guessRepo())}"></label>
      <label>Branch<input id="o-branch" required value="${esc(cur.branch || "main")}"></label>
      <label>GitHub token<input id="o-token" required type="password" autocomplete="off" placeholder="github_pat_…"></label>
      <p class="err" id="o-err" hidden></p>
      <div class="foot"><button type="button" class="btn" id="o-cancel">Cancel</button><button class="btn gold" id="o-go">Sign in</button></div>
    </form>`;
    document.body.appendChild(m);
    const done = () => { m.remove(); history.replaceState(null, "", location.pathname + location.hash); };
    m.querySelector("#o-cancel").onclick = done;
    m.querySelector("#owner-form").onsubmit = async e => {
      e.preventDefault();
      const cfg = { repo: m.querySelector("#o-repo").value.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\/$/, ""), branch: m.querySelector("#o-branch").value.trim(), token: m.querySelector("#o-token").value.trim() };
      const err = m.querySelector("#o-err"), go = m.querySelector("#o-go"); go.disabled = true; go.textContent = "Checking…";
      try {
        const repo = await gh("", {}, cfg);
        if (!repo.permissions?.push) throw new Error("This token can't write to " + cfg.repo + ". Give it Contents: Read and write.");
        setCfg(cfg); done(); location.reload();
      } catch (ex) { err.hidden = false; err.textContent = "Sign-in failed: " + ex.message; go.disabled = false; go.textContent = "Sign in"; }
    };
  }
  const start = () => {
    if (new URLSearchParams(location.search).has("owner")) signInDialog();
    ownerCheck.then(owner => {
      if (!owner) return;
      const pill = document.createElement("div"); pill.className = "owner-pill";
      pill.innerHTML = `<span>Owner mode</span><button type="button">Sign out</button>`;
      pill.querySelector("button").onclick = () => { setCfg(null); location.reload(); };
      document.body.appendChild(pill);
    });
  };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start) : start();
})();
