/* Policy Summary Power Tools — screens and storage. Client data stays on this phone only. */
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
  const saveCases = () => save('pspt.cases', cases);
  const getCase = id => cases.find(c => c.id === id);
  const agent = () => ({name: settings.name, title: settings.title, phone: settings.phone});

  /* ---------- small UI helpers ---------- */
  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 3200); }
  function sheet(html, onMount) {
    const s = $('#sheet'); s.innerHTML = `<div class="sheet-in" role="dialog" aria-modal="true">${html}</div>`; s.hidden = false;
    s.onclick = e => { if (e.target === s && !s.dataset.lock) closeSheet(); };
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
    trash: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>'
  };
  const bar = (title, back, right) => `<header class="bar">${back ? `<a class="ib" href="${back}" aria-label="Back">${ICONS.back}</a>` : ''}<h1>${esc(title)}</h1>${right || ''}</header>`;
  const money = v => (v == null ? '' : String(v));

  /* ---------- router ---------- */
  function route() {
    closeSheet(); leaveGuard = null;
    const h = location.hash.replace(/^#\/?/, '').split('/');
    window.scrollTo(0, 0);
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
    app.innerHTML = `<header class="bar"><div class="brand"><img src="logo.png" alt=""><div><b>Policy Summary</b><span>POWER TOOLS</span></div></div><button class="ib" id="set" aria-label="Settings">${ICONS.gear}</button></header>
      <div class="wrap">
        <div class="card hero"><h2>New summary</h2><p>Snap the client's policy pages or portal screenshots, confirm what the app reads, and send a one-page summary.</p>
          <button class="btn primary block" id="new">+ New client summary</button></div>
        ${settings.name ? '' : '<div class="checks"><b>Add your name first.</b> It goes at the bottom of every PDF. <a href="#" id="set2">Open settings</a></div>'}
        <h2 class="muted" style="margin:6px 2px 8px;font-weight:600">CLIENTS ON THIS PHONE</h2>
        ${list.length ? list.map(c => {
          const s = PS.summarise(c), n = PS.pendingChecks(c).length;
          return `<a class="item" href="#/case/${c.id}"><div class="t"><b>${esc(c.client.name || 'Unnamed client')}${c.sample ? ' <span class="pill grey">Sample</span>' : ''}</b><span>${c.policies.length} polic${c.policies.length === 1 ? 'y' : 'ies'} · updated ${new Date(c.updated).toLocaleDateString('en-GB')}</span></div>
            <div class="amt">${PS.rm(s.cats.death.total, {short: true})}<small>${n ? `<span class="pill warn">${n} to check</span>` : 'death cover'}</small></div></a>`;
        }).join('') : '<div class="empty">No clients yet.<br>Tap <b>New client summary</b>, or <a href="#" id="demo">open a sample</a> to see the format.</div>'}
        ${list.length && !list.some(c => c.sample) ? '<p class="muted" style="text-align:center;margin:10px 0"><a href="#" id="demo">Open the sample client</a></p>' : ''}
        <p class="muted" style="text-align:center;margin:18px 10px">Client details are saved on this phone only. Photos are read and then discarded.</p>
      </div>`;
    $('#new').onclick = newCase;
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
        <div class="card hero"><h2>So far</h2>
          <div class="stat"><div><span>Death</span><b>${PS.rm(s.cats.death.total, {short: true})}</b></div><div><span>CI</span><b>${PS.rm(s.cats.ci.total, {short: true})}</b></div><div><span>Medical/yr</span><b>${s.medical.annual != null ? PS.rm(s.medical.annual, {short: true}) : '—'}</b></div></div>
        </div>
        <div class="big2" style="margin-bottom:12px">
          <button class="btn" id="snap">${ICONS.cam}Snap / upload<br>policy photos</button>
          <button class="btn" id="key">${ICONS.pen}Key in<br>a policy</button>
        </div>
        <input type="file" id="file" accept="image/*" multiple hidden>
        ${checks.length ? `<div class="checks"><b>${checks.length} item${checks.length > 1 ? 's' : ''} to confirm</b> before the summary is complete. Tap a policy marked <span class="pill warn">check</span>.</div>` : ''}
        <h2 class="muted" style="margin:6px 2px 8px;font-weight:600">POLICIES (${c.policies.length})</h2>
        ${c.policies.length ? c.policies.map(p => {
          const n = PS.pendingChecks({policies: [p]}).length, r = PS.policyRow(p), out = p.status !== 'inforce' && p.status !== 'unknown';
          const tags = PS.CATS.filter(k => r[k.id].has).map(k => k.short).join(' · ');
          return `<a class="item" href="#/case/${c.id}/policy/${p.id}"><span class="stripe" style="background:${PS.insurerColor(p.insurer)}"></span><div class="t"><b>${esc(p.insurer || 'Insurer?')}</b><span>${esc(p.productName || 'Plan')}${p.policyNo ? ' · ' + esc(p.policyNo) : ''}</span><span>${esc(tags || 'No benefits yet')}</span></div>
            <div class="amt">${n ? `<span class="pill warn">${n} check</span>` : out ? `<span class="pill grey">${esc(p.status)}</span>` : '<span class="pill ok">OK</span>'}<small>${p.source === 'photo' ? 'from photo' : 'keyed in'}</small></div></a>`;
        }).join('') : '<div class="empty">No policies yet. Snap a photo of a policy schedule, statement or the insurer\'s app screen, or key one in.</div>'}
        <div class="card" style="margin-top:12px"><h2>Client</h2>
          <div class="f"><label for="cName">Name on PDF</label><input id="cName" value="${esc(c.client.name)}"></div>
          <div class="grid2"><div class="f"><label for="cAge">Age</label><input id="cAge" inputmode="numeric" value="${money(c.client.age)}"></div>
          <div class="f"><label for="cInc">Annual income (optional)</label><input id="cInc" inputmode="decimal" value="${money(c.client.income)}"></div></div>
          <p class="muted">With income, the summary compares cover with a guideline of ${c.guide.death}× income for death/TPD and ${c.guide.ci}× for CI. Change the multiples in Settings.</p>
        </div>
      </div>
      <div class="dock"><a class="btn navy" href="#/case/${c.id}/summary" ${c.policies.length ? '' : 'aria-disabled="true" style="opacity:.45;pointer-events:none"'}>See summary &amp; PDF</a></div>`;
    $('#key').onclick = () => { location.hash = '#/case/' + c.id + '/policy/new'; };
    $('#snap').onclick = () => $('#file').click();
    $('#file').onchange = e => { const f = [...e.target.files]; e.target.value = ''; if (f.length) readPhotos(c, f); };
    $('#del').onclick = async () => {
      if (await confirmBox('Delete ' + (c.client.name || 'this client') + '?', 'This removes the client and all ' + c.policies.length + ' policies from this phone. It cannot be undone.', 'Delete', true)) {
        cases = cases.filter(x => x.id !== c.id); saveCases(); location.hash = '#/';
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
      const el = sheet(`<h3>Sign in to read photos</h3><p>Reading photos uses the REDEFINE team server. Enter your name and the team code (the same one as Form Filler). Keying in works without signing in.</p>
        <div class="f"><label for="gName">Your name</label><input id="gName" autocomplete="name" value="${esc(settings.name)}"></div>
        <div class="f"><label for="gCode">Team code</label><input id="gCode" type="password" autocomplete="current-password"></div>
        <p class="muted" id="gMsg" role="alert" style="color:var(--err);min-height:18px"></p>
        <div class="row"><button class="btn" data-x>Cancel</button><button class="btn primary" data-ok>Sign in</button></div>`);
      $('[data-x]', el).onclick = () => { closeSheet(); done(false); };
      $('[data-ok]', el).onclick = async () => {
        const who = {name: $('#gName', el).value.trim(), code: $('#gCode', el).value.trim()};
        if (!who.name || !who.code) { $('#gMsg', el).textContent = 'Enter both.'; return; }
        $('[data-ok]', el).disabled = true; $('[data-ok]', el).textContent = 'Checking…';
        try { await post({op: 'login'}, who); save('pspt.session', who); closeSheet(); done(true); }
        catch (e) {
          $('#gMsg', el).textContent = e.code === 'unauthorized' ? 'That team code is not right.' : e.code === 'locked' ? 'Too many wrong tries. Wait 15 minutes.' : 'Could not reach the team server. Check your connection.';
          $('[data-ok]', el).disabled = false; $('[data-ok]', el).textContent = 'Sign in';
        }
      };
    });
  }
  async function toJpegB64(file) {
    const bmp = await createImageBitmap(file), k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
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

  async function readPhotos(c, files) {
    const max = CFG.maxPhotosPerRead || 4;
    const urls = files.map(f => URL.createObjectURL(f));
    const el = sheet(`<h3>Read ${files.length} photo${files.length > 1 ? 's' : ''}?</h3>
      <div class="thumbs">${urls.map(u => `<img src="${u}" alt="">`).join('')}</div>
      <p>Pages of the same policy can go together. A portal screen listing several policies is fine. ${files.length > max ? `They will be read ${max} at a time.` : ''} Cover the client's IC number if it shows, it is not needed.</p>
      <div class="row"><button class="btn" data-x>Cancel</button><button class="btn primary" data-ok>Read with AI</button></div>`);
    const go = await new Promise(done => { $('[data-x]', el).onclick = () => done(false); $('[data-ok]', el).onclick = () => done(true); });
    if (!go) { closeSheet(); urls.forEach(URL.revokeObjectURL); return; }
    if (!session() && !(await signIn())) { urls.forEach(URL.revokeObjectURL); return; }
    const box = sheet('<h3>Reading…</h3><div class="spin"></div><p id="rdMsg" style="text-align:center">Usually 20–60 seconds. Keep this screen open.</p>');
    $('#sheet').dataset.lock = '1';
    const added = [];
    try {
      for (let i = 0; i < files.length; i += max) {
        const part = files.slice(i, i + max);
        if (files.length > max) $('#rdMsg', box).textContent = `Reading photos ${i + 1}–${i + part.length} of ${files.length}…`;
        const images = [];
        for (const f of part) { try { images.push(await toJpegB64(f)); } catch (e) { throw {code: 'image_rejected'}; } }
        const r = await post({op: 'ai', prompt: PS.aiPrompt(learned), images});
        if (r.truncated) throw {code: 'invalid_json'};
        added.push(...PS.fromAI(parseJSON(r.text), learned));
      }
    } catch (e) {
      closeSheet(); urls.forEach(URL.revokeObjectURL);
      if (e.code === 'unauthorized') { localStorage.setItem('pspt.session', 'null'); toast('Please sign in again.'); return; }
      sheet(`<h3>Could not read the photos</h3><p>${esc(AI_ERR[e.code] || 'Something went wrong (' + (e.code || 'error') + '). Try again or key it in.')}</p><button class="btn block" data-x>OK</button>`, s => { $('[data-x]', s).onclick = closeSheet; });
      return;
    }
    urls.forEach(URL.revokeObjectURL);
    closeSheet();
    if (!added.length) {
      sheet('<h3>No policy details found</h3><p>The photo didn\'t show a policy the app could read. Retake it closer and flatter, or key it in.</p><button class="btn block" data-x>OK</button>', s => { $('[data-x]', s).onclick = closeSheet; });
      return;
    }
    /* possible duplicates: same insurer and same last 4 digits */
    added.forEach(p => {
      const dup = c.policies.find(q => q.insurer && q.insurer === p.insurer && q.policyNo && q.policyNo === p.policyNo);
      if (dup) p.checks.duplicate = 'Looks like a policy already added (' + dup.policyNo + '). Delete one if it is the same.';
    });
    c.policies.push(...added); c.updated = new Date().toISOString(); saveCases();
    toast(`Found ${added.length} polic${added.length > 1 ? 'ies' : 'y'}. Please check ${added.length > 1 ? 'each one' : 'it'}.`);
    location.hash = '#/case/' + c.id + '/policy/' + added[0].id;
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
  function openSettings() {
    const s = session();
    const el = sheet(`<h3>Settings</h3><p>Shown at the bottom of every PDF.</p>
      <div class="f"><label for="sN">Your name</label><input id="sN" value="${esc(settings.name)}" autocomplete="name"></div>
      <div class="f"><label for="sT">Title (optional)</label><input id="sT" value="${esc(settings.title)}" placeholder="e.g. Financial Planner, REDEFINE"></div>
      <div class="f"><label for="sP">Phone (optional)</label><input id="sP" value="${esc(settings.phone)}" inputmode="tel"></div>
      <div class="grid2"><div class="f"><label for="sD">Guideline death/TPD (× income)</label><input id="sD" inputmode="decimal" value="${settings.guide.death}"></div>
      <div class="f"><label for="sC">Guideline CI (× income)</label><input id="sC" inputmode="decimal" value="${settings.guide.ci}"></div></div>
      <p class="muted" style="margin-bottom:12px">New clients use these multiples. ${Object.keys(learned).length} benefit names remembered. ${s ? 'Signed in to the team server as ' + esc(s.name) + '.' : 'Not signed in (needed only for reading photos).'}</p>
      <div style="display:flex;flex-direction:column;gap:8px"><button class="btn primary block" data-ok>Save</button>
      ${s ? '<button class="btn ghost block" id="out">Sign out of team server</button>' : ''}
      ${Object.keys(learned).length ? '<button class="btn ghost block" id="forget">Forget remembered benefit names</button>' : ''}</div>`);
    $('[data-ok]', el).onclick = () => {
      settings = {name: $('#sN', el).value.trim(), title: $('#sT', el).value.trim(), phone: $('#sP', el).value.trim(),
        guide: {death: PS.parseAmount($('#sD', el).value).value || 10, ci: PS.parseAmount($('#sC', el).value).value || 5}};
      save('pspt.settings', settings); closeSheet(); toast('Saved'); route();
    };
    const o = $('#out', el); if (o) o.onclick = () => { localStorage.setItem('pspt.session', 'null'); closeSheet(); toast('Signed out'); };
    const f = $('#forget', el); if (f) f.onclick = async () => { if (await confirmBox('Forget remembered names?', 'The app will go back to its built-in reading of benefit names.', 'Forget')) { learned = {}; save('pspt.learned', learned); toast('Done'); } };
  }

  route();
})();
