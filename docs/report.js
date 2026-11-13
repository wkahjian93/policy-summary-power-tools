/* Builds the client-facing A4 pages as HTML (794 x 1123 px). The same pages are shown on screen
   and turned into the PDF, so what the agent previews is exactly what the client receives. */
(function (root) {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

  const ICON = {
    death: '<path d="M12 21s-7-4.4-9.3-9A5.3 5.3 0 0 1 12 6.4 5.3 5.3 0 0 1 21.3 12C19 16.6 12 21 12 21z"/>',
    tpd: '<circle cx="12" cy="5" r="2"/><path d="M10 9h4l-1 6h3l2 5M11 15a4 4 0 1 0 4 5"/>',
    ci: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
    eci: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
    accident: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
    medical: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>',
    hospital: '<path d="M3 20V9l9-5 9 5v11M9 20v-6h6v6"/>',
    cash: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
    bonus: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>'
  };
  const icon = (k, c) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>`;

  function fmtDate(d) {
    const x = d ? new Date(d) : new Date();
    return x.toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'});
  }

  function header(c, agent, title, page, pages) {
    return `<header class="rp-head"><img src="logo.png" alt="REDEFINE" class="rp-logo"><div class="rp-head-r"><b>${esc(title)}</b><span>${fmtDate()} · Page ${page} of ${pages}</span></div></header>`;
  }
  function footer(agent) {
    const who = agent && agent.name ? `Prepared by <b>${esc(agent.name)}</b>${agent.title ? ', ' + esc(agent.title) : ''}${agent.phone ? ' · ' + esc(agent.phone) : ''}` : 'Prepared by your REDEFINE adviser';
    return `<footer class="rp-foot"><div>${who}</div><p>This summary is prepared from the policy documents and information you shared, for discussion only. Amounts are as shown in those documents on the dates stated and may change. It is not a policy contract, a quotation or a recommendation. Benefits are subject to each insurer's terms, conditions and exclusions; please refer to your policy contracts.</p></footer>`;
  }

  function tile(k, label, value, sub, color, extra) {
    return `<div class="rp-tile"><div class="rp-tile-top">${icon(k, color)}<span>${esc(label)}</span></div><div class="rp-tile-v">${value}</div><div class="rp-tile-s">${sub || '&nbsp;'}</div>${extra || ''}</div>`;
  }
  const big = (v, PS) => v == null ? '<span class="rp-none">Not stated</span>' : esc(PS.rm(v));
  function catSub(x, PS) {
    if (!x.policies) return 'No cover found';
    const bits = [x.policies + (x.policies > 1 ? ' policies' : ' policy')];
    if (x.drop) bits.push(x.drop.left ? `<em>drops to ${PS.rm(x.drop.left, {short: true})} at age ${x.drop.age}</em>` : `ends at age ${x.drop.age}`);
    else if (x.maxAge) bits.push('up to age ' + x.maxAge);
    if (x.missing) bits.push(`<em>+${x.missing} not stated</em>`);
    return bits.join(' · ');
  }
  const catVal = (x, PS) => x.policies ? (x.total || !x.missing ? esc(PS.rm(x.total)) : '<span class="rp-none">Not stated</span>') : '<span class="rp-zero">RM0</span>';

  function page1(c, s, agent, PS, pages, opts) {
    const C = s.cats, name = c.client.name || 'Client';
    const facts = [c.client.age ? 'Age ' + esc(c.client.age) : '', s.policyCount + ' polic' + (s.policyCount === 1 ? 'y' : 'ies') + ' in force',
      s.insurers.length + ' insurer' + (s.insurers.length === 1 ? '' : 's')].filter(Boolean).join(' · ');
    const med = s.medical;
    const medVal = med.plans ? big(med.annual, PS) : '<span class="rp-zero">None</span>';
    const medSub = med.plans ? [`Lifetime: ${med.lifetimeUnlimited ? 'no limit' : med.lifetime != null ? PS.rm(med.lifetime, {short: true}) : 'not stated'}`,
      med.roomBoard != null ? `Room ${PS.rm(med.roomBoard)}/day` : ''].filter(Boolean).join(' · ') : 'No medical card found';
    const hosp = C.hospital;
    const gaps = s.gaps ? `<section class="rp-gap"><h3>How your cover compares with a common guideline</h3>
      <p class="rp-gap-note">Guideline: ${s.gaps[0].x}× annual income for death and TPD, ${s.gaps[2].x}× for critical illness, based on an annual income of ${PS.rm(c.client.income)}. A rule of thumb for discussion, not a full needs analysis.</p>
      ${s.gaps.map(g => `<div class="rp-bar"><span class="rp-bar-l">${esc(g.label)}</span><div class="rp-bar-t"><i style="width:${g.pct}%;background:${g.pct >= 100 ? '#1E8A6E' : g.pct >= 60 ? '#D9A23B' : '#B5452F'}"></i></div><span class="rp-bar-v"><b>${g.pct}%</b> ${g.short ? 'short by ' + PS.rm(g.short, {short: true}) : 'covered'}</span></div>`).join('')}</section>` : '';
    const chips = s.insurers.map(n => `<span class="rp-chip"><i style="background:${PS.insurerColor(n)}"></i>${esc(n)}</span>`).join('');
    const excl = s.excluded ? `<p class="rp-excl">${s.excluded} polic${s.excluded > 1 ? 'ies' : 'y'} not in force ${s.excluded > 1 ? 'are' : 'is'} listed in the details but not counted.</p>` : '';
    return `<div class="rp-page">${header(c, agent, 'Policy Summary', 1, pages)}
      <div class="rp-client"><span>Prepared for</span><h1>${esc(name)}</h1><p>${facts}</p></div>
      <section class="rp-hero">
        <div class="rp-hero-main"><span>If the unexpected happens, your family receives</span><b>${catVal(C.death, PS)}</b><em>Total death cover · ${catSub(C.death, PS)}</em></div>
        <div class="rp-hero-side">
          <div><span>Total &amp; Permanent Disability</span><b>${catVal(C.tpd, PS)}</b><em>${catSub(C.tpd, PS)}</em></div>
          <div><span>Critical Illness</span><b>${catVal(C.ci, PS)}</b><em>${catSub(C.ci, PS)}</em></div>
        </div>
      </section>
      <div class="rp-grid">
        ${tile('eci', 'Early Critical Illness', catVal(C.eci, PS), catSub(C.eci, PS), '#D9783B')}
        ${tile('medical', 'Medical card · annual limit', medVal, medSub, '#1E8A6E')}
        ${tile('accident', 'Accident (extra on accidental death)', catVal(C.accident, PS), catSub(C.accident, PS), '#6B4E9B')}
        ${tile('hospital', 'Hospital income', hosp.policies ? catVal(hosp, PS) + '<small>/day</small>' : '<span class="rp-zero">None</span>', catSub(hosp, PS), '#4A9A9A')}
        ${tile('cash', 'Cash value today', s.cash.n ? esc(PS.rm(s.cash.total)) : '<span class="rp-zero">None stated</span>', s.cash.n ? 'From ' + s.cash.n + ' polic' + (s.cash.n > 1 ? 'ies' : 'y') + ' · not guaranteed' : 'Protection-only plans may have none', '#1F3A68')}
        ${tile('bonus', 'Bonus accumulated', s.bonus.n ? esc(PS.rm(s.bonus.total)) : '<span class="rp-zero">None stated</span>', s.bonus.n ? 'From ' + s.bonus.n + ' polic' + (s.bonus.n > 1 ? 'ies' : 'y') : '&nbsp;', '#B08A2E')}
      </div>
      ${gaps}
      <section class="rp-prem"><div><span>Total premium</span><b>${PS.rm(s.premium.annual)}<small> / year</small></b><em>about ${PS.rm(Math.round(s.premium.annual / 12))} a month${s.premium.missing ? ' · ' + s.premium.missing + ' not stated' : ''}</em></div><div class="rp-chips">${chips}</div></section>
      ${excl}${opts && opts.incomplete ? `<p class="rp-excl">Some details were not available in the documents provided and are shown as "Not stated" or left out of the totals. Your adviser will update this summary when they are confirmed.</p>` : ""}
      ${footer(agent)}</div>`;
  }

  /* page 2: one row per policy, one column per category */
  function matrix(c, s, agent, PS, pages) {
    const cols = ['death', 'tpd', 'ci', 'eci', 'accident', 'medical'];
    const cell = (r, id) => !r[id].has ? '<td class="rp-dash">—</td>' : `<td>${r[id].total ? PS.rm(r[id].total, {short: true}) : ''}${r[id].missing ? '<sup>?</sup>' : ''}</td>`;
    const rows = c.policies.map(p => {
      const r = PS.policyRow(p), out = p.status !== 'inforce' && p.status !== 'unknown';
      return `<tr class="${out ? 'rp-out' : ''}"><th><i style="background:${PS.insurerColor(p.insurer)}"></i><b>${esc(p.insurer || 'Insurer?')}</b><span>${esc(p.productName || 'Plan')}${p.policyNo ? ' · ' + esc(p.policyNo) : ''}${out ? ' · ' + esc(p.status.toUpperCase()) : ''}</span></th>
        ${cols.map(id => cell(r, id)).join('')}<td>${p.cashValue != null ? PS.rm(p.cashValue, {short: true}) : '—'}</td><td>${PS.annualPremium(p) != null ? PS.rm(PS.annualPremium(p)) : '—'}</td></tr>`;
    }).join('');
    const C = s.cats;
    const tot = cols.map(id => `<td>${id === 'medical' ? (s.medical.annual != null ? PS.rm(s.medical.annual, {short: true}) + '<sup>*</sup>' : '—') : PS.rm(C[id].total, {short: true})}</td>`).join('');
    return `<div class="rp-page">${header(c, agent, 'Policy Summary · All policies side by side', 2, pages)}
      <div class="rp-client small"><span>${esc(c.client.name)}</span><h2>Your policies side by side</h2></div>
      <table class="rp-mx"><thead><tr><th>Policy</th><th>Death</th><th>TPD</th><th>CI</th><th>Early CI</th><th>Accident</th><th>Medical annual</th><th>Cash value</th><th>Premium / yr</th></tr></thead>
      <tbody>${rows}</tbody><tfoot><tr><th>Total in force</th>${tot}<td>${PS.rm(s.cash.total, {short: true})}</td><td>${PS.rm(s.premium.annual)}</td></tr></tfoot></table>
      <p class="rp-key"><sup>?</sup> amount not stated in the documents · <sup>*</sup> medical shows the highest single annual limit, as medical cards do not simply add up · greyed rows are not in force and not counted.</p>
      ${footer(agent)}</div>`;
  }

  /* pages 3+: each policy's benefits in full; long lists flow onto more pages */
  function detailPages(c, agent, PS, startPage, pages) {
    const out = [];
    let cur = [], used = 0;
    const cost = p => 3 + p.benefits.length * 1.15;
    c.policies.forEach(p => { if (used + cost(p) > 30 && cur.length) { out.push(cur); cur = []; used = 0; } cur.push(p); used += cost(p); });
    if (cur.length) out.push(cur);
    return out.map((group, i) => `<div class="rp-page">${header(c, agent, 'Policy Summary · Policy details', startPage + i, pages)}
      ${i === 0 ? `<div class="rp-client small"><span>${esc(c.client.name)}</span><h2>Policy details</h2></div>` : ''}
      ${group.map(p => policyCard(p, PS)).join('')}
      ${footer(agent)}</div>`);
  }
  function policyCard(p, PS) {
    const meta = [p.policyNo && 'Policy ' + p.policyNo, p.startDate && 'Since ' + fmtDate(p.startDate),
      PS.annualPremium(p) != null && PS.rm(p.premium) + ' ' + (p.premiumFreq || ''), p.lifeAssured && 'Life assured: ' + p.lifeAssured].filter(Boolean).map(esc).join(' · ');
    const ben = p.benefits.map(b => {
      const cat = PS.catOf(b.cat);
      let v;
      if (b.cat === 'medical') v = [b.annual != null ? 'Annual ' + PS.rm(b.annual) : 'Annual not stated', b.lifetimeUnlimited ? 'Lifetime no limit' : b.lifetime != null ? 'Lifetime ' + PS.rm(b.lifetime) : '', b.roomBoard != null ? 'Room ' + PS.rm(b.roomBoard) + '/day' : '', b.deductible ? 'Deductible ' + PS.rm(b.deductible) : ''].filter(Boolean).join(' · ');
      else if (b.cat === 'waiver') v = 'Included';
      else v = b.amount == null ? 'Not stated' : PS.rm(b.amount) + (b.cat === 'hospital' ? ' / day' : '');
      return `<tr><td><span class="rp-tag" style="background:${cat.color}">${esc(cat.short)}</span></td><td>${esc(b.name)}${b.note ? `<small>${esc(b.note)}</small>` : ''}</td><td>${esc(v)}</td><td>${b.untilAge ? 'to age ' + b.untilAge : ''}</td></tr>`;
    }).join('');
    const extra = [p.cashValue != null && `Cash value ${PS.rm(p.cashValue)}${p.cashValueDate ? ' (as at ' + fmtDate(p.cashValueDate) + ')' : ''}`, p.bonus != null && `Bonus ${PS.rm(p.bonus)}`].filter(Boolean).map(esc).join(' · ');
    const out = p.status !== 'inforce' && p.status !== 'unknown';
    return `<section class="rp-pol${out ? ' rp-out' : ''}"><div class="rp-pol-h"><i style="background:${PS.insurerColor(p.insurer)}"></i><div><b>${esc(p.insurer || 'Insurer not stated')} · ${esc(p.productName || 'Plan')}</b><span>${meta}${out ? ' · ' + esc(p.status.toUpperCase()) + ', not counted' : ''}</span></div></div>
      <table class="rp-ben">${ben}</table>${extra ? `<p class="rp-pol-x">${extra}</p>` : ''}</section>`;
  }

  function build(c, agent, PS, opts) {
    const s = PS.summarise(c);
    const tmpDetail = detailPages(c, agent, PS, 3, 0).length;
    const pages = 2 + tmpDetail;
    return [page1(c, s, agent, PS, pages, opts), matrix(c, s, agent, PS, pages)].concat(detailPages(c, agent, PS, 3, pages));
  }

  /* render pages to a PDF Blob */
  const loadScript = src => new Promise((ok, bad) => { const el = document.createElement('script'); el.src = src; el.onload = ok; el.onerror = () => bad(new Error('load ' + src)); document.head.appendChild(el); });
  async function toPDF(container, onProgress) {
    if (!window.jspdf) await loadScript('vendor/jspdf.umd.min.js');
    if (!window.html2canvas) await loadScript('vendor/html2canvas.min.js');
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const pdf = new window.jspdf.jsPDF({unit: 'pt', format: 'a4', compress: true});
    const pages = container.querySelectorAll('.rp-page');
    for (let i = 0; i < pages.length; i++) {
      onProgress && onProgress(i + 1, pages.length);
      const canvas = await window.html2canvas(pages[i], {scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false, windowWidth: 794});
      if (i) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 595.28, 841.89, undefined, 'FAST');
    }
    return pdf.output('blob');
  }

  /* ---------- On Field: personal follow-up PDF after a meeting ---------- */
  const FU_L = {
    zh: {prep: '专属为你准备', disc: '今天我们聊了', matters: '对你来说重要的', rec: '我的建议，和原因', next: '下一步', notes: '我们的讨论笔记', about: '关于我', why: '我为什么做保险', contact: '联络我', concept: '概念分享', illus: '数字只作说明用途，并非报价或保证。'},
    en: {prep: 'Prepared for', disc: 'What we talked about', matters: 'What matters to you', rec: 'What I suggest, and why', next: 'Next step', notes: 'Our discussion notes', about: 'About me', why: 'Why I do this work', contact: 'Contact me', concept: 'An idea worth sharing', illus: 'Figures are illustrative only, not a quotation or guarantee.'},
    ms: {prep: 'Disediakan untuk', disc: 'Apa yang kita bincangkan', matters: 'Apa yang penting bagi anda', rec: 'Cadangan saya, dan sebabnya', next: 'Langkah seterusnya', notes: 'Nota perbincangan kita', about: 'Tentang saya', why: 'Kenapa saya buat kerja ini', contact: 'Hubungi saya', concept: 'Idea untuk dikongsi', illus: 'Angka hanya sebagai ilustrasi, bukan sebut harga atau jaminan.'}
  };
  function fuFoot(agent, L) {
    return `<footer class="rp-foot"><div>${esc(agent.name || '')}${agent.title ? ' · ' + esc(agent.title) : ''}${agent.phone ? ' · ' + esc(agent.phone) : ''}</div><p>This note summarises our conversation for your reference. It is not a policy contract, quotation or offer. Any plan, premium and benefit is subject to the insurer's approved documents, terms and underwriting. ${esc(L.illus)}</p></footer>`;
  }
  function fuHead(title, page, pages) {
    return `<header class="rp-head"><img src="logo.png" alt="REDEFINE" class="rp-logo"><div class="rp-head-r"><b>${esc(title)}</b><span>${fmtDate()} · ${page} / ${pages}</span></div></header>`;
  }
  const paras = a => (a || []).filter(Boolean).map(p => `<p>${esc(p)}</p>`).join('');
  const bullets = a => (a || []).filter(Boolean).length ? `<ul>${a.filter(Boolean).map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : '';
  /* o: {clientName, draft, agent: {name,title,phone,email,photo,intro,why,background}, lang, photos: [dataURL], concepts: [concept objects]} */
  function buildFollowUp(o) {
    const L = FU_L[o.lang] || FU_L.zh, d = o.draft, a = o.agent, l = d.letter, out = [];
    const photoPages = [];
    for (let i = 0; i < (o.photos || []).length; i += 4) photoPages.push(o.photos.slice(i, i + 4));
    const pages = 1 + o.concepts.length + photoPages.length + 1;
    let n = 1;
    out.push(`<div class="rp-page fu">${fuHead(l.title || L.prep, n++, pages)}
      <div class="rp-client"><span>${esc(L.prep)}</span><h1>${esc(o.clientName)}</h1></div>
      ${l.title ? `<h2 class="fu-title">${esc(l.title)}</h2>` : ''}
      ${l.greeting ? `<p class="fu-greet">${esc(l.greeting)}</p>` : ''}
      ${(l.discussed || []).length ? `<section class="fu-sec"><h3>${esc(L.disc)}</h3>${paras(l.discussed)}</section>` : ''}
      ${(l.matters || []).length ? `<section class="fu-sec fu-box"><h3>${esc(L.matters)}</h3>${bullets(l.matters)}</section>` : ''}
      ${l.recommendation ? `<section class="fu-sec"><h3>${esc(L.rec)}</h3><p>${esc(l.recommendation)}</p></section>` : ''}
      ${l.nextStep ? `<section class="fu-sec fu-next"><h3>${esc(L.next)}</h3><p>${esc(l.nextStep)}</p></section>` : ''}
      ${l.closing ? `<p class="fu-close">${esc(l.closing)}</p>` : ''}
      <div class="fu-sign">${a.photo ? `<img src="${a.photo}" alt="">` : ''}<div><b>${esc(a.name || '')}</b><span>${esc(a.title || '')}</span></div></div>
      ${fuFoot(a, L)}</div>`);
    o.concepts.forEach(k => out.push(`<div class="rp-page fu">${fuHead(L.concept, n++, pages)}
      <div class="fu-concept"><span class="fu-tag">${k.group === 'income' ? 'Income protection' : 'Medical protection'}</span><h2>${esc(k.zh)}</h2><h4>${esc(k.en)}</h4>
      <div class="fu-art">${k.art}</div>
      <ol>${k.lines.map(([zh, en]) => `<li><b>${esc(zh)}</b><span>${esc(en)}</span></li>`).join('')}</ol>
      <blockquote><b>${esc(k.key)}</b><span>${esc(k.keyEn)}</span></blockquote></div>
      ${fuFoot(a, L)}</div>`));
    photoPages.forEach(group => out.push(`<div class="rp-page fu">${fuHead(L.notes, n++, pages)}
      <h2 class="fu-title">${esc(L.notes)}</h2><div class="fu-photos n${group.length}">${group.map(src => `<div><img src="${src}" alt=""></div>`).join('')}</div>
      ${fuFoot(a, L)}</div>`));
    out.push(`<div class="rp-page fu">${fuHead(L.about, n++, pages)}
      <div class="fu-about">${a.photo ? `<img src="${a.photo}" alt="">` : ''}<div><h2>${esc(a.name || '')}</h2><p class="fu-role">${esc(a.title || '')}</p></div></div>
      ${a.intro ? `<section class="fu-sec"><h3>${esc(L.about)}</h3><p>${esc(a.intro)}</p></section>` : ''}
      ${a.why ? `<section class="fu-sec fu-box"><h3>${esc(L.why)}</h3><p>${esc(a.why)}</p></section>` : ''}
      ${a.background ? `<section class="fu-sec"><p>${esc(a.background)}</p></section>` : ''}
      <section class="fu-card"><img src="logo.png" alt=""><div><b>${esc(a.name || '')}</b><span>${esc(a.title || '')}</span>${a.phone ? `<span>📞 ${esc(a.phone)}</span>` : ''}${a.email ? `<span>✉️ ${esc(a.email)}</span>` : ''}</div></section>
      ${fuFoot(a, L)}</div>`);
    return out;
  }

  root.Report = {build, toPDF, buildFollowUp};
})(this);
