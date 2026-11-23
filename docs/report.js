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

  /* ---------- language: English (as before) or 中文 (Simplified, natural wording; insurer, product and benefit names stay as printed) ---------- */
  let LANG = 'en';
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  const SL = {
    en: {
      title: 'Policy Summary', prep: 'Prepared for', page: (p, n) => `Page ${p} of ${n}`,
      age: a => 'Age ' + a, inForce: n => n + ' polic' + (n === 1 ? 'y' : 'ies') + ' in force', insurers: n => n + ' insurer' + (n === 1 ? '' : 's'),
      noCover: 'No cover found', nPol: n => n + (n > 1 ? ' policies' : ' policy'), dropsTo: (v, a) => `drops to ${v} at age ${a}`, endsAt: a => `ends at age ${a}`, upTo: a => 'up to age ' + a, notStatedN: n => `+${n} not stated`,
      notStated: 'Not stated', none: 'None', noneStated: 'None stated',
      lifetime: v => `Lifetime: ${v}`, noLimit: 'no limit', notStatedL: 'not stated', room: v => `Room ${v}/day`, noMed: 'No medical card found',
      gapH: 'How your cover compares with a common guideline',
      gapNote: (d, ci, inc) => `Guideline: ${d}× annual income for death and TPD, ${ci}× for critical illness, based on an annual income of ${inc}. A rule of thumb for discussion, not a full needs analysis.`,
      gapLabel: {death: 'Death', tpd: 'TPD', ci: 'Critical Illness'}, shortBy: v => 'short by ' + v, covered: 'covered',
      excl: n => `${n} polic${n > 1 ? 'ies' : 'y'} not in force ${n > 1 ? 'are' : 'is'} listed in the details but not counted.`,
      incomplete: 'Some details were not available in the documents provided and are shown as "Not stated" or left out of the totals. Your adviser will update this summary when they are confirmed.',
      heroLead: 'If the unexpected happens, your family receives', heroSub: 'Total death cover', tpd: 'Total &amp; Permanent Disability', ci: 'Critical Illness',
      eci: 'Early Critical Illness', med: 'Medical card · annual limit', acc: 'Accident (extra on accidental death)', hosp: 'Hospital income', perDay: '/day',
      cash: 'Cash value today', cashFrom: n => 'From ' + n + ' polic' + (n > 1 ? 'ies' : 'y') + ' · not guaranteed', cashNone: 'Protection-only plans may have none',
      bonus: 'Bonus accumulated', bonusFrom: n => 'From ' + n + ' polic' + (n > 1 ? 'ies' : 'y'),
      prem: 'Total premium', perYear: ' / year', aMonth: v => `about ${v} a month`, premMissing: n => n + ' not stated',
      mxTitle: 'Policy Summary · All policies side by side', mxH: 'Your policies side by side',
      mxCols: ['Policy', 'Death', 'TPD', 'CI', 'Early CI', 'Accident', 'Medical annual', 'Cash value', 'Premium / yr'], mxTotal: 'Total in force',
      mxKey: '<sup>?</sup> amount not stated in the documents · <sup>*</sup> medical shows the highest single annual limit, as medical cards do not simply add up · greyed rows are not in force and not counted.',
      status: s => s.toUpperCase(), insQ: 'Insurer?', plan: 'Plan',
      dtTitle: 'Policy Summary · Policy details', dtH: 'Policy details',
      polNo: n => 'Policy ' + n, since: d => 'Since ' + d, freq: f => f || '', la: n => 'Life assured: ' + n,
      annual: v => 'Annual ' + v, annualNS: 'Annual not stated', lifeNL: 'Lifetime no limit', life: v => 'Lifetime ' + v, roomD: v => 'Room ' + v + '/day', deduct: v => 'Deductible ' + v,
      included: 'Included', dayS: ' / day', toAge: a => 'to age ' + a, note: n => n,
      cv: (v, d) => `Cash value ${v}${d ? ' (as at ' + d + ')' : ''}`, bon: v => `Bonus ${v}`, insNS: 'Insurer not stated', notCounted: ', not counted',
      catShort: id => null,
      by: (n, t, p) => `Prepared by <b>${n}</b>${t ? ', ' + t : ''}${p ? ' · ' + p : ''}`, byDefault: 'Prepared by your REDEFINE adviser',
      foot: 'This summary is prepared from the policy documents and information you shared, for discussion only. Amounts are as shown in those documents on the dates stated and may change. It is not a policy contract, a quotation or a recommendation. Benefits are subject to each insurer\'s terms, conditions and exclusions; please refer to your policy contracts.'
    },
    zh: {
      title: '保单总结', prep: '专属为您准备', page: (p, n) => `第 ${p} 页，共 ${n} 页`,
      age: a => a + ' 岁', inForce: n => n + ' 份有效保单', insurers: n => n + ' 家保险公司',
      noCover: '未发现此保障', nPol: n => n + ' 份保单', dropsTo: (v, a) => `${a} 岁后降至 ${v}`, endsAt: a => `${a} 岁终止`, upTo: a => '保障至 ' + a + ' 岁', notStatedN: n => `另有 ${n} 项未注明`,
      notStated: '未注明', none: '无', noneStated: '未注明',
      lifetime: v => `终身限额：${v}`, noLimit: '无上限', notStatedL: '未注明', room: v => `病房 ${v}/天`, noMed: '未发现医药卡',
      gapH: '您的保障与常用参考标准比较',
      gapNote: (d, ci, inc) => `参考标准：身故及完全永久残废为年收入的 ${d} 倍，严重疾病为 ${ci} 倍，以年收入 ${inc} 计算。这只是方便讨论的经验法则，并非完整的需求分析。`,
      gapLabel: {death: '身故', tpd: '残废 (TPD)', ci: '严重疾病'}, shortBy: v => '尚差 ' + v, covered: '已足够',
      excl: n => `${n} 份非有效保单列在详情页，但不计入总额。`,
      incomplete: '部分资料在所提供的文件中未能找到，显示为"未注明"或不计入总额。确认后，您的顾问会更新这份总结。',
      heroLead: '万一不幸发生，您的家人可获得', heroSub: '身故保障总额', tpd: '完全永久残废 (TPD)', ci: '严重疾病 (CI)',
      eci: '早期严重疾病 (Early CI)', med: '医药卡 · 每年限额', acc: '意外 (意外身故额外赔偿)', hosp: '住院津贴', perDay: '/天',
      cash: '目前现金价值', cashFrom: n => '来自 ' + n + ' 份保单 · 非保证', cashNone: '纯保障计划可能没有现金价值',
      bonus: '累积红利', bonusFrom: n => '来自 ' + n + ' 份保单',
      prem: '总保费', perYear: ' / 年', aMonth: v => `约每月 ${v}`, premMissing: n => n + ' 份未注明',
      mxTitle: '保单总结 · 所有保单一览', mxH: '您的保单一览',
      mxCols: ['保单', '身故', 'TPD', '严重疾病', '早期严疾', '意外', '医药卡每年', '现金价值', '年保费'], mxTotal: '有效保单合计',
      mxKey: '<sup>?</sup> 文件中未注明金额 · <sup>*</sup> 医药卡显示最高的单项每年限额，因为医药卡不能直接相加 · 灰色行是非有效保单，不计入总额。',
      status: s => ({lapsed: '已失效', surrendered: '已退保', matured: '已满期'})[s] || s, insQ: '保险公司?', plan: '计划',
      dtTitle: '保单总结 · 保单详情', dtH: '保单详情',
      polNo: n => '保单 ' + n, since: d => '生效日 ' + d, freq: f => ({monthly: '每月', quarterly: '每季', 'half-yearly': '每半年', yearly: '每年', single: '一次性'})[f] || '', la: n => '受保人：' + n,
      annual: v => '每年 ' + v, annualNS: '每年限额未注明', lifeNL: '终身无上限', life: v => '终身 ' + v, roomD: v => '病房 ' + v + '/天', deduct: v => '自付额 ' + v,
      included: '已包括', dayS: ' / 天', toAge: a => '至 ' + a + ' 岁', note: n => n === 'Paid once, on death or TPD' ? '身故或 TPD 只赔一次' : n,
      cv: (v, d) => `现金价值 ${v}${d ? '（截至 ' + d + '）' : ''}`, bon: v => `红利 ${v}`, insNS: '保险公司未注明', notCounted: '，不计入',
      catShort: id => ({death: '身故', tpd: 'TPD', ci: '严疾', eci: '早期严疾', accident: '意外', medical: '医药', hospital: '住院津贴', waiver: '豁免', other: '其他'})[id],
      by: (n, t, p) => `顾问：<b>${n}</b>${t ? '，' + t : ''}${p ? ' · ' + p : ''}`, byDefault: '由您的 REDEFINE 顾问准备',
      foot: '本总结根据您提供的保单文件及资料整理，仅供讨论参考。金额以文件所示日期为准，日后可能变动。本文件并非保单合约、报价或建议。所有保障须以各保险公司的条款、条件及不保事项为准，请参阅您的保单合约。'
    }
  };
  const T = () => SL[LANG] || SL.en;
  /* in 中文, short amounts read the way clients say them: RM30万, RM150万 */
  function localPS(PS, lang) {
    if (lang !== 'zh') return PS;
    const rm = (v, opts) => {
      opts = opts || {};
      if (v == null) return opts.dash || '—';
      if (opts.short && v >= 1e4) { const w = v / 1e4; return 'RM' + (w >= 100 ? Math.round(w) : +w.toFixed(2)) + '万'; }
      return PS.rm(v);
    };
    return Object.assign({}, PS, {rm});
  }

  function fmtDate(d) {
    const x = d ? new Date(d) : new Date();
    if (LANG === 'zh') return `${x.getFullYear()}年${x.getMonth() + 1}月${x.getDate()}日`;
    return x.toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'});
  }

  function header(c, agent, title, page, pages) {
    return `<header class="rp-head"><img src="logo.png" alt="REDEFINE" class="rp-logo"><div class="rp-head-r"><b>${esc(title)}</b><span>${fmtDate()} · ${T().page(page, pages)}</span></div></header>`;
  }
  function footer(agent) {
    const t = T(), who = agent && agent.name ? t.by(esc(agent.name), agent.title ? esc(agent.title) : '', agent.phone ? esc(agent.phone) : '') : t.byDefault;
    return `<footer class="rp-foot"><div>${who}</div><p>${t.foot}</p></footer>`;
  }

  function tile(k, label, value, sub, color, extra) {
    return `<div class="rp-tile"><div class="rp-tile-top">${icon(k, color)}<span>${label}</span></div><div class="rp-tile-v">${value}</div><div class="rp-tile-s">${sub || '&nbsp;'}</div>${extra || ''}</div>`;
  }
  const big = (v, PS) => v == null ? `<span class="rp-none">${T().notStated}</span>` : esc(PS.rm(v));
  function catSub(x, PS) {
    const t = T();
    if (!x.policies) return t.noCover;
    const bits = [t.nPol(x.policies)];
    if (x.drop) bits.push(x.drop.left ? `<em>${t.dropsTo(PS.rm(x.drop.left, {short: true}), x.drop.age)}</em>` : t.endsAt(x.drop.age));
    else if (x.maxAge) bits.push(t.upTo(x.maxAge));
    if (x.missing) bits.push(`<em>${t.notStatedN(x.missing)}</em>`);
    return bits.join(' · ');
  }
  const catVal = (x, PS) => x.policies ? (x.total || !x.missing ? esc(PS.rm(x.total)) : `<span class="rp-none">${T().notStated}</span>`) : '<span class="rp-zero">RM0</span>';

  function page1(c, s, agent, PS, pages, opts) {
    const t = T(), C = s.cats, name = c.client.name || 'Client';
    const facts = [c.client.age ? t.age(esc(c.client.age)) : '', t.inForce(s.policyCount), t.insurers(s.insurers.length)].filter(Boolean).join(' · ');
    const med = s.medical;
    const medVal = med.plans ? big(med.annual, PS) : `<span class="rp-zero">${t.none}</span>`;
    const medSub = med.plans ? [t.lifetime(med.lifetimeUnlimited ? t.noLimit : med.lifetime != null ? PS.rm(med.lifetime, {short: true}) : t.notStatedL),
      med.roomBoard != null ? t.room(PS.rm(med.roomBoard)) : ''].filter(Boolean).join(' · ') : t.noMed;
    const hosp = C.hospital;
    const gaps = s.gaps ? `<section class="rp-gap"><h3>${t.gapH}</h3>
      <p class="rp-gap-note">${t.gapNote(s.gaps[0].x, s.gaps[2].x, PS.rm(c.client.income))}</p>
      ${s.gaps.map(g => `<div class="rp-bar"><span class="rp-bar-l">${esc(t.gapLabel[g.id] || g.label)}</span><div class="rp-bar-t"><i style="width:${g.pct}%;background:${g.pct >= 100 ? '#1E8A6E' : g.pct >= 60 ? '#D9A23B' : '#B5452F'}"></i></div><span class="rp-bar-v"><b>${g.pct}%</b> ${g.short ? t.shortBy(PS.rm(g.short, {short: true})) : t.covered}</span></div>`).join('')}</section>` : '';
    const chips = s.insurers.map(n => `<span class="rp-chip"><i style="background:${PS.insurerColor(n)}"></i>${esc(n)}</span>`).join('');
    const excl = s.excluded ? `<p class="rp-excl">${t.excl(s.excluded)}</p>` : '';
    return `<div class="rp-page${LANG === 'zh' ? ' rp-zh' : ''}">${header(c, agent, t.title, 1, pages)}
      <div class="rp-client"><span>${t.prep}</span><h1>${esc(name)}</h1><p>${facts}</p></div>
      <section class="rp-hero">
        <div class="rp-hero-main"><span>${t.heroLead}</span><b>${catVal(C.death, PS)}</b><em>${t.heroSub} · ${catSub(C.death, PS)}</em></div>
        <div class="rp-hero-side">
          <div><span>${t.tpd}</span><b>${catVal(C.tpd, PS)}</b><em>${catSub(C.tpd, PS)}</em></div>
          <div><span>${t.ci}</span><b>${catVal(C.ci, PS)}</b><em>${catSub(C.ci, PS)}</em></div>
        </div>
      </section>
      <div class="rp-grid">
        ${tile('eci', t.eci, catVal(C.eci, PS), catSub(C.eci, PS), '#D9783B')}
        ${tile('medical', t.med, medVal, medSub, '#1E8A6E')}
        ${tile('accident', t.acc, catVal(C.accident, PS), catSub(C.accident, PS), '#6B4E9B')}
        ${tile('hospital', t.hosp, hosp.policies ? catVal(hosp, PS) + `<small>${t.perDay}</small>` : `<span class="rp-zero">${t.none}</span>`, catSub(hosp, PS), '#4A9A9A')}
        ${tile('cash', t.cash, s.cash.n ? esc(PS.rm(s.cash.total)) : `<span class="rp-zero">${t.noneStated}</span>`, s.cash.n ? t.cashFrom(s.cash.n) : t.cashNone, '#1F3A68')}
        ${tile('bonus', t.bonus, s.bonus.n ? esc(PS.rm(s.bonus.total)) : `<span class="rp-zero">${t.noneStated}</span>`, s.bonus.n ? t.bonusFrom(s.bonus.n) : '&nbsp;', '#B08A2E')}
      </div>
      ${gaps}
      <section class="rp-prem"><div><span>${t.prem}</span><b>${PS.rm(s.premium.annual)}<small>${t.perYear}</small></b><em>${t.aMonth(PS.rm(Math.round(s.premium.annual / 12)))}${s.premium.missing ? ' · ' + t.premMissing(s.premium.missing) : ''}</em></div><div class="rp-chips">${chips}</div></section>
      ${excl}${opts && opts.incomplete ? `<p class="rp-excl">${t.incomplete}</p>` : ""}
      ${footer(agent)}</div>`;
  }

  /* page 2: one row per policy, one column per category */
  function matrix(c, s, agent, PS, pages) {
    const t = T(), cols = ['death', 'tpd', 'ci', 'eci', 'accident', 'medical'];
    const cell = (r, id) => !r[id].has ? '<td class="rp-dash">—</td>' : `<td>${r[id].total ? PS.rm(r[id].total, {short: true}) : ''}${r[id].missing ? '<sup>?</sup>' : ''}</td>`;
    const rows = c.policies.map(p => {
      const r = PS.policyRow(p), out = p.status !== 'inforce' && p.status !== 'unknown';
      return `<tr class="${out ? 'rp-out' : ''}"><th><i style="background:${PS.insurerColor(p.insurer)}"></i><b>${esc(p.insurer || t.insQ)}</b><span>${esc(p.productName || t.plan)}${p.policyNo ? ' · ' + esc(p.policyNo) : ''}${out ? ' · ' + esc(t.status(p.status)) : ''}</span></th>
        ${cols.map(id => cell(r, id)).join('')}<td>${p.cashValue != null ? PS.rm(p.cashValue, {short: true}) : '—'}</td><td>${PS.annualPremium(p) != null ? PS.rm(PS.annualPremium(p)) : '—'}</td></tr>`;
    }).join('');
    const C = s.cats;
    const tot = cols.map(id => `<td>${id === 'medical' ? (s.medical.annual != null ? PS.rm(s.medical.annual, {short: true}) + '<sup>*</sup>' : '—') : PS.rm(C[id].total, {short: true})}</td>`).join('');
    return `<div class="rp-page${LANG === 'zh' ? ' rp-zh' : ''}">${header(c, agent, t.mxTitle, 2, pages)}
      <div class="rp-client small"><span>${esc(c.client.name)}</span><h2>${t.mxH}</h2></div>
      <table class="rp-mx"><thead><tr>${t.mxCols.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody><tfoot><tr><th>${t.mxTotal}</th>${tot}<td>${PS.rm(s.cash.total, {short: true})}</td><td>${PS.rm(s.premium.annual)}</td></tr></tfoot></table>
      <p class="rp-key">${t.mxKey}</p>
      ${footer(agent)}</div>`;
  }

  /* pages 3+: each policy's benefits in full; long lists flow onto more pages */
  function detailPages(c, agent, PS, startPage, pages) {
    const t = T(), out = [];
    let cur = [], used = 0;
    const cost = p => 3 + p.benefits.length * 1.15;
    c.policies.forEach(p => { if (used + cost(p) > 30 && cur.length) { out.push(cur); cur = []; used = 0; } cur.push(p); used += cost(p); });
    if (cur.length) out.push(cur);
    return out.map((group, i) => `<div class="rp-page${LANG === 'zh' ? ' rp-zh' : ''}">${header(c, agent, t.dtTitle, startPage + i, pages)}
      ${i === 0 ? `<div class="rp-client small"><span>${esc(c.client.name)}</span><h2>${t.dtH}</h2></div>` : ''}
      ${group.map(p => policyCard(p, PS)).join('')}
      ${footer(agent)}</div>`);
  }
  function policyCard(p, PS) {
    const t = T();
    const meta = [p.policyNo && t.polNo(p.policyNo), p.startDate && t.since(fmtDate(p.startDate)),
      PS.annualPremium(p) != null && PS.rm(p.premium) + ' ' + t.freq(p.premiumFreq), p.lifeAssured && t.la(p.lifeAssured)].filter(Boolean).map(esc).join(' · ');
    const ben = p.benefits.map(b => {
      const cat = PS.catOf(b.cat);
      let v;
      if (b.cat === 'medical') v = [b.annual != null ? t.annual(PS.rm(b.annual)) : t.annualNS, b.lifetimeUnlimited ? t.lifeNL : b.lifetime != null ? t.life(PS.rm(b.lifetime)) : '', b.roomBoard != null ? t.roomD(PS.rm(b.roomBoard)) : '', b.deductible ? t.deduct(PS.rm(b.deductible)) : ''].filter(Boolean).join(' · ');
      else if (b.cat === 'waiver') v = t.included;
      else v = b.amount == null ? t.notStated : PS.rm(b.amount) + (b.cat === 'hospital' ? t.dayS : '');
      return `<tr><td><span class="rp-tag" style="background:${cat.color}">${esc(t.catShort(b.cat) || cat.short)}</span></td><td>${esc(b.name)}${b.note ? `<small>${esc(t.note(b.note))}</small>` : ''}</td><td>${esc(v)}</td><td>${b.untilAge ? t.toAge(b.untilAge) : ''}</td></tr>`;
    }).join('');
    const extra = [p.cashValue != null && t.cv(PS.rm(p.cashValue), p.cashValueDate ? fmtDate(p.cashValueDate) : ''), p.bonus != null && t.bon(PS.rm(p.bonus))].filter(Boolean).map(esc).join(' · ');
    const out = p.status !== 'inforce' && p.status !== 'unknown';
    return `<section class="rp-pol${out ? ' rp-out' : ''}"><div class="rp-pol-h"><i style="background:${PS.insurerColor(p.insurer)}"></i><div><b>${esc(p.insurer || t.insNS)} · ${esc(p.productName || t.plan)}</b><span>${meta}${out ? ' · ' + esc(t.status(p.status)) + t.notCounted : ''}</span></div></div>
      <table class="rp-ben">${ben}</table>${extra ? `<p class="rp-pol-x">${extra}</p>` : ''}</section>`;
  }

  function build(c, agent, PS, opts) {
    LANG = opts && opts.lang === 'zh' ? 'zh' : 'en'; PS = localPS(PS, LANG);
    c = Object.assign({}, c, {policies: (c.policies || []).filter(p => !PS.isProposal(p))});   // proposals are compared, never summarised
    const s = PS.summarise(c);
    const tmpDetail = detailPages(c, agent, PS, 3, 0).length;
    const pages = 2 + tmpDetail;
    return [page1(c, s, agent, PS, pages, opts), matrix(c, s, agent, PS, pages)].concat(detailPages(c, agent, PS, 3, pages));
  }

  /* ---------- Policy / proposal comparison (same template as the summary) ---------- */
  const CL = {
    en: {title: 'Policy Comparison', prep: 'Prepared for', comparing: n => 'Comparing ' + n + ' plans side by side',
      existing: 'Existing', proposal: 'Proposal', protection: 'Protection', medical: 'Medical', cost: 'Premium & term', value: 'Savings value',
      rows: {death: 'Death', tpd: 'Total & Permanent Disability', ci: 'Critical illness', eci: 'Early critical illness', accident: 'Accident (extra)', hospital: 'Hospital income / day',
        medical: 'Medical card · annual limit', medLife: 'Medical · lifetime limit', room: 'Room & board / day', deduct: 'Deductible', waiver: 'Premium waiver',
        premium: 'Premium', annual: 'Premium per year', pay: 'Premium paying term', end: 'Cover until', cash: 'Cash value today', bonus: 'Bonus accumulated', riders: 'Riders & add-ons'},
      notIncl: 'Not included', notStated: 'Not stated', included: 'Included', unlimited: 'No limit', age: a => 'Age ' + a, years: y => y + ' years', perYear: '/ year',
      freq: {monthly: '/ month', quarterly: '/ quarter', 'half-yearly': '/ half-year', yearly: '/ year', single: 'single'},
      vs: 'vs first column', diffs: 'Main differences at a glance', noDiffs: 'The plans compared show the same main cover amounts.',
      d: {only: (n, cat, v, o) => n + ' includes ' + cat + (v ? ' (' + v + ')' : '') + '; ' + o + ' does not.',
        missing: (n, cat, v, o) => n + ' does not include ' + cat + (v ? ' (' + o + ': ' + v + ')' : '') + '.',
        diff: (n, cat, a, b, d, o) => cat + ': ' + b + ' in ' + n + ' vs ' + a + ' in ' + o + ' (' + d + ').',
        premium: (n, a, b, d, o) => 'Premium: ' + b + ' a year in ' + n + ' vs ' + a + ' in ' + o + ' (' + d + ').',
        term: (n, a, b, o) => 'Cover until: age ' + b + ' in ' + n + ' vs age ' + a + ' in ' + o + '.'},
      p2title: 'Your total cover', p2sub: 'Today vs with the proposal', today: 'Today', todayB: 'Your policies today', inForce: n => n + ' in force', withP: 'With', change: 'change',
      replaced: names => 'Assumes ' + names + ' is replaced by the proposal.', added: 'Assumes the proposal is added to the policies you have today.',
      prem: 'Total premium / year', guide: g => 'Guideline ' + g, details: 'Plan details', medNote: 'Medical shows the highest single annual limit; medical cards do not simply add up.',
      foot: 'This comparison is prepared from the policy documents, benefit illustrations and information you shared, for discussion only. Amounts are as shown in those documents and may change. It is not a policy contract, a quotation or a recommendation. Benefits are subject to each insurer\'s terms, conditions, exclusions and underwriting; please read the product disclosure sheet and benefit illustration of any proposal.',
      replace: 'Thinking of replacing an existing policy? Switching may not be to your advantage: you may lose cash value and bonuses built up, pay more because of your age today, face new waiting periods and exclusions, and need to go through underwriting again. Keep the existing policy until the new one is approved.'}
  };
  CL.zh = {title: '保单比较', prep: '专属为您准备', comparing: n => n + ' 个计划并列比较',
    existing: '现有', proposal: '建议', protection: '保障', medical: '医药', cost: '保费与期限', value: '储蓄价值',
    rows: {death: '身故', tpd: '完全永久残废 (TPD)', ci: '严重疾病 (CI)', eci: '早期严重疾病 (Early CI)', accident: '意外 (额外赔偿)', hospital: '住院津贴 / 天',
      medical: '医药卡 · 每年限额', medLife: '医药卡 · 终身限额', room: '病房 / 天', deduct: '自付额', waiver: '保费豁免',
      premium: '保费', annual: '每年保费', pay: '缴费年期', end: '保障至', cash: '目前现金价值', bonus: '累积红利', riders: '附加保障 (Riders)'},
    notIncl: '不包括', notStated: '未注明', included: '已包括', unlimited: '无上限', age: a => a + ' 岁', years: y => y + ' 年', perYear: '/ 年',
    freq: {monthly: '/ 月', quarterly: '/ 季', 'half-yearly': '/ 半年', yearly: '/ 年', single: '一次性'},
    vs: '与第一栏比较', diffs: '主要差别一览', noDiffs: '所比较的计划，主要保障金额相同。',
    d: {only: (n, cat, v, o) => n + ' 包括' + cat + (v ? '（' + v + '）' : '') + '，' + o + ' 没有。',
      missing: (n, cat, v, o) => n + ' 不包括' + cat + (v ? '（' + o + '：' + v + '）' : '') + '。',
      diff: (n, cat, a, b, d, o) => cat + '：' + n + ' 为 ' + b + '，' + o + ' 为 ' + a + '（' + d + '）。',
      premium: (n, a, b, d, o) => '保费：' + n + ' 每年 ' + b + '，' + o + ' 每年 ' + a + '（' + d + '）。',
      term: (n, a, b, o) => '保障期：' + n + ' 至 ' + b + ' 岁，' + o + ' 至 ' + a + ' 岁。'},
    p2title: '您的总保障', p2sub: '现在 vs 加上建议计划后', today: '现在', todayB: '您现有的保单', inForce: n => n + ' 份有效', withP: '加上', change: '变化',
    replaced: names => '假设以建议计划取代：' + names + '。', added: '假设建议计划是在现有保单之外新增。',
    prem: '每年总保费', guide: g => '参考标准 · ' + g, details: '计划详情', medNote: '医药卡显示最高的单项每年限额，因为医药卡不能直接相加。',
    foot: '本比较根据您提供的保单文件、利益说明书（Benefit Illustration）及资料整理，仅供讨论参考。金额以文件所示为准，日后可能变动。本文件并非保单合约、报价或建议。所有保障须以各保险公司的条款、条件、不保事项及核保为准；如考虑任何建议计划，请详阅其产品披露单（PDS）及利益说明书。',
    replace: '考虑以新保单取代现有保单？转换不一定对您有利：您可能失去已累积的现金价值和红利、因现在的年龄而支付更高保费、面对新的等待期和不保事项，并须重新核保。在新保单获批之前，请保留现有保单。'};
  function cmpFoot(agent, L, replaceNote) {
    const t = T(), who = agent && agent.name ? t.by(esc(agent.name), agent.title ? esc(agent.title) : '', agent.phone ? esc(agent.phone) : '') : t.byDefault;
    return `<footer class="rp-foot">${replaceNote ? `<p class="rp-repl">${esc(L.replace)}</p>` : ''}<div>${who}</div><p>${esc(L.foot)}</p></footer>`;
  }
  const colName = (col, i, L) => (col.proposal ? L.proposal : L.existing) + ' ' + String.fromCharCode(65 + i);
  function buildCompare(c, ids, agent, PS, opts) {
    opts = opts || {};
    LANG = opts.lang === 'zh' ? 'zh' : 'en'; PS = localPS(PS, LANG);
    const L = CL[LANG];
    const pg = LANG === 'zh' ? 'rp-page rp-zh' : 'rp-page';
    const pols = ids.map(id => (c.policies || []).find(p => p.id === id)).filter(Boolean);
    const cols = pols.map(PS.compareCol);
    const props = cols.filter(x => x.proposal), mixed = props.length && cols.some(x => !x.proposal);
    const replaceIds = opts.replace ? cols.filter(x => !x.proposal).map(x => x.id) : [];
    const rmS = v => PS.rm(v, {short: true});
    const page2 = props.length > 0;
    const det = cmpDetails(c, pols, agent, PS, L, 0, 0, mixed, cols.length > 2 && !page2 ? 'x' : '').length;
    const pages = 1 + (page2 ? 1 : 0) + det;

    /* page 1: columns */
    const head = cols.map((x, i) => `<th class="${x.proposal ? 'pro' : 'ex'}"><i style="background:${PS.insurerColor(x.p.insurer)}"></i><em>${esc(colName(x, i, L))}</em><b>${esc(x.p.insurer || '')}</b><span>${esc(x.p.productName || '')}</span></th>`).join('');
    const numRow = (label, get, opt) => {
      opt = opt || {};
      const vals = cols.map(get);
      if (vals.every(v => v == null) && !opt.always) return '';
      const nums = vals.filter(v => typeof v === 'number');
      const max = nums.length > 1 && new Set(nums).size > 1 ? Math.max(...nums) : null;
      const anyHas = vals.some(v => v != null);
      return `<tr><th>${esc(label)}</th>${vals.map((v, i) => {
        let cls = '', html;
        if (v == null) { cls = anyHas && !opt.plain ? 'no' : 'dash'; html = anyHas && !opt.plain ? L.notIncl : '—'; }
        else if (v === 'unknown') { cls = 'unk'; html = L.notStated; }
        else if (v === 'unlimited') html = L.unlimited;
        else if (v === true) html = L.included;
        else html = (opt.fmt || rmS)(v);
        if (!opt.neutral && max != null && v === max) cls += ' hi';
        const b = vals[0];
        const delta = i > 0 && !opt.noDelta && typeof v === 'number' && typeof b === 'number' && v !== b ? `<small>${v > b ? '+' : '−'}${rmS(Math.abs(v - b))}</small>` : '';
        return `<td class="${cls.trim()}">${delta}${esc(html)}</td>`;
      }).join('')}</tr>`;
    };
    const sec = t => `<tr class="sec"><td colspan="${cols.length + 1}">${esc(t)}</td></tr>`;
    const txtRow = (label, get) => { const vals = cols.map(get); if (vals.every(v => !v)) return ''; return `<tr><th>${esc(label)}</th>${vals.map(v => `<td class="${v ? 'txt' : 'dash'}">${v ? esc(v) : '—'}</td>`).join('')}</tr>`; };
    const endTxt = e => !e ? '' : e.age ? L.age(e.age) : L.years(e.years);
    const R = L.rows;
    const body = sec(L.protection)
      + ['death', 'tpd', 'ci', 'eci', 'accident'].map(id => numRow(R[id], x => x.v[id], {always: id !== 'accident'})).join('')
      + sec(L.medical)
      + numRow(R.medical, x => x.v.medical, {always: true}) + numRow(R.medLife, x => x.medLifetime) + numRow(R.room, x => x.roomBoard, {fmt: v => PS.rm(v)}) + numRow(R.hospital, x => x.v.hospital, {fmt: v => PS.rm(v)})
      + numRow(R.waiver, x => x.waiver ? true : null, {always: true})
      + sec(L.cost)
      + txtRow(R.premium, x => x.premium != null ? PS.rm(x.premium) + ' ' + (L.freq[x.freq] || '') : '')
      + numRow(R.annual, x => x.annual, {fmt: v => PS.rm(v), neutral: true})
      + txtRow(R.pay, x => x.payYears ? L.years(x.payYears) : '')
      + txtRow(R.end, x => endTxt(x.end))
      + (cols.some(x => x.cash != null || x.bonus != null) ? sec(L.value) + numRow(R.cash, x => x.cash, {neutral: true, plain: true, noDelta: true}) + numRow(R.bonus, x => x.bonus, {neutral: true, plain: true, noDelta: true}) : '')
      + txtRow(R.riders, x => x.riders.join(', '));
    const diffAt0 = cols.length <= 2 ? 1 : 2;
    const diffs = PS.keyDiffs(cols).map((d, i) => [d, i]).sort((a, b) => (cols[b[0].col].proposal ? 1 : 0) - (cols[a[0].col].proposal ? 1 : 0) || a[1] - b[1]).map(x => x[0]).slice(0, diffAt0 === 1 ? 5 : 8);   // differences involving a proposal first
    const catName = id => id === 'medical' ? R.medical.split(' ·')[0] : id === 'waiver' ? R.waiver : R[id];
    const dTxt = d => { const n = colName(cols[d.col], d.col, L), o = colName(cols[0], 0, L), sg = v => (v > 0 ? '+' : '−') + rmS(Math.abs(v));
      if (d.kind === 'only') return L.d.only(n, catName(d.cat), d.val != null ? rmS(d.val) : '', o);
      if (d.kind === 'missing') return L.d.missing(n, catName(d.cat), d.val != null ? rmS(d.val) : '', o);
      if (d.kind === 'diff') return L.d.diff(n, catName(d.cat), rmS(d.a), rmS(d.b), sg(d.delta), o);
      if (d.kind === 'premium') return L.d.premium(n, PS.rm(d.a), PS.rm(d.b), (d.delta > 0 ? '+' : '−') + PS.rm(Math.abs(d.delta)), o);
      return L.d.term(n, d.a, d.b, o); };
    const diffBox = `<section class="rp-diff"><h3>${esc(L.diffs)}</h3>${diffs.length ? `<ul>${diffs.map(d => `<li>${esc(dTxt(d))}</li>`).join('')}</ul>` : `<p>${esc(L.noDiffs)}</p>`}<p class="rp-key">${esc(L.medNote)}</p></section>`;
    const diffAt = cols.length <= 2 ? 1 : page2 ? 2 : 3;   // 3-4 columns fill page 1, so the differences move to the next page
    const p1 = `<div class="${pg}">${header(c, agent, L.title, 1, pages)}
      <div class="rp-client small cmp"><span>${esc(L.prep)}</span><h1>${esc(c.client.name || '')}</h1><p>${esc(L.comparing(cols.length))}</p></div>
      <table class="rp-cmp n${cols.length}"><thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody></table>
      ${diffAt === 1 ? diffBox : ''}
      ${cmpFoot(agent, L, mixed)}</div>`;

    /* page 2: total cover today vs with each proposal */
    let p2 = '';
    if (page2) {
      const W = PS.coverWith(c, props.map(x => x.p), replaceIds), sets = [W.today].concat(W.withEach.map(w => w.s));
      const hd = [`<th class="ex"><em>${esc(L.today)}</em><b>${esc(L.todayB)}</b><span>${esc(L.inForce(W.today.policyCount))}</span></th>`].concat(W.withEach.map(w => {
        const i = cols.findIndex(x => x.id === w.p.id); return `<th class="pro"><em>${esc(L.withP + ' ' + colName(cols[i], i, L))}</em><b>${esc(w.p.insurer || '')}</b><span>${esc(w.p.productName || '')}</span></th>`; })).join('');
      const row = (label, get, fmt) => { const vals = sets.map(get), b = vals[0];
        return `<tr><th>${esc(label)}</th>${vals.map((v, i) => `<td>${esc((fmt || rmS)(v || 0))}${i && v !== b ? `<small class="blk">${v > b ? '+' : '−'}${(fmt || rmS)(Math.abs(v - b))}</small>` : ''}</td>`).join('')}</tr>`; };
      const gapRow = id => !W.today.gaps ? '' : `<tr class="gl"><th>${esc(L.guide(R[id] || id))}</th>${sets.map(s2 => { const g = s2.gaps.find(x => x.id === id); return `<td><span class="rp-mini"><i style="width:${g.pct}%"></i></span>${g.pct}%</td>`; }).join('')}</tr>`;
      const names = cols.filter(x => replaceIds.includes(x.id)).map(x => (x.p.insurer || '') + ' ' + (x.p.productName || '')).join(', ');
      p2 = `<div class="${pg}">${header(c, agent, L.title + ' · ' + L.p2title, 2, pages)}
        <div class="rp-client small"><span>${esc(c.client.name || '')}</span><h2>${esc(L.p2title)}</h2><p>${esc(L.p2sub)}</p></div>
        ${diffAt === 2 ? diffBox : ''}
        <table class="rp-cmp tot n${sets.length}"><thead><tr><th></th>${hd}</tr></thead><tbody>
          ${['death', 'tpd', 'ci', 'eci', 'accident'].map(id => row(R[id], s2 => s2.cats[id].total)).join('')}
          ${row(R.medical, s2 => s2.medical.annual)}${row(R.hospital, s2 => s2.cats.hospital.total, v => PS.rm(v))}
          ${row(L.prem, s2 => s2.premium.annual, v => PS.rm(v))}
          ${gapRow('death')}${gapRow('ci')}
        </tbody></table>
        <p class="rp-key">${esc(replaceIds.length ? L.replaced(names) : L.added)} ${esc(L.medNote)}</p>
        ${cmpFoot(agent, L, mixed)}</div>`;
    }
    return [p1].concat(p2 ? [p2] : [], cmpDetails(c, pols, agent, PS, L, 1 + (page2 ? 1 : 0) + 1, pages, mixed, diffAt === 3 ? diffBox : ''));
  }
  function cmpDetails(c, pols, agent, PS, L, startPage, pages, mixed, lead) {
    const out = []; let cur = [], used = lead ? 7 : 0;
    const cost = p => 3 + p.benefits.length * 1.15;
    pols.forEach(p => { if (used + cost(p) > 28 && cur.length) { out.push(cur); cur = []; used = 0; } cur.push(p); used += cost(p); });
    if (cur.length) out.push(cur);
    return out.map((group, i) => `<div class="${LANG === 'zh' ? 'rp-page rp-zh' : 'rp-page'}">${header(c, agent, L.title + ' · ' + L.details, startPage + i, pages)}
      ${i === 0 ? `<div class="rp-client small"><span>${esc(c.client.name)}</span><h2>${esc(L.details)}</h2></div>${lead && lead !== 'x' ? lead : ''}` : ''}
      ${group.map(p => policyCard(p, PS).replace('<section class="rp-pol', `<section data-role="${PS.isProposal(p) ? L.proposal : L.existing}" class="rp-pol${PS.isProposal(p) ? ' rp-prop' : ''}`)).join('')}
      ${cmpFoot(agent, L, mixed)}</div>`);
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

  root.Report = {build, toPDF, buildFollowUp, buildCompare, CL};
})(this);
