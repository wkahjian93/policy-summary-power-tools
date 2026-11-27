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
  const saveSettings = () => { settings.updatedAt = new Date().toISOString(); save('pspt.settings', settings); scheduleSync(); };
  const saveLearned = () => { save('pspt.learned', learned); save('pspt.learnedAt', new Date().toISOString()); scheduleSync(); };
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
    if (sending) setTimeout(showSend, 0);   // a screen refresh (sync, Calendar) must never close the send sheet
    else if (pendingNext) { const p = pendingNext; pendingNext = null; setTimeout(() => nextSheet(p), 0); }   // after saving a meeting: offer Calendar and 定联
    /* link from 定联 (Customer Relationship App) after "Presented": #/record?name=<name> starts a recording for that person */
    const lp = location.hash.match(/^#\/?link-prospecting\?(.*)$/);
    if (lp) {   // from REDEFINE Prospecting → Me → Connected apps
      const code = (new URLSearchParams(lp[1]).get('code') || '').replace(/[^a-z0-9]/gi, '').slice(0, 60);
      history.replaceState(null, '', location.pathname + location.search + '#/');
      if (code) connectProspecting(code);
      return route();
    }
    const pq = location.hash.match(/^#\/?prospecting\?(.*)$/);
    if (pq) {   // "📒 On Field" on a lead in Prospecting: collect, then open that prospect (or a quick log for them)
      const name = (new URLSearchParams(pq[1]).get('name') || '').replace(/\s+/g, ' ').trim().slice(0, 80);
      history.replaceState(null, '', location.pathname + location.search + '#/');
      prPull(true).then(() => { const c = FU.matchClient(cases, name); if (c) location.hash = '#/case/' + c.id; else { route(); quickAdd(todayISO(), 'approach', name); } });
      return;
    }
    const qm = location.hash.match(/^#\/?record\?(.*)$/);
    if (qm) {
      const name = (new URLSearchParams(qm[1]).get('name') || '').replace(/\s+/g, ' ').trim().slice(0, 80);
      history.replaceState(null, '', location.pathname + location.search + '#/');
      return recordFor(name);
    }
    const h = location.hash.replace(/^#\/?/, '').split('/');
    window.scrollTo(0, 0);
    if (h[0] === 'record') return recordScreen(h[1] && getCase(h[1]) ? h[1] : null);
    if (h[0] === 'day') return dayScreen(h[1]);
    if (h[0] === 'activity') return activityScreen(h[1], h[2]);
    if (h[0] === 'followups') return followScreen();
    if (h[0] === 'summaries') return summariesScreen();
    if (h[0] === 'team') return teamScreen();
    if (h[0] === 'case' && getCase(h[1])) {
      if (h[2] === 'policy') return editPolicy(getCase(h[1]), h[3]);
      if (h[2] === 'summary') return summary(getCase(h[1]));
      if (h[2] === 'compare') return compareScreen(getCase(h[1]));
      return caseScreen(getCase(h[1]));
    }
    home();
  }
  addEventListener('hashchange', route);

  /* ---------- home ---------- */
  function home() {
    const list = cases.slice().sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
    const due = dueList(), q = (home.q || '').toLowerCase(), tab = load('pspt.homeTab', 'prospect');
    const nClient = list.filter(c => FU.kindOf(c) === 'client').length, nProspect = list.length - nClient;
    const shown = list.filter(c => FU.kindOf(c) === tab).filter(c => !q || (c.client.name + ' ' + (c.client.nickname || '')).toLowerCase().includes(q));
    app.innerHTML = `<header class="bar"><div class="brand"><img src="logo.png" alt=""><div><b>On Field</b><span>REDEFINE</span></div></div><button class="ib" id="set" aria-label="Settings">${ICONS.gear}</button></header>
      <div class="wrap">
        <div class="card hero"><h2>Just met a client?</h2><p>Speak for 1–2 minutes. On Field writes the follow-up PDF and WhatsApp message, and saves the meeting to your client farm.</p>
          <button class="btn primary block rec-big" id="recNew">🎙 Record a meeting</button>
          ${rec && (rec.transcript || rec.draft) ? '<button class="btn block" id="recResume" style="margin-top:8px">Continue unfinished note</button>' : ''}
          <button class="btn block ghost-l" id="new">+ New client or prospect</button></div>
        <button type="button" class="card pshero" id="psGo"><span class="ps-ic">📄</span><span class="ps-t"><b>Policy summary</b><small>Snap or upload a client's policies from any insurer. Get Death, CI, TPD &amp; Medical totals on a one-page PDF.</small></span><span class="go">›</span></button>
        ${followCard()}
        ${settings.name ? '' : '<div class="checks"><b>Add your name first.</b> It goes at the bottom of every PDF. <a href="#" id="set2">Open settings</a></div>'}
        ${settings.name && !settings.intro ? '<div class="checks"><b>Set up "My profile" once.</b> Your photo, intro and why you do insurance go on every follow-up PDF. <a href="#" id="prof2">Open My profile</a></div>' : ''}
        ${due.length ? `<h2 class="muted" style="margin:6px 2px 8px;font-weight:600">FOLLOW UP SOON</h2>${due.map(({c, m}) => `<a class="item" href="#/case/${c.id}"><span class="stripe" style="background:${m.followUpDate < todayISO() ? 'var(--err)' : 'var(--gold)'}"></span><div class="t"><b>${esc(c.client.name)}</b><span>${esc(m.nextStep || FU.typeLabel(m.type))}</span></div><div class="amt">${esc(m.followUpDate)}<small>${m.followUpDate < todayISO() ? 'overdue' : m.followUpDate === todayISO() ? 'today' : 'soon'}</small></div></a>`).join('')}` : ''}
        ${installTip()}
        <div id="syncLine"></div>
        <div class="seg kindtabs" role="tablist"><button type="button" data-kt="client" aria-pressed="${tab === 'client'}">⭐ Existing Clients (${nClient})</button><button type="button" data-kt="prospect" aria-pressed="${tab === 'prospect'}">🌱 Prospects (${nProspect})</button></div>
        <p class="muted" style="margin:-6px 2px 8px">${tab === 'client' ? 'People whose policies you manage or review. Their policy summaries live here.' : 'People you are approaching or following up. Not clients yet.'}</p>
        ${list.length > 6 ? `<div class="f"><input id="qC" type="search" placeholder="Search ${tab === 'client' ? 'clients' : 'prospects'}" value="${esc(home.q || '')}"></div>` : ''}
        ${shown.length ? shown.map(c => {
          const s = PS.summarise(c), n = PS.pendingChecks(c).length, ms = c.meetings || [], last = ms[ms.length - 1];
          const sub = [c.client.nickname, last ? 'met ' + last.date : '', c.policies.length ? c.policies.length + ' polic' + (c.policies.length === 1 ? 'y' : 'ies') : ''].filter(Boolean).join(' · ') || 'updated ' + new Date(c.updated).toLocaleDateString('en-GB');
          return `<a class="item" href="#/case/${c.id}"><div class="t"><b>${esc(c.client.name || 'Unnamed client')}${c.sample ? ' <span class="pill grey">Sample</span>' : ''}</b><span>${esc(sub)}</span></div>
            <div class="amt">${c.policies.length ? PS.rm(s.cats.death.total, {short: true}) : ms.length}<small>${n ? `<span class="pill warn">${n} to check</span>` : c.policies.length ? 'death cover' : 'meeting' + (ms.length === 1 ? '' : 's')}</small></div></a>`;
        }).join('') : q ? '<div class="empty">No one matches.</div>' : tab === 'client' ? '<div class="empty">No existing clients yet.<br>Add one with <b>+ New client or prospect</b>, or move a prospect here when they close.</div>' : '<div class="empty">No prospects yet.<br>Tap <b>Record a meeting</b> after you meet someone.</div>'}
        ${list.length && !list.some(c => c.sample) ? '<p class="muted" style="text-align:center;margin:10px 0"><a href="#" id="demo">Open the sample client</a></p>' : ''}
        <p class="muted" style="text-align:center;margin:18px 10px">${syncCfg ? 'Clients are locked with your sync passphrase before syncing. Photos are read and then discarded.' : 'Client details are saved on this device only. Photos are read and then discarded.'}</p>
      </div>${tabbar('home')}`;
    $('#new').onclick = () => newCase(tab);
    $('#recNew').onclick = () => startRecord(null);
    $('#psGo').onclick = () => psStart();
    $$('[data-kt]').forEach(b => b.onclick = () => { save('pspt.homeTab', b.dataset.kt); home.q = ''; home(); });
    const rr = $('#recResume'); if (rr) rr.onclick = () => { location.hash = '#/record' + (rec.caseId ? '/' + rec.caseId : ''); };
    const p2 = $('#prof2'); if (p2) p2.onclick = e => { e.preventDefault(); openProfile(); };
    const qc = $('#qC'); if (qc) qc.oninput = () => { home.q = qc.value; const pos = qc.selectionStart; home(); const n = $('#qC'); n.focus(); n.setSelectionRange(pos, pos); };
    updateSyncLine();
    const it = $('#tipX'); if (it) it.onclick = () => { save('pspt.tipHidden', Date.now()); $('#installTip').remove(); };
    $('#set').onclick = openSettings;
    const s2 = $('#set2'); if (s2) s2.onclick = e => { e.preventDefault(); openSettings(); };
    const d = $('#demo'); if (d) d.onclick = e => { e.preventDefault(); const c = window.sampleCase(PS); cases.push(c); saveCases(); location.hash = '#/case/' + c.id; };
  }

  function newCase(kind) {
    let k = kind === 'client' ? 'client' : 'prospect';
    const el = sheet(`<h3>New person</h3>
      <div class="seg" id="nKind"><button type="button" data-k="client" aria-pressed="${k === 'client'}">⭐ Existing client</button><button type="button" data-k="prospect" aria-pressed="${k === 'prospect'}">🌱 Prospect</button></div>
      <p>Only the name is needed. Age and income make a policy summary more useful.</p>
      <div class="f"><label for="nName">Client name (as it should appear on the PDF)</label><input id="nName" autocomplete="off"></div>
      <div class="grid2"><div class="f"><label for="nAge">Age</label><input id="nAge" inputmode="numeric"></div>
      <div class="f"><label for="nInc">Annual income (optional)</label><input id="nInc" inputmode="decimal" placeholder="e.g. 84k"></div></div>
      <div class="row"><button class="btn" data-x>Cancel</button><button class="btn primary" data-ok>Create</button></div>`);
    $('#nName', el).focus();
    $$('#nKind button', el).forEach(b => b.onclick = () => { k = b.dataset.k; $$('#nKind button', el).forEach(x => x.setAttribute('aria-pressed', x === b)); });
    $('[data-x]', el).onclick = closeSheet;
    $('[data-ok]', el).onclick = () => {
      const name = $('#nName', el).value.trim();
      if (!name) { $('#nName', el).classList.add('flag'); return; }
      const now = new Date().toISOString();
      const c = {id: PS.uid(), created: now, updated: now, kind: k, client: {name, age: PS.parseAmount($('#nAge', el).value).value, income: PS.parseAmount($('#nInc', el).value).value},
        guide: Object.assign({}, settings.guide), policies: []};
      cases.push(c); save('pspt.homeTab', k); saveCases(); closeSheet(); location.hash = '#/case/' + c.id;
    };
  }

  /* ---------- one client ---------- */
  function caseScreen(c) {
    const s = PS.summarise(c), checks = PS.pendingChecks(c), kind = FU.kindOf(c);
    const exist = c.policies.filter(p => !PS.isProposal(p)), props = c.policies.filter(PS.isProposal);
    app.innerHTML = bar(c.client.name || 'Client', '#/', `<button class="ib" id="del" aria-label="Delete client">${ICONS.trash}</button>`) + `
      <div class="wrap">
        <div class="kindbar ${kind}"><span>${kind === 'client' ? '⭐ Existing client' : '🌱 Prospect'}</span><button type="button" class="btn sm" id="kindSw">${kind === 'client' ? 'Move to Prospects' : 'Move to Existing Clients'}</button></div>
        ${afterCloseCard(c)}
        <div class="card hero psbox"><h2>📄 Policy summary</h2>
          ${exist.length ? `<div class="stat"><div><span>Death</span><b>${PS.rm(s.cats.death.total, {short: true})}</b></div><div><span>CI</span><b>${PS.rm(s.cats.ci.total, {short: true})}</b></div><div><span>Medical/yr</span><b>${s.medical.annual != null ? PS.rm(s.medical.annual, {short: true}) : '—'}</b></div></div>
            <p class="ps-sub">${exist.length} polic${exist.length === 1 ? 'y' : 'ies'}${checks.length ? ` · <b>${checks.length} to check</b>` : ' · all checked'}</p>
            <a class="btn primary block" href="#/case/${c.id}/summary">See summary &amp; create PDF</a>
            <button type="button" class="btn block ps-more" id="psAdd">+ Add more policies</button>`
          : `<p>Snap or upload ${esc(c.client.name || 'their')}'s policies from any insurer: policy pages, e-Connect / portal screenshots or PDFs. On Field reads them and adds up the cover on one page.</p>
            <button type="button" class="btn primary block" id="psAdd">📷 Start policy summary</button>`}
          <div class="cmpbar">${c.policies.length >= 2 ? `<a class="btn block cmp-go" href="#/case/${c.id}/compare">⚖️ Compare policies &amp; proposals</a>` : ''}
            <button type="button" class="btn block ps-more" id="propAdd">+ Add a proposal to compare</button></div>
          <div id="resendPS"></div>
        </div>
        ${kind === 'client' ? '' : farmCard(c)}
        ${kind === 'client' ? '' : `<details class="polwrap" ${c.policies.length ? 'open' : ''}><summary><b>Their current policies</b> <span class="muted">(${c.policies.length})</span></summary>`}
        <h2 class="muted" style="margin:14px 2px 8px;font-weight:600">ADD POLICIES</h2>
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
        <h2 class="muted" style="margin:6px 2px 8px;font-weight:600">POLICIES (${exist.length})</h2>
        ${[[exist, 0], [props, 1]].map(([list, isP]) => (isP && !list.length ? '' : (isP ? '<h2 class="muted" style="margin:14px 2px 8px;font-weight:600">PROPOSALS (' + list.length + ') <small style="font-weight:400;letter-spacing:0;text-transform:none">· compared only, not in the summary</small></h2>' : '')) + (list.length ? list.map(p => {
          const n = PS.pendingChecks({policies: [p]}, true).length, r = PS.policyRow(p), out = p.status !== 'inforce' && p.status !== 'unknown';
          const tags = PS.CATS.filter(k => r[k.id].has).map(k => k.short).join(' · ');
          return `<a class="item" href="#/case/${c.id}/policy/${p.id}"><span class="stripe" style="background:${PS.insurerColor(p.insurer)}"></span><div class="t"><b>${esc(p.insurer || 'Insurer?')}${PS.isProposal(p) ? ' <span class="pill prop">Proposal</span>' : ''}</b><span>${esc(p.productName || 'Plan')}${p.policyNo ? ' · ' + esc(p.policyNo) : ''}</span><span>${esc(tags || 'No benefits yet')}</span></div>
            <div class="amt">${n ? `<span class="pill warn">${n} check</span>` : out ? `<span class="pill grey">${esc(p.status)}</span>` : '<span class="pill ok">OK</span>'}<small>${p.source === 'photo' ? 'from photo' : 'keyed in'}</small></div></a>`;
        }).join('') : isP ? '' : '<div class="empty">No policies yet. Tap <b>Add policy pages</b>, add every policy the client has from any insurer, then read them all at once.</div>')).join('')}
        ${kind === 'client' ? farmCard(c) : '</details>'}
        <div class="card" style="margin-top:12px"><h2>Client</h2>
          <div class="f"><label for="cName">Name on PDF</label><input id="cName" value="${esc(c.client.name)}"></div>
          <div class="grid2"><div class="f"><label for="cAge">Age</label><input id="cAge" inputmode="numeric" value="${money(c.client.age)}"></div>
          <div class="f"><label for="cInc">Annual income (optional)</label><input id="cInc" inputmode="decimal" value="${money(c.client.income)}"></div></div>
          <p class="muted">With income, the summary compares cover with a guideline of ${c.guide.death}× income for death/TPD and ${c.guide.ci}× for CI. Change the multiples in Settings.</p>
        </div>
      </div>
      ${exist.length ? `<div class="dock"><a class="btn navy" href="#/case/${c.id}/summary">See policy summary &amp; PDF</a></div>` : ''}`;
    $('#key').onclick = () => { location.hash = '#/case/' + c.id + '/policy/new'; };
    wireFarm(c);
    wireResend(c);
    $('#kindSw').onclick = () => setKind(c, kind === 'client' ? 'prospect' : 'client');
    wireAfterClose(c);
    $('#addP').onclick = () => openTray(c, 'existing');
    $('#propAdd').onclick = () => { const w = $('.polwrap'); if (w) w.open = true; openTray(c, 'proposal'); };
    $('#psAdd').onclick = () => { const w = $('.polwrap'); if (w) w.open = true; $('#addP').click(); };
    if (openTrayFor === c.id) { const role = openTrayRole || 'existing'; openTrayFor = null; openTrayRole = null; setTimeout(() => { const w = $('.polwrap'); if (w) w.open = true; openTray(c, role); }, 0); }
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
        try { const lr = await post({op: 'login'}, who); save('pspt.session', Object.assign(who, {owner: !!lr.owner})); if (!settings.name) { settings.name = who.name; save('pspt.settings', settings); }   /* not an edit: a synced profile from another device still wins */ closeSheet(); done(true); }
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
    offline: 'No internet connection. Try again, or key the policy in.', daily_limit: 'The team has used today\'s shared AI limit (about 300 reads across all REDEFINE apps). It resets at midnight. Meanwhile you can key in or type instead.',
    no_credit: 'The OpenAI account is out of credit. Tell Kah Jian.', bad_api_key: 'The team server key is not working. Tell Kah Jian.',
    refused: 'The AI would not read this image. Try a clearer photo or key it in.', invalid_json: 'The AI answer was unreadable. Try again with fewer photos.',
    rate_limited: 'The AI is busy. Wait a minute and try again.', image_rejected: 'One photo could not be opened. Try a screenshot or a different photo.'
  };

  /* the team shares one daily AI allowance on the team server (DAILY_LIMIT, 300 by default) across all REDEFINE apps */
  const aiLimitNote = extra => `<p class="ai-limit">🤖 <b>AI is shared by the whole team:</b> about 300 AI reads a day across all REDEFINE apps, reset at midnight. Each group of up to 4 pages, each voice note and each draft is 1 read, and there is a limit of 40 pages per upload. Please send only the pages you need, so your teammates can use AI too.${extra ? ' ' + extra : ''}</p>`;

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

  function openTray(c, role) { if (!tray || tray.caseId !== c.id) { clearTray(); tray = {caseId: c.id, items: [], notes: []}; } if (role) tray.role = role; showTray(c); }
  function showTray(c) {
    const items = tray.items, n = items.filter(it => it.on).length, prop = tray.role === 'proposal';
    const el = sheet(`<div class="sheet-top"><h3>${n ? `Read ${n} page${n === 1 ? '' : 's'}?` : 'Add policy pages'}</h3><button type="button" class="xbtn" id="trayX" aria-label="Close">✕</button></div>
      <div class="seg" id="tRole" style="margin-bottom:8px"><button type="button" data-r="existing" aria-pressed="${!prop}">Existing policies</button><button type="button" data-r="proposal" aria-pressed="${prop}">New proposal</button></div>
      <p style="margin-bottom:8px">${prop ? `Add the benefit illustration or proposal pages for ${esc(c.client.name || 'this client')} (any insurer, PDF or photos). It is saved as a <b>proposal</b>: used in comparisons, never counted in their policy summary.` : `Add every policy for ${esc(c.client.name || 'this client')}, from any insurer: photos, screenshots of insurer apps, and PDFs. Tap a page to leave it out. The AI sorts them into separate policies.`}</p>
      ${items.length ? `<div class="pick grid">${items.map((it, i) => `<button type="button" class="th" data-i="${i}" aria-pressed="${it.on}"><img src="${it.url}" alt=""><span>${esc(it.label)}</span></button>`).join('')}</div>` : ''}
      <div class="addrow">
        <button class="btn sm" id="tCam">${ICONS.cam.replace('<svg ', '<svg width="18" height="18" ')}Take photo</button>
        <button class="btn sm" id="tPic">+ Photos</button>
        <button class="btn sm" id="tPdf">${ICONS.pdf.replace('<svg ', '<svg width="18" height="18" ')}+ PDF</button>
      </div>
      ${tray.notes.length ? `<p class="muted" style="color:var(--warn)">${esc(tray.notes.join('. '))}.</p>` : ''}
      <p class="muted">${n > MAX_PICK ? `<b style="color:var(--err)">Choose up to ${MAX_PICK} pages.</b> ` : ''}Long terms-and-conditions pages are not needed; pick schedule, benefit and statement pages. Cover IC numbers if they show.</p>
      ${aiLimitNote(n ? `These ${n} page${n === 1 ? '' : 's'} use about ${Math.ceil(n / (CFG.maxPhotosPerRead || 4))} read${Math.ceil(n / (CFG.maxPhotosPerRead || 4)) === 1 ? '' : 's'}.` : '')}
      <div class="row" style="margin-top:10px"><button class="btn" id="tCancel">Cancel</button><button class="btn primary" id="tGo" ${!n || n > MAX_PICK ? 'disabled' : ''}>Read with AI</button></div>`);
    $('#sheet').dataset.lock = '1';   // a stray tap outside must not throw the pages away
    $$('.th', el).forEach(b => b.onclick = () => { const it = items[+b.dataset.i]; it.on = !it.on; showTray(c); });
    $$('#tRole button', el).forEach(b => b.onclick = () => { tray.role = b.dataset.r; showTray(c); });
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
    if (tray.role === 'proposal') merged.forEach(p => { p.role = 'proposal'; p.status = 'inforce'; delete p.checks.status; p.cashValue = null; p.bonus = null; delete p.checks.cashValue; delete p.checks.bonus; });
    merged.forEach(p => {
      const dup = c.policies.find(q => q.insurer && q.insurer === p.insurer && q.policyNo && q.policyNo === p.policyNo && PS.isProposal(q) === PS.isProposal(p));
      if (dup) p.checks.duplicate = 'Looks like a policy already added (' + dup.policyNo + '). Delete one if it is the same.';
    });
    if (merged.length) { c.policies.push(...merged); c.updated = new Date().toISOString(); saveCases(); route(); }   // list behind the result box shows them

    /* keep only the pages that failed, so they can be retried */
    const failedSet = new Set(failed);
    tray.items.forEach(it => { if (!failedSet.has(it) && it.url) URL.revokeObjectURL(it.url); });
    tray.items = failed.map(it => Object.assign(it, {on: true}));
    tray.notes = [];
    const insurers = [...new Set(merged.map(p => p.insurer || 'Insurer not recognised'))];
    const checks = PS.pendingChecks({policies: merged}, true).length;
    const why = stop ? (AI_ERR[stop.code] || stop.code) : failed.length ? AI_ERR[failed[0].why] || 'Some pages could not be read.' : '';
    const el = sheet(`<h3>${merged.length ? `Found ${merged.length} ${tray.role === 'proposal' ? 'proposal' + (merged.length > 1 ? 's' : '') : 'polic' + (merged.length > 1 ? 'ies' : 'y')}` : 'No policy details found'}</h3>
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
          <div class="seg" id="pRole" style="margin-bottom:10px"><button type="button" data-r="" aria-pressed="${!PS.isProposal(p)}">Existing policy</button><button type="button" data-r="proposal" aria-pressed="${PS.isProposal(p)}">Proposal (not bought yet)</button></div>
          ${PS.isProposal(p) ? '<p class="muted" style="margin:-4px 0 10px">Proposals are used in comparisons only. They never count in the client\'s policy summary.</p>' : ''}
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
          <div class="grid3">
            <div class="f"><label for="pTo">Cover to age</label><input id="pTo" inputmode="numeric" value="${money(p.coverTo)}" placeholder="e.g. 100"></div>
            <div class="f"><label for="pYrs">or term (years)</label><input id="pYrs" inputmode="numeric" value="${money(p.coverYears)}"></div>
            <div class="f"><label for="pPay">Pay for (years)</label><input id="pPay" inputmode="numeric" value="${money(p.payYears)}"></div>
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
        <label class="chk" style="margin-bottom:8px"><input type="checkbox" data-k="rider" ${b.rider ? 'checked' : ''}> Rider / add-on (not the basic plan)</label>
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
      bind('#pTo', v => { p.coverTo = PS.parseAmount(v).value; });
      bind('#pYrs', v => { p.coverYears = PS.parseAmount(v).value; });
      bind('#pPay', v => { p.payYears = PS.parseAmount(v).value; });
      $$('#pRole button').forEach(b => b.onclick = () => { p.role = b.dataset.r; if (p.role) { p.status = 'inforce'; delete p.checks.status; } dirty = true; keep(draw); });
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
          else if (k === 'rider') b.rider = inp.checked;
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
        saveLearned();
        if (!p.benefits.length) p.checks.benefits = 'No benefits yet: add at least one'; else delete p.checks.benefits;
        if (isNew) c.policies.push(p); else c.policies[c.policies.indexOf(orig)] = p;
        c.updated = new Date().toISOString(); saveCases(); dirty = false;
        const next = c.policies.find(q => q !== p && PS.pendingChecks({policies: [q]}, true).length);
        if (next) { toast('Saved. Next one to check.'); location.hash = '#/case/' + c.id + '/policy/' + next.id; }
        else { toast('Saved'); location.hash = '#/case/' + c.id; }
      };
      const dp = $('#delP'); if (dp) dp.onclick = async () => {
        if (await confirmBox('Delete this policy?', esc((p.insurer || '') + ' ' + (p.productName || '')) + ' will be removed from ' + esc(c.client.name) + '\'s summary.', 'Delete', true)) {
          FU.markRemoved(c, 'policies', pid); c.policies = c.policies.filter(q => q.id !== pid); c.updated = new Date().toISOString(); saveCases(); dirty = false; location.hash = '#/case/' + c.id;
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
    const pages = Report.build(c, agent(), PS, {incomplete: checks.length > 0, lang: pdfLang(c)});
    const fit = Math.min(1, (Math.min(innerWidth, 560) - 28) / 794);
    app.innerHTML = bar('Summary · ' + (c.client.name || ''), '#/case/' + c.id) + `
      <div class="wrap">
        ${checks.length ? `<div class="checks"><b>${checks.length} item${checks.length > 1 ? 's' : ''} not confirmed yet.</b> Best to fix them first, but you can still create the PDF: missing amounts show as "Not stated" and are left out of the totals, and amounts read from photos are used as read.<ul>${checks.slice(0, 8).map(k => {
          const p = c.policies.find(x => x.id === k.policyId);
          return `<li><a href="#/case/${c.id}/policy/${p.id}">${esc(p.insurer || 'Policy')}</a>: ${esc(k.why)}</li>`;
        }).join('')}</ul></div>` : ''}
        ${settings.name ? '' : '<div class="checks"><b>Your name is missing</b> from the PDF footer. <a href="#" id="setN">Add it in Settings</a>.</div>'}
        ${langSeg(c)}
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
    wireLang(c, () => summary(c));
    $('#mk').onclick = async () => {
      if (checks.length && !(await confirmBox('Create PDF with incomplete info?', checks.length + ' item' + (checks.length > 1 ? 's are' : ' is') + ' not confirmed. Missing amounts show as <b>Not stated</b> and are left out of the totals. Page 1 tells the client some details were not available.', 'Create anyway'))) return;
      const T = PDF_TXT[pdfLang(c)], nm = c.client.name || '';
      makePDF(c, pages, {kind: 'summary', fname: `${T.summary(safeName(c.client.name))} - ${new Date().toISOString().slice(0, 10)}.pdf`, wa: T.waS(nm)});
    };
  }

  /* ---------- PDF language: English / 中文, remembered per client (synced with the client) ---------- */
  const pdfLang = c => c.pdfLang === 'zh' ? 'zh' : 'en';
  const langSeg = c => `<div class="seg langseg" role="group" aria-label="PDF language"><button type="button" data-lang="en" aria-pressed="${pdfLang(c) === 'en'}">English</button><button type="button" data-lang="zh" aria-pressed="${pdfLang(c) === 'zh'}">中文</button></div>`;
  function wireLang(c, redraw) { $$('[data-lang]').forEach(b => b.onclick = () => { if (pdfLang(c) === b.dataset.lang) return; c.pdfLang = b.dataset.lang; c.updated = new Date().toISOString(); saveCases(); keepScroll(redraw); }); }
  const safeName = n => (n || 'Client').replace(/[^\w一-鿿 .-]+/g, '').trim() || 'Client';
  const hi = n => n ? n + (/[一-鿿]$/.test(n) ? '' : ' ') + '您好，' : '您好，';
  const PDF_TXT = {
    en: {summary: n => `Policy Summary - ${n}`, compare: n => `Policy Comparison - ${n}`,
      waS: n => 'Hi ' + n + ', here is the summary of your insurance policies we went through.', waC: n => 'Hi ' + n + ', here is the side-by-side comparison of the plans we discussed.'},
    zh: {summary: n => `保单总结 - ${n}`, compare: n => `保单比较 - ${n}`,
      waS: n => hi(n) + '这是我们一起看过的保单总结，请参考。', waC: n => hi(n) + '这是我们讨论过的计划比较，方便您对照参考。'}
  };

  /* ---------- ⚖️ compare policies and proposals (same template as the summary) ---------- */
  function compareScreen(c) {
    const all = c.policies.slice().sort((a, b) => (PS.isProposal(a) ? 1 : 0) - (PS.isProposal(b) ? 1 : 0));
    const live = p => PS.isProposal(p) || p.status === 'inforce' || p.status === 'unknown';
    let sel = (c.cmp && c.cmp.ids || []).filter(id => all.some(p => p.id === id));
    if (sel.length < 2) { const ex = all.filter(p => !PS.isProposal(p) && live(p)), pr = all.filter(PS.isProposal); sel = (pr.length ? ex.slice(0, 1).concat(pr) : ex).slice(0, 4).map(p => p.id); if (sel.length < 2) sel = all.slice(0, 2).map(p => p.id); }
    const replace = !!(c.cmp && c.cmp.replace);
    const chosen = sel.map(id => all.find(p => p.id === id));
    const mixed = chosen.some(PS.isProposal) && chosen.some(p => !PS.isProposal(p));
    const checks = PS.pendingChecks({policies: chosen}, true);
    const pages = sel.length >= 2 ? Report.buildCompare(c, sel, agent(), PS, {replace: mixed && replace, lang: pdfLang(c)}) : [];
    const fit = Math.min(1, (Math.min(innerWidth, 560) - 28) / 794);
    app.innerHTML = bar('Compare · ' + (c.client.name || ''), '#/case/' + c.id) + `<div class="wrap">
      <div class="card"><h2>Choose 2 to 4 to compare</h2>
        <p class="muted" style="margin-bottom:8px">The first one ticked is the starting point; the others are compared with it. Untick and tick again to change the order.</p>
        <div class="cmp-pick">${all.map(p => { const i = sel.indexOf(p.id); return `<button type="button" class="cmp-it ${i >= 0 ? 'on' : ''}" data-id="${p.id}"><span class="cmp-n">${i >= 0 ? String.fromCharCode(65 + i) : ''}</span><i style="background:${PS.insurerColor(p.insurer)}"></i><span class="t"><b>${esc(p.insurer || 'Insurer?')} ${PS.isProposal(p) ? '<span class="pill prop">Proposal</span>' : live(p) ? '' : `<span class="pill grey">${esc(p.status)}</span>`}</b><small>${esc(p.productName || 'Plan')}${PS.annualPremium(p) != null ? ' · ' + PS.rm(PS.annualPremium(p)) + '/yr' : ''}</small></span></button>`; }).join('')}</div>
        <button type="button" class="btn block" id="cmpProp" style="margin-top:10px">+ Add a proposal</button>
        ${mixed ? `<label class="chk" style="margin-top:10px"><input type="checkbox" id="cmpRep" ${replace ? 'checked' : ''}> The proposal <b>replaces</b> the existing polic${chosen.filter(p => !PS.isProposal(p)).length > 1 ? 'ies' : 'y'} ticked (page 2 totals leave ${chosen.filter(p => !PS.isProposal(p)).length > 1 ? 'them' : 'it'} out)</label>` : ''}
      </div>
      ${langSeg(c)}
      ${checks.length ? `<div class="checks"><b>${checks.length} item${checks.length > 1 ? 's' : ''} not confirmed</b> in the plans chosen. Missing amounts show as "Not stated". <a href="#/case/${c.id}/policy/${checks[0].policyId}">Check now</a></div>` : ''}
      ${mixed ? '<div class="checks">Existing policy vs proposal: the PDF adds a short note on what the client may lose by replacing a policy. Follow the replacement disclosure process before any switch.</div>' : ''}
      ${pages.length ? `<div class="pages">${pages.map((h, i) => `<div class="pagebox" style="width:${Math.round(794 * fit)}px;height:${Math.round(1123 * fit)}px">${h.replace('class="rp-page"', `class="rp-page" style="transform:scale(${fit})"`)}</div>`).join('')}</div>` : '<div class="empty">Tick at least 2.</div>'}
    </div>
    ${pages.length ? `<div class="dock"><button class="btn primary" id="cmpMk">Create comparison PDF</button></div>` : ''}`;
    const store = (ids, rep) => { c.cmp = {ids, replace: rep}; c.updated = new Date().toISOString(); saveCases(); keepScroll(() => compareScreen(c)); };
    $$('.cmp-it').forEach(b => b.onclick = () => { const id = b.dataset.id, i = sel.indexOf(id); if (i >= 0) sel.splice(i, 1); else if (sel.length >= 4) return toast('Up to 4 at a time. Untick one first.'); else sel.push(id); store(sel, replace); });
    const rp = $('#cmpRep'); if (rp) rp.onchange = () => store(sel, rp.checked);
    wireLang(c, () => compareScreen(c));
    $('#cmpProp').onclick = () => { openTrayFor = c.id; openTrayRole = 'proposal'; location.hash = '#/case/' + c.id; };
    const mk = $('#cmpMk'); if (mk) mk.onclick = async () => {
      if (checks.length && !(await confirmBox('Create with unconfirmed items?', checks.length + ' item' + (checks.length > 1 ? 's are' : ' is') + ' not confirmed. Missing amounts show as <b>Not stated</b>.', 'Create anyway'))) return;
      const T = PDF_TXT[pdfLang(c)];
      makePDF(c, pages, {kind: 'compare', fname: `${T.compare(safeName(c.client.name))} - ${new Date().toISOString().slice(0, 10)}.pdf`, wa: T.waC(c.client.name || '')});
    };
  }
  function keepScroll(fn) { const y = scrollY; fn(); scrollTo(0, y); }

  async function makePDF(c, pages, o) {
    o = o || {};
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
    const fname = o.fname || `Policy Summary - ${(c.client.name || 'Client').replace(/[^\w .-]+/g, '')} - ${new Date().toISOString().slice(0, 10)}.pdf`;
    await startSend({kind: o.kind || 'summary', blob, fileName: fname, caseId: c.id, name: c.client.name || 'client',
      wa: o.wa || 'Hi ' + (c.client.name || '') + ', here is the summary of your insurance policies we went through.'});
  }

  /* ======================= send a PDF (+ WhatsApp message) without ever redoing it =======================
     The PDF is kept on this device (IndexedDB, 30 days) the moment it is made. The send sheet survives screen
     refreshes (sync, Calendar) and even a reload after coming back from WhatsApp, and every button can be tapped
     again as often as needed. Nothing is sent anywhere by the app itself: the phone's share sheet does it. */
  const PdfStore = (() => {
    let dbp = null;
    const db = () => dbp || (dbp = new Promise((ok, no) => {
      const r = indexedDB.open('pspt-pdfs', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('pdf', {keyPath: 'key'});
      r.onsuccess = () => ok(r.result); r.onerror = () => { dbp = null; no(r.error); };
    }));
    const run = async (mode, fn) => { const d = await db(); return new Promise((ok, no) => { const t = d.transaction('pdf', mode), q = fn(t.objectStore('pdf')); t.oncomplete = () => ok(q && q.result); t.onerror = () => no(t.error); }); };
    return {
      put: rec => run('readwrite', s => s.put(rec)).catch(() => null),
      get: key => run('readonly', s => s.get(key)).catch(() => null),
      all: () => run('readonly', s => s.getAll()).then(r => r || []).catch(() => []),
      del: key => run('readwrite', s => s.delete(key)).catch(() => null),
      async prune() { const all = await this.all(), old = Date.now() - 30 * 864e5; all.sort((a, b) => b.created - a.created).forEach((r, i) => { if (i >= 30 || r.created < old) this.del(r.key); }); }
    };
  })();
  let sending = null;   // the open send sheet: {key, file, url, wa, name, caseId, meetingId, kind, msg, sent}

  /* keep a freshly made PDF and open the send sheet */
  async function startSend(o) {
    const key = o.kind + '_' + (o.meetingId || o.caseId) + '_' + Date.now().toString(36);
    const buf = await o.blob.arrayBuffer();
    await PdfStore.put({key, kind: o.kind, caseId: o.caseId, meetingId: o.meetingId || '', name: o.name, fileName: o.fileName, wa: o.wa || '', buf, created: Date.now(), sent: false});
    PdfStore.prune();
    openSendRec({key, kind: o.kind, caseId: o.caseId, meetingId: o.meetingId || '', name: o.name, fileName: o.fileName, wa: o.wa || '', buf, sent: false}, o.next);
  }
  function openSendRec(r, next) {
    if (sending && sending.url) URL.revokeObjectURL(sending.url);
    const file = new File([r.buf], r.fileName, {type: 'application/pdf'});
    window.__lastPdf = file;
    sending = {key: r.key, file, url: URL.createObjectURL(file), wa: r.wa, name: r.name, caseId: r.caseId, meetingId: r.meetingId, kind: r.kind, msg: '', sent: !!r.sent, next: next || null, busy: false};
    save('pspt.sendOpen', r.key);
    showSend();
  }
  /* re-open a kept PDF (📤 Send again on the client's page) */
  async function resendPdf(key) { const r = await PdfStore.get(key); if (!r) return toast('That PDF is no longer on this device. Create it again.'); openSendRec(r, null); }
  /* after a reload (the phone may reload the app when you come back from WhatsApp) */
  async function resumeSend() { const k = load('pspt.sendOpen', null); if (!k || sending) return; const r = await PdfStore.get(k); if (r) { openSendRec(r, null); sending.msg = 'Your PDF is still here. Tap Send again if it did not go through.'; showSend(); } else save('pspt.sendOpen', null); }

  function showSend() {
    const s = sending; if (!s) return;
    const canShare = !!(navigator.canShare && navigator.share && navigator.canShare({files: [s.file]}));
    const el = sheet(`<div class="sheet-top"><h3>📤 Send to ${esc(s.name)}</h3><button type="button" class="xbtn" id="sdX" aria-label="Close">✕</button></div>
      <p><b>${esc(s.file.name)}</b> · ${(s.file.size / 1024).toFixed(0)} KB${s.sent ? ' · <span class="ok-t">✅ sent</span>' : ''}</p>
      <div class="checks">Check you pick <b>${esc(s.name)}</b>'s chat. ${s.wa ? 'The message is copied each time you tap Send, so you can paste it with the PDF.' : ''}</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${canShare ? `<button class="btn primary block" id="sdShare">${s.sent ? 'Send again…' : 'Send PDF…'}</button>` : ''}
        ${s.wa ? '<button class="btn block" id="sdCopy">Copy WhatsApp message</button>' : ''}
        <a class="btn ${canShare ? '' : 'primary'} block" href="${s.url}" download="${esc(s.file.name)}" target="_blank" rel="noopener">Save / open PDF</a>
        ${s.wa ? `<a class="btn ghost block" href="https://wa.me/?text=${encodeURIComponent(s.wa)}" target="_blank" rel="noopener">Open WhatsApp with the message only</a>` : ''}
      </div>
      <p id="sdMsg" role="status" class="send-msg">${esc(s.msg)}</p>
      <p class="muted" style="font-size:13px">If it fails, just tap again: nothing is lost. This PDF also stays on ${esc(s.name)}'s page (📤 Send again) on this device for 30 days.</p>
      <button class="btn block" id="sdDone">Done</button>`);
    $('#sheet').dataset.lock = '1';
    const say = t => { s.msg = t; const m = $('#sdMsg', el); if (m) m.textContent = t; };
    const copy = () => { if (!s.wa) return Promise.resolve(false); try { return navigator.clipboard.writeText(s.wa).then(() => true, () => false); } catch (e) { return Promise.resolve(false); } };
    const cp = $('#sdCopy', el); if (cp) cp.onclick = async () => { if (await copy()) { say('Message copied. Paste it in the chat.'); toast('Message copied'); } else say('Copy did not work here. Use "Open WhatsApp with the message only".'); };
    const sh = $('#sdShare', el); if (sh) sh.onclick = () => {
      if (s.busy) return say('Your phone is still opening the share menu… wait a second.');
      s.busy = true; setTimeout(() => { s.busy = false; }, 2500);
      const copied = copy();   // no waiting before share(): the phone only allows it straight after the tap
      const data = {files: [s.file], title: s.file.name};
      if (s.wa && !isIOS()) data.text = s.wa;   // iPhone WhatsApp often fails with file + text together; the text is on the clipboard instead
      let p; try { p = navigator.share(data); } catch (e) { p = Promise.reject(e); }
      p.then(async () => {
        s.sent = true; s.busy = false;
        const r = await PdfStore.get(s.key); if (r) { r.sent = true; PdfStore.put(r); }
        const c = getCase(s.caseId), m = c && s.meetingId && (c.meetings || []).find(x => x.id === s.meetingId);
        if (m && !m.sentPdf) { m.sentPdf = true; c.updated = new Date().toISOString(); saveCases(); }
        say((await copied) ? '✅ Shared. If the message is not in the chat, paste it (it is copied).' : '✅ Shared.');
        showSend();
      }, async e => {
        s.busy = false;
        const n = e && e.name;
        if (n === 'AbortError') say('Not sent (closed, or WhatsApp did not take it). Tap Send PDF again.');
        else if (n === 'NotAllowedError') say('Your phone blocked it this time. Tap Send PDF again.');
        else if (n === 'InvalidStateError') say('The share menu was still open. Tap Send PDF again.');
        else say('Sending did not work this time. Tap Send PDF again, or tap Save / open PDF and attach it in WhatsApp.');
      });
    };
    const close = () => {
      const nx = s.next; if (s.url) setTimeout(() => URL.revokeObjectURL(s.url), 60000);
      sending = null; save('pspt.sendOpen', null); closeSheet();
      if (nx) { pendingNext = nx; if (location.hash === '#/case/' + nx.caseId) route(); else location.hash = '#/case/' + nx.caseId; }
      else route();
    };
    $('#sdX', el).onclick = close; $('#sdDone', el).onclick = close;
  }
  /* 📤 Send again buttons on a client's page */
  async function wireResend(c) {
    const recs = (await PdfStore.all()).filter(r => r.caseId === c.id).sort((a, b) => b.created - a.created);
    if (!recs.length || location.hash !== '#/case/' + c.id) return;
    const seen = {};
    recs.forEach(r => {
      if (r.kind === 'followup') {
        if (seen[r.meetingId]) return; seen[r.meetingId] = 1;
        const li = $(`.timeline li[data-mid="${r.meetingId}"]`); if (!li || $('.tl-resend', li)) return;
        const b = document.createElement('button'); b.type = 'button'; b.className = 'btn sm tl-resend'; b.textContent = r.sent ? '📤 Send PDF again' : '📤 Send PDF (not sent yet)';
        b.onclick = () => resendPdf(r.key); li.insertBefore(b, $('.tl-del', li));
      } else if ((r.kind === 'summary' || r.kind === 'compare') && !seen[r.kind]) {
        seen[r.kind] = 1;
        const host = $('#resendPS'); if (!host) return;
        const d = new Date(r.created), p = n => String(n).padStart(2, '0');
        const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn block'; btn.style.marginTop = '6px';
        btn.textContent = `📤 Send last ${r.kind === 'compare' ? 'comparison' : 'summary'} PDF again (${p(d.getDate())}/${p(d.getMonth() + 1)})`;
        btn.onclick = () => resendPdf(r.key); host.appendChild(btn);
      }
    });
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
        let pulledR = 0, pulledS = false;
        const strip = x => JSON.stringify(Object.assign({}, x, {updated: 0, removed: 0}));
        for (const id of Object.keys(server)) {
          const s = server[id];
          if (id.startsWith('r_')) {   // a day's 三访 reflection, not a client
            const date = id.slice(2), loc = reports[date];
            if (!s.d && (!loc || !loc.updated || s.u > loc.updated)) { try { reports[date] = await open(key, s); pulledR++; } catch (e) {} }
            continue;
          }
          if (id === 'p_settings') {   // profile, report name, targets: same on every device
            if (!settings.updatedAt || s.u > settings.updatedAt) { try { settings = Object.assign({}, settings, await open(key, s)); saveSettings(); pulledS = true; } catch (e) {} }
            continue;
          }
          if (id === 'l_learned') {   // benefit names the agent taught the app
            if (!load('pspt.learnedAt', '') || s.u > load('pspt.learnedAt', '')) { try { learned = await open(key, s); save('pspt.learned', learned); save('pspt.learnedAt', s.u); } catch (e) {} }
            continue;
          }
          const local = getCase(id);
          if (tombs[id] && s.u <= tombs[id]) continue;          // we deleted it here
          if (local && s.u === local.updated) continue;          // nothing new
          if (s.d) { if (local && local.updated > s.u) continue; if (local) { cases = cases.filter(x => x.id !== id); pulled++; } tombs[id] = s.u; continue; }
          let remote; try { remote = await open(key, s); } catch (e) { continue; }   // not ours / damaged: leave it
          if (!local) { cases.push(remote); pulled++; continue; }
          /* both this device and another changed this client: keep both sides' work */
          const merged = FU.mergeCase(local, remote), i = cases.indexOf(local);
          if (strip(merged) === strip(remote)) cases[i] = remote;                    // the other copy already has everything
          else { merged.updated = new Date().toISOString(); cases[i] = merged; }    // newer than both, so it is sent back below
          if (strip(cases[i]) !== strip(local)) pulled++;
        }
        const push = {};
        for (const c of cases) if (!c.sample && (!server[c.id] || server[c.id].u < c.updated)) push[c.id] = Object.assign({u: c.updated}, await seal(key, c));
        for (const id of Object.keys(tombs)) if (server[id] && !server[id].d && server[id].u < tombs[id]) push[id] = {u: tombs[id], d: true};
        for (const date of Object.keys(reports)) { const r = reports[date], sid = 'r_' + date; if (r.updated && (!server[sid] || server[sid].u < r.updated)) push[sid] = Object.assign({u: r.updated}, await seal(key, r)); }
        if (settings.updatedAt && (!server.p_settings || server.p_settings.u < settings.updatedAt)) push.p_settings = Object.assign({u: settings.updatedAt}, await seal(key, settings));
        const la = load('pspt.learnedAt', ''); if (la && (!server.l_learned || server.l_learned.u < la)) push.l_learned = Object.assign({u: la}, await seal(key, learned));
        if (pulledR) save('pspt.reports', reports);
        if (pulledS && !pulled) { const h = location.hash.replace(/^#\/?/, ''); if (!h) route(); }
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
    if (!syncCfg) return `<div class="checks backup-warn"><b>⚠️ Your clients are only on this device.</b> If you delete the app, change phone, or use an iPad or laptop, they won't be there. Turn on <b>Backup &amp; sync</b> once on each device.<button class="btn primary block" id="syncSet" style="margin-top:8px">☁︎ Turn on Backup &amp; sync</button><span class="muted" style="display:block;margin-top:6px">Already use On Field on another device? Same button: enter the same name and passphrase to bring everything here.</span></div>`;
    const t = syncCfg.last ? new Date(syncCfg.last).toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'}) : '';
    const msg = syncState === 'server' ? 'Sync waiting for the team server update' : syncState === 'signin' ? 'Sync paused: sign in again' : syncState === 'offline' ? 'Sync paused: no connection' : syncing ? 'Syncing…' : t ? 'Synced ' + t : 'Sync on';
    return `<button class="syncline${syncState ? ' warn' : ''}" id="syncSet">☁︎ ${esc(msg)} · ${esc(syncCfg.name)}</button>`;
  }
  /* ---------- REDEFINE Prospecting: collect lead activity (called / appointment) into quick logs ---------- */
  let prBusy = null;
  function prPull(loud) {
    if (!settings.prCode || !navigator.onLine) return Promise.resolve(0);
    if (prBusy) return prBusy;
    prBusy = fetch(FU.PROSPECTING_URL, {method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: JSON.stringify({op: 'feed', code: settings.prCode, since: settings.prSince || ''})})
      .then(r => r.json()).then(j => {
        prBusy = null;
        if (j.error === 'bad_link') { settings.prCode = ''; settings.prSince = ''; saveSettings(); toast('REDEFINE Prospecting was disconnected (the code was replaced). Connect again in Settings.'); return 0; }
        if (j.error) throw new Error(j.error);
        const r = FU.applyProspecting(cases, j.items, {guide: settings.guide});
        settings.prSince = j.now; settings.prLast = new Date().toISOString(); saveSettings();
        if (r.changed || r.created) { saveCases(); if (loud !== 'quiet') toast('📒 From Prospecting: ' + r.changed + ' update(s)' + (r.created ? ', ' + r.created + ' new prospect(s)' : '')); route(); }
        else if (loud === true) toast('Up to date with Prospecting');
        return r.changed;
      }).catch(() => { prBusy = null; if (loud === true) toast('Could not reach REDEFINE Prospecting. Try again later.'); return 0; });
    return prBusy;
  }
  function connectProspecting(code) {
    settings.prCode = code; settings.prSince = ''; saveSettings();
    toast('Connecting REDEFINE Prospecting…');
    prPull('quiet').then(n => { if (settings.prCode) toast('✅ Connected to REDEFINE Prospecting' + (n ? ' · ' + n + ' update(s) added' : '') + '. Calls and appointments now come in by themselves.'); });
  }
  setInterval(() => { if (document.visibilityState === 'visible') prPull('quiet'); }, 5 * 60e3);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') prPull('quiet'); });

  function updateSyncLine() { const el = $('#syncLine'); if (el) { el.innerHTML = syncLine(); $('#syncSet').onclick = openSync; } }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
  setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 30000);   // devices open at the same time catch up within about 30 s
  addEventListener('online', () => syncNow());

  async function openSync() {
    if (syncCfg) {
      const el = sheet(`<div class="sheet-top"><h3>Backup &amp; sync</h3><button type="button" class="xbtn" data-close aria-label="Close">✕</button></div>
        <p>On as <b>${esc(syncCfg.name)}</b>. Your clients, meetings, 三访 notes and profile are backed up (locked with your passphrase) and shared with every device where you turned this on: phone, iPad and laptop, even at the same time. Changes reach the others within about 30 seconds. ${syncCfg.last ? 'Last synced ' + esc(new Date(syncCfg.last).toLocaleString('en-GB')) + '.' : ''}</p>
        <p class="muted">New phone or reinstalled the app? Sign in, tap Turn on Backup &amp; sync, and enter the same name and passphrase. Everything comes back.</p>
        ${syncCfg.pw ? `<button class="tinylink" id="sShow" style="margin:0 0 10px">Show my passphrase</button><p class="muted" id="sPw" hidden></p>` : ''}
        ${syncState === 'server' ? '<div class="checks">The team server needs its update before sync can run. Your clients are safe on this device.</div>' : ''}
        ${syncState === 'signin' ? '<div class="checks">Sync is paused because the team sign-in was not accepted (the team code may have changed). Sign in again to continue. Your sync stays on.</div>' : ''}
        <div style="display:flex;flex-direction:column;gap:8px">${syncState === 'signin' ? '<button class="btn primary block" id="sIn">Sign in again</button>' : '<button class="btn primary block" id="sNow">Sync now</button>'}<button class="btn block" data-close>Close</button></div>
        <button class="tinylink" id="sOff">Stop syncing this device…</button>`);
      const sw = $('#sShow', el); if (sw) sw.onclick = () => { const p = $('#sPw', el); p.hidden = !p.hidden; p.innerHTML = `Name <b>${esc(syncCfg.name)}</b> · passphrase <b>${esc(syncCfg.pw)}</b>. Use exactly these on your other devices.`; sw.textContent = p.hidden ? 'Show my passphrase' : 'Hide passphrase'; };
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
    const el = sheet(`<div class="sheet-top"><h3>Backup &amp; sync</h3><button type="button" class="xbtn" data-close aria-label="Close">✕</button></div>
      <p><b>First device:</b> choose a personal passphrase. <b>Other devices, a new phone or after reinstalling:</b> type the <b>same name and passphrase</b> and everything comes back. Your clients are locked with your passphrase before leaving this device, so other agents and REDEFINE cannot read them.</p>
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
      syncCfg = Object.assign({name, pw}, await deriveSync(name, pw)); save('pspt.sync', syncCfg);   // pw kept on this device only, so the agent can look it up for their next device
      await syncNow();
      closeSheet();
      toast(syncState === 'server' ? 'Backup is set. It starts once the team server is updated.' : syncState ? 'Backup is set. It will finish when you are online.' : lastPulled ? 'Backup & sync is on. ' + lastPulled + ' client(s) restored from your other device.' : 'Backup & sync is on. If you used On Field before and nothing came back, check the name and passphrase are exactly the same.');
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

  // open the recorder for a named person: their farm record if the name matches exactly, else a new client with that name
  async function recordFor(name) {
    const n = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const m = name && cases.find(x => !x.sample && (n(x.client.name) === n(name) || (x.client.nickname && n(x.client.nickname) === n(name))));
    if (m) return startRecord(m.id);
    await startRecord(null);
    if (name && rec && !rec.caseId && !rec.transcript) { rec.nameHint = name; saveRec(); if (/^#\/?record$/.test(location.hash)) route(); }
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
        <div id="vPend"></div>
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
      pendingVoiceBanner(c);
      $('#draft').onclick = () => draftWithAI(c);
      return;
    }
    /* capture */
    app.innerHTML = bar('Record a meeting', back, rec.transcript ? discard : '') + `<div class="wrap">${stepBar}
      ${c ? '' : `<div class="card"><h2>Which client?</h2><div class="f">${rec.nameHint ? `<p style="margin-bottom:8px">From 定联: <b>${esc(rec.nameHint)}</b> (new client). If they're already in your farm, pick them below instead.</p>` : ''}<select id="pickC"><option value="">${rec.nameHint ? 'New client: ' + esc(rec.nameHint) : 'New client (the app takes the name from what you say)'}</option>${cases.filter(x => !x.sample).sort((a, b) => (b.updated || '').localeCompare(a.updated || '')).map(x => `<option value="${x.id}">${esc(x.client.name)}${x.client.nickname ? ' (' + esc(x.client.nickname) + ')' : ''}</option>`).join('')}</select></div></div>`}
      <div id="vPend"></div>
      <div class="card mic-card">
        <p class="muted">Tell it like you'd tell your leader. Mix Mandarin, Hokkien, Cantonese, English and Malay freely.</p>
        <button class="mic" id="mic" aria-label="Start recording"><span></span></button>
        <div class="mic-time" id="micT">Tap to record · up to 10 min</div>
        ${rec.transcript ? `<p class="muted" style="margin-top:8px">${rec.transcript.length} characters recorded so far. Recording again adds to it.</p>` : ''}
      </div>
      <details class="card guide" ${load('pspt.guideClosed', false) ? '' : 'open'} id="guideQ"><summary><b>Guide: what to cover</b> <span class="muted">(no need to follow all)</span></summary>
        <ol>${FU.QUESTIONS.map(q => `<li>${esc(q.zh)}<span>${esc(q.en)}</span></li>`).join('')}</ol></details>
      ${aiLimitNote('Recording costs 1 read and the draft 1 more; typing instead skips the voice read.')}
      <details class="card"><summary><b>Type instead</b> <span class="muted">(or use your keyboard's mic)</span></summary>
        <div class="f" style="margin-top:8px"><textarea id="typed" rows="6" placeholder="今天见陈先生, 35岁, 两个孩子, 担心 medical 不够……"></textarea></div>
        <button class="btn sm" id="useTyped">Use this text</button></details>
      ${photoStrip()}
      ${rec.transcript ? '<p style="text-align:center"><button class="btn" id="toTx">Next: check the text →</button></p>' : ''}
    </div>`;
    wireCommon(c);
    const pick = $('#pickC'); if (pick) pick.onchange = () => { if (pick.value) { const id = pick.value; rec.caseId = id; saveRec(); location.hash = '#/record/' + id; } };
    $('#mic').onclick = () => (mediaRec ? stopMic() : startMic(c));
    pendingVoiceBanner(c);
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

  /* ---------- microphone ----------
     Long notes are recorded in pieces of about 90 seconds, one after another (never two recorders at once: iPhone
     breaks both). Each piece is a whole audio file turned into text on its own, then joined in order.
     A recording is never thrown away: the pieces are kept on the device until every one is text, a failed piece is
     tried 3 times (a dropped connection on mobile data is the usual cause), and "Try again" re-sends only the pieces
     still missing. If the phone stops the mic by itself (screen lock, a call), what was recorded so far is kept. */
  const SEG_MS = 90000, MAX_REC_S = 600;
  const recType = () => ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
  function segRecorder(stream, segMs) {
    const type = recType(), parts = [];
    let cur = null, n = 0, stopping = false, finishedOnce = false, done, timer = null;
    const finished = new Promise(r => { done = r; });
    const finish = () => { if (finishedOnce) return; finishedOnce = true; clearTimeout(timer); stream.getTracks().forEach(t => t.stop()); done(parts.filter(Boolean)); };
    const startOne = () => {
      const i = n++, chunks = [];
      let r;
      try { r = new MediaRecorder(stream, type ? {mimeType: type, audioBitsPerSecond: 32000} : undefined); r.start(); }   // no timeslice: each piece ends as one whole file
      catch (e) { return finish(); }
      r.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      r.onerror = () => { stopping = true; };
      r.onstop = () => {
        const b = new Blob(chunks, {type: (r.mimeType || type || 'audio/mp4').split(';')[0]});
        if (b.size > 1500) parts[i] = b;
        const live = stream.getAudioTracks().some(t => t.readyState === 'live');
        if (stopping || !live) finish(); else { startOne(); timer = setTimeout(roll, segMs); }   // next piece starts right after this one is closed
      };
      cur = r;
    };
    const roll = () => { if (!stopping && cur && cur.state !== 'inactive') cur.stop(); };
    stream.getAudioTracks().forEach(t => { t.onended = () => { stopping = true; if (cur && cur.state !== 'inactive') cur.stop(); else finish(); }; });   // the phone took the mic away
    startOne(); timer = setTimeout(roll, segMs);
    return {
      finished,
      stop() { if (stopping) return; stopping = true; clearTimeout(timer); if (cur && cur.state !== 'inactive') cur.stop(); else finish(); },
      get active() { return !stopping; }
    };
  }

  /* recordings waiting to become text, kept on this device (IndexedDB) until they are */
  const VoiceStore = (() => {
    let dbp = null;
    const db = () => dbp || (dbp = new Promise((ok, no) => { const r = indexedDB.open('pspt-voice', 1); r.onupgradeneeded = () => r.result.createObjectStore('v', {keyPath: 'key'}); r.onsuccess = () => ok(r.result); r.onerror = () => { dbp = null; no(r.error); }; }));
    const run = async (mode, fn) => { const d = await db(); return new Promise((ok, no) => { const t = d.transaction('v', mode), q = fn(t.objectStore('v')); t.oncomplete = () => ok(q && q.result); t.onerror = () => no(t.error); }); };
    return {put: v => run('readwrite', s => s.put(v)).catch(() => null), get: k => run('readonly', s => s.get(k)).catch(() => null), del: k => run('readwrite', s => s.delete(k)).catch(() => null)};
  })();
  const NO_RETRY = ['invalid_request', 'no_api_key', 'bad_api_key', 'no_credit', 'daily_limit', 'unauthorized', 'audio_too_large'];
  const VOICE_ERR = {offline: 'The connection dropped while sending the recording.', upstream_error: 'The team server did not answer properly.', rate_limited: 'The speech-to-text service was busy.',
    audio_rejected: 'The speech-to-text service could not open this recording.', bad_model: 'The speech-to-text model is not available.'};
  const wait = ms => new Promise(r => setTimeout(r, ms));
  /* turn the pieces still missing into text: up to 3 tries each. job = {parts: [Blob], texts: [string|null]} */
  async function convertJob(job, hint, onProgress) {
    let lastErr = null;
    const todo = job.parts.map((_, i) => i).filter(i => job.texts[i] == null);
    for (let k = 0; k < todo.length; k++) {
      const i = todo[k];
      onProgress && onProgress(k + 1, todo.length, job.parts.length);
      const prev = job.texts.slice(0, i).filter(Boolean).join(' ').slice(-200);
      for (let t = 0; t < 3 && job.texts[i] == null; t++) {
        if (t) await wait(t === 1 ? 1500 : 4000);
        try { const r = await post({op: 'transcribe', audio: await blobB64(job.parts[i]), mime: job.parts[i].type, hint: (hint + (prev ? ' Earlier in this note: ' + prev : '')).slice(0, 900)}); job.texts[i] = String(r.text || '').trim(); }
        catch (e) { lastErr = e; if (NO_RETRY.includes(e.code)) return {err: e}; }
      }
    }
    const missing = job.texts.filter(x => x == null).length;
    return {missing, err: missing ? lastErr || {code: 'upstream_error'} : null};
  }
  const jobText = job => job.texts.map((x, i) => x == null ? `[part ${i + 1} of ${job.parts.length} not converted yet]` : x).filter(Boolean).join('\n').trim();
  const voiceMsg = e => e.code === 'invalid_request' ? 'Voice needs the latest team server update.' : AI_ERR[e.code] && e.code !== 'offline' ? AI_ERR[e.code] : (VOICE_ERR[e.code] || 'Something went wrong') + ' (' + (e.code || 'error') + ')';

  async function startMic(c) {
    if (!navigator.mediaDevices || !window.MediaRecorder) return toast('This browser cannot record. Use "Type instead" with your keyboard mic.');
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true}}); }
    catch (e) { return sheet('<h3>Microphone not allowed</h3><p>Allow the microphone for this app in your phone settings (Safari / Chrome → this site → Microphone), or use "Type instead" with your keyboard mic.</p><button class="btn block" data-close>OK</button>'); }
    const sr = segRecorder(stream, SEG_MS), t0 = Date.now();
    mediaRec = sr;
    $('#mic').classList.add('on'); $('#mic').setAttribute('aria-label', 'Stop recording');
    recTimer = setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000), el = $('#micT');
      if (el) el.textContent = `● ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} · tap to stop${s >= MAX_REC_S - 60 ? ' · stops at 10:00' : ''}`;
      if (s >= MAX_REC_S) stopMic();
    }, 500);
    const parts = await sr.finished, secs = Math.round((Date.now() - t0) / 1000);
    clearInterval(recTimer); mediaRec = null;
    if (!parts.length) { toast('Too short. Try again.'); return route(); }
    const job = {key: 'pending', parts, texts: parts.map(() => null), caseId: c ? c.id : '', created: Date.now(), secs};
    await VoiceStore.put(job);   // kept until it is all text
    await transcribeJob(job, c);
  }
  function stopMic() { if (mediaRec && mediaRec.active) mediaRec.stop(); }

  const blobB64 = blob => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = bad; r.readAsDataURL(blob); });
  async function transcribeJob(job, c) {
    if (!session() && !(await signIn())) { toast('Sign in to turn voice into text. Your recording is kept.'); return route(); }
    const box = sheet(`<h3>Turning your voice into text…</h3><div class="spin"></div><p style="text-align:center" id="trP">${job.parts.length > 1 ? `Part 1 of ${job.parts.length}` : 'Usually 5–20 seconds.'}</p><p class="muted" style="text-align:center">Keep this screen open. The recording is saved on this phone until it is text.</p>`);
    $('#sheet').dataset.lock = '1';
    const name = c ? c.client.name + (c.client.nickname ? ' / ' + c.client.nickname : '') : '';
    const r = await convertJob(job, FU.hintFor(name), (k, n, all) => { const p = $('#trP', box); if (p && all > 1) p.textContent = n < all ? `Trying again: part ${k} of ${n} still missing` : `Part ${k} of ${n} · about 10–20 seconds each`; });
    await VoiceStore.put(job);
    if (!r.err) { useJob(job); return; }
    /* something is still missing: nothing is lost, offer to try again */
    const got = job.texts.filter(x => x != null).length;
    const el = sheet(`<h3>Voice not converted${got ? ' yet' : ''}</h3>
      <p>${esc(voiceMsg(r.err))}</p>
      <div class="checks ok-box">Your recording is <b>saved on this phone</b>${got ? ` and ${got} of ${job.parts.length} parts are already text` : ''}. You don't need to speak again.</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${NO_RETRY.includes(r.err.code) ? '' : '<button class="btn primary block" id="vRetry">Try again</button>'}
        ${got ? '<button class="btn block" id="vPart">Use the text so far</button>' : ''}
        <a class="btn block" id="vSave" download="On Field voice note.${(job.parts[0].type.split('/')[1] || 'webm').replace('mp4', 'm4a')}">Save the recording file</a>
        <button class="btn ghost block" id="vLater">Later</button>
        <button class="tinylink" id="vDrop">Discard this recording</button></div>`);
    $('#sheet').dataset.lock = '1';
    const url = URL.createObjectURL(new Blob(job.parts, {type: job.parts[0].type})); $('#vSave', el).href = url;
    const rt = $('#vRetry', el); if (rt) rt.onclick = () => transcribeJob(job, c);
    const vp = $('#vPart', el); if (vp) vp.onclick = () => useJob(job, true);
    $('#vLater', el).onclick = () => { closeSheet(); toast('Saved. Open "Record a meeting" to try again.'); route(); };
    $('#vDrop', el).onclick = async () => { if (await confirmBox('Discard this recording?', 'The parts not yet turned into text are lost. You would need to speak them again.', 'Discard', true)) { await VoiceStore.del('pending'); toast('Discarded'); route(); } else transcribeJob(job, c); };
  }
  /* put the text in the note; a partly converted recording stays saved so the rest can be tried later */
  async function useJob(job, partial) {
    const text = jobText(job);
    closeSheet();
    if (!partial) await VoiceStore.del('pending');
    if (!text.replace(/\[part .*?\]/g, '').trim()) { if (!partial) toast('Nothing was heard. Try again closer to the phone.'); return route(); }
    rec = rec || {step: 'speak'};
    rec.transcript = (rec.transcript ? rec.transcript + '\n' : '') + text; rec.step = 'transcript'; saveRec(); route();
    if (partial) { await VoiceStore.del('pending'); toast('Text so far added. Type or speak the missing part.'); }
  }
  /* on the record screen: a recording that was not converted yet */
  async function pendingVoiceBanner(c) {
    const job = await VoiceStore.get('pending'); const host = $('#vPend');
    if (!job || !host) return;
    const left = job.texts.filter(x => x == null).length, mins = Math.round((job.secs || 0) / 60);
    host.innerHTML = `<div class="checks"><b>🎙 A recording${mins ? ` (about ${mins} min)` : ''} is saved but ${left === job.parts.length ? 'not turned into text yet' : `${left} part${left > 1 ? 's are' : ' is'} not text yet`}.</b> <button type="button" class="btn sm" id="vGo">Try again</button></div>`;
    $('#vGo', host).onclick = () => transcribeJob(job, c || (job.caseId && getCase(job.caseId)) || null);
  }

  /* ---------- AI draft ---------- */
  async function draftWithAI(c) {
    if (!rec.transcript.trim()) return toast('Record or type what happened first.');
    if (!session() && !(await signIn())) return;
    sheet('<h3>Writing the follow-up…</h3><div class="spin"></div><p style="text-align:center">About 20–40 seconds.</p>');
    $('#sheet').dataset.lock = '1';
    try {
      const known = c || (rec.nameHint ? {client: {name: rec.nameHint}} : null);   // a name sent over from 定联
      const r = await post({op: 'ai', prompt: FU.buildPrompt({transcript: rec.transcript, lang: rec.lang, agentName: settings.name, client: known, concepts: KC.CONCEPTS, date: todayISO()})});
      if (r.truncated) throw {code: 'invalid_json'};
      rec.draft = FU.normalizeDraft(parseJSON(r.text), KC.CONCEPTS.map(k => k.id));
      if (!c && rec.nameHint && !rec.draft.client.name) rec.draft.client.name = rec.nameHint;
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
          ${rec.matchId ? '<p class="muted" style="color:var(--warn);margin:-4px 0 8px">Looks like a client you already have. Check before saving.</p>' : ''}
          <div class="seg" id="nwKind" ${rec.matchId ? 'hidden' : ''}><button type="button" data-k="prospect" aria-pressed="${rec.newKind !== 'client'}">🌱 New prospect</button><button type="button" data-k="client" aria-pressed="${rec.newKind === 'client'}">⭐ New existing client</button></div>`}
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
        <label class="chk"><input type="checkbox" id="mVisit" ${d.visit !== false ? 'checked' : ''}> Face-to-face visit (counts for 三访)</label>
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
    const who = $('#cWho'); if (who) who.onchange = () => { rec.matchId = who.value; saveRec(); const k = $('#nwKind'); if (k) k.hidden = !!who.value; };
    $$('#nwKind button').forEach(b => b.onclick = () => { rec.newKind = b.dataset.k; saveRec(); $$('#nwKind button').forEach(x => x.setAttribute('aria-pressed', x === b)); });
    const vz = $('#mVisit'); if (vz) vz.onchange = () => { d.visit = vz.checked; saveRec(); };
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
      target = {id: PS.uid(), created: now, updated: now, kind: rec.newKind === 'client' ? 'client' : 'prospect', client: {name: d.client.name || name, nickname: '', age: null, income: null}, guide: Object.assign({}, settings.guide), policies: [], meetings: []};
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
    const savedM = FU.applyToFarm(target, d, {date: todayISO(), sentPdf: false});   // marked sent once the phone confirms the share
    const next = {caseId: target.id, meetingId: savedM.id};
    saveCases();
    const wa = d.whatsapp, caseId = target.id;
    rec = null; recPhotos = []; saveRec();
    if (!withPdf) { pendingNext = next; if (location.hash === '#/case/' + caseId) route(); else location.hash = '#/case/' + caseId; return; }
    await startSend({kind: 'followup', blob, fileName: file.name, caseId, meetingId: savedM.id, name, wa, next});
  }

  /* ---------- after saving a meeting: update REDEFINE Calendar and 定联 too ---------- */
  let pendingNext = null;
  function nextSheet({caseId, meetingId}) {
    const c = getCase(caseId); if (!c) return;
    const m = (c.meetings || []).find(x => x.id === meetingId) || {};
    const when = [m.followUpDate, m.nextStep].filter(Boolean).join(' · ');
    sheet(`<div class="sheet-top"><h3>✅ Saved to ${esc(c.client.name)}'s farm</h3><button type="button" class="xbtn" data-close aria-label="Close">✕</button></div>
      ${FU.activityOf(m) === 'present' ? '<div class="checks">🔁 Added to <b>Follow-ups</b>: Day 1 to Day 5 follow-up plan starts tomorrow.</div>' : ''}
      ${FU.activityOf(m) === 'close' && FU.kindOf(c) === 'prospect' ? '<button class="btn primary block" id="nxClient" style="margin-bottom:10px">⭐ Move to Existing Clients</button>' : ''}
      ${FU.activityOf(m) === 'close' ? `<div class="checks">🎉 <b>Next for ${esc(c.client.name)}:</b> ${FU.AFTER_CLOSE.map(x => esc(x.label.toLowerCase())).join(', ')}. The checklist is on their page.</div>` : ''}
      <p>Also update:</p>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${(c.appts || []).some(a => a.fromId === m.id)
          ? (a => `<div class="checks ok-box">✅ In your REDEFINE Calendar: <b>${esc(a.title)}</b>, ${esc(a.date.slice(8, 10) + '/' + a.date.slice(5, 7))} ${esc(FU.timeLabel(a.time))}. Tap ✓ Done there after the meeting and it comes back here.</div>`)((c.appts || []).find(a => a.fromId === m.id))
          : m.nextStep || m.followUpDate
          ? `<a class="btn primary block nx" target="_blank" rel="noopener" href="${esc(FU.calendarLink(settings.calendarUrl, {name: c.client.name, nextStep: m.nextStep, followUpDate: m.followUpDate}))}">📅 Add follow-up to REDEFINE Calendar</a>
             <p class="muted" style="margin:-4px 0 4px">Opens a new event: Follow up ${esc(c.client.name)}${when ? ' · ' + esc(when) : ''}. Check the time, then tap Add.</p>`
          : '<p class="muted">No follow-up date or next step yet, so there is nothing for the Calendar.</p>'}
        <a class="btn block nx" target="_blank" rel="noopener" href="${esc(FU.dinglianLink(settings.crmUrl, c.client.name))}">🤝 Update 定联: Open / Present / Close or remark</a>
        <button class="btn ghost block" data-close>Done</button>
      </div>`);
    const mv = $('#nxClient'); if (mv) mv.onclick = () => { closeSheet(); setKind(c, 'client'); };
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
      saveSettings(); closeSheet(); toast('Profile saved'); route();
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
        return `<li data-mid="${esc(m.id)}"><span class="tl-d">${esc(m.date)}${m.time ? ' · ' + esc(FU.timeLabel(m.time)) : ''}${(m.tags || []).length ? ' · ' + esc(m.tags.join(',')) : ''}</span><b>${esc(FU.typeLabel(m.type))}${m.outcome === 'closed' ? ' 🎉' : ''}${m.sentPdf ? ' · PDF sent' : ''}</b><p>${esc(m.summary)}</p>${m.nextStep ? `<p class="tl-n">Next: ${esc(m.nextStep)}${m.followUpDate ? ' · ' + esc(m.followUpDate) : ''}</p>` : ''}
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
      FU.markRemoved(c, 'meetings', b.dataset.m); c.meetings = c.meetings.filter(m => m.id !== b.dataset.m); c.updated = new Date().toISOString(); saveCases(); route();
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
      targets: settings.targets, hideNames: r.hideNames, week: w, month: mo, headline: settings.reportHead, endLine: settings.reportEnd,
      items: items.map(({c, m}) => ({name: c.client.name, time: m.time, tags: m.tags && m.tags.length ? m.tags : FU.tagsFor(m.type), note: FU.noteFor(m)}))});
    /* the report box shows the agent's own edits if any, otherwise the report built from today's visits */
    const shown = () => (typeof r.edited === 'string' ? r.edited : text());
    const touch = () => { r.updated = new Date().toISOString(); reports[date] = r; saveReports(); const b = $('#rTxt'); if (b && typeof r.edited !== 'string') b.value = text(); };
    const st = FU.streak(days, date), T = settings.targets || FU.TARGETS;
    const past = Array.from({length: 14}, (_, i) => FU.addDays(date === todayISO() ? date : todayISO(), -i)).filter(d => (days[d] && days[d].met) || (reports[d] && reports[d].done));
    app.innerHTML = bar('三访', '#/', `<input type="date" id="dPick" class="datepick" value="${date}" max="${todayISO()}" aria-label="Pick a day">`) + `<div class="wrap">
      <div class="card sanfang"><div class="sf-top"><div><h2>${date === todayISO() ? '三访 today' : '三访 ' + esc(date)}</h2><b class="sf-n">${metN}<small>/3</small></b></div>
        <div class="sf-dots">${[0, 1, 2].map(i => `<i class="${metN > i ? 'on' : ''}"></i>`).join('')}</div></div>
        <p class="muted">This week V ${w.met}/${T.week} · R ${w.rec}/${T.recruit} · month ${mo.met}/${T.month}${st ? ` · 🔥 ${st} day${st > 1 ? 's' : ''} in a row` : ''}</p>
        ${(session() || {}).owner ? '<a class="btn block" href="#/team" style="margin-top:8px">👥 Team 三访 (leader view)</a>' : ''}</div>
      <p class="muted" style="margin:0 2px 10px">Only face-to-face visits count here. WhatsApp or call follow-ups are in Activities.</p>
      <div class="card"><h2>Visits on ${esc(date)} (${metN}/3)</h2>
        ${items.length ? items.map(({c, m}, i) => `<button type="button" class="item" data-visit="${i}"><div class="t"><b>${esc(c.client.name)}</b><span>${esc(FU.timeLabel(m.time) || 'time?')} · ${esc((m.tags && m.tags.length ? m.tags : FU.tagsFor(m.type)).join(','))} · ${esc(FU.typeLabel(m.type))}</span><span>${esc(FU.noteFor(m) || 'Tap to add a report note')}</span></div><div class="amt">${m.outcome === 'closed' || m.type === 'closing' ? '🎉' : '✎'}</div></button>`).join('') : '<p class="muted">No meetings recorded for this day yet.</p>'}
        <button class="btn block" id="quickAdd">+ Add someone I met (quick log)</button></div>
      <div class="card"><div class="farm-h"><h2>Report for the WhatsApp group</h2><button class="btn sm" id="rFmt">✏️ Headline &amp; end line</button></div>
        ${settings.reportName || settings.base ? '' : '<p class="muted" style="margin-bottom:6px">Set your report name and base (e.g. Rex👑, SG Farlim) in Settings → 👤 My profile.</p>'}
        <label class="chk"><input type="checkbox" id="rHide" ${r.hideNames ? 'checked' : ''}> Hide client names (Client A, B, C)</label>
        <p class="muted" style="margin:8px 0 4px">Edit anything below before copying.</p>
        <textarea class="rpt" id="rTxt" rows="16"></textarea>
        <div id="rEdited" ${typeof r.edited === 'string' ? '' : 'hidden'} class="flagnote"><span>You edited the report, so new visits won't be added to it automatically.</span><button type="button" id="rReset">Undo my edits</button></div>
        <p class="muted">Use 称呼 only. Client details stay in your farm, not in the group.</p>
        <button class="btn primary block" id="rCopy">Copy report for WhatsApp</button>
        <label class="chk"><input type="checkbox" id="rShare" ${settings.shareTally !== false ? 'checked' : ''}> Share my numbers with my leader (counts only, no client names)</label></div>
      ${past.length ? `<div class="card"><h2>Past 三访 (14 days)</h2>${past.map(d => `<a class="item" href="#/day/${d}"><div class="t"><b>${esc(d.slice(8, 10) + '/' + d.slice(5, 7))} ${esc(new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', {weekday: 'short', timeZone: 'UTC'}))}</b><span>${reports[d] && reports[d].done ? 'Report copied ✓' : 'No report copied'}</span></div><div class="amt">${(days[d] || {met: 0}).met}/3</div></a>`).join('')}</div>` : ''}
    </div>${tabbar('day')}`;
    $('#rTxt').value = shown();
    $('#rTxt').addEventListener('input', e => { r.edited = e.target.value; $('#rEdited').hidden = false; r.updated = new Date().toISOString(); reports[date] = r; saveReports(); });
    $('#rReset').onclick = async () => {
      if (!(await confirmBox('Undo your edits?', 'The report is rebuilt from today\'s visits, your headline and end line. Your changes to the text are removed.', 'Undo edits'))) return;
      delete r.edited; touch(); route();
    };
    $('#rFmt').onclick = () => editReportFormat();
    $('#rHide').onchange = e => { r.hideNames = e.target.checked; touch(); };
    $('#rShare').onchange = e => { settings.shareTally = e.target.checked; saveSettings(); };
    $$('[data-visit]').forEach(b => b.onclick = () => editVisit(items[+b.dataset.visit]));
    $('#dPick').onchange = e => { if (e.target.value) location.hash = '#/day/' + e.target.value; };
    $('#quickAdd').onclick = () => quickAdd(date);
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

  /* the agent's own headline (lines above the date) and end line for the 三访 report */
  function editReportFormat() {
    const defHead = (settings.reportName ? '{name}' : (settings.name || '{name}')) + (settings.base ? ' ({base})' : '') + '\n' + (settings.reportOpening == null ? '以愉快的心情与大家一起修练三访。' : settings.reportOpening);
    const cur = typeof settings.reportHead === 'string' && settings.reportHead.trim() ? settings.reportHead : defHead;
    const el = sheet(`<div class="sheet-top"><h3>Headline &amp; end line</h3><button type="button" class="xbtn" data-close aria-label="Close">✕</button></div>
      <p class="muted">Shortcuts: <b>{name}</b> your report name, <b>{base}</b> your base, <b>{date}</b> e.g. 13/11/2026, <b>{day}</b> e.g. Friday. The date line, V / R / Total and the visits stay in the middle.</p>
      <div class="f"><label>Headline (top lines)</label><textarea id="fHead" rows="3">${esc(cur)}</textarea></div>
      <div class="f"><label>End line (bottom, optional)</label><textarea id="fEnd" rows="2" placeholder="e.g. 加油！明天继续 💪">${esc(settings.reportEnd || '')}</textarea></div>
      <div class="row"><button class="btn" id="fReset">Use default</button><button class="btn primary" id="fOk">Save</button></div>`);
    $('#fOk', el).onclick = () => { settings.reportHead = $('#fHead', el).value.trim(); settings.reportEnd = $('#fEnd', el).value.trim(); saveSettings(); closeSheet(); toast('Report format saved'); route(); };
    $('#fReset', el).onclick = () => { delete settings.reportHead; delete settings.reportEnd; saveSettings(); closeSheet(); toast('Back to the default format'); route(); };
  }

  /* quick log for someone met without a voice note */
  function quickAdd(date, presetType, presetName) {
    const qTags = FU.tagsFor(presetType || 'fact_find');
    let qKind = 'prospect';
    const now = new Date(), nowT = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const el = sheet(`<div class="sheet-top"><h3>Quick log</h3><button type="button" class="xbtn" data-close aria-label="Close">✕</button></div>
      <p class="muted">For an activity you didn't record by voice. It is saved to their farm.</p>
      <div class="f"><label>Who</label><select id="qWho"><option value="">New person…</option>${cases.filter(x => !x.sample).sort((a, b) => a.client.name.localeCompare(b.client.name)).map(x => `<option value="${x.id}">${esc(x.client.name)}${x.client.nickname ? ' (' + esc(x.client.nickname) + ')' : ''}</option>`).join('')}</select></div>
      <div id="qNewF"><div class="f"><label>Name (称呼)</label><input id="qName" placeholder="e.g. Ah Seng" value="${esc(presetName || '')}"></div>
        <div class="seg" id="qKind"><button type="button" data-k="prospect" aria-pressed="true">🌱 Prospect</button><button type="button" data-k="client" aria-pressed="false">⭐ Existing client</button></div></div>
      <div class="grid2"><div class="f"><label>Type</label><select id="qType">${FU.MEETING_TYPES.map(t => `<option value="${t.id}" ${t.id === (presetType || 'fact_find') ? 'selected' : ''}>${t.zh} · ${t.en}</option>`).join('')}</select></div>
      <div class="f"><label>Result</label><select id="qOut"><option value="none">No decision yet</option><option value="considering">Considering</option><option value="closed">Closed 🎉</option><option value="not_interested">Not interested</option></select></div></div>
      <div class="grid2"><div class="f"><label>Time</label><input id="qTime" type="time" value="${date === todayISO() ? nowT : ''}"></div><div class="f"><label>P / O / R</label>${tagButtons(qTags)}</div></div>
      <label class="chk"><input type="checkbox" id="qVisit" checked> Face-to-face visit (counts for 三访)</label>
      <div class="f"><label>Notes / report note</label><textarea id="qNote" rows="3" placeholder="e.g. Direct approach, open for review and do CFF."></textarea></div>
      <div class="f"><label>Next step (optional)</label><input id="qNext" placeholder="e.g. Present medical card plan"></div>
      <div class="grid2"><div class="f"><label>Next appointment</label><input id="qDate" type="date"></div><div class="f"><label>Time</label><input id="qApptT" type="time" value="10:00"></div></div>
      <p class="muted" style="margin:-4px 0 8px">${calCfg ? '📅 Goes into your REDEFINE Calendar automatically. Tap ✓ Done there after the meeting and it comes back here.' : 'Connect REDEFINE Calendar in Settings and this appointment goes there automatically.'}</p>
      <div class="row"><button class="btn" data-close>Cancel</button><button class="btn primary" id="qSave">Save</button></div>`);
    wireTags(el, qTags);
    $('#qType', el).onchange = e => { qTags.splice(0, qTags.length, ...FU.tagsFor(e.target.value)); $$('[data-tg]', el).forEach(b => b.setAttribute('aria-pressed', qTags.includes(b.dataset.tg))); };
    $('#qWho', el).onchange = e => { $('#qNewF', el).hidden = !!e.target.value; };
    $$('#qKind button', el).forEach(b => b.onclick = () => { qKind = b.dataset.k; $$('#qKind button', el).forEach(x => x.setAttribute('aria-pressed', x === b)); });
    $('#qSave', el).onclick = async () => {
      let c = getCase($('#qWho', el).value);
      if (!c) {
        const name = $('#qName', el).value.trim(); if (!name) return $('#qName', el).classList.add('flag');
        const now = new Date().toISOString();
        c = {id: PS.uid(), created: now, updated: now, kind: qKind, client: {name, nickname: '', age: null, income: null}, guide: Object.assign({}, settings.guide), policies: [], meetings: []};
        cases.push(c);
      }
      const d = FU.normalizeDraft({meeting: {type: $('#qType', el).value, outcome: $('#qOut', el).value, nextStep: $('#qNext', el).value, followUpDate: $('#qDate', el).value, summary: 'Quick log'},
        tags: qTags, time: $('#qTime', el).value, reportNote: $('#qNote', el).value, visit: $('#qVisit', el).checked}, []);
      const qm = FU.applyToFarm(c, d, {date});
      saveCases();
      const apD = $('#qDate', el).value;
      if (apD && calCfg) {
        $('#qSave', el).disabled = true; $('#qSave', el).textContent = 'Adding to Calendar…';
        try { await addAppointment(c, qm, apD, $('#qApptT', el).value || '10:00'); } catch (e) { toast('Saved here, but the Calendar did not take it (' + (CAL_ERR[e.code] || e.code) + '). Use the Calendar button instead.'); }
      }
      closeSheet(); pendingNext = {caseId: c.id, meetingId: qm.id}; route();
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
    const t0 = Date.now(), sr = segRecorder(stream, SEG_MS);
    miniRec = sr; btn.textContent = '■ Stop';
    const tick = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); label.textContent = `● ${s}s · tap again to stop`; if (s >= MAX_REC_S) sr.stop(); }, 500);
    const parts = await sr.finished;
    clearInterval(tick); miniRec = null; btn.textContent = '🎙 Speak into the box';
    if (!parts.length) { label.textContent = 'Too short.'; return; }
    const job = {parts, texts: parts.map(() => null)};
    const go = async () => {
      const r = await convertJob(job, FU.HINT, (k, n, all) => { label.textContent = all > 1 ? `Turning voice into text… part ${k} of ${n}` : 'Turning voice into text…'; });
      if (!r.err) { label.textContent = ''; const t = jobText(job); if (t) onText(t); return; }
      label.innerHTML = `${esc(voiceMsg(r.err))} Your recording is kept. ${NO_RETRY.includes(r.err.code) ? '' : '<button type="button" class="tinylink" data-vr>Try again</button>'}`;
      const b = label.querySelector('[data-vr]'); if (b) b.onclick = go;
    };
    go();
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

  /* ======================= sections: bottom bar, Activities, Follow-ups ======================= */
  function tabbar(active) {
    const t = todayISO(), att = FU.followList(cases, t).filter(x => x.t.attention).length;
    const vis = (FU.dayStats(cases)[t] || {met: 0}).met;
    const items = [['home', '#/', '🏠', 'Home', ''], ['summaries', '#/summaries', '📄', 'Summary', ''], ['activity', '#/activity', '📋', 'Activities', ''],
      ['followups', '#/followups', '🔁', 'Follow-ups', att ? `<i class="badge">${att}</i>` : ''], ['day', '#/day', '3️⃣', '三访', `<i class="badge soft">${vis}/3</i>`]];
    return `<nav class="tabbar">${items.map(([k, href, ic, label, badge]) => `<a href="${href}" class="${k === active ? 'on' : ''}"><span>${ic}${badge}</span>${label}</a>`).join('')}</nav>`;
  }
  /* ---------- 📄 Summary tab: every policy summary in one place ---------- */
  let openTrayFor = null, openTrayRole = null;   // open the "Add policy pages" tray when this client's page shows
  function psStart() {
    const people = cases.filter(x => !x.sample).sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
    let k = 'client';
    const el = sheet(`<div class="sheet-top"><h3>📄 Policy summary for…</h3><button type="button" class="xbtn" data-close aria-label="Close">✕</button></div>
      ${people.length ? `<div class="f"><label for="psWho">Someone in your farm</label><select id="psWho"><option value="">New person…</option>${people.map(x => `<option value="${x.id}">${esc(x.client.name)}${x.client.nickname ? ' (' + esc(x.client.nickname) + ')' : ''}${x.policies.length ? ' · ' + x.policies.length + ' polic' + (x.policies.length === 1 ? 'y' : 'ies') : ''}</option>`).join('')}</select></div>` : ''}
      <div id="psNewBox"><div class="f"><label for="psName">Client name (as it should appear on the PDF)</label><input id="psName" autocomplete="off"></div>
        <div class="seg" id="psKind"><button type="button" data-k="client" aria-pressed="true">⭐ Existing client</button><button type="button" data-k="prospect" aria-pressed="false">🌱 Prospect</button></div></div>
      <p class="muted">Next: snap or upload their policy pages (any insurer, many at once).</p>
      <div class="row"><button class="btn" data-close>Cancel</button><button class="btn primary" id="psOk">Next: add policies</button></div>`);
    const who = $('#psWho', el), box = $('#psNewBox', el);
    if (who) who.onchange = () => { box.hidden = !!who.value; };
    $$('#psKind button', el).forEach(b => b.onclick = () => { k = b.dataset.k; $$('#psKind button', el).forEach(x => x.setAttribute('aria-pressed', x === b)); });
    $('#psOk', el).onclick = () => {
      let c = who && who.value ? getCase(who.value) : null;
      if (!c) {
        const name = $('#psName', el).value.trim();
        if (!name) { $('#psName', el).classList.add('flag'); return $('#psName', el).focus(); }
        const now = new Date().toISOString();
        c = {id: PS.uid(), created: now, updated: now, kind: k, client: {name, age: null, income: null}, guide: Object.assign({}, settings.guide), policies: []};
        cases.push(c); saveCases();
      }
      closeSheet(); openTrayFor = c.id;
      if (location.hash === '#/case/' + c.id) route(); else location.hash = '#/case/' + c.id;
    };
  }
  function summariesScreen() {
    const withP = cases.filter(c => c.policies.length).sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
    app.innerHTML = bar('Policy summaries', '#/') + `<div class="wrap">
      <button type="button" class="btn primary block addbig" id="psNew">${ICONS.cam}<span><b>New policy summary</b><small>Snap / upload policies · any insurer · one-page PDF</small></span></button>
      <p class="muted" style="margin:4px 2px 12px">How it works: <b>1</b> add policy pages (photos, screenshots, PDFs) → <b>2</b> On Field reads insurer, plan and benefits → <b>3</b> check anything marked <span class="pill warn">check</span> → <b>4</b> create the PDF and send it.</p>
      <h2 class="muted" style="margin:6px 2px 8px;font-weight:600">SUMMARIES (${withP.length})</h2>
      ${withP.length ? withP.map(c => {
        const s = PS.summarise(c), n = PS.pendingChecks(c).length;
        return `<a class="item" href="#/case/${c.id}/summary"><div class="t"><b>${esc(c.client.name || 'Unnamed')}${c.sample ? ' <span class="pill grey">Sample</span>' : ''}</b><span>${c.policies.length} polic${c.policies.length === 1 ? 'y' : 'ies'} · ${FU.kindOf(c) === 'client' ? '⭐ client' : '🌱 prospect'}</span></div>
          <div class="amt">${PS.rm(s.cats.death.total, {short: true})}<small>${n ? `<span class="pill warn">${n} to check</span>` : 'death cover'}</small></div></a>`;
      }).join('') : `<div class="empty">No policy summaries yet.<br>Tap <b>New policy summary</b> to start${cases.some(c => c.sample) ? '' : ', or <a href="#" id="psDemo">open the sample</a> to see one'}.</div>`}
    </div>${tabbar('summaries')}`;
    $('#psNew').onclick = psStart;
    const d = $('#psDemo'); if (d) d.onclick = e => { e.preventDefault(); const c = window.sampleCase(PS); cases.push(c); saveCases(); location.hash = '#/case/' + c.id + '/summary'; };
  }
  function followCard() {
    const list = FU.followList(cases, todayISO()), att = list.filter(x => x.t.attention);
    if (!list.length) return '';
    return `<a class="card fcard" href="#/followups"><div><b>🔁 ${list.length} in follow-up after presenting</b><span>${att.length ? `<em>${att.length} need${att.length === 1 ? 's' : ''} attention</em>: ${esc(att.slice(0, 3).map(x => x.c.client.name).join(', '))}${att.length > 3 ? '…' : ''}` : 'All on schedule'}</span></div><span class="go">›</span></a>`;
  }
  function setKind(c, kind) {
    c.kind = kind; c.updated = new Date().toISOString(); saveCases(); save('pspt.homeTab', kind);
    toast(kind === 'client' ? `${c.client.name} is now an Existing Client ⭐` : `${c.client.name} moved to Prospects`);
    route();
  }

  /* ---------- Activities: who was approached / opened / presented / followed up / closed on a day ---------- */
  function activityScreen(date, cat) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) date = todayISO();
    const g = FU.activitiesOn(cases, date);
    cat = FU.ACTIVITIES.some(a => a.id === cat) ? cat : FU.ACTIVITIES.some(a => a.id === load('pspt.actTab', '')) ? load('pspt.actTab', '') : 'approach';
    const rows = g[cat] || [];
    const typeFor = {approach: 'approach', open: 'fact_find', present: 'presentation', follow_up: 'follow_up', close: 'closing'};
    app.innerHTML = bar('Activities', '#/', `<input type="date" id="aPick" class="datepick" value="${date}" max="${todayISO()}" aria-label="Pick a day">`) + `<div class="wrap">
      <div class="acttabs">${FU.ACTIVITIES.map(a => [a.id, a.en, g[a.id].length]).map(([k, l, n]) => `<button type="button" data-cat="${k}" aria-pressed="${cat === k}"><b>${n}</b>${l}</button>`).join('')}</div>
      <div class="card"><h2>${esc(FU.ACTIVITIES.find(a => a.id === cat).en)} on ${esc(date)}</h2>
        ${rows.length ? rows.map(({c, m}) => {
          const lab = FU.stagesOf(m).map(s => (FU.ACTIVITIES.find(x => x.id === s) || {en: FU.typeLabel(m.type)}).en).join(' + ');
          return `<a class="item" href="#/case/${c.id}"><div class="t"><b>${esc(c.client.name)} <span class="pill ${FU.kindOf(c) === 'client' ? 'ok' : 'grey'}">${FU.kindOf(c) === 'client' ? 'Client' : 'Prospect'}</span></b><span>${esc(FU.timeLabel(m.time) || '')}${m.time ? ' · ' : ''}${esc(lab)}${m.visit === false ? ' · not a visit' : ''}</span><span>${esc(FU.noteFor(m) || m.summary || '')}</span></div></a>`;
        }).join('') : '<p class="muted">Nothing recorded.</p>'}
        <button class="btn block" id="aAdd">+ Add ${esc(FU.ACTIVITIES.find(a => a.id === cat).en.toLowerCase())}</button></div>
    </div>${tabbar('activity')}`;
    $('#aPick').onchange = e => { if (e.target.value) location.hash = '#/activity/' + e.target.value + '/' + cat; };
    $$('[data-cat]').forEach(b => b.onclick = () => { save('pspt.actTab', b.dataset.cat); location.hash = '#/activity/' + date + '/' + b.dataset.cat; });
    $('#aAdd').onclick = () => quickAdd(date, typeFor[cat] || '');
  }

  /* ---------- Follow-ups: everyone presented in the last round, Day 1–5 ---------- */
  function followScreen() {
    const t = todayISO(), list = FU.followList(cases, t);
    app.innerHTML = bar('Follow-ups', '#/') + `<div class="wrap">
      <p class="muted" style="margin:0 2px 10px">Anyone you present to is listed here automatically. Aim for one follow-up a day for 5 days. They leave the list when they close or you stop tracking.</p>
      ${list.length ? list.map(({c, t: tr}) => `<div class="card ftrack ${tr.attention ? 'att' : ''}" data-cid="${c.id}">
        <div class="ft-h"><a href="#/case/${c.id}"><b>${esc(c.client.name)}</b></a><span class="pill ${FU.kindOf(c) === 'client' ? 'ok' : 'grey'}">${FU.kindOf(c) === 'client' ? 'Client' : 'Prospect'}</span></div>
        <p class="ft-sum">Presented ${esc(tr.presDate)} · <b>Day ${tr.days}</b> · <b>${tr.done}/5</b> follow-ups done</p>
        ${tr.attention ? `<p class="ft-att">⚠️ ${esc(tr.reasons.join(' · '))}</p>` : ''}
        <table class="ftable"><thead><tr><th>Stage</th><th>Due</th><th>Follow-up</th></tr></thead><tbody>
          ${tr.slots.map(s => `<tr class="${s.done ? 'done' : s.late ? 'late' : s.today ? 'due' : ''}"><td>Day ${s.n}</td><td>${esc(s.due.slice(8, 10) + '/' + s.due.slice(5, 7))}</td><td>${s.done ? `✅ ${esc(['First', 'Second', 'Third', 'Fourth', 'Fifth'][s.n - 1])} · ${esc(s.done.date.slice(8, 10) + '/' + s.done.date.slice(5, 7))}${s.done.visit === false ? ' (chat/call)' : ' (met)'}` : s.late ? '⏰ Missed' : s.today ? '👉 Due today' : '—'}</td></tr>`).join('')}
        </tbody></table>
        <div class="row" style="margin-top:8px"><button class="btn primary sm" data-flog="${c.id}">✓ Log follow-up</button><button class="btn sm" data-fclose="${c.id}">🎉 Closed</button><button class="btn sm" data-fstop="${c.id}">Stop</button></div>
      </div>`).join('') : '<div class="empty">Nobody to follow up yet.<br>When you record a <b>Present</b> meeting, the person appears here with a 5-day follow-up plan.</div>'}
    </div>${tabbar('followups')}`;
    $$('[data-flog]').forEach(b => b.onclick = () => logFollowUp(getCase(b.dataset.flog)));
    $$('[data-fclose]').forEach(b => b.onclick = () => markClosed(getCase(b.dataset.fclose)));
    $$('[data-fstop]').forEach(b => b.onclick = async () => {
      const c = getCase(b.dataset.fstop);
      if (!(await confirmBox('Stop tracking ' + esc(c.client.name) + '?', 'They leave the follow-up list. A new presentation puts them back.', 'Stop tracking'))) return;
      c.fuStop = todayISO(); c.updated = new Date().toISOString(); saveCases(); route();
    });
  }
  function logFollowUp(c) {
    const now = new Date(), nowT = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    let how = 'whatsapp';
    const el = sheet(`<div class="sheet-top"><h3>Follow-up: ${esc(c.client.name)}</h3><button type="button" class="xbtn" data-close aria-label="Close">✕</button></div>
      <div class="seg" id="fHow">${[['whatsapp', 'WhatsApp'], ['call', 'Call'], ['meet', 'Met']].map(([k, l]) => `<button type="button" data-h="${k}" aria-pressed="${k === how}">${l}</button>`).join('')}</div>
      <div class="grid2"><div class="f"><label>Date</label><input id="fDate" type="date" value="${todayISO()}" max="${todayISO()}"></div><div class="f"><label>Time</label><input id="fTime" type="time" value="${nowT}"></div></div>
      <div class="f"><label>What happened</label><textarea id="fNote" rows="3" placeholder="e.g. Sent the summary again, he will reply after talking to his wife"></textarea></div>
      <div class="f"><label>Next step (optional)</label><input id="fNext"></div>
      <p class="muted">A WhatsApp or call follow-up counts as a follow-up activity, not a 三访 visit. "Met" counts as a visit too.</p>
      <div class="row"><button class="btn" data-close>Cancel</button><button class="btn primary" id="fSave">Save</button></div>`);
    $$('#fHow button', el).forEach(b => b.onclick = () => { how = b.dataset.h; $$('#fHow button', el).forEach(x => x.setAttribute('aria-pressed', x === b)); });
    $('#fSave', el).onclick = () => {
      const note = $('#fNote', el).value.trim(), label = {whatsapp: 'WhatsApp follow-up', call: 'Call follow-up', meet: 'Met to follow up'}[how];
      const d = FU.normalizeDraft({meeting: {type: 'follow_up', summary: label + (note ? ': ' + note : ''), nextStep: $('#fNext', el).value, outcome: 'considering'},
        tags: ['F'], time: $('#fTime', el).value, reportNote: note ? label + '. ' + note : label + '.', visit: how === 'meet'}, []);
      FU.applyToFarm(c, d, {date: $('#fDate', el).value || todayISO()});
      saveCases(); closeSheet(); toast('Follow-up logged'); route();
    };
  }
  async function markClosed(c) {
    if (!(await confirmBox(esc(c.client.name) + ' closed? 🎉', 'A Close activity is logged for today and they leave the follow-up list.' + (FU.kindOf(c) === 'prospect' ? ' They also move to Existing Clients.' : ''), 'Yes, closed'))) return;
    const now = new Date(), nowT = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    FU.applyToFarm(c, FU.normalizeDraft({meeting: {type: 'closing', summary: 'Closed', outcome: 'closed'}, tags: ['P'], time: nowT, visit: false}, []), {date: todayISO()});
    if (FU.kindOf(c) === 'prospect') c.kind = 'client';
    saveCases(); route(); afterCloseSheet(c);
  }

  /* ======================= REDEFINE Calendar link =======================
     A quick log with an appointment date + time creates a private event in the agent's REDEFINE Calendar.
     When the agent taps ✓ Done or 💰 Closed on it in the Calendar, On Field logs the visit (for the 三访 report).
     Uses the agent's own Calendar sign-in on this device; nothing about the client goes anywhere else. */
  let calCfg = load('pspt.cal', null), calBusy = null;
  const CAL_ERR = {wrong_code: 'That Calendar team code is not right.', wrong_pin: 'That PIN is not right for this name.', too_many_tries: 'Too many tries. Wait a few minutes.',
    name_needed: 'Type your name as it is in the Calendar.', pin_4_digits: 'The PIN is 4 to 6 digits.', removed: 'This name was removed from the Calendar team.', offline: 'No connection.'};
  async function calPost(body) {
    let r; try { r = await fetch(FU.CAL_API, {method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: JSON.stringify(body)}); } catch (e) { throw {code: 'offline'}; }
    let j; try { j = await r.json(); } catch (e) { throw {code: 'upstream_error'}; }
    if (j.error) throw {code: j.error};
    return j;
  }
  const calApi = (op, body) => calPost(Object.assign({op, token: calCfg.token}, body || {}));
  function connectCalendar() {
    const el = sheet(`<div class="sheet-top"><h3>📅 Connect REDEFINE Calendar</h3><button type="button" class="xbtn" data-close aria-label="Close">✕</button></div>
      <p>Use the <b>same team code, name and PIN</b> as your REDEFINE Calendar. Then appointments you set in a quick log go into your Calendar by themselves, and when you tap ✓ Done there, the visit comes back here for your 三访 report.</p>
      <div class="f"><label>Calendar team code</label><input id="kCode" type="password" autocomplete="off"></div>
      <div class="f"><label>Your name in the Calendar</label><input id="kName" value="${esc(settings.name || '')}"></div>
      <div class="f"><label>Calendar PIN</label><input id="kPin" type="password" inputmode="numeric" maxlength="6"></div>
      <p class="muted" id="kMsg" role="alert" style="color:var(--err);min-height:18px"></p>
      <div class="row"><button class="btn" data-close>Cancel</button><button class="btn primary" id="kGo">Connect</button></div>`);
    $('#kGo', el).onclick = async () => {
      const b = $('#kGo', el); b.disabled = true; b.textContent = 'Connecting…';
      try {
        const r = await calPost({op: 'signin', code: $('#kCode', el).value.trim(), name: $('#kName', el).value.trim(), pin: $('#kPin', el).value.trim(), device: 'REDEFINE On Field'});
        calCfg = {token: r.token, name: r.me && r.me.name, memberId: r.me && r.me.id}; save('pspt.cal', calCfg);
        closeSheet();
        toast(r.created ? '⚠️ Connected, but this made a NEW Calendar account. If you already use the Calendar, disconnect and check the name.' : '✅ Connected to REDEFINE Calendar as ' + calCfg.name);
        route();
      } catch (e) { $('#kMsg', el).textContent = CAL_ERR[e.code] || 'Could not connect (' + (e.code || 'error') + ').'; b.disabled = false; b.textContent = 'Connect'; }
    };
  }
  /* put the appointment into the Calendar; returns the appointment kept on the person */
  async function addAppointment(c, m, date, time) {
    if (!calCfg || !date) return null;
    const ev = FU.calEventFor({date, time, name: c.client.name, fromType: m.type, nextStep: m.nextStep});
    const r = await calApi('save', {event: ev});
    const appt = {calId: r.event.id, date, time: time || '10:00', calType: ev.type, fromId: m.id, status: 'set', title: ev.title};
    c.appts = (c.appts || []).concat(appt); c.updated = new Date().toISOString(); saveCases();
    return appt;
  }
  /* collect ✓ Done / 💰 Closed from the Calendar for appointments made here */
  async function calPull() {
    if (!calCfg || calBusy || !navigator.onLine) return;
    const waiting = cases.filter(c => (c.appts || []).some(a => a.status === 'set'));
    if (!waiting.length) return;
    calBusy = (async () => {
      try {
        const data = await calApi('sync', {force: true}), byId = {};
        (data.events || []).forEach(e => { byId[e.id] = e; });
        let logged = 0, changed = false;
        for (const c of waiting) {
          for (const a of c.appts) {
            if (a.status !== 'set') continue;
            const e = byId[a.calId];
            if (!e) { if (a.date < FU.addDays(todayISO(), -35)) { a.status = 'gone'; changed = true; } continue; }
            if (e.out === 'done' || e.out === 'closed') {
              const m = FU.eventToMeeting(e, a);
              if (!(c.meetings || []).some(x => x.id === m.id)) { c.meetings = (c.meetings || []).concat(m).sort((x, y) => ((x.date || '') + (x.time || '')).localeCompare((y.date || '') + (y.time || ''))); logged++; }
              a.status = e.out; changed = true;
              if (e.out === 'closed') { c.afterClose = c.afterClose || {}; }
            } else if (e.out === 'cancel') { a.status = 'cancelled'; changed = true; }   // ✕ Didn't happen in the Calendar
            else if (e.start) { const d = new Date(e.start), p = n => String(n).padStart(2, '0'), nd = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()), nt = p(d.getHours()) + ':' + p(d.getMinutes()); if (nd !== a.date || nt !== a.time) { a.date = nd; a.time = nt; changed = true; } }   // moved in the Calendar
          }
          if (changed) c.updated = new Date().toISOString();
        }
        if (changed) { saveCases(); const h = location.hash.replace(/^#\/?/, '').split('/')[0]; if (['', 'day', 'activity', 'followups', 'case'].includes(h)) route(); }
        if (logged) toast(`📅 ${logged} visit${logged > 1 ? 's' : ''} from REDEFINE Calendar added to your 三访`);
      } catch (e) {
        if (e.code === 'signed_out' || e.code === 'removed') { toast('REDEFINE Calendar link expired. Connect it again in Settings.'); calCfg = null; save('pspt.cal', null); }
      } finally { calBusy = null; }
    })();
    return calBusy;
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') calPull(); });
  setInterval(() => { if (document.visibilityState === 'visible') calPull(); }, 60000);
  setTimeout(calPull, 3000);

  /* ======================= after a close: the REDEFINE service checklist ======================= */
  const hasClosed = c => (c.meetings || []).some(m => m.type === 'closing' || m.outcome === 'closed');
  function afterCloseLeft(c) { const d = c.afterClose || {}; return FU.AFTER_CLOSE.filter(x => !d[x.k]); }
  function afterCloseCard(c) {
    if (!hasClosed(c) || !afterCloseLeft(c).length) return '';
    const d = c.afterClose || {};
    return `<div class="card afterclose"><h2>🎉 After closing: ${FU.AFTER_CLOSE.length - afterCloseLeft(c).length}/${FU.AFTER_CLOSE.length} done</h2>
      ${FU.AFTER_CLOSE.map(x => `<div class="ac-row"><label class="chk"><input type="checkbox" data-ac="${x.k}" ${d[x.k] ? 'checked' : ''}> <span><b>${esc(x.label)}</b><small>${esc(x.hint)}</small></span></label>
        ${x.k === 'summary' ? '<button type="button" class="btn sm" data-acgo="summary">Open</button>' : x.url ? `<a class="btn sm" target="_blank" rel="noopener" href="${esc(x.url)}">Open</a>` : ''}</div>`).join('')}
    </div>`;
  }
  function wireAfterClose(c) {
    $$('[data-ac]').forEach(b => b.onchange = () => { c.afterClose = Object.assign({}, c.afterClose, {[b.dataset.ac]: b.checked}); c.updated = new Date().toISOString(); saveCases(); if (!afterCloseLeft(c).length) toast('✅ All done for ' + c.client.name + '. Great service!'); route(); });
    const s = $('[data-acgo="summary"]'); if (s) s.onclick = () => { const w = $('.polwrap'); if (w) w.open = true; const a = $('#addP'); if (a) a.scrollIntoView({behavior: 'smooth', block: 'center'}); };
  }
  function afterCloseSheet(c) {
    sheet(`<div class="sheet-top"><h3>🎉 ${esc(c.client.name)} closed!</h3><button type="button" class="xbtn" data-close aria-label="Close">✕</button></div>
      <p>Before you move on, finish the REDEFINE service steps:</p>
      <ol class="ac-list">${FU.AFTER_CLOSE.map(x => `<li><b>${esc(x.label)}</b><span>${esc(x.hint)}</span></li>`).join('')}</ol>
      <p class="muted">The checklist stays on ${esc(c.client.name)}'s page until each one is ticked.</p>
      <div class="row"><button class="btn" data-close>Later</button><a class="btn primary" href="#/case/${c.id}">Open ${esc(c.client.name)}</a></div>`);
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
      <button class="btn block" id="openProf" style="margin-bottom:8px">👤 My profile (photo, intro, why insurance)</button>
      <button class="btn block" id="calLink" style="margin-bottom:12px">${calCfg ? '📅 REDEFINE Calendar: connected as ' + esc(calCfg.name || '') + ' · Disconnect' : '📅 Connect REDEFINE Calendar'}</button>
      <div class="checks" style="margin-bottom:12px"><b>📒 REDEFINE Prospecting</b><br>${settings.prCode ? '✅ Connected. 📞 Called, 📅 appointments and ☕ appointments done come in as quick logs by themselves' + (settings.prLast ? ' (last update ' + esc(new Date(settings.prLast).toLocaleString()) + ')' : '') + '.<div class="row" style="margin-top:6px"><button class="btn" id="prNow">Update now</button><button class="btn ghost" id="prOff">Disconnect</button></div>' : 'In Prospecting → Me → Connected apps → Connect REDEFINE On Field. Or paste the code here:<div class="row" style="margin-top:6px"><input id="prIn" placeholder="Paste the code" style="flex:1;font-family:monospace"><button class="btn primary" id="prGo">Connect</button></div>'}</div>
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
      saveSettings(); closeSheet(); toast('Saved'); route();
    };
    $('#openProf', el).onclick = openProfile;
    $('#calLink', el).onclick = async () => { if (!calCfg) return connectCalendar(); if (await confirmBox('Disconnect REDEFINE Calendar?', 'New appointments stop going to the Calendar, and Done there stops coming back. Events already in the Calendar stay.', 'Disconnect')) { calCfg = null; save('pspt.cal', null); toast('Disconnected'); } };
    const prGo = $('#prGo', el); if (prGo) prGo.onclick = () => { const v = $('#prIn', el).value.replace(/[^a-z0-9]/gi, ''); if (!v) return toast('Paste the code from Prospecting first'); closeSheet(); connectProspecting(v); };
    const prNow = $('#prNow', el); if (prNow) prNow.onclick = () => { closeSheet(); prPull(true); };
    const prOff = $('#prOff', el); if (prOff) prOff.onclick = async () => { if (await confirmBox('Disconnect REDEFINE Prospecting?', 'New calls and appointments will stop coming in. Quick logs already here stay.', 'Disconnect', true)) { settings.prCode = ''; settings.prSince = ''; saveSettings(); closeSheet(); toast('Disconnected'); } };
    const o = $('#out', el); if (o) o.onclick = async () => {
      if (!(await confirmBox('Sign out of this device?', 'You will need the team code again to read photos and PDFs' + (syncCfg ? ', and sync will pause until you sign back in' : '') + '. Clients on this device stay. You normally never need to sign out.', 'Sign out', true))) return;
      localStorage.setItem('pspt.session', 'null'); toast('Signed out'); route();
    };
    const f = $('#forget', el); if (f) f.onclick = async () => { if (await confirmBox('Forget remembered names?', 'The app will go back to its built-in reading of benefit names.', 'Forget')) { learned = {}; saveLearned(); toast('Done'); } };
  }

  route();
  resumeSend();
  syncNow();
  prPull('quiet');
})();
