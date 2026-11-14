/* Policy Summary Power Tools — screens and storage. Client data stays on the agent's devices; optional sync is end-to-end encrypted. */
(function () {
  'use strict';
  const PS = window.PS, CFG = window.PSPT_CONFIG || {};
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const app = $('#app');

  /* ---------- storage (this phone only) ---------- */
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { toast('Phone storage is full. Delete old clients.'); } };
  let cases = load('pspt.cases', []);
  let settings = load('pspt.settings', {name: '', title: '', phone: '', guide: {death: 10, ci: 5}});
  let learned = load('pspt.learned', {});
  let tombs = load('pspt.tombs', {});   // deleted client ids -> when, so a delete reaches the other devices
  let reports = load('pspt.reports', {});   // 三访: date -> {reflection, tomorrow, hideNames, done, updated}
  const saveCases = () => { save('pspt.cases', cases); scheduleSync(); };
  const getCase = id => cases.find(c => c.id === id);
  const agent = () => ({name: settings.name, title: settings.title, phone: settings.phone});

  /* ---------- small UI helpers ---------- */
  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 3200); }
  function sheet(html, onMount) {
    const s = $('#sheet'); s.innerHTML = `<div class="sheet-in" role="dialog" aria-modal="true">${html}</div>`; s.hidden = false;
    s.onclick = e => { if (e.target === s && !s.dataset.lock) closeSheet(); };
    $$('[data-close]', s).forEach(b => b.onclick = closeSheet);
    onMount && onMount(s.firstChild);
    return s.firstChild;
  }
  function closeSheet() { const s = $('#sheet'); s.hidden = true; s.innerHTML = ''; delete s.dataset.lock; }
  function confirmBox(title, body, okLabel, danger) {
    return new Promise(done => {
      const el = sheet(`<h3>${esc(title)}</h3><p>${body}</p><div class="row"><button class="btn" data-x>Cancel</button><button class="btn ${danger ? 'navy' : 'primary'}" data-ok>${esc(okLabel)}</button></div>`);
      $('[data-x]', el).onclick = () => { closeSheet(); done(false); };
      $('[data-ok]', el).onclick = () => { closeSheet(); done(true); };
    });
  }
  const ICONS = {
    back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>',
    gear: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.6-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.2-2.6l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.6 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg>',
    cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M3 8h4l2-3h6l2 3h4v12H3z"/><circle cx="12" cy="13" r="4"/></svg>',
    pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/></svg>',
    pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 12h6M9 15h6M9 18h4"/></svg>',
    trash: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>'
  };
  const bar = (title, back, right) => `<header class="bar">${back ? `<a class="ib" href="${back}" aria-label="Back">${ICONS.back}</a>` : ''}<h1>${esc(title)}</h1>${right || ''}</header>`;
  const money = v => (v == null ? '' : String(v));

  /* ---------- router ---------- */
  function route() {
    closeSheet(); leaveGuard = null;
    if (pendingNext) { const p = pendingNext; pendingNext = null; setTimeout(() => nextSheet(p), 0); }   // after saving a meeting: offer Calendar and 定联
    const h = location.hash.replace(/^#\/?/, '').split('/');
    window.scrollTo(0, 0);
    if (h[0] === 'record') return recordScreen(h[1] && getCase(h[1]) ? h[1] : null);
    if (h[0] === 'day') return dayScreen(h[1]);
    if (h[0] === 'team') return teamScreen();
    if (h[0] === 'case' && getCase(h[1])) {
      if (h[2] === 'policy') return editPolicy(getCase(h[1]), h[3]);
      if (h[2] === 'summary') return summary(getCase(h[1]));
      return caseScreen(getCase(h[1]));
    }
    home();
  }
  addEventListener('hashchange', route);

  /* ---------- home ---------- */
  function home() {
    const list = cases.slice().sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
    const due = dueList(), q = (home.q || '').toLowerCase();
    const shown = q ? list.filter(c => (c.client.name + ' ' + (c.client.nickname || '')).toLowerCase().includes(q)) : list;
    app.innerHTML = `<header class="bar"><div class="brand"><img src="logo.png" alt=""><div><b>On Field</b><span>REDEFINE</span></div></div><button class="ib" id="set" aria-label="Settings">${ICONS.gear}</button></header>
      <div class="wrap">
        <div class="card hero"><h2>Just met a client?</h2><p>Speak for 1–2 minutes. On Field writes the follow-up PDF and WhatsApp message, and saves the meeting to your client farm.</p>
          <button class="btn primary block rec-big" id="recNew">🎙 Record a meeting</button>
          ${rec && (rec.transcript || rec.draft) ? '<button class="btn block" id="recResume" style="margin-top:8px">Continue unfinished note</button>' : ''}
          <button class="btn block ghost-l" id="new">+ New client · policy summary</button></div>
        ${todayCard()}
        ${settings.name ? '' : '<div class="checks"><b>Add your name first.</b> It goes at the bottom of every PDF. <a href="#" id="set2">Open settings</a></div>'}
        ${settings.name && !settings.intro ? '<div class="checks"><b>Set up "My profile" once.</b> Your photo, intro and why you do insurance go on every follow-up PDF. <a href="#" id="prof2">Open My profile</a></div>' : ''}
        ${due.length ? `<h2 class="muted" style="margin:6px 2px 8px;font-weight:600">FOLLOW UP SOON</h2>${due.map(({c, m}) => `<a class="item" href="#/case/${c.id}"><span class="stripe" style="background:${m.followUpDate < todayISO() ? 'var(--err)' : 'var(--gold)'}"></span><div class="t"><b>${esc(c.client.name)}</b><span>${esc(m.nextStep || FU.typeLabel(m.type))}</span></div><div class="amt">${esc(m.followUpDate)}<small>${m.followUpDate < todayISO() ? 'overdue' : m.followUpDate === todayISO() ? 'today' : 'soon'}</small></div></a>`).join('')}` : ''}
        ${installTip()}
        <div id="syncLine"></div>
        <h2 class="muted" style="margin:6px 2px 8px;font-weight:600">MY CLIENTS (${list.length})</h2>
        ${list.length > 6 ? `<div class="f"><input id="qC" type="search" placeholder="Search clients" value="${esc(home.q || '')}"></div>` : ''}
        ${shown.length ? shown.map(c => {
          const s = PS.summarise(c), n = PS.pendingChecks(c).length, ms = c.meetings || [], last = ms[ms.length - 1];
          const sub = [c.client.nickname, last ? 'met ' + last.date : '', c.policies.length ? c.policies.length + ' polic' + (c.policies.length === 1 ? 'y' : 'ies') : ''].filter(Boolean).join(' · ') || 'updated ' + new Date(c.updated).toLocaleDateString('en-GB');
          return `<a class="item" href="#/case/${c.id}"><div class="t"><b>${esc(c.client.name || 'Unnamed client')}${c.sample ? ' <span class="pill grey">Sample</span>' : ''}</b><span>${esc(sub)}</span></div>
            <div class="amt">${c.policies.length ? PS.rm(s.cats.death.total, {short: true}) : ms.length}<small>${n ? `<span class="pill warn">${n} to check</span>` : c.policies.length ? 'death cover' : 'meeting' + (ms.length === 1 ? '' : 's')}</small></div></a>`;
        }).join('') : list.length ? '<div class="empty">No client matches.</div>' : '<div class="empty">No clients yet.<br>Tap <b>Record a meeting</b> after you meet someone, or <a href="#" id="demo">open a sample</a> to see a policy summary.</div>'}
        ${list.length && !list.some(c => c.sample) ? '<p class="muted" style="text-align:center;margin:10px 0"><a href="#" id="demo">Open the sample client</a></p>' : ''}
        <p class="muted" style="text-align:center;margin:18px 10px">${syncCfg ? 'Clients are locked with your sync passphrase before syncing. Photos are read and then discarded.' : 'Client details are saved on this device only. Photos are read and then discarded.'}</p>
      </div>`;
    $('#new').onclick = newCase;
    $('#recNew').onclick = () => startRecord(null);
    wireTodayCard();
    const rr = $('#recResume'); if (rr) rr.onclick = () => { location.hash = '#/record' + (rec.caseId ? '/' + rec.caseId : ''); };
    const p2 = $('#prof2'); if (p2) p2.onclick = e => { e.preventDefault(); openProfile(); };
    const qc = $('#qC'); if (qc) qc.oninput = () => { home.q = qc.value; const pos = qc.selectionStart; home(); const n = $('#qC'); n.focus(); n.setSelectionRange(pos, pos); };
    updateSyncLine();
    const it = $('#tipX'); if (it) it.onclick = () => { save('pspt.tipHidden', Date.now()); $('#installTip').remove(); };
    $('#set').onclick = openSettings;
    const s2 = $('#set2'); if (s2) s2.onclick = e => { e.preventDefault(); openSettings(); };
    const d = $('#demo'); if (d) d.onclick = e => { e.preventDefault(); const c = window.sampleCase(PS); cases.push(c); saveCases(); location.hash = '#/case/' + c.id; };
  }

  function newCase() {
    const el = sheet(`<h3>New client</h3><p>Only the name is needed. Age and income make the summary more useful.</p>
      <div class="f"><label for="nName">Client name (as it should appear on the PDF)</label><input id="nName" autocomplete="off"></div>
      <div class="grid2"><div class="f"><label for="nAge">Age</label><input id="nAge" inputmode="numeric"></div>
      <div class="f"><label for="nInc">Annual income (optional)</label><input id="nInc" inputmode="decimal" placeholder="e.g. 84k"></div></div>
      <div class="row"><button class="btn" data-x>Cancel</button><button class="btn primary" data-ok>Create</button></div>`);
    $('#nName', el).focus();
    $('[data-x]', el).onclick = closeSheet;
    $('[data-ok]', el).onclick = () => {
      const name = $('#nName', el).value.trim();
      if (!name) { $('#nName', el).classList.add('flag'); return; }
      const now = new Date().toISOString();
      const c = {id: PS.uid(), created: now, updated: now, client: {name, age: PS.parseAmount($('#nAge', el).value).value, income: PS.parseAmount($('#nInc', el).value).value},
        guide: Object.assign({}, settings.guide), policies: []};
      cases.push(c); saveCases(); closeSheet(); location.hash = '#/case/' + c.id;
    };
  }

  /* ---------- one client ---------- */
  function caseScreen(c) {
    const s = PS.summarise(c), checks = PS.pendingChecks(c);
    app.innerHTML = bar(c.client.name || 'Client', '#/', `<button class="ib" id="del" aria-label="Delete client">${ICONS.trash}</button>`) + `
      <div class="wrap">
        ${farmCard(c)}
        <h2 class="muted" style="margin:14px 2px 8px;font-weight:600">POLICY SUMMARY</h2>
        ${c.policies.length ? `<div class="card hero"><h2>So far</h2>
          <div class="stat"><div><span>Death</span><b>${PS.rm(s.cats.death.total, {short: true})}</b></div><div><span>CI</span><b>${PS.rm(s.cats.ci.total, {short: true})}</b></div><div><span>Medical/yr</span><b>${s.medical.annual != null ? PS.rm(s.medical.annual, {short: true}) : '—'}</b></div></div>
        </div>` : ''}
        <button class="btn primary block addbig" id="addP">${ICONS.cam}<span><b>Add policy pages</b><small>Photos, screenshots &amp; PDFs · many policies, any insurer</small></span></button>
        <div class="big3">
          <button class="btn sm" id="snap">${ICONS.cam.replace('<svg ', '<svg width="18" height="18" ')}Take photo</button>
          <button class="btn sm" id="pics">+ Photos</button>
          <button class="btn sm" id="pdfB">${ICONS.pdf.replace('<svg ', '<svg width="18" height="18" ')}+ PDF</button>
        </div>
        <button class="btn block" id="key" style="margin-bottom:12px">${ICONS.pen.replace('<svg ', '<svg width="22" height="22" ')}Key in a policy</button>
        <input type="file" id="camIn" accept="image/*" capture="environment" hidden>
        <input type="file" id="file" accept="image/*" multiple hidden>
        <input type="file" id="pdfIn" accept="application/pdf,.pdf" multiple hidden>
        ${checks.length ? `<div class="checks"><b>${checks.length} item${checks.length > 1 ? 's' : ''} to confirm</b> before the summary is complete. Tap a policy marked <span class="pill warn">check</span>.</div>` : ''}
        <h2 class="muted" style="margin:6px 2px 8px;font-weight:600">POLICIES (${c.policies.length})</h2>
        ${c.policies.length ? c.policies.map(p => {
          const n = PS.pendingChecks({policies: [p]}).length, r = PS.policyRow(p), out = p.status !== 'inforce' && p.status !== 'unknown';
          const tags = PS.CATS.filter(k => r[k.id].has).map(k => k.short).join(' · ');
          return `<a class="item" href="#/case/${c.id}/policy/${p.id}"><span class="stripe" style="background:${PS.insurerColor(p.insurer)}"></span><div class="t"><b>${esc(p.insurer || 'Insurer?')}</b><span>${esc(p.productName || 'Plan')}${p.policyNo ? ' · ' + esc(p.policyNo) : ''}</span><span>${esc(tags || 'No benefits yet')}</span></div>
            <div class="amt">${n ? `<span class="pill warn">${n} check</span>` : out ? `<span class="pill grey">${esc(p.status)}</span>` : '<span class="pill ok">OK</span>'}<small>${p.source === 'photo' ? 'from photo' : 'keyed in'}</small></div></a>`;
        }).join('') : '<div class="empty">No policies yet. Tap <b>Add policy pages</b>, add every policy the client has from any insurer, then read them all at once.</div>'}
        <div class="card" style="margin-top:12px"><h2>Client</h2>
          <div class="f"><label for="cName">Name on PDF</label><input id="cName" value="${esc(c.client.name)}"></div>
          <div class="grid2"><div class="f"><label for="cAge">Age</label><input id="cAge" inputmode="numeric" value="${money(c.client.age)}"></div>
          <div class="f"><label for="cInc">Annual income (optional)</label><input id="cInc" inputmode="decimal" value="${money(c.client.income)}"></div></div>
          <p class="muted">With income, the summary compares cover with a guideline of ${c.guide.death}× income for death/TPD and ${c.guide.ci}× for CI. Change the multiples in Settings.</p>
        </div>
      </div>
      ${c.policies.length ? `<div class="dock"><a class="btn navy" href="#/case/${c.id}/summary">See policy summary &amp; PDF</a></div>` : ''}`;
    $('#key').onclick = () => { location.hash = '#/case/' + c.id + '/policy/new'; };
    wireFarm(c);
    $('#addP').onclick =() => { if (!tray || tray.caseId !== c.id) { clearTray(); tray = {caseId: c.id, items: [], notes: []}; } showTray(c); };
    $('#snap').onclick = () => $('#camIn').click();
    $('#pics').onclick = () => $('#file').click();
    $('#pdfB').onclick = () => $('#pdfIn').click();
    ['#camIn', '#file', '#pdfIn'].forEach(s => { $(s).onchange = e => { const f = [...e.target.files]; e.target.value = ''; if (f.length) addToTray(c, f); }; });
    $('#del').onclick = async () => {
      if (await confirmBox('Delete ' + (c.client.name || 'this client') + '?', 'This removes the client and all ' + c.policies.length + ' policies from this phone. It cannot be undone.', 'Delete', true)) {
        cases = cases.filter(x => x.id !== c.id); tombs[c.id] = new Date().toISOString(); save('pspt.tombs', tombs); saveCases(); location.hash = '#/';
      }
    };
    const upd = () => {
      c.client.name = $('#cName').value.trim(); c.client.age = PS.parseAmount($('#cAge').value).value; c.client.income = PS.parseAmount($('#cInc').value).value;
      c.updated = new Date().toISOString(); saveCases();
    };
    ['#cName', '#cAge', '#cInc'].forEach(s => $(s).addEventListener('change', upd));
  }

  /* ---------- AI reading through the team server ---------- */
  function session() { const own = localStorage.getItem('pspt.session'); return own !== null ? load('pspt.session', null) : load('rff.session', null); }
  async function post(body, who) {
    const s = who || session();
    let r;
    try { r = await fetch(CFG.api, {method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: JSON.stringify(Object.assign({code: s.code, name: s.name}, body))}); }
    catch (e) { throw {code: 'offline'}; }
    let j; try { j = await r.json(); } catch (e) { throw {code: 'upstream_error'}; }
    if (j.error) throw {code: j.error};
    return j;
  }
  function signIn() {
    return new Promise(done => {
      const el = sheet(`<h3>Sign in once</h3><p>Reading photos/PDFs and syncing use the REDEFINE team server. Enter your name and the team code (the same one as Form Filler). You stay signed in on this device. Keying in works without signing in.</p>
        <div class="f"><label for="gName">Your name</label><input id="gName" autocomplete="name" value="${esc(settings.name || (load('pspt.session', null) || load('rff.session', null) || {}).name || (syncCfg || {}).name || '')}"></div>
        <div class="f"><label for="gCode">Team code</label><input id="gCode" type="password" autocomplete="current-password"></div>
        <p class="muted" id="gMsg" role="alert" style="color:var(--err);min-height:18px"></p>
        <div class="row"><button class="btn" data-x>Cancel</button><button class="btn primary" data-ok>Sign in</button></div>`);
      $('[data-x]', el).onclick = () => { closeSheet(); done(false); };
      $('[data-ok]', el).onclick = async () => {
        const who = {name: $('#gName', el).value.trim(), code: $('#gCode', el).value.trim()};
        if (!who.name || !who.code) { $('#gMsg', el).textContent = 'Enter both.'; return; }
        $('[data-ok]', el).disabled = true; $('[data-ok]', el).textContent = 'Checking…';
        try { const lr = await post({op: 'login'}, who); save('pspt.session', Object.assign(who, {owner: !!lr.owner})); if (!settings.name) { settings.name = who.name; save('pspt.settings', settings); } closeSheet(); done(true); }
        catch (e) {
          $('#gMsg', el).textContent = e.code === 'unauthorized' ? 'That team code is not right.' : e.code === 'locked' ? 'Too many wrong tries. Wait 15 minutes.' : 'Could not reach the team server. Check your connection.';
          $('[data-ok]', el).disabled = false; $('[data-ok]', el).textContent = 'Sign in';
        }
      };
    });
  }
  async function toJpegB64(file, maxSide) {
    const bmp = await createImageBitmap(file), k = Math.min(1, (maxSide || 2000) / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(bmp, 0, 0, cv.width, cv.height);
    return cv.toDataURL('image/jpeg', 0.85).split(',')[1];
  }
  function parseJSON(text) {
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/), a = text.indexOf('{'), b = text.lastIndexOf('}');
    for (const t of [text, fence && fence[1], a >= 0 && b > a && text.slice(a, b + 1)]) { if (!t) continue; try { return JSON.parse(t); } catch (e) {} }
    throw {code: 'invalid_json'};
  }
  const AI_ERR = {
    offline: 'No internet connection. Try again, or key the policy in.', daily_limit: 'The team has used today\'s AI limit. Key the policy in, or try tomorrow.',
    no_credit: 'The OpenAI account is out of credit. Tell Kah Jian.', bad_api_key: 'The team server key is not working. Tell Kah Jian.',
    refused: 'The AI would not read this image. Try a clearer photo or key it in.', invalid_json: 'The AI answer was unreadable. Try again with fewer photos.',
    rate_limited: 'The AI is busy. Wait a minute and try again.', image_rejected: 'One photo could not be opened. Try a screenshot or a different photo.'
  };

  /* ---------- PDFs: each page becomes an image the AI can read ---------- */
  const loadScript = src => new Promise((ok, bad) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => bad(new Error(src)); document.head.appendChild(s); });
  const isPdf = f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '');
  const MAX_PDF_PAGES = 20, MAX_PICK = 40;
  function askPassword(name, wrong) {
    return new Promise(done => {
      const el = sheet(`<h3>${wrong ? 'Wrong password' : 'This PDF has a password'}</h3><p>${esc(name)} is locked. E-statements often use the client's IC number or date of birth. The password is used once on this phone and not saved.</p>
        <div class="f"><label for="pw">PDF password</label><input id="pw" type="password" autocomplete="off"></div>
        <div class="row"><button class="btn" data-x>Skip this PDF</button><button class="btn primary" data-ok>Open</button></div>`);
      $('#pw', el).focus();
      $('[data-x]', el).onclick = () => done(null);
      $('[data-ok]', el).onclick = () => done($('#pw', el).value);
    });
  }
  async function pdfPages(file, onPage) {
    if (!window.pdfjsLib) { await loadScript('vendor/pdf.min.js'); window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js'; }
    const task = window.pdfjsLib.getDocument({data: new Uint8Array(await file.arrayBuffer())});
    let skipped = false;
    task.onPassword = async (update, reason) => {
      const pw = await askPassword(file.name, reason === 2);
      if (pw == null) { skipped = true; task.destroy(); } else { sheet('<h3>Opening PDF…</h3><div class="spin"></div>'); update(pw); }
    };
    let doc;
    try { doc = await task.promise; } catch (e) { if (skipped) return {pages: [], skipped: true}; throw {code: 'pdf_unreadable'}; }
    const n = Math.min(doc.numPages, MAX_PDF_PAGES), pages = [];
    for (let i = 1; i <= n; i++) {
      onPage && onPage(i, n);
      const page = await doc.getPage(i), v1 = page.getViewport({scale: 1});
      const v = page.getViewport({scale: Math.min(3, 1800 / Math.max(v1.width, v1.height))});
      const cv = document.createElement('canvas'); cv.width = Math.round(v.width); cv.height = Math.round(v.height);
      const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
      await page.render({canvasContext: g, viewport: v, intent: 'print'}).promise;   // 'print' doesn't pause when the screen is hidden
      pages.push({blob: await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.88)), label: (doc.numPages > 1 ? 'p' + i : 'PDF'), pdf: true, page: i});
      page.cleanup();
    }
    const total = doc.numPages; doc.destroy();
    return {pages, total};
  }

  /* ---------- the tray: collect photos, screenshots and PDFs from many policies, then read them all ----------
     Agents can keep adding (camera, gallery, PDF) before reading. Pages are sent in small batches, 3 at a time,
     each PDF's pages kept together, and parts of the same policy found in different batches are joined. */
  let tray = null;   // {caseId, items: [{blob, url, label, src, on}], notes: []}
  let photoN = 0;
  async function addToTray(c, files) {
    if (!tray || tray.caseId !== c.id) { clearTray(); tray = {caseId: c.id, items: [], notes: []}; }
    if (files.some(isPdf)) { sheet('<h3>Opening PDF…</h3><div class="spin"></div><p id="pdfMsg" style="text-align:center"></p>'); $('#sheet').dataset.lock = '1'; }
    for (const f of files) {
      if (!isPdf(f)) { tray.items.push({blob: f, label: 'Photo ' + (++photoN), on: true}); continue; }
      try {
        const r = await pdfPages(f, (i, n) => { const m = $('#pdfMsg'); if (m) m.textContent = `${f.name}: page ${i} of ${n}`; });
        if (r.skipped) { tray.notes.push(f.name + ' skipped (locked)'); continue; }
        if (r.total > MAX_PDF_PAGES) tray.notes.push(`${f.name}: only the first ${MAX_PDF_PAGES} of ${r.total} pages are shown`);
        /* pages of one PDF share a key so they stay in the same AI batch */
        const short = f.name.replace(/\.pdf$/i, '').slice(0, 14), key = 'pdf-' + PS.uid();
        /* policy schedules are usually at the front: pick the first 4 pages of each PDF */
        r.pages.forEach((p, i) => tray.items.push({blob: p.blob, label: short + (r.pages.length > 1 ? ' p' + p.page : ''), pdfKey: key, on: i < 4}));
      } catch (e) { tray.notes.push(f.name + ' could not be opened'); }
    }
    tray.items.forEach(it => { if (!it.url) it.url = URL.createObjectURL(it.blob); });
    delete $('#sheet').dataset.lock;
    showTray(c);
  }
  function clearTray() { if (tray) tray.items.forEach(it => it.url && URL.revokeObjectURL(it.url)); tray = null; photoN = 0; }

  function showTray(c) {
    const items = tray.items, n = items.filter(it => it.on).length;
    const el = sheet(`<div class="sheet-top"><h3>${n ? `Read ${n} page${n === 1 ? '' : 's'}?` : 'Add policy pages'}</h3><button type="button" class="xbtn" id="trayX" aria-label="Close">✕</button></div>
      <p style="margin-bottom:8px">Add every policy for ${esc(c.client.name || 'this client')}, from any insurer: photos, screenshots of insurer apps, and PDFs. Tap a page to leave it out. The AI sorts them into separate policies.</p>
      ${items.length ? `<div class="pick grid">${items.map((it, i) => `<button type="button" class="th" data-i="${i}" aria-pressed="${it.on}"><img src="${it.url}" alt=""><span>${esc(it.label)}</span></button>`).join('')}</div>` : ''}
      <div class="addrow">
        <button class="btn sm" id="tCam">${ICONS.cam.replace('<svg ', '<svg width="18" height="18" ')}Take photo</button>
        <button class="btn sm" id="tPic">+ Photos</button>
        <button class="btn sm" id="tPdf">${ICONS.pdf.replace('<svg ', '<svg width="18" height="18" ')}+ PDF</button>
      </div>
      ${tray.notes.length ? `<p class="muted" style="color:var(--warn)">${esc(tray.notes.join('. '))}.</p>` : ''}
      <p class="muted">${n > MAX_PICK ? `<b style="color:var(--err)">Choose up to ${MAX_PICK} pages.</b> ` : ''}Long terms-and-conditions pages are not needed; pick schedule, benefit and statement pages. Cover IC numbers if they show.</p>
      <div class="row" style="margin-top:10px"><button class="btn" id="tCancel">Cancel</button><button class="btn primary" id="tGo" ${!n || n > MAX_PICK ? 'disabled' : ''}>Read with AI</button></div>`);
    $('#sheet').dataset.lock = '1';   // a stray tap outside must not throw the pages away
    $$('.th', el).forEach(b => b.onclick = () => { const it = items[+b.dataset.i]; it.on = !it.on; showTray(c); });
    $('#tCam', el).onclick = () => $('#camIn').click();
    $('#tPic', el).onclick = () => $('#file').click();
    $('#tPdf', el).onclick = () => $('#pdfIn').click();
    const leave = async () => {
      if (items.length && !(await confirmBox('Discard these pages?', `${items.length} page${items.length > 1 ? 's' : ''} will be removed. Nothing has been read yet.`, 'Discard', true))) return showTray(c);
      clearTray(); closeSheet();
    };
    $('#trayX', el).onclick = leave; $('#tCancel', el).onclick = leave;
    $('#tGo', el).onclick = () => readTray(c);
  }

  async function readTray(c) {
    const max = CFG.maxPhotosPerRead || 4, picked = tray.items.filter(it => it.on);
    if (!session() && !(await signIn())) return showTray(c);
    /* batches: each PDF's pages together (split every 4), photos in the order taken */
    const groups = [];
    for (const it of picked) {
      const key = it.pdfKey || 'photos';
      let g = groups.find(x => x.key === key && x.items.length < max);
      if (!g) groups.push(g = {key, items: []});
      g.items.push(it);
    }
    const box = sheet(`<h3>Reading ${picked.length} page${picked.length > 1 ? 's' : ''}…</h3><div class="spin"></div><p id="rdMsg" style="text-align:center"></p><p class="muted" style="text-align:center">About 20–60 seconds per group, 3 groups at a time. Keep this screen open.</p>`);
    $('#sheet').dataset.lock = '1';
    const found = [], failed = [];
    let done = 0, stop = null;
    const msg = () => { const m = $('#rdMsg', box); if (m) m.textContent = `Group ${Math.min(done + 1, groups.length)} of ${groups.length} · ${found.length} polic${found.length === 1 ? 'y' : 'ies'} found so far`; };
    msg();
    const queue = groups.slice();
    async function worker() {
      while (queue.length && !stop) {
        const g = queue.shift();
        try {
          const images = [];
          for (const it of g.items) { try { images.push(await toJpegB64(it.blob)); } catch (e) { throw {code: 'image_rejected'}; } }
          const r = await post({op: 'ai', prompt: PS.aiPrompt(learned), images});
          if (r.truncated) throw {code: 'invalid_json'};
          found.push(...PS.fromAI(parseJSON(r.text), learned));
        } catch (e) {
          if (['unauthorized', 'daily_limit', 'no_credit', 'bad_api_key', 'offline'].includes(e.code)) stop = e;
          failed.push(...g.items.map(it => Object.assign(it, {why: e.code})));
        }
        done++; msg();
      }
    }
    await Promise.all([worker(), worker(), worker()]);
    if (stop && stop.code === 'unauthorized') { if (await signIn()) toast('Signed in. Tap Read with AI again.'); return showTray(c); }

    const merged = PS.mergePolicies(found);
    merged.forEach(p => {
      const dup = c.policies.find(q => q.insurer && q.insurer === p.insurer && q.policyNo && q.policyNo === p.policyNo);
      if (dup) p.checks.duplicate = 'Looks like a policy already added (' + dup.policyNo + '). Delete one if it is the same.';
    });
    if (merged.length) { c.policies.push(...merged); c.updated = new Date().toISOString(); saveCases(); route(); }   // list behind the result box shows them

    /* keep only the pages that failed, so they can be retried */
    const failedSet = new Set(failed);
    tray.items.forEach(it => { if (!failedSet.has(it) && it.url) URL.revokeObjectURL(it.url); });
    tray.items = failed.map(it => Object.assign(it, {on: true}));
    tray.notes = [];
    const insurers = [...new Set(merged.map(p => p.insurer || 'Insurer not recognised'))];
    const checks = PS.pendingChecks({policies: merged}).length;
    const why = stop ? (AI_ERR[stop.code] || stop.code) : failed.length ? AI_ERR[failed[0].why] || 'Some pages could not be read.' : '';
    const el = sheet(`<h3>${merged.length ? `Found ${merged.length} polic${merged.length > 1 ? 'ies' : 'y'}` : 'No policy details found'}</h3>
      ${merged.length ? `<p>From ${insurers.length} insurer${insurers.length > 1 ? 's' : ''}: ${esc(insurers.join(', '))}.${checks ? ` <b>${checks} item${checks > 1 ? 's' : ''} to check</b>, marked orange.` : ''}</p>
        <ul class="found">${merged.map(p => `<li><i style="background:${PS.insurerColor(p.insurer)}"></i><b>${esc(p.insurer || '?')}</b> ${esc(p.productName || '')}${p.policyNo ? ' · ' + esc(p.policyNo) : ''}${p.parts > 1 ? ` <span class="muted">(joined from ${p.parts} parts)</span>` : ''}</li>`).join('')}</ul>`
      : '<p>The pages didn\'t show a policy the app could read. Try clearer photos or different PDF pages, or key it in.</p>'}
      ${failed.length ? `<div class="checks"><b>${failed.length} page${failed.length > 1 ? 's' : ''} could not be read.</b> ${esc(why)}</div>` : ''}
      <div style="display:flex;flex-direction:column;gap:8px">
        ${failed.length && !stop ? '<button class="btn block" id="fRetry">Try those pages again</button>' : ''}
        <button class="btn primary block" id="fOk">${merged.length ? 'Review policies' : 'OK'}</button></div>`);
    $('#sheet').dataset.lock = '1';
    const r = $('#fRetry', el); if (r) r.onclick = () => showTray(c);
    $('#fOk', el).onclick = () => { clearTray(); closeSheet(); if (merged.length) { toast('Tap each policy marked orange to check it.'); route(); } };
  }

  /* ---------- policy editor (used for photo results and keying in) ---------- */
  function editPolicy(c, pid) {
    const isNew = pid === 'new';
    const orig = isNew ? null : c.policies.find(p => p.id === pid);
    if (!isNew && !orig) { location.hash = '#/case/' + c.id; return; }
    const p = JSON.parse(JSON.stringify(orig || PS.blankPolicy()));
    let dirty = false;
    const insurerOpts = PS.INSURERS.map(i => `<option ${p.insurer === i.name ? 'selected' : ''}>${esc(i.name)}</option>`).join('');
    const flag = f => p.checks[f] ? ' flag' : '';
    const note = f => p.checks[f] ? `<div class="flagnote" data-f="${f}"><span>${esc(p.checks[f])}</span><button type="button" data-ok-f="${f}">Looks right</button></div>` : '';

    function draw() {
      app.innerHTML = bar(isNew ? 'Key in a policy' : (p.insurer || 'Check policy'), '#/case/' + c.id, isNew ? '' : `<button class="ib" id="delP" aria-label="Delete policy">${ICONS.trash}</button>`) + `
      <div class="wrap">
        ${p.source === 'photo' && Object.keys(p.checks).length + p.benefits.filter(b => b.check).length ? '<div class="checks"><b>Read from photo.</b> Orange items were unclear. Fix them or tap <b>Looks right</b>. Nothing is counted as zero when it is missing.</div>' : ''}
        ${note('duplicate')}${note('benefits')}
        <div class="card"><h2>Policy</h2>
          ${note('insurer')}
          <div class="f"><label for="pIns">Insurer${p.insurerRaw && p.insurerRaw !== p.insurer ? ` <span class="muted">(photo said "${esc(p.insurerRaw)}")</span>` : ''}</label><select id="pIns" class="${flag('insurer')}"><option value="">Choose…</option>${insurerOpts}</select></div>
          ${note('productName')}
          <div class="f"><label for="pProd">Plan / product name</label><input id="pProd" class="${flag('productName')}" value="${esc(p.productName)}"></div>
          <div class="grid2">
            <div class="f"><label for="pNo">Policy no. (last 4)</label><input id="pNo" value="${esc(p.policyNo)}" maxlength="12"></div>
            <div class="f"><label for="pStart">Start date</label><input id="pStart" type="date" class="${flag('startDate')}" value="${esc(p.startDate)}"></div>
          </div>
          <div class="f"><label for="pLA">Life assured</label><input id="pLA" value="${esc(p.lifeAssured)}" placeholder="If not the client (e.g. child)"></div>
          ${note('status')}
          <div class="grid2">
            <div class="f"><label for="pStat">Status</label><select id="pStat" class="${flag('status')}">${[['inforce', 'In force'], ['lapsed', 'Lapsed'], ['surrendered', 'Surrendered'], ['matured', 'Matured'], ['unknown', 'Not sure']].map(([v, l]) => `<option value="${v}" ${p.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
            <div class="f"><label for="pType">Type</label><select id="pType">${[['traditional', 'Traditional'], ['investment-linked', 'Investment-linked'], ['takaful', 'Takaful'], ['medical', 'Medical'], ['term', 'Term'], ['other', 'Other']].map(([v, l]) => `<option value="${v}" ${p.planType === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          </div>
          ${note('premium')}
          <div class="grid2">
            <div class="f"><label for="pPrem">Premium (RM)</label><input id="pPrem" inputmode="decimal" class="${flag('premium')}" value="${money(p.premium)}"></div>
            <div class="f"><label for="pFreq">Paid</label><select id="pFreq" class="${flag('premium')}"><option value="">?</option>${['monthly', 'quarterly', 'half-yearly', 'yearly', 'single'].map(v => `<option ${p.premiumFreq === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
          </div>
          ${note('cashValue')}${note('bonus')}
          <div class="grid3">
            <div class="f"><label for="pCV">Cash value</label><input id="pCV" inputmode="decimal" class="${flag('cashValue')}" value="${money(p.cashValue)}"></div>
            <div class="f"><label for="pCVD">As at</label><input id="pCVD" type="date" value="${esc(p.cashValueDate)}"></div>
            <div class="f"><label for="pBon">Bonus</label><input id="pBon" inputmode="decimal" class="${flag('bonus')}" value="${money(p.bonus)}"></div>
          </div>
        </div>
        <div class="card"><h2>Benefits &amp; riders</h2>
          <div id="bens">${p.benefits.map(benHTML).join('')}</div>
          <button class="btn block" id="addB">+ Add benefit</button>
          <p class="muted" style="margin-top:8px">"Death / TPD" that pays once: add it twice, once as Death and once as TPD. The app remembers categories you choose for each benefit name.</p>
        </div>
      </div>
      <div class="dock"><a class="btn" href="#/case/${c.id}">Cancel</a><button class="btn primary" id="saveP">Save policy</button></div>`;
      wire();
    }
    function benHTML(b) {
      const cat = PS.catOf(b.cat), med = b.cat === 'medical', amtLabel = b.cat === 'hospital' ? 'Amount per day (RM)' : 'Sum assured (RM)';
      return `<div class="ben ${b.check ? 'flagged' : ''}" data-b="${b.id}">
        <div class="ben-h"><span class="dot" style="background:${cat.color}"></span><b>${esc(cat.label)}</b><button type="button" data-delb aria-label="Remove benefit">${ICONS.trash}</button></div>
        ${b.check ? `<div class="flagnote"><span>${esc(b.check)}</span><button type="button" data-okb>Looks right</button></div>` : ''}
        <div class="f"><label>Benefit name</label><input data-k="name" value="${esc(b.name)}" placeholder="As printed, e.g. Critical Illness Rider"></div>
        <div class="grid2"><div class="f"><label>Category</label><select data-k="cat">${PS.CATS.map(k => `<option value="${k.id}" ${b.cat === k.id ? 'selected' : ''}>${esc(k.label)}</option>`).join('')}</select></div>
        <div class="f"><label>Covered to age</label><input data-k="untilAge" inputmode="numeric" value="${money(b.untilAge)}"></div></div>
        ${med ? `<div class="grid2"><div class="f"><label>Annual limit (RM)</label><input data-k="annual" inputmode="decimal" value="${money(b.annual)}"></div>
          <div class="f"><label>Lifetime limit (RM)</label><input data-k="lifetime" inputmode="decimal" value="${money(b.lifetime)}" ${b.lifetimeUnlimited ? 'disabled' : ''}></div></div>
          <label class="chk"><input type="checkbox" data-k="lifetimeUnlimited" ${b.lifetimeUnlimited ? 'checked' : ''}> No lifetime limit</label>
          <div class="grid2"><div class="f"><label>Room &amp; board / day</label><input data-k="roomBoard" inputmode="decimal" value="${money(b.roomBoard)}"></div>
          <div class="f"><label>Deductible (RM)</label><input data-k="deductible" inputmode="decimal" value="${money(b.deductible)}"></div></div>`
        : b.cat === 'waiver' ? '' : `<div class="f"><label>${amtLabel}</label><input data-k="amount" inputmode="decimal" value="${money(b.amount)}" placeholder="Leave blank if not stated"></div>`}
      </div>`;
    }
    function wire() {
      const bind = (sel, fn) => { const el = $(sel); el.addEventListener('change', () => { fn(el.value); dirty = true; }); };
      bind('#pIns', v => { p.insurer = v; delete p.checks.insurer; });
      bind('#pProd', v => { p.productName = v.trim(); delete p.checks.productName; });
      bind('#pNo', v => { p.policyNo = PS.maskPolicyNo(v); $('#pNo').value = p.policyNo; });
      bind('#pStart', v => { p.startDate = v; delete p.checks.startDate; });
      bind('#pLA', v => { p.lifeAssured = v.trim(); });
      bind('#pStat', v => { p.status = v; if (v !== 'unknown') delete p.checks.status; });
      bind('#pType', v => { p.planType = v; });
      bind('#pPrem', v => { p.premium = PS.parseAmount(v).value; if (p.premium != null && p.premiumFreq) delete p.checks.premium; });
      bind('#pFreq', v => { p.premiumFreq = v; if (p.premium != null && v) delete p.checks.premium; });
      bind('#pCV', v => { p.cashValue = PS.parseAmount(v).value; delete p.checks.cashValue; });
      bind('#pCVD', v => { p.cashValueDate = v; });
      bind('#pBon', v => { p.bonus = PS.parseAmount(v).value; delete p.checks.bonus; });
      $$('#pPrem,#pCV,#pBon').forEach(inp => inp.addEventListener('change', () => {
        const v = PS.parseAmount(inp.value);
        if (v.value != null) { inp.value = money(v.value); inp.classList.remove('flag'); }
        else if (inp.value.trim()) { inp.classList.add('flag'); toast('Could not read "' + inp.value + '" as an amount. Use numbers like 350 or 18k.'); }
      }));
      $$('[data-ok-f]').forEach(b => b.onclick = () => { delete p.checks[b.dataset.okF]; dirty = true; keep(draw); });
      $('#addB').onclick = () => { p.benefits.push(PS.blankBenefit('death')); dirty = true; keep(draw); $$('.ben').pop().scrollIntoView({behavior: 'smooth', block: 'center'}); };
      $$('.ben').forEach(el => {
        const b = p.benefits.find(x => x.id === el.dataset.b);
        $('[data-delb]', el).onclick = () => { p.benefits = p.benefits.filter(x => x !== b); dirty = true; keep(draw); };
        const ok = $('[data-okb]', el); if (ok) ok.onclick = () => { delete b.check; dirty = true; keep(draw); };
        $$('[data-k]', el).forEach(inp => inp.addEventListener('change', () => {
          const k = inp.dataset.k; dirty = true;
          if (k === 'name') b.name = inp.value.trim();
          else if (k === 'cat') { b.cat = inp.value; b.catSet = true; return keep(draw); }
          else if (k === 'lifetimeUnlimited') { b.lifetimeUnlimited = inp.checked; if (inp.checked) b.lifetime = null; return keep(draw); }
          else { const v = PS.parseAmount(inp.value); b[k] = v.value; if (k === 'lifetime' && v.unlimited) { b.lifetimeUnlimited = true; return keep(draw); }
            if (v.value != null) { inp.value = money(v.value); inp.classList.remove('flag'); }
            else if (inp.value.trim() && !v.unlimited) { inp.classList.add('flag'); toast('Could not read "' + inp.value + '" as an amount. Use numbers like 150000 or 150k.'); }
            /* clear the flag in place: a full redraw here would swallow a tap on Save made while typing */
            if (v.value != null && (k === 'amount' || k === 'annual') && b.check && /Amount|Annual/.test(b.check)) {
              delete b.check; el.classList.remove('flagged'); const fn = $('.flagnote', el); if (fn) fn.remove();
            } }
        }));
      });
      $('#saveP').onclick = () => {
        if (!p.insurer && !p.productName) { toast('Choose the insurer or type the plan name first.'); return; }
        p.benefits = p.benefits.filter(b => b.name || b.amount != null || b.annual != null);
        /* remember categories the agent chose, so the next photo is read the same way */
        p.benefits.forEach(b => { if (b.name && b.catSet) { learned[PS.learnKey(b.name)] = b.cat; } delete b.catSet; });
        save('pspt.learned', learned);
        if (!p.benefits.length) p.checks.benefits = 'No benefits yet: add at least one'; else delete p.checks.benefits;
        if (isNew) c.policies.push(p); else c.policies[c.policies.indexOf(orig)] = p;
        c.updated = new Date().toISOString(); saveCases(); dirty = false;
        const next = c.policies.find(q => q !== p && PS.pendingChecks({policies: [q]}).length);
        if (next) { toast('Saved. Next one to check.'); location.hash = '#/case/' + c.id + '/policy/' + next.id; }
        else { toast('Saved'); location.hash = '#/case/' + c.id; }
      };
      const dp = $('#delP'); if (dp) dp.onclick = async () => {
        if (await confirmBox('Delete this policy?', esc((p.insurer || '') + ' ' + (p.productName || '')) + ' will be removed from ' + esc(c.client.name) + '\'s summary.', 'Delete', true)) {
          c.policies = c.policies.filter(q => q.id !== pid); c.updated = new Date().toISOString(); saveCases(); dirty = false; location.hash = '#/case/' + c.id;
        }
      };
    }
    /* redraw without losing the scroll position */
    function keep(fn) { const y = scrollY; fn(); scrollTo(0, y); }
    draw();
    leaveGuard = () => dirty;
  }
  let leaveGuard = null;
  addEventListener('beforeunload', e => { if (leaveGuard && leaveGuard()) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- summary + PDF ---------- */
  function summary(c) {
    const checks = PS.pendingChecks(c);
    const pages = Report.build(c, agent(), PS, {incomplete: checks.length > 0});
    const fit = Math.min(1, (Math.min(innerWidth, 560) - 28) / 794);
    app.innerHTML = bar('Summary · ' + (c.client.name || ''), '#/case/' + c.id) + `
      <div class="wrap">
        ${checks.length ? `<div class="checks"><b>${checks.length} item${checks.length > 1 ? 's' : ''} not confirmed yet.</b> Best to fix them first, but you can still create the PDF: missing amounts show as "Not stated" and are left out of the totals, and amounts read from photos are used as read.<ul>${checks.slice(0, 8).map(k => {
          const p = c.policies.find(x => x.id === k.policyId);
          return `<li><a href="#/case/${c.id}/policy/${p.id}">${esc(p.insurer || 'Policy')}</a>: ${esc(k.why)}</li>`;
        }).join('')}</ul></div>` : ''}
        ${settings.name ? '' : '<div class="checks"><b>Your name is missing</b> from the PDF footer. <a href="#" id="setN">Add it in Settings</a>.</div>'}
        <div class="seg" role="group"><button aria-pressed="true" data-v="0">At a glance</button><button aria-pressed="false" data-v="1">Side by side</button><button aria-pressed="false" data-v="2">Details</button></div>
        <div class="pages" id="pages">${pages.map((h, i) => `<div class="pagebox" data-i="${i}" style="width:${Math.round(794 * fit)}px;height:${Math.round(1123 * fit)}px">${h.replace('class="rp-page"', `class="rp-page" style="transform:scale(${fit})"`)}</div>`).join('')}</div>
      </div>
      <div class="dock"><button class="btn primary" id="mk">${checks.length ? 'Create PDF anyway' : 'Create PDF'}</button></div>`;
    $$('.seg button').forEach(b => b.onclick = () => {
      $$('.seg button').forEach(x => x.setAttribute('aria-pressed', x === b));
      const target = $$('.pagebox')[Math.min(+b.dataset.v, pages.length - 1)];
      scrollTo({top: target.getBoundingClientRect().top + scrollY - 70, behavior: 'smooth'});
    });
    const sn = $('#setN'); if (sn) sn.onclick = e => { e.preventDefault(); openSettings(); };
    $('#mk').onclick = async () => {
      if (checks.length && !(await confirmBox('Create PDF with incomplete info?', checks.length + ' item' + (checks.length > 1 ? 's are' : ' is') + ' not confirmed. Missing amounts show as <b>Not stated</b> and are left out of the totals. Page 1 tells the client some details were not available.', 'Create anyway'))) return;
      makePDF(c, pages);
    };
  }

  async function makePDF(c, pages) {
    const box = sheet('<h3>Creating PDF…</h3><div class="spin"></div><p id="pg" style="text-align:center">Page 1</p>');
    $('#sheet').dataset.lock = '1';
    const stage = document.createElement('div');
    stage.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px';
    stage.innerHTML = pages.join('');
    document.body.appendChild(stage);
    let blob;
    try { blob = await Report.toPDF(stage, (i, n) => { $('#pg', box).textContent = `Page ${i} of ${n}`; }); }
    catch (e) { stage.remove(); closeSheet(); toast('Could not create the PDF. Try again.'); console.error(e); return; }
    stage.remove();
    const fname = `Policy Summary - ${(c.client.name || 'Client').replace(/[^\w .-]+/g, '')} - ${new Date().toISOString().slice(0, 10)}.pdf`;
    const file = new File([blob], fname, {type: 'application/pdf'});
    const url = URL.createObjectURL(blob);
    window.__lastPdf = blob; // for the local test run
    const canShare = navigator.canShare && navigator.canShare({files: [file]});
    const el = sheet(`<h3>PDF ready</h3><p><b>${esc(fname)}</b><br>${pages.length} pages · ${(blob.size / 1024).toFixed(0)} KB</p>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${canShare ? '<button class="btn primary block" id="share">Send to client…</button>' : ''}
        <a class="btn ${canShare ? '' : 'primary'} block" href="${url}" download="${esc(fname)}" id="dl">Save / open PDF</a>
        <button class="btn ghost block" data-x>Close</button></div>`);
    $('[data-x]', el).onclick = () => { closeSheet(); URL.revokeObjectURL(url); };
    const sh = $('#share', el);
    if (sh) sh.onclick = async () => {
      if (!(await confirmBox('Send to ' + (c.client.name || 'client') + '?', `Check the name on page 1 is <b>${esc(c.client.name)}</b> and that you are sending to the right person. Your phone will ask which app to use (WhatsApp, email…).`, 'Choose app'))) return;
      try { await navigator.share({files: [file], title: fname, text: 'Hi ' + (c.client.name || '') + ', here is the summary of your insurance policies we went through.'}); }
      catch (e) { if (e.name !== 'AbortError') toast('Sharing failed. Use Save / open PDF instead.'); }
    };
  }

  /* ---------- settings ---------- */
  /* ---------- sync between this agent's own devices ----------
     Clients are encrypted here with a key made from the agent's name + personal sync passphrase.
     The team server stores only scrambled data under a vault id; it cannot read clients, and other agents
     (or the app owner) cannot open them without the passphrase. */
  let syncCfg = load('pspt.sync', null), syncTimer = null, syncing = null, syncState = '', lastPulled = 0;
  const te = new TextEncoder(), td = new TextDecoder();
  const toB64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const fromB64 = b => Uint8Array.from(atob(b), ch => ch.charCodeAt(0));
  const syncName = n => String(n || '').trim().toLowerCase().replace(/\s+/g, ' ');
  async function deriveSync(name, pass) {
    const base = await crypto.subtle.importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveBits']);
    const bits = new Uint8Array(await crypto.subtle.deriveBits({name: 'PBKDF2', salt: te.encode('pspt-sync:' + syncName(name)), iterations: 250000, hash: 'SHA-256'}, base, 512));
    return {k: toB64(bits.slice(0, 32)), vault: [...bits.slice(32)].map(b => b.toString(16).padStart(2, '0')).join('')};
  }
  const aesKey = () => crypto.subtle.importKey('raw', fromB64(syncCfg.k), 'AES-GCM', false, ['encrypt', 'decrypt']);
  async function seal(key, obj) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({name: 'AES-GCM', iv}, key, te.encode(JSON.stringify(obj))));
    return {iv: toB64(iv), ct: toB64(ct)};
  }
  async function open(key, it) { return JSON.parse(td.decode(await crypto.subtle.decrypt({name: 'AES-GCM', iv: fromB64(it.iv)}, key, fromB64(it.ct)))); }

  function scheduleSync() { if (!syncCfg) return; clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, 1500); }
  async function syncNow() {
    if (!syncCfg || !CFG.api || !navigator.onLine) return;
    if (!session()) { syncState = 'signin'; updateSyncLine(); return; }
    if (syncing) return syncing;
    syncing = (async () => {
      try {
        const key = await aesKey(), vault = syncCfg.vault;
        const server = (await post({op: 'psget', vault})).items || {};
        let pulled = 0; lastPulled = 0;
        let pulledR = 0;
        for (const id of Object.keys(server)) {
          if (id.startsWith('r_')) {   // a day's 三访 reflection, not a client
            const s = server[id], date = id.slice(2), loc = reports[date];
            if (!s.d && (!loc || !loc.updated || s.u > loc.updated)) { try { reports[date] = await open(key, s); pulledR++; } catch (e) {} }
            continue;
          }
          const s = server[id], local = getCase(id), mine = [local && local.updated, tombs[id]].filter(Boolean).sort().pop();
          if (mine && s.u <= mine) continue;
          if (s.d) { if (local) { cases = cases.filter(x => x.id !== id); pulled++; } tombs[id] = s.u; continue; }
          let c; try { c = await open(key, s); } catch (e) { continue; }   // not ours / damaged: leave it
          if (local) cases[cases.indexOf(local)] = c; else cases.push(c);
          pulled++;
        }
        const push = {};
        for (const c of cases) if (!c.sample && (!server[c.id] || server[c.id].u < c.updated)) push[c.id] = Object.assign({u: c.updated}, await seal(key, c));
        for (const id of Object.keys(tombs)) if (server[id] && !server[id].d && server[id].u < tombs[id]) push[id] = {u: tombs[id], d: true};
        for (const date of Object.keys(reports)) { const r = reports[date], sid = 'r_' + date; if (r.updated && (!server[sid] || server[sid].u < r.updated)) push[sid] = Object.assign({u: r.updated}, await seal(key, r)); }
        if (pulledR) save('pspt.reports', reports);
        if (Object.keys(push).length) await post({op: 'psput', vault, items: push});
        save('pspt.tombs', tombs);
        lastPulled = pulled;
        if (pulled) {
          save('pspt.cases', cases);
          const h = location.hash.replace(/^#\/?/, '').split('/');
          if (!h[0] || (h[0] === 'case' && !h[2]) || (h[0] === 'case' && !getCase(h[1]))) route();
          toast(`Updated ${pulled} client${pulled > 1 ? 's' : ''} from your other device`);
        }
        syncCfg.last = new Date().toISOString(); save('pspt.sync', syncCfg); syncState = '';
      } catch (e) {
        syncState = e.code === 'invalid_request' ? 'server' : e.code === 'unauthorized' ? 'signin' : 'offline';
      } finally { syncing = null; updateSyncLine(); }
    })();
    return syncing;
  }
  function syncLine() {
    if (!syncCfg) return '<button class="syncline" id="syncSet">☁︎ Sync off · <u>Use on iPad &amp; phone</u></button>';
    const t = syncCfg.last ? new Date(syncCfg.last).toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'}) : '';
    const msg = syncState === 'server' ? 'Sync waiting for the team server update' : syncState === 'signin' ? 'Sync paused: sign in again' : syncState === 'offline' ? 'Sync paused: no connection' : syncing ? 'Syncing…' : t ? 'Synced ' + t : 'Sync on';
    return `<button class="syncline${syncState ? ' warn' : ''}" id="syncSet">☁︎ ${esc(msg)} · ${esc(syncCfg.name)}</button>`;
  }
  function updateSyncLine() { const el = $('#syncLine'); if (el) { el.innerHTML = syncLine(); $('#syncSet').onclick = openSync; } }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
  setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 60000);
  addEventListener('online', () => syncNow());

  async function openSync() {
    if (syncCfg) {
      const el = sheet(`<div class="sheet-top"><h3>Sync my devices</h3><button type="button" class="xbtn" data-close aria-label="Close">✕</button></div>
        <p>On as <b>${esc(syncCfg.name)}</b>. Clients you add or change here appear on your other devices that use the same name and sync passphrase. ${syncCfg.last ? 'Last synced ' + esc(new Date(syncCfg.last).toLocaleString('en-GB')) + '.' : ''}</p>
        ${syncState === 'server' ? '<div class="checks">The team server needs its update before sync can run. Your clients are safe on this device.</div>' : ''}
        ${syncState === 'signin' ? '<div class="checks">Sync is paused because the team sign-in was not accepted (the team code may have changed). Sign in again to continue. Your sync stays on.</div>' : ''}
        <div style="display:flex;flex-direction:column;gap:8px">${syncState === 'signin' ? '<button class="btn primary block" id="sIn">Sign in again</button>' : '<button class="btn primary block" id="sNow">Sync now</button>'}<button class="btn block" data-close>Close</button></div>
        <button class="tinylink" id="sOff">Stop syncing this device…</button>`);
      const sn = $('#sNow', el); if (sn) sn.onclick = async () => { sn.textContent = 'Syncing…'; await syncNow(); closeSheet(); toast(syncState ? 'Sync could not finish' : 'Synced'); route(); };
      const si = $('#sIn', el); if (si) si.onclick = async () => { if (await signIn()) { syncState = ''; await syncNow(); toast(syncState ? 'Sync could not finish' : 'Synced'); route(); } };
      $('#sOff', el).onclick = async () => {
        if (!(await confirmBox('Stop syncing this device?', 'This device will no longer receive changes from your other devices, and its changes won\'t reach them. Clients already here stay. To sync again you will need your sync passphrase.', 'Stop syncing', true))) return;
        if (!(await confirmBox('Are you sure?', 'Most agents never need this. Only stop syncing if this device is being given away or shared.', 'Yes, stop syncing', true))) return;
        syncCfg = null; localStorage.removeItem('pspt.sync'); route();
      };
      return;
    }
    if (!session() && !(await signIn())) return;
    const el = sheet(`<div class="sheet-top"><h3>Use on iPad &amp; phone</h3><button type="button" class="xbtn" data-close aria-label="Close">✕</button></div>
      <p>Set a personal sync passphrase. Type the <b>same name and passphrase</b> on each of your devices and your clients will match. They are locked with your passphrase before leaving this device, so other agents and REDEFINE cannot read them.</p>
      <div class="f"><label for="yName">Your name (same on every device)</label><input id="yName" autocomplete="name" value="${esc(settings.name || (session() || {}).name || '')}"></div>
      <div class="f"><label for="yPw">Sync passphrase (at least 8 characters)</label><input id="yPw" type="password" autocomplete="new-password"></div>
      <div class="f"><label for="yPw2">Type it again</label><input id="yPw2" type="password" autocomplete="new-password"></div>
      <p class="muted" style="color:var(--warn)">Write it down. If you forget it, the synced copy cannot be opened (clients on your devices stay). Don't use the team code.</p>
      <p class="muted" id="yMsg" role="alert" style="color:var(--err);min-height:18px"></p>
      <div class="row"><button class="btn" data-close>Cancel</button><button class="btn primary" id="yGo">Turn on sync</button></div>`);
    $$('[data-close]', el).forEach(b => b.onclick = closeSheet);
    $('#yGo', el).onclick = async () => {
      const name = $('#yName', el).value.trim(), pw = $('#yPw', el).value, msg = $('#yMsg', el);
      if (!name) return (msg.textContent = 'Enter your name.');
      if (pw.length < 8) return (msg.textContent = 'Use at least 8 characters.');
      if (pw !== $('#yPw2', el).value) return (msg.textContent = 'The two passphrases are different.');
      if ((session() || {}).code === pw) return (msg.textContent = 'Use your own passphrase, not the team code.');
      $('#yGo', el).disabled = true; $('#yGo', el).textContent = 'Turning on…';
      syncCfg = Object.assign({name}, await deriveSync(name, pw)); save('pspt.sync', syncCfg);
      await syncNow();
      closeSheet();
      toast(syncState === 'server' ? 'Sync is set. It starts once the team server is updated.' : syncState ? 'Sync is set. It will finish when you are online.' : lastPulled ? 'Sync is on. ' + lastPulled + ' client(s) came from your other device.' : 'Sync is on. If your other device already syncs and nothing appeared, check the name and passphrase match.');
      route();
    };
  }

  /* ======================= REDEFINE On Field: record a meeting -> follow-up PDF + farm ======================= */
  const FU = window.FU, KC = window.REDEFINE_CONCEPTS;
  const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  /* the work in progress survives switching apps or a reload (no audio or photos kept) */
  let rec = load('pspt.rec', null);
  const saveRec = () => save('pspt.rec', rec ? Object.assign({}, rec, {photos: undefined}) : null);
  let recPhotos = [];   // data URLs of note photos, memory only
  let mediaRec = null, recTimer = null;

  async function startRecord(caseId) {
    if (rec && (rec.transcript || rec.draft)) {
      if (rec.caseId === (caseId || null)) { location.hash = '#/record' + (caseId ? '/' + caseId : ''); return; }
      const other = rec.caseId && getCase(rec.caseId);
      if (!(await confirmBox('You have an unfinished note', `There is an unsent note${other ? ' for ' + esc(other.client.name) : ''}. Start a new one and discard it?`, 'Discard and start new', true))) {
        location.hash = '#/record' + (rec.caseId ? '/' + rec.caseId : ''); return;
      }
    }
    rec = {caseId: caseId || null, step: 'capture', transcript: '', lang: settings.fuLang || 'zh', draft: null, started: Date.now()};
    recPhotos = []; saveRec();
    location.hash = '#/record' + (caseId ? '/' + caseId : '');
  }

  function recordScreen(caseId) {
    if (!rec || rec.caseId !== (caseId || null)) { rec = {caseId: caseId || null, step: 'capture', transcript: '', lang: settings.fuLang || 'zh', draft: null}; recPhotos = []; saveRec(); }
    const c = caseId ? getCase(caseId) : null;
    const back = c ? '#/case/' + c.id : '#/';
    const steps = ['capture', 'transcript', 'review'];
    const stepBar = `<div class="steps">${['Speak', 'Check text', 'Review & send'].map((s, i) => `<span class="${steps.indexOf(rec.step) >= i ? 'on' : ''}">${i + 1}. ${s}</span>`).join('')}</div>`;
    const discard = `<button class="ib" id="recX" aria-label="Discard">${ICONS.trash}</button>`;
    if (rec.step === 'review' && rec.draft) return reviewScreen(c, back, stepBar, discard);
    if (rec.step === 'transcript') {
      app.innerHTML = bar('Record a meeting', back, discard) + `<div class="wrap">${stepBar}
        <div class="card"><h2>${c ? 'Meeting with ' + esc(c.client.name) : 'Your note'}</h2>
          <p class="muted" style="margin-bottom:8px">Fix any wrong names or numbers. Hokkien and Cantonese words may be spelled oddly; the AI understands them, but numbers must be right.</p>
          <div class="f"><textarea id="tx" rows="10">${esc(rec.transcript)}</textarea></div>
          <button class="btn sm" id="more">🎙 Add more by voice</button>
        </div>
        <div class="card"><h2>Letter language</h2>${langChips()}</div>
        ${photoStrip()}
      </div>
      <div class="dock"><button class="btn primary" id="draft">✨ Draft follow-up</button></div>`;
      wireCommon(c);
      $('#tx').addEventListener('input', () => { rec.transcript = $('#tx').value; saveRec(); });
      $('#more').onclick = () => { rec.step = 'capture'; saveRec(); route(); };
      $('#draft').onclick = () => draftWithAI(c);
      return;
    }
    /* capture */
    app.innerHTML = bar('Record a meeting', back, rec.transcript ? discard : '') + `<div class="wrap">${stepBar}
      ${c ? '' : `<div class="card"><h2>Which client?</h2><div class="f"><select id="pickC"><option value="">New client (the app takes the name from what you say)</option>${cases.filter(x => !x.sample).sort((a, b) => (b.updated || '').localeCompare(a.updated || '')).map(x => `<option value="${x.id}">${esc(x.client.name)}${x.client.nickname ? ' (' + esc(x.client.nickname) + ')' : ''}</option>`).join('')}</select></div></div>`}
      <div class="card mic-card">
        <p class="muted">Tell it like you'd tell your leader. Mix Mandarin, Hokkien, Cantonese, English and Malay freely.</p>
        <button class="mic" id="mic" aria-label="Start recording"><span></span></button>
        <div class="mic-time" id="micT">Tap to record · up to 5 min</div>
        ${rec.transcript ? `<p class="muted" style="margin-top:8px">${rec.transcript.length} characters recorded so far. Recording again adds to it.</p>` : ''}
      </div>
      <details class="card guide" ${load('pspt.guideClosed', false) ? '' : 'open'} id="guideQ"><summary><b>Guide: what to cover</b> <span class="muted">(no need to follow all)</span></summary>
        <ol>${FU.QUESTIONS.map(q => `<li>${esc(q.zh)}<span>${esc(q.en)}</span></li>`).join('')}</ol></details>
      <details class="card"><summary><b>Type instead</b> <span class="muted">(or use your keyboard's mic)</span></summary>
        <div class="f" style="margin-top:8px"><textarea id="typed" rows="6" placeholder="今天见陈先生, 35岁, 两个孩子, 担心 medical 不够……"></textarea></div>
        <button class="btn sm" id="useTyped">Use this text</button></details>
      ${photoStrip()}
      ${rec.transcript ? '<p style="text-align:center"><button class="btn" id="toTx">Next: check the text →</button></p>' : ''}
    </div>`;
    wireCommon(c);
    const pick = $('#pickC'); if (pick) pick.onchange = () => { if (pick.value) { const id = pick.value; rec.caseId = id; saveRec(); location.hash = '#/record/' + id; } };
    $('#mic').onclick = () => (mediaRec ? stopMic() : startMic(c));
    $('#guideQ').addEventListener('toggle', e => save('pspt.guideClosed', !e.target.open));
    $('#useTyped').onclick = () => { const t = $('#typed').value.trim(); if (!t) return; rec.transcript = (rec.transcript ? rec.transcript + '\n' : '') + t; rec.step = 'transcript'; saveRec(); route(); };
    const tt = $('#toTx'); if (tt) tt.onclick = () => { rec.step = 'transcript'; saveRec(); route(); };
  }

  function langChips() {
    return `<div class="seg" id="langs">${[['zh', '中文'], ['en', 'English'], ['ms', 'Bahasa']].map(([k, l]) => `<button type="button" data-l="${k}" aria-pressed="${rec.lang === k}">${l}</button>`).join('')}</div>`;
  }
  function photoStrip() {
    return `<div class="card"><h2>Photos of notes or drawings <span class="muted">(optional, go into the PDF)</span></h2>
      <div class="thumbs">${recPhotos.map((p, i) => `<button type="button" class="thx" data-i="${i}" aria-label="Remove photo"><img src="${p}" alt=""><span>✕</span></button>`).join('')}</div>
      <div class="row"><button class="btn sm" id="phCam">${ICONS.cam.replace('<svg ', '<svg width="18" height="18" ')}Take photo</button><button class="btn sm" id="phPick">+ Photos</button></div>
      <input type="file" id="phCamIn" accept="image/*" capture="environment" hidden><input type="file" id="phIn" accept="image/*" multiple hidden></div>`;
  }
  function wireCommon(c) {
    const x = $('#recX'); if (x) x.onclick = async () => {
      if (!(await confirmBox('Discard this note?', 'The recording text and draft will be deleted. Nothing has been saved to the client yet.', 'Discard', true))) return;
      rec = null; recPhotos = []; saveRec(); location.hash = c ? '#/case/' + c.id : '#/';
    };
    $$('#langs button').forEach(b => b.onclick = () => { rec.lang = b.dataset.l; saveRec(); $$('#langs button').forEach(y => y.setAttribute('aria-pressed', y === b)); });
    $$('.thx').forEach(b => b.onclick = () => { recPhotos.splice(+b.dataset.i, 1); route(); });
    const add = async files => {
      for (const f of files) { try { recPhotos.push('data:image/jpeg;base64,' + await toJpegB64(f, 1400)); } catch (e) { toast('One photo could not be opened.'); } }
      route();
    };
    $('#phCam').onclick = () => $('#phCamIn').click();
    $('#phPick').onclick = () => $('#phIn').click();
    ['#phCamIn', '#phIn'].forEach(s => { $(s).onchange = e => { const f = [...e.target.files]; e.target.value = ''; if (f.length) add(f); }; });
  }

  /* ---------- microphone ---------- */
  async function startMic(c) {
    if (!navigator.mediaDevices || !window.MediaRecorder) return toast('This browser cannot record. Use "Type instead" with your keyboard mic.');
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true}}); }
    catch (e) { return sheet('<h3>Microphone not allowed</h3><p>Allow the microphone for this app in your phone settings (Safari / Chrome → this site → Microphone), or use "Type instead" with your keyboard mic.</p><button class="btn block" data-close>OK</button>'); }
    const type = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
    const chunks = [];
    mediaRec = new MediaRecorder(stream, type ? {mimeType: type, audioBitsPerSecond: 48000} : undefined);
    mediaRec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    mediaRec.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      clearInterval(recTimer); mediaRec = null;
      const blob = new Blob(chunks, {type: (type || 'audio/mp4').split(';')[0]});
      if (blob.size < 2000) { toast('Too short. Try again.'); return route(); }
      await transcribeBlob(blob, c);
    };
    mediaRec.start(1000);
    const t0 = Date.now();
    $('#mic').classList.add('on'); $('#mic').setAttribute('aria-label', 'Stop recording');
    recTimer = setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000), el = $('#micT');
      if (el) el.textContent = `● ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} · tap to stop`;
      if (s >= 300) stopMic();
    }, 500);
  }
  function stopMic() { if (mediaRec && mediaRec.state !== 'inactive') mediaRec.stop(); }

  const blobB64 = blob => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = bad; r.readAsDataURL(blob); });
  async function transcribeBlob(blob, c) {
    if (!session() && !(await signIn())) { toast('Sign in to turn voice into text, or use "Type instead".'); return route(); }
    sheet('<h3>Turning your voice into text…</h3><div class="spin"></div><p style="text-align:center">Usually 5–20 seconds.</p>');
    $('#sheet').dataset.lock = '1';
    try {
      const name = c ? c.client.name + (c.client.nickname ? ' / ' + c.client.nickname : '') : '';
      const r = await post({op: 'transcribe', audio: await blobB64(blob), mime: blob.type, hint: FU.hintFor(name)});
      const text = String(r.text || '').trim();
      closeSheet();
      if (!text) { toast('Nothing was heard. Try again closer to the phone.'); return route(); }
      rec.transcript = (rec.transcript ? rec.transcript + '\n' : '') + text; rec.step = 'transcript'; saveRec(); route();
    } catch (e) {
      closeSheet();
      const msg = e.code === 'invalid_request' ? 'Voice needs the latest team server update. For now, use "Type instead" with your keyboard mic.' : AI_ERR[e.code] || 'Could not turn the voice into text (' + (e.code || 'error') + '). Try again, or use "Type instead".';
      sheet(`<h3>Voice not converted</h3><p>${esc(msg)}</p><button class="btn block" data-close>OK</button>`);
    }
  }

  /* ---------- AI draft ---------- */
  async function draftWithAI(c) {
    if (!rec.transcript.trim()) return toast('Record or type what happened first.');
    if (!session() && !(await signIn())) return;
    sheet('<h3>Writing the follow-up…</h3><div class="spin"></div><p style="text-align:center">About 20–40 seconds.</p>');
    $('#sheet').dataset.lock = '1';
    try {
      const r = await post({op: 'ai', prompt: FU.buildPrompt({transcript: rec.transcript, lang: rec.lang, agentName: settings.name, client: c, concepts: KC.CONCEPTS, date: todayISO()})});
      if (r.truncated) throw {code: 'invalid_json'};
      rec.draft = FU.normalizeDraft(parseJSON(r.text), KC.CONCEPTS.map(k => k.id));
      rec.pdfName = c ? (c.client.nickname && !rec.draft.client.name ? c.client.nickname : (rec.draft.client.name || c.client.name)) : rec.draft.client.name;
      if (!c) { const m = FU.matchClient(cases, rec.draft.client.name); rec.matchId = m ? m.id : ''; }
      rec.step = 'review'; saveRec(); closeSheet(); route();
    } catch (e) {
      closeSheet();
      sheet(`<h3>Could not write the draft</h3><p>${esc(AI_ERR[e.code] || 'Something went wrong (' + (e.code || 'error') + '). Try again.')}</p><button class="btn block" data-close>OK</button>`);
    }
  }

  /* ---------- review & send ---------- */
  function reviewScreen(c, back, stepBar, discard) {
    const d = rec.draft, L = d.letter;
    /* drafts saved before the guide existed, and a sensible default time (when recording started) */
    d.qa = d.qa || {}; d.tags = d.tags && d.tags.length ? d.tags : FU.tagsFor(d.meeting.type); d.reportNote = d.reportNote || '';
    if (!d.time) { const t = new Date(rec.started || Date.now()); d.time = String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0'); }
    const ta = (id, v, rows) => `<textarea id="${id}" rows="${rows || 3}">${esc(v)}</textarea>`;
    const unchecked = d.numbers.filter(n => !n.ok).length;
    app.innerHTML = bar('Review & send', back, discard) + `<div class="wrap">${stepBar}
      <div class="card"><h2>Client</h2>
        ${c ? `<p><b>${esc(c.client.name)}</b> · saved to this client</p>` : `
          <div class="f"><label for="cWho">Save to</label><select id="cWho"><option value="">New client: ${esc(d.client.name || 'name below')}</option>${cases.filter(x => !x.sample).map(x => `<option value="${x.id}" ${rec.matchId === x.id ? 'selected' : ''}>${esc(x.client.name)}${x.client.nickname ? ' (' + esc(x.client.nickname) + ')' : ''}</option>`).join('')}</select></div>
          ${rec.matchId ? '<p class="muted" style="color:var(--warn);margin:-4px 0 8px">Looks like a client you already have. Check before saving.</p>' : ''}`}
        <div class="f"><label for="pdfN">Name on the PDF (how you address them)</label><input id="pdfN" value="${esc(rec.pdfName || '')}" placeholder="e.g. 陈先生 / Ah Seng / Puan Aminah"></div>
        <p class="muted">No phone or IC numbers are saved. Use a nickname or tag (e.g. "陈先生 Bayan Lepas") to tell people apart.</p>
      </div>
      ${d.numbers.length ? `<div class="card numcheck"><h2>Numbers to check (${unchecked} left)</h2><p class="muted" style="margin-bottom:6px">The AI may mishear numbers. Tick each one after checking. Fix wrong ones in the letter below.</p>
        ${d.numbers.map((n, i) => `<label class="chk"><input type="checkbox" data-n="${i}" ${n.ok ? 'checked' : ''}> <span><b>${esc(n.value)}</b> ${esc(n.what)}</span></label>`).join('')}</div>` : ''}
      <div class="card"><h2>Letter to the client</h2>${langChips()}
        <div class="f"><label>Title</label><input id="lTitle" value="${esc(L.title)}"></div>
        <div class="f"><label>Greeting</label>${ta('lGreet', L.greeting, 2)}</div>
        <div class="f"><label>What we talked about (blank line between paragraphs)</label>${ta('lDisc', L.discussed.join('\n\n'), 6)}</div>
        <div class="f"><label>What matters to them (one per line)</label>${ta('lMat', L.matters.join('\n'), 4)}</div>
        <div class="f"><label>My suggestion and why</label>${ta('lRec', L.recommendation, 4)}</div>
        <div class="f"><label>Next step</label>${ta('lNext', L.nextStep, 2)}</div>
        <div class="f"><label>Closing</label>${ta('lClose', L.closing, 2)}</div>
        <button class="btn sm" id="redo">↻ Rewrite in the chosen language</button>
      </div>
      <div class="card"><h2>Concept pages (${d.concepts.length} chosen)</h2><p class="muted" style="margin-bottom:8px">Tap to add or remove. The AI picked the ones that match what you talked about.</p>
        <div class="chips">${KC.CONCEPTS.map(k => `<button type="button" class="chip" data-k="${k.id}" aria-pressed="${d.concepts.includes(k.id)}">${esc(k.zh)}</button>`).join('')}</div></div>
      ${photoStrip()}
      <div class="card"><h2>WhatsApp message</h2>${ta('wa', d.whatsapp, 5)}</div>
      <div class="card"><h2>For your farm record <span class="muted">(only you see this)</span></h2>
        <div class="grid2"><div class="f"><label>Meeting type</label><select id="mType">${FU.MEETING_TYPES.map(t => `<option value="${t.id}" ${d.meeting.type === t.id ? 'selected' : ''}>${t.zh} · ${t.en}</option>`).join('')}</select></div>
        <div class="f"><label>Follow up on</label><input id="mDate" type="date" value="${esc(d.meeting.followUpDate)}"></div></div>
        <div class="f"><label>Summary</label>${ta('mSum', d.meeting.summary, 3)}</div>
        <div class="f"><label>Next step</label><input id="mNext" value="${esc(d.meeting.nextStep)}"></div>
        <div class="f"><label>Result</label><select id="mOut">${[['considering', 'Considering'], ['closed', 'Closed 🎉'], ['not_interested', 'Not interested'], ['none', 'No decision yet']].map(([v, l]) => `<option value="${v}" ${d.meeting.outcome === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <details class="qa" open><summary><b>Guide answers</b> <span class="muted">(filled from what you said; edit or leave blank)</span></summary>
          ${FU.QUESTIONS.map((q, i) => `<div class="f"><label>${i + 1}. ${esc(q.zh)}</label><input data-qa="${q.k}" value="${esc(d.qa[q.k] || '')}"></div>`).join('')}</details>
      </div>
      <div class="card"><h2>For today's 三访 report</h2>
        <div class="grid2"><div class="f"><label>Time</label><input id="mTime" type="time" value="${esc(d.time)}"></div>
        <div class="f"><label>Type</label><div class="tagrow">${FU.TAGS.map(t => `<button type="button" class="chip" data-tag="${t}" aria-pressed="${d.tags.includes(t)}">${t}</button>`).join('')}</div></div></div>
        <p class="muted" style="margin:-4px 0 8px">O = appointment made · F = follow up · P = presentation · R = recruitment</p>
        <div class="f"><label>Report note (what the group sees)</label>${ta('mNote', d.reportNote, 3)}</div>
      </div>
    </div>
    <div class="dock"><button class="btn" id="saveOnly">Save only</button><button class="btn primary" id="mkFU" ${unchecked ? 'disabled' : ''}>${unchecked ? `Check ${unchecked} number${unchecked > 1 ? 's' : ''}` : 'Create PDF & send'}</button></div>`;
    wireCommon(c);
    /* keep edits in the draft as the agent types */
    const bind = (id, fn) => $('#' + id).addEventListener('input', () => { fn($('#' + id).value); saveRec(); });
    bind('pdfN', v => rec.pdfName = v);
    bind('lTitle', v => L.title = v); bind('lGreet', v => L.greeting = v);
    bind('lDisc', v => L.discussed = v.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean));
    bind('lMat', v => L.matters = v.split('\n').map(s => s.trim()).filter(Boolean));
    bind('lRec', v => L.recommendation = v); bind('lNext', v => L.nextStep = v); bind('lClose', v => L.closing = v);
    bind('wa', v => d.whatsapp = v); bind('mSum', v => d.meeting.summary = v); bind('mNext', v => d.meeting.nextStep = v);
    $('#mType').onchange = e => { d.meeting.type = e.target.value; saveRec(); };
    $('#mDate').onchange = e => { d.meeting.followUpDate = e.target.value; saveRec(); };
    $('#mOut').onchange = e => { d.meeting.outcome = e.target.value; saveRec(); };
    $$('[data-qa]').forEach(inp => inp.addEventListener('input', () => { d.qa[inp.dataset.qa] = inp.value; saveRec(); }));
    $('#mTime').onchange = e => { d.time = e.target.value; saveRec(); };
    bind('mNote', v => d.reportNote = v);
    $$('[data-tag]').forEach(b => b.onclick = () => { const t = b.dataset.tag, i = d.tags.indexOf(t); if (i >= 0) d.tags.splice(i, 1); else d.tags.push(t); d.tags.sort((x, y) => FU.TAGS.indexOf(x) - FU.TAGS.indexOf(y)); b.setAttribute('aria-pressed', i < 0); saveRec(); });
    const who = $('#cWho'); if (who) who.onchange = () => { rec.matchId = who.value; saveRec(); };
    $$('[data-n]').forEach(b => b.onchange = () => { d.numbers[+b.dataset.n].ok = b.checked; saveRec(); const left = d.numbers.filter(n => !n.ok).length;
      const mk = $('#mkFU'); mk.disabled = !!left; mk.textContent = left ? `Check ${left} number${left > 1 ? 's' : ''}` : 'Create PDF & send'; $('.numcheck h2').textContent = `Numbers to check (${left} left)`; });
    $$('.chip').forEach(b => b.onclick = () => { const k = b.dataset.k, i = d.concepts.indexOf(k); if (i >= 0) d.concepts.splice(i, 1); else d.concepts.push(k); b.setAttribute('aria-pressed', i < 0); saveRec();
      $$('.card h2').forEach(h => { if (/^Concept pages/.test(h.textContent)) h.textContent = `Concept pages (${d.concepts.length} chosen)`; }); });
    $('#redo').onclick = async () => { if (await confirmBox('Rewrite the letter?', 'The AI writes the letter again from your note, in the chosen language. Your edits to the letter will be replaced.', 'Rewrite')) draftWithAI(c); };
    $('#saveOnly').onclick = () => finishMeeting(c, false);
    $('#mkFU').onclick = () => finishMeeting(c, true);
  }

  async function finishMeeting(c, withPdf) {
    const d = rec.draft, name = (rec.pdfName || '').trim();
    if (!name) { toast('Add the name to show on the PDF.'); return $('#pdfN').focus(); }
    /* the client this meeting belongs to */
    let target = c || (rec.matchId ? getCase(rec.matchId) : null);
    if (!target) {
      const now = new Date().toISOString();
      target = {id: PS.uid(), created: now, updated: now, client: {name: d.client.name || name, nickname: '', age: null, income: null}, guide: Object.assign({}, settings.guide), policies: [], meetings: []};
      cases.push(target);
    }
    let blob = null, file = null;
    if (withPdf) {
      const pages = Report.buildFollowUp({clientName: name, draft: d, agent: profile(), lang: rec.lang, photos: recPhotos, concepts: d.concepts.map(KC.byId).filter(Boolean)});
      const box = sheet('<h3>Creating PDF…</h3><div class="spin"></div><p id="pg" style="text-align:center"></p>');
      $('#sheet').dataset.lock = '1';
      const stage = document.createElement('div');
      stage.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px';
      stage.innerHTML = pages.join(''); document.body.appendChild(stage);
      try { blob = await Report.toPDF(stage, (i, n) => { const p = $('#pg', box); if (p) p.textContent = `Page ${i} of ${n}`; }); }
      catch (e) { stage.remove(); closeSheet(); return toast('Could not create the PDF. Try again.'); }
      stage.remove();
      file = new File([blob], `${(d.letter.title || 'Follow-up').replace(/[^\w一-鿿 .-]+/g, '')} - ${name.replace(/[^\w一-鿿 .-]+/g, '')}.pdf`, {type: 'application/pdf'});
      window.__lastPdf = blob;
    }
    const savedM = FU.applyToFarm(target, d, {date: todayISO(), sentPdf: withPdf});
    const next = {caseId: target.id, meetingId: savedM.id};
    saveCases();
    const wa = d.whatsapp, caseId = target.id;
    rec = null; recPhotos = []; saveRec();
    if (!withPdf) { pendingNext = next; if (location.hash === '#/case/' + caseId) route(); else location.hash = '#/case/' + caseId; return; }
    const url = URL.createObjectURL(blob);
    const canShare = navigator.canShare && navigator.canShare({files: [file]});
    const el = sheet(`<h3>Ready to send</h3><p><b>${esc(file.name)}</b> · ${(blob.size / 1024).toFixed(0)} KB<br>Saved to ${esc(target.client.name)}'s farm record.</p>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${canShare ? '<button class="btn primary block" id="shr">Send PDF to client…</button>' : ''}
        <button class="btn block" id="cpy">Copy WhatsApp message</button>
        <a class="btn ${canShare ? '' : 'primary'} block" href="${url}" download="${esc(file.name)}">Save / open PDF</a>
        <button class="btn ghost block" id="done">Done</button></div>
      <p class="muted" style="margin-top:8px">Tip: copy the message first, then send the PDF in WhatsApp and paste the message with it.</p>`);
    $('#sheet').dataset.lock = '1';
    $('#cpy', el).onclick = async () => { try { await navigator.clipboard.writeText(wa); toast('Message copied'); } catch (e) { toast('Copy did not work; select the text in the review screen next time.'); } };
    const s = $('#shr', el); if (s) s.onclick = async () => {
      if (!(await confirmBox('Send to ' + name + '?', 'Check you pick the right chat in WhatsApp. The message is copied too, so you can paste it with the PDF.', 'Choose app'))) return;
      try { await navigator.clipboard.writeText(wa); } catch (e) {}
      try { await navigator.share({files: [file], text: wa}); } catch (e) { if (e.name !== 'AbortError') toast('Sharing failed. Use Save / open PDF.'); }
    };
    $('#done', el).onclick = () => { URL.revokeObjectURL(url); closeSheet(); pendingNext = next; if (location.hash === '#/case/' + caseId) route(); else location.hash = '#/case/' + caseId; };
  }

  /* ---------- after saving a meeting: update REDEFINE Calendar and 定联 too ---------- */
  let pendingNext = null;
  function nextSheet({caseId, meetingId}) {
    const c = getCase(caseId); if (!c) return;
    const m = (c.meetings || []).find(x => x.id === meetingId) || {};
    const when = [m.followUpDate, m.nextStep].filter(Boolean).join(' · ');
    sheet(`<div class="sheet-top"><h3>✅ Saved to ${esc(c.client.name)}'s farm</h3><button type="button" class="xbtn" data-close aria-label="Close">✕</button></div>
      <p>Also update:</p>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${m.nextStep || m.followUpDate
          ? `<a class="btn primary block nx" target="_blank" rel="noopener" href="${esc(FU.calendarLink(settings.calendarUrl, {name: c.client.name, nextStep: m.nextStep, followUpDate: m.followUpDate}))}">📅 Add follow-up to REDEFINE Calendar</a>
             <p class="muted" style="margin:-4px 0 4px">Opens a new event: Follow up ${esc(c.client.name)}${when ? ' · ' + esc(when) : ''}. Check the time, then tap Add.</p>`
          : '<p class="muted">No follow-up date or next step yet, so there is nothing for the Calendar.</p>'}
        <a class="btn block nx" target="_blank" rel="noopener" href="${esc(FU.dinglianLink(settings.crmUrl, c.client.name))}">🤝 Update 定联: Open / Present / Close or remark</a>
        <button class="btn ghost block" data-close>Done</button>
      </div>`);
  }

  /* ---------- the agent's own profile (on every follow-up PDF) ---------- */
  const profile = () => ({name: settings.name, title: settings.title, phone: settings.phone, email: settings.email || '', photo: settings.photo || '', intro: settings.intro || '', why: settings.why || '', background: settings.background || ''});
  function openProfile() {
    const el = sheet(`<div class="sheet-top"><h3>My profile</h3><button type="button" class="xbtn" data-close aria-label="Close">✕</button></div>
      <p>Goes on the "About me" page of every follow-up PDF. Set it once.</p>
      <div class="prof-photo"><img id="pPhoto" src="${settings.photo || 'icons/icon-192.png'}" alt=""><button class="btn sm" id="pPick">${settings.photo ? 'Change photo' : 'Add photo'}</button><input type="file" id="pIn" accept="image/*" hidden></div>
      <div class="f"><label for="pN">Name</label><input id="pN" value="${esc(settings.name)}"></div>
      <div class="f"><label for="pT">Title</label><input id="pT" value="${esc(settings.title)}" placeholder="e.g. Financial Planner, REDEFINE · Great Eastern Life"></div>
      <div class="grid2"><div class="f"><label for="pP">Phone</label><input id="pP" value="${esc(settings.phone)}" inputmode="tel"></div><div class="f"><label for="pE">Email</label><input id="pE" value="${esc(settings.email || '')}" inputmode="email"></div></div>
      <div class="f"><label for="pI">About me (2–4 sentences)</label><textarea id="pI" rows="3">${esc(settings.intro || '')}</textarea></div>
      <div class="f"><label for="pW">Why I do insurance</label><textarea id="pW" rows="3">${esc(settings.why || '')}</textarea></div>
      <div class="f"><label for="pB">Background / achievements (optional)</label><textarea id="pB" rows="2">${esc(settings.background || '')}</textarea></div>
      <h3 style="font-size:15px;margin:14px 0 6px">三访 report</h3>
      <div class="grid2"><div class="f"><label for="pRN">Name in report</label><input id="pRN" value="${esc(settings.reportName || '')}" placeholder="e.g. Rex👑"></div>
      <div class="f"><label for="pBase">Base</label><input id="pBase" value="${esc(settings.base || '')}" placeholder="e.g. SG Farlim"></div></div>
      <div class="f"><label for="pOpen">Opening line</label><input id="pOpen" value="${esc(settings.reportOpening == null ? '以愉快的心情与大家一起修练三访。' : settings.reportOpening)}"></div>
      <div class="grid3"><div class="f"><label for="pTW">V target / week</label><input id="pTW" inputmode="numeric" value="${(settings.targets || FU.TARGETS).week}"></div>
      <div class="f"><label for="pTR">R target / week</label><input id="pTR" inputmode="numeric" value="${(settings.targets || FU.TARGETS).recruit}"></div></div>
      <div class="f"><label for="pTM">Total target / month</label><input id="pTM" inputmode="numeric" value="${(settings.targets || FU.TARGETS).month}"></div>
      <div class="f"><label>Usual letter language</label><select id="pL">${[['zh', '中文'], ['en', 'English'], ['ms', 'Bahasa Melayu']].map(([k, l]) => `<option value="${k}" ${(settings.fuLang || 'zh') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="row"><button class="btn" data-close>Cancel</button><button class="btn primary" id="pSave">Save</button></div>`);
    let photo = settings.photo || '';
    $('#pPick', el).onclick = () => $('#pIn', el).click();
    $('#pIn', el).onchange = async e => { const f = e.target.files[0]; if (!f) return; try { photo = 'data:image/jpeg;base64,' + await toJpegB64(f, 420); $('#pPhoto', el).src = photo; } catch (er) { toast('Could not open that photo.'); } };
    $('#pSave', el).onclick = () => {
      Object.assign(settings, {name: $('#pN', el).value.trim(), title: $('#pT', el).value.trim(), phone: $('#pP', el).value.trim(), email: $('#pE', el).value.trim(),
        intro: $('#pI', el).value.trim(), why: $('#pW', el).value.trim(), background: $('#pB', el).value.trim(), fuLang: $('#pL', el).value, photo,
        reportName: $('#pRN', el).value.trim(), base: $('#pBase', el).value.trim(), reportOpening: $('#pOpen', el).value.trim(),
        targets: {week: +$('#pTW', el).value || FU.TARGETS.week, recruit: +$('#pTR', el).value || FU.TARGETS.recruit, month: +$('#pTM', el).value || FU.TARGETS.month}});
      save('pspt.settings', settings); closeSheet(); toast('Profile saved'); route();
    };
  }

  /* ---------- farm on the client screen ---------- */
  function farmCard(c) {
    const ms = (c.meetings || []).slice().reverse(), t = c.client.traits || {};
    const b = FU.brief(c, todayISO());
    return `<div class="card farm"><div class="farm-h"><h2>Client farm</h2><div class="row" style="flex:none;gap:6px"><a class="btn sm" target="_blank" rel="noopener" href="${esc(FU.dinglianLink(settings.crmUrl, c.client.name))}">🤝 定联</a><button class="btn sm" id="editT">Edit details</button></div></div>
      ${ms.length ? `<div class="brief"><b>Before you meet</b>${b.map(x => `<p>${esc(x)}</p>`).join('')}</div>` : '<p class="muted">No meetings yet. After you meet, tap <b>Record a meeting</b>; it is saved here.</p>'}
      <button class="btn primary block" id="recC" style="margin:10px 0">🎙 Record a meeting</button>
      ${ms.length ? `<ol class="timeline">${ms.map(m => {
        const qa = FU.QUESTIONS.filter(q => m.qa && m.qa[q.k]);
        return `<li><span class="tl-d">${esc(m.date)}${m.time ? ' · ' + esc(FU.timeLabel(m.time)) : ''}${(m.tags || []).length ? ' · ' + esc(m.tags.join(',')) : ''}</span><b>${esc(FU.typeLabel(m.type))}${m.outcome === 'closed' ? ' 🎉' : ''}${m.sentPdf ? ' · PDF sent' : ''}</b><p>${esc(m.summary)}</p>${m.nextStep ? `<p class="tl-n">Next: ${esc(m.nextStep)}${m.followUpDate ? ' · ' + esc(m.followUpDate) : ''}</p>` : ''}
          ${qa.length ? `<details class="tl-qa"><summary>Guide answers (${qa.length})</summary>${qa.map(q => `<p><b>${esc(q.zh)}</b> ${esc(m.qa[q.k])}</p>`).join('')}</details>` : ''}${m.nextStep || m.followUpDate ? `<a class="tl-cal" target="_blank" rel="noopener" href="${esc(FU.calendarLink(settings.calendarUrl, {name: c.client.name, nextStep: m.nextStep, followUpDate: m.followUpDate}))}">📅 Add this follow-up to REDEFINE Calendar</a>` : ''}<button class="tinylink tl-del" data-m="${m.id}">delete</button></li>`;
      }).join('')}</ol>` : ''}
      ${(t.family || t.work || (t.cares || []).length || (t.objections || []).length) ? `<div class="traits">${t.family ? `<p><b>Family</b> ${esc(t.family)}</p>` : ''}${t.work ? `<p><b>Work</b> ${esc(t.work)}</p>` : ''}${t.personality ? `<p><b>Personality</b> ${esc(t.personality)}</p>` : ''}${(t.cares || []).length ? `<p><b>Cares about</b> ${esc(t.cares.join(', '))}</p>` : ''}${(t.objections || []).length ? `<p><b>Concerns</b> ${esc(t.objections.join(', '))}</p>` : ''}</div>` : ''}
    </div>`;
  }
  function wireFarm(c) {
    $('#recC').onclick = () => startRecord(c.id);
    $('#editT').onclick = () => editTraits(c);
    $$('.tl-del').forEach(b => b.onclick = async () => {
      if (!(await confirmBox('Delete this meeting record?', 'It is removed from this client\'s farm on all your synced devices. A PDF already sent is not affected.', 'Delete', true))) return;
      c.meetings = c.meetings.filter(m => m.id !== b.dataset.m); c.updated = new Date().toISOString(); saveCases(); route();
    });
  }
  function editTraits(c) {
    const t = c.client.traits = c.client.traits || {family: '', work: '', personality: '', cares: [], objections: []};
    const el = sheet(`<div class="sheet-top"><h3>${esc(c.client.name)}</h3><button type="button" class="xbtn" data-close aria-label="Close">✕</button></div>
      <p class="muted">No IC, phone or medical details here.</p>
      <div class="f"><label>Nickname / tag (to tell same names apart)</label><input id="tNick" value="${esc(c.client.nickname || '')}" placeholder="e.g. Bayan Lepas, engineer"></div>
      <div class="f"><label>Family</label><input id="tFam" value="${esc(t.family)}"></div>
      <div class="f"><label>Work</label><input id="tWork" value="${esc(t.work)}"></div>
      <div class="f"><label>Personality</label><input id="tPers" value="${esc(t.personality || '')}"></div>
      <div class="f"><label>Cares about (one per line)</label><textarea id="tCare" rows="3">${esc((t.cares || []).join('\n'))}</textarea></div>
      <div class="f"><label>Concerns / objections (one per line)</label><textarea id="tObj" rows="3">${esc((t.objections || []).join('\n'))}</textarea></div>
      <div class="row"><button class="btn" data-close>Cancel</button><button class="btn primary" id="tSave">Save</button></div>`);
    $('#tSave', el).onclick = () => {
      const lines = id => $(id, el).value.split('\n').map(s => s.trim()).filter(Boolean);
      c.client.nickname = $('#tNick', el).value.trim();
      Object.assign(t, {family: $('#tFam', el).value.trim(), work: $('#tWork', el).value.trim(), personality: $('#tPers', el).value.trim(), cares: lines('#tCare'), objections: lines('#tObj')});
      c.updated = new Date().toISOString(); saveCases(); closeSheet(); route();
    };
  }
  /* clients to follow up soon: next step date within 3 days or overdue */
  function dueList() {
    const soon = new Date(); soon.setDate(soon.getDate() + 3); const lim = soon.toISOString().slice(0, 10);
    return cases.filter(c => !c.sample).map(c => ({c, m: (c.meetings || [])[(c.meetings || []).length - 1]}))
      .filter(x => x.m && x.m.followUpDate && x.m.followUpDate <= lim && x.m.outcome !== 'closed' && x.m.outcome !== 'not_interested')
      .sort((a, b) => a.m.followUpDate.localeCompare(b.m.followUpDate));
  }

  /* ======================= 三访 daily review + GM team view ======================= */
  const saveReports = () => { save('pspt.reports', reports); scheduleSync(); };
  function todayCard() {
    const days = FU.dayStats(cases), t = todayISO(), d = days[t] || {met: 0}, st = FU.streak(days, t), w = FU.weekStats(days, t);
    return `<div class="card sanfang"><div class="sf-top"><div><h2>三访 today</h2><b class="sf-n">${d.met}<small>/3</small></b></div>
      <div class="sf-dots">${[0, 1, 2].map(i => `<i class="${d.met > i ? 'on' : ''}"></i>`).join('')}</div></div>
      <p class="muted">This week V ${w.met}/${(settings.targets || FU.TARGETS).week} · R ${w.rec}/${(settings.targets || FU.TARGETS).recruit}${st ? ` · 🔥 ${st} day${st > 1 ? 's' : ''} in a row` : ''}</p>
      <button class="btn block" id="dayRev">📋 ${reports[t] && reports[t].done ? 'Edit today\'s report' : 'Daily review & report'}</button>
      ${(session() || {}).owner ? '<button class="btn block" id="teamV" style="margin-top:8px">👥 Team 三访 (leader view)</button>' : ''}</div>`;
  }
  function wireTodayCard() {
    const b = $('#dayRev'); if (b) b.onclick = () => { location.hash = '#/day/' + todayISO(); };
    const t = $('#teamV'); if (t) t.onclick = () => { location.hash = '#/team'; };
  }

  function dayScreen(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) date = todayISO();
    const r = reports[date] || {reflection: '', tomorrow: '', hideNames: false};
    const items = FU.meetingsOn(cases, date);
    const days = FU.dayStats(cases), w = FU.weekStats(days, date), mo = FU.monthStats(days, date);
    const metN = new Set(items.map(x => x.c.id)).size;
    const text = () => FU.reportText({date, agentName: settings.name, reportName: settings.reportName, base: settings.base, opening: settings.reportOpening,
      targets: settings.targets, hideNames: r.hideNames, week: w, month: mo, reflection: r.reflection, tomorrow: r.tomorrow,
      items: items.map(({c, m}) => ({name: c.client.name, time: m.time, tags: m.tags && m.tags.length ? m.tags : FU.tagsFor(m.type), note: FU.noteFor(m)}))});
    /* the report box shows the agent's own edits if any, otherwise the report built from today's visits */
    const shown = () => (typeof r.edited === 'string' ? r.edited : text());
    const touch = () => { r.updated = new Date().toISOString(); reports[date] = r; saveReports(); const b = $('#rTxt'); if (b && typeof r.edited !== 'string') b.value = text(); };
    app.innerHTML = bar('三访 report', '#/', `<input type="date" id="dPick" class="datepick" value="${date}" max="${todayISO()}" aria-label="Pick a day">`) + `<div class="wrap">
      <div class="card"><h2>Met on ${esc(date)} (${metN}/3)</h2>
        ${items.length ? items.map(({c, m}, i) => `<button type="button" class="item" data-visit="${i}"><div class="t"><b>${esc(c.client.name)}</b><span>${esc(FU.timeLabel(m.time) || 'time?')} · ${esc((m.tags && m.tags.length ? m.tags : FU.tagsFor(m.type)).join(','))} · ${esc(FU.typeLabel(m.type))}</span><span>${esc(FU.noteFor(m) || 'Tap to add a report note')}</span></div><div class="amt">${m.outcome === 'closed' || m.type === 'closing' ? '🎉' : '✎'}</div></button>`).join('') : '<p class="muted">No meetings recorded for this day yet.</p>'}
        <button class="btn block" id="quickAdd">+ Add someone I met (quick log)</button></div>
      <div class="card"><h2>💡 Reflection</h2><div class="f"><textarea id="rRef" rows="3" placeholder="What went well, what to improve…">${esc(r.reflection)}</textarea></div>
        <h2 style="margin-top:6px">🎯 Tomorrow</h2><div class="f"><textarea id="rTom" rows="2" placeholder="Who you will meet, what you will do…">${esc(r.tomorrow)}</textarea></div>
        <button class="btn sm" id="rMic">🎙 Speak into the box</button> <span class="muted" id="rMicT">Tap a box first, then speak.</span></div>
      <div class="card"><h2>Report for the WhatsApp group</h2>
        ${settings.reportName || settings.base ? '' : '<p class="muted" style="margin-bottom:6px">Set your report name and base (e.g. Rex👑, SG Farlim) in Settings → 👤 My profile.</p>'}
        <label class="chk"><input type="checkbox" id="rHide" ${r.hideNames ? 'checked' : ''}> Hide client names (Client A, B, C)</label>
        <p class="muted" style="margin:8px 0 4px">Edit anything below before copying.</p>
        <textarea class="rpt" id="rTxt" rows="16"></textarea>
        <div id="rEdited" ${typeof r.edited === 'string' ? '' : 'hidden'} class="flagnote"><span>You edited the report, so new visits won't be added to it automatically.</span><button type="button" id="rReset">Undo my edits</button></div>
        <p class="muted">Use 称呼 only. Client details stay in your farm, not in the group.</p>
        <label class="chk"><input type="checkbox" id="rShare" ${settings.shareTally !== false ? 'checked' : ''}> Share my numbers with my leader (counts only, no client names)</label></div>
    </div>
    <div class="dock"><button class="btn primary" id="rCopy">Copy report for WhatsApp</button></div>`;
    $('#rTxt').value = shown();
    $('#rTxt').addEventListener('input', e => { r.edited = e.target.value; $('#rEdited').hidden = false; r.updated = new Date().toISOString(); reports[date] = r; saveReports(); });
    $('#rReset').onclick = async () => {
      if (!(await confirmBox('Undo your edits?', 'The report is rebuilt from today\'s visits, reflection and tomorrow. Your changes to the text are removed.', 'Undo edits'))) return;
      delete r.edited; touch(); route();
    };
    let lastBox = 'rRef';
    ['rRef', 'rTom'].forEach(id => { $('#' + id).addEventListener('focus', () => { lastBox = id; }); });
    $('#rRef').oninput = e => { r.reflection = e.target.value; touch(); };
    $('#rTom').oninput = e => { r.tomorrow = e.target.value; touch(); };
    $('#rHide').onchange = e => { r.hideNames = e.target.checked; touch(); };
    $('#rShare').onchange = e => { settings.shareTally = e.target.checked; save('pspt.settings', settings); };
    $$('[data-visit]').forEach(b => b.onclick = () => editVisit(items[+b.dataset.visit]));
    $('#dPick').onchange = e => { if (e.target.value) location.hash = '#/day/' + e.target.value; };
    $('#quickAdd').onclick = () => quickAdd(date);
    $('#rMic').onclick = () => voiceInto($('#rMic'), $('#rMicT'), txt => {
      const box = $('#' + lastBox); box.value = (box.value ? box.value.trim() + ' ' : '') + txt; box.dispatchEvent(new Event('input'));
    });
    $('#rCopy').onclick = async () => {
      const t = $('#rTxt').value;
      try { await navigator.clipboard.writeText(t); toast('Copied. Paste it in the WhatsApp group.'); } catch (e) { toast('Copy did not work. Press and hold the report text to copy it.'); }
      r.done = true; touch();
      if (settings.shareTally !== false && session()) {
        const d = FU.dayStats(cases)[date] || {met: 0, pres: 0, closed: 0};
        post({op: 'tallyput', date, met: d.met, pres: d.pres, closed: d.closed}).catch(() => {});   // numbers only
      }
    };
  }

  /* time, P/O/R and the line the group sees, for one visit */
  const tagButtons = sel => `<div class="tagrow">${FU.TAGS.map(t => `<button type="button" class="chip" data-tg="${t}" aria-pressed="${sel.includes(t)}">${t}</button>`).join('')}</div>`;
  const wireTags = (el, sel) => $$('[data-tg]', el).forEach(b => b.onclick = () => { const t = b.dataset.tg, i = sel.indexOf(t); if (i >= 0) sel.splice(i, 1); else sel.push(t); sel.sort((x, y) => FU.TAGS.indexOf(x) - FU.TAGS.indexOf(y)); b.setAttribute('aria-pressed', i < 0); });
  function editVisit({c, m}) {
    const tags = (m.tags && m.tags.length ? m.tags : FU.tagsFor(m.type)).slice();
    const el = sheet(`<div class="sheet-top"><h3>${esc(c.client.name)}</h3><button type="button" class="xbtn" data-close aria-label="Close">✕</button></div>
      <div class="grid2"><div class="f"><label>Time</label><input id="vTime" type="time" value="${esc(m.time || '')}"></div><div class="f"><label>P / O / R</label>${tagButtons(tags)}</div></div>
      <div class="f"><label>Report note (what the group sees)</label><textarea id="vNote" rows="4">${esc(m.reportNote || FU.noteFor(m))}</textarea></div>
      <p class="muted"><a href="#/case/${c.id}">Open ${esc(c.client.name)}'s farm</a></p>
      <div class="row"><button class="btn" data-close>Cancel</button><button class="btn primary" id="vSave">Save</button></div>`);
    wireTags(el, tags);
    $('#vSave', el).onclick = () => { m.time = $('#vTime', el).value; m.tags = tags; m.reportNote = $('#vNote', el).value.trim(); c.updated = new Date().toISOString(); saveCases(); closeSheet(); route(); };
  }

  /* quick log for someone met without a voice note */
  function quickAdd(date) {
    const qTags = ['O'];
    const now = new Date(), nowT = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const el = sheet(`<div class="sheet-top"><h3>Quick log</h3><button type="button" class="xbtn" data-close aria-label="Close">✕</button></div>
      <p class="muted">For someone you met but didn't record. It is saved to their farm.</p>
      <div class="f"><label>Client</label><select id="qWho"><option value="">New client…</option>${cases.filter(x => !x.sample).sort((a, b) => a.client.name.localeCompare(b.client.name)).map(x => `<option value="${x.id}">${esc(x.client.name)}${x.client.nickname ? ' (' + esc(x.client.nickname) + ')' : ''}</option>`).join('')}</select></div>
      <div class="f" id="qNewF"><label>Name (称呼)</label><input id="qName" placeholder="e.g. Ah Seng"></div>
      <div class="grid2"><div class="f"><label>Type</label><select id="qType">${FU.MEETING_TYPES.map(t => `<option value="${t.id}">${t.zh} · ${t.en}</option>`).join('')}</select></div>
      <div class="f"><label>Result</label><select id="qOut"><option value="none">No decision yet</option><option value="considering">Considering</option><option value="closed">Closed 🎉</option><option value="not_interested">Not interested</option></select></div></div>
      <div class="grid2"><div class="f"><label>Time</label><input id="qTime" type="time" value="${date === todayISO() ? nowT : ''}"></div><div class="f"><label>P / O / R</label>${tagButtons(qTags)}</div></div>
      <div class="f"><label>Report note (what the group sees)</label><textarea id="qNote" rows="3" placeholder="e.g. Direct approach, open for review and do CFF."></textarea></div>
      <div class="grid2"><div class="f"><label>Next step (optional)</label><input id="qNext"></div><div class="f"><label>Follow up on</label><input id="qDate" type="date"></div></div>
      <div class="row"><button class="btn" data-close>Cancel</button><button class="btn primary" id="qSave">Save</button></div>`);
    wireTags(el, qTags);
    $('#qType', el).onchange = e => { qTags.splice(0, qTags.length, ...FU.tagsFor(e.target.value)); $$('[data-tg]', el).forEach(b => b.setAttribute('aria-pressed', qTags.includes(b.dataset.tg))); };
    $('#qWho', el).onchange = e => { $('#qNewF', el).hidden = !!e.target.value; };
    $('#qSave', el).onclick = () => {
      let c = getCase($('#qWho', el).value);
      if (!c) {
        const name = $('#qName', el).value.trim(); if (!name) return $('#qName', el).classList.add('flag');
        const now = new Date().toISOString();
        c = {id: PS.uid(), created: now, updated: now, client: {name, nickname: '', age: null, income: null}, guide: Object.assign({}, settings.guide), policies: [], meetings: []};
        cases.push(c);
      }
      const d = FU.normalizeDraft({meeting: {type: $('#qType', el).value, outcome: $('#qOut', el).value, nextStep: $('#qNext', el).value, followUpDate: $('#qDate', el).value, summary: 'Quick log'},
        tags: qTags, time: $('#qTime', el).value, reportNote: $('#qNote', el).value}, []);
      const qm = FU.applyToFarm(c, d, {date});
      saveCases(); closeSheet(); pendingNext = {caseId: c.id, meetingId: qm.id}; route();
    };
  }

  /* tap to record, tap to stop, text comes back (used by the daily review boxes) */
  let miniRec = null;
  async function voiceInto(btn, label, onText) {
    if (miniRec) { miniRec.stop(); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) return toast('This browser cannot record. Use the keyboard mic.');
    if (!session() && !(await signIn())) return;
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({audio: true}); } catch (e) { return toast('Microphone not allowed. Use the keyboard mic.'); }
    const type = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
    const chunks = [], t0 = Date.now();
    miniRec = new MediaRecorder(stream, type ? {mimeType: type, audioBitsPerSecond: 48000} : undefined);
    miniRec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    const tick = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); label.textContent = `● ${s}s · tap again to stop`; if (s >= 180) miniRec && miniRec.stop(); }, 500);
    miniRec.onstop = async () => {
      clearInterval(tick); stream.getTracks().forEach(t => t.stop()); miniRec = null; btn.textContent = '🎙 Speak into the box';
      const blob = new Blob(chunks, {type: (type || 'audio/mp4').split(';')[0]});
      if (blob.size < 2000) { label.textContent = 'Too short.'; return; }
      label.textContent = 'Turning voice into text…';
      try { const r = await post({op: 'transcribe', audio: await blobB64(blob), mime: blob.type, hint: FU.HINT}); label.textContent = ''; if (r.text) onText(String(r.text).trim()); }
      catch (e) { label.textContent = e.code === 'invalid_request' ? 'Voice needs the team server update.' : 'Could not convert. Try again or type.'; }
    };
    miniRec.start(1000); btn.textContent = '■ Stop';
  }

  /* leader view: numbers only, from the team server */
  async function teamScreen() {
    app.innerHTML = bar('Team 三访', '#/') + '<div class="wrap"><div class="spin"></div></div>';
    let tally;
    try { tally = (await post({op: 'tallyget'})).tally || {}; }
    catch (e) {
      $('.wrap').innerHTML = `<div class="checks">${e.code === 'not_allowed' ? 'Only the leader (owner code) can see the team view.' : e.code === 'invalid_request' ? 'The team view needs the latest team server update.' : 'Could not load the team numbers. Check your connection.'}</div>`;
      return;
    }
    const t = todayISO(), rows = Object.values(tally).map(a => {
      const w = FU.weekStats(a.days, t), d = a.days[t] || {met: 0, pres: 0, closed: 0};
      return {name: a.name, today: d.met, week: w.met, hit: w.hit, pres: w.pres, closed: w.closed, streak: FU.streak(a.days, t), last: Object.keys(a.days).sort().pop() || ''};
    }).sort((a, b) => b.week - a.week || b.today - a.today);
    $('.wrap').innerHTML = `<div class="card"><h2>Today ${esc(t)} · this week from Monday</h2>
      <p class="muted" style="margin-bottom:8px">Agents' own numbers, sent when they copy their 三访 report. No client names.</p>
      ${rows.length ? `<table class="team"><thead><tr><th>Agent</th><th>Today</th><th>Week</th><th>Days 3+</th><th>🔥</th><th>🎉</th></tr></thead><tbody>${rows.map(x => `<tr><td><b>${esc(x.name)}</b><span>last report ${esc(x.last)}</span></td><td class="${x.today >= 3 ? 'ok' : ''}">${x.today}/3</td><td>${x.week}</td><td>${x.hit}</td><td>${x.streak || ''}</td><td>${x.closed || ''}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No reports yet. Numbers appear when agents tap "Copy report for WhatsApp".</p>'}
    </div>`;
  }

  /* ---------- staying signed in ----------
     On iPhone/iPad, Safari and the home-screen app keep separate storage, and Safari clears a website's
     storage after about 7 days without use. The home-screen app keeps it, so we nudge agents to install. */
  const standalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function installTip() {
    if (standalone()) return '';
    const hidden = load('pspt.tipHidden', 0);
    if (hidden && Date.now() - hidden < 3 * 864e5) return '';   // ask again after 3 days
    const how = isIOS() ? 'In Safari tap <b>Share</b> <span aria-hidden="true">⬆︎</span> then <b>Add to Home Screen</b>.' : 'Tap the browser menu <b>⋮</b> then <b>Add to Home screen</b> / <b>Install app</b>.';
    return `<div class="checks" id="installTip" style="position:relative;padding-right:40px"><b>Stay signed in: add this app to your Home Screen.</b> ${how} Then always open it from the icon. Opening it in the browser instead can sign you out and hide your clients.<button class="xbtn" id="tipX" aria-label="Hide tip" style="position:absolute;top:8px;right:8px;width:30px;height:30px;font-size:13px">✕</button></div>`;
  }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}

  function openSettings() {
    const s = session();
    const el = sheet(`<div class="sheet-top"><h3>Settings</h3><button type="button" class="xbtn" data-close aria-label="Close">✕</button></div>
      <button class="btn block" id="openProf" style="margin-bottom:12px">👤 My profile (photo, intro, why insurance)</button>
      <p>Shown at the bottom of every PDF.</p>
      <div class="f"><label for="sN">Your name</label><input id="sN" value="${esc(settings.name)}" autocomplete="name"></div>
      <div class="f"><label for="sT">Title (optional)</label><input id="sT" value="${esc(settings.title)}" placeholder="e.g. Financial Planner, REDEFINE"></div>
      <div class="f"><label for="sP">Phone (optional)</label><input id="sP" value="${esc(settings.phone)}" inputmode="tel"></div>
      <div class="grid2"><div class="f"><label for="sD">Guideline death/TPD (× income)</label><input id="sD" inputmode="decimal" value="${settings.guide.death}"></div>
      <div class="f"><label for="sC">Guideline CI (× income)</label><input id="sC" inputmode="decimal" value="${settings.guide.ci}"></div></div>
      <p class="muted" style="margin-bottom:12px">New clients use these multiples. ${Object.keys(learned).length} benefit names remembered. ${s ? 'Signed in to the team server as ' + esc(s.name) + '.' : 'Not signed in (needed only for reading photos).'}</p>
      <div style="display:flex;flex-direction:column;gap:8px"><div class="row"><button class="btn" data-close>Cancel</button><button class="btn primary" data-ok>Save</button></div>
      ${Object.keys(learned).length ? '<button class="btn ghost block" id="forget">Forget remembered benefit names</button>' : ''}</div>
      ${s ? '<button class="tinylink" id="out">Sign out of this device…</button>' : ''}`);
    $('[data-ok]', el).onclick = () => {
      Object.assign(settings, {name: $('#sN', el).value.trim(), title: $('#sT', el).value.trim(), phone: $('#sP', el).value.trim(),
        guide: {death: PS.parseAmount($('#sD', el).value).value || 10, ci: PS.parseAmount($('#sC', el).value).value || 5}});   // keeps the profile fields
      save('pspt.settings', settings); closeSheet(); toast('Saved'); route();
    };
    $('#openProf', el).onclick = openProfile;
    const o = $('#out', el); if (o) o.onclick = async () => {
      if (!(await confirmBox('Sign out of this device?', 'You will need the team code again to read photos and PDFs' + (syncCfg ? ', and sync will pause until you sign back in' : '') + '. Clients on this device stay. You normally never need to sign out.', 'Sign out', true))) return;
      localStorage.setItem('pspt.session', 'null'); toast('Signed out'); route();
    };
    const f = $('#forget', el); if (f) f.onclick = async () => { if (await confirmBox('Forget remembered names?', 'The app will go back to its built-in reading of benefit names.', 'Forget')) { learned = {}; save('pspt.learned', learned); toast('Done'); } };
  }

  route();
  syncNow();
})();
