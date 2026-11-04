/* Policy Summary Power Tools — pure logic (no DOM). Used by the app and by test.js.
   Recognises insurers and benefit names, cleans messy numbers, turns AI output into
   policies that need confirming, and adds up the summary. Never guesses a missing amount. */
(function (root) {
  'use strict';

  /* ---------- categories ---------- */
  const CATS = [
    {id: 'death',    label: 'Death',                 short: 'Death',     color: '#1F3A68'},
    {id: 'tpd',      label: 'Total & Permanent Disability', short: 'TPD', color: '#2F5D8A'},
    {id: 'ci',       label: 'Critical Illness',      short: 'CI',        color: '#B5452F'},
    {id: 'eci',      label: 'Early Critical Illness', short: 'Early CI', color: '#D9783B'},
    {id: 'accident', label: 'Accident',              short: 'Accident',  color: '#6B4E9B'},
    {id: 'medical',  label: 'Medical card',          short: 'Medical',   color: '#1E8A6E'},
    {id: 'hospital', label: 'Hospital income',       short: 'Hosp. income', color: '#4A9A9A'},
    {id: 'waiver',   label: 'Premium waiver',        short: 'Waiver',    color: '#7A7F8C'},
    {id: 'other',    label: 'Others',                short: 'Others',    color: '#9A8F7A'}
  ];
  const CAT_IDS = CATS.map(c => c.id);
  const catOf = id => CATS.find(c => c.id === id) || CATS[CATS.length - 1];

  /* ---------- insurers in Malaysia (names and common short forms only; no product facts) ---------- */
  const INSURERS = [
    {name: 'Great Eastern Life',        color: '#C8102E', al: ['great eastern life', 'great eastern', 'gelm', 'ge life', 'greateastern', '大东方']},
    {name: 'Great Eastern Takaful',     color: '#C8102E', al: ['great eastern takaful', 'getb', 'ge takaful']},
    {name: 'AIA',                       color: '#D31145', al: ['aia bhd', 'aia berhad', 'aia malaysia', 'aia', '友邦']},
    {name: 'AIA PUBLIC Takaful',        color: '#D31145', al: ['aia public takaful', 'aia public']},
    {name: 'Prudential',                color: '#ED1B2E', al: ['prudential assurance malaysia', 'prudential', 'pamb', 'pru', '保诚']},
    {name: 'Prudential BSN Takaful',    color: '#ED1B2E', al: ['prudential bsn takaful', 'prubsn', 'pru bsn']},
    {name: 'Allianz Life',              color: '#003781', al: ['allianz life insurance malaysia', 'allianz life', 'allianz', '安联']},
    {name: 'Manulife',                  color: '#00A758', al: ['manulife insurance', 'manulife', '宏利']},
    {name: 'Tokio Marine Life',         color: '#004C97', al: ['tokio marine life', 'tokio marine']},
    {name: 'Hong Leong Assurance',      color: '#00529B', al: ['hong leong assurance', 'hla', 'hong leong life', '丰隆']},
    {name: 'Hong Leong MSIG Takaful',   color: '#00529B', al: ['hong leong msig takaful', 'hlmt']},
    {name: 'Etiqa Life',                color: '#F5A800', al: ['etiqa life insurance', 'etiqa life', 'etiqa insurance', 'etiqa']},
    {name: 'Etiqa Family Takaful',      color: '#F5A800', al: ['etiqa family takaful', 'etiqa takaful']},
    {name: 'Zurich Life',               color: '#2167AE', al: ['zurich life insurance', 'zurich life', 'zurich insurance', 'zurich']},
    {name: 'Zurich Takaful',            color: '#2167AE', al: ['zurich takaful']},
    {name: 'Sun Life',                  color: '#E8A400', al: ['sun life malaysia', 'sun life', 'sunlife']},
    {name: 'AmMetLife',                 color: '#0090DA', al: ['ammetlife', 'am metlife', 'metlife']},
    {name: 'FWD Insurance',             color: '#E87722', al: ['fwd insurance', 'fwd life', 'fwd']},
    {name: 'FWD Takaful',               color: '#E87722', al: ['fwd takaful']},
    {name: 'Generali Life',             color: '#C21B17', al: ['generali life', 'generali', 'mpi generali']},
    {name: 'Gibraltar BSN',             color: '#1B365D', al: ['gibraltar bsn', 'gibraltar']},
    {name: 'Takaful Malaysia',          color: '#00843D', al: ['takaful malaysia', 'syarikat takaful malaysia', 'stmkb', 'takaful myself']},
    {name: 'Takaful Ikhlas',            color: '#00843D', al: ['takaful ikhlas', 'ikhlas']},
    {name: 'Sun Life Takaful',          color: '#E8A400', al: ['sun life takaful']},
    {name: 'Other insurer',             color: '#7A7F8C', al: []}
  ];
  const norm = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9一-鿿]+/g, ' ').trim();

  /* longest alias that appears as whole words wins, so "Great Eastern Takaful" beats "Great Eastern" */
  function matchInsurer(text) {
    const t = ' ' + norm(text) + ' ';
    if (!t.trim()) return null;
    let best = null, bestLen = 0;
    for (const ins of INSURERS) for (const a of ins.al) {
      const na = norm(a);
      const hit = /[一-鿿]/.test(na) ? t.includes(na) : t.includes(' ' + na + ' ');
      if (hit && na.length > bestLen) { best = ins; bestLen = na.length; }
    }
    return best;
  }
  const insurerColor = name => (INSURERS.find(i => i.name === name) || INSURERS[INSURERS.length - 1]).color;

  /* ---------- benefit names -> category (English, Malay, Chinese) ---------- */
  const RULES = [
    ['waiver',   /waiver|payor|payer|wop\b|pengecualian premium|豁免/],
    ['eci',      /early|multi(ple)?[- ]?(stage|claim)|all[- ]stage|pre[- ]?crisis|peringkat awal|早期/],
    ['hospital', /hospital (income|cash|benefit)|daily (cash|hospital|room)|hib\b|elaun harian|住院津贴|住院现金/],
    ['medical',  /medic|medical|med\b|h ?& ?s|hospital(isation)? (and|&) surgical|surgical|room (and|&) board|perubatan|hospitalisation|医药|医疗|住院/],
    ['accident', /accident|\bpa\b|personal accident|kemalangan|意外/],
    ['ci',       /critical|dread|crisis|\bci\b|cancer|penyakit kritikal|危疾|重疾|严重疾病|癌/],
    ['tpd',      /tpd|total (and|&) permanent|permanent disab|hilang upaya|残疾|全残/],
    ['death',    /death|life cover|basic (plan|sum)|sum assured|kematian|身故|死亡|寿险/]
  ];
  function classify(name, learned) {
    const n = norm(name);
    if (!n) return {cat: 'other', sure: false};
    if (learned && learned[n]) return {cat: learned[n], sure: true, learned: true};
    for (const [cat, re] of RULES) if (re.test(n)) return {cat, sure: !(cat === 'death' && /sum assured|basic/.test(n))};
    return {cat: 'other', sure: false};
  }

  /* ---------- numbers ---------- */
  /* "RM 150,000.00" -> 150000, "150k" -> 150000, "1.5 mil" -> 1500000, "Unlimited"/"No limit" -> unlimited.
     Anything unreadable returns value null so it is never counted as zero. */
  function parseAmount(v) {
    if (v == null || v === '') return {value: null};
    if (typeof v === 'number') return isFinite(v) && v >= 0 ? {value: v} : {value: null};
    const s = String(v).toLowerCase().trim();
    if (/unlimited|no limit|tiada had|tanpa had|无限|as charged|as[- ]?charged/.test(s)) return {value: null, unlimited: true};
    if (/^(n\/?a|nil|none|-+|tiada|not (stated|shown|available))$/.test(s)) return {value: null, none: true};
    const m = s.replace(/rm|myr|ringgit|\s/g, '').replace(/,/g, '').match(/^(\d+(?:\.\d+)?)(k|m|mil|million|juta)?$/);
    if (!m) return {value: null};
    let n = parseFloat(m[1]);
    if (m[2] === 'k') n *= 1e3; else if (m[2]) n *= 1e6;
    return {value: Math.round(n * 100) / 100};
  }
  const FREQ = {monthly: 12, quarterly: 4, 'half-yearly': 2, yearly: 1, single: 0};
  function parseFreq(s) {
    const t = norm(s);
    if (/month|bulan|月/.test(t)) return 'monthly';
    if (/quarter|suku|季/.test(t)) return 'quarterly';
    if (/half|semi|setengah|半年/.test(t)) return 'half-yearly';
    if (/single|lump|sekaligus|趸/.test(t)) return 'single';
    if (/year|annual|tahun|年/.test(t)) return 'yearly';
    return '';
  }
  const annualPremium = p => {
    const v = p.premium, f = FREQ[p.premiumFreq];
    return v == null || f == null ? null : v * f;
  };
  /* last 4 characters only; IC numbers are never kept */
  function maskPolicyNo(s) {
    const t = String(s || '').replace(/[^A-Za-z0-9]/g, '');
    if (!t) return '';
    if (/^\d{12}$/.test(t)) return ''; // looks like a MyKad number, drop it
    return t.length <= 4 ? t : '••••' + t.slice(-4);
  }

  /* ---------- AI ---------- */
  function aiPrompt(learned) {
    const names = INSURERS.filter(i => i.al.length).map(i => i.name).join('; ');
    const taught = Object.entries(learned || {}).slice(0, 80).map(([k, v]) => k + ' => ' + v).join('; ');
    return [
      'You read Malaysian life insurance / takaful documents for an insurance agent preparing a policy summary for their client.',
      'The images may be policy schedules, contract pages, benefit illustrations, annual statements, or screenshots of an insurer customer portal or app, in English, Malay or Chinese. They may be blurred, cropped or rotated.',
      'Extract every policy you can see. One image can show several policies (a portal list); several images can be pages of one policy (combine them).',
      'RULES: Copy only what is printed. Never estimate, calculate or fill in a value that is not visible: use null. Amounts are numbers in RM without commas. Do not output any identity card (MyKad/NRIC) number, address, phone or bank details. For policy numbers output only the last 4 characters.',
      'List every benefit / rider separately using the exact name printed. Give each a category: death, tpd, ci (critical illness / late stage), eci (early stage or multi-stage CI), accident, medical (medical card / hospital & surgical), hospital (daily hospital income), waiver, other.',
      'For medical: annualLimit, lifetimeLimit (set lifetimeUnlimited true if it says no lifetime limit/unlimited), roomBoard (per day), deductible.',
      'Set "sure": false on any benefit where the amount or category is hard to read or you are unsure. Put the names of unclear policy fields in "unclear".',
      'Insurers you may see: ' + names + '.',
      taught ? 'The agent has confirmed these benefit name categories before: ' + taught + '.' : '',
      'Answer with JSON only, in this shape:',
      '{"pageKind":"schedule|illustration|statement|portal|other","policies":[{"insurer":"","productName":"","policyNoLast4":"","lifeAssured":"","planType":"traditional|investment-linked|takaful|medical|term|other","status":"inforce|lapsed|surrendered|matured|unknown","startDate":"YYYY-MM-DD or null","premium":null,"premiumFrequency":"monthly|quarterly|half-yearly|yearly|single|null","cashValue":null,"cashValueDate":"YYYY-MM-DD or null","bonus":null,"benefits":[{"name":"","category":"","amount":null,"untilAge":null,"annualLimit":null,"lifetimeLimit":null,"lifetimeUnlimited":false,"roomBoard":null,"deductible":null,"sure":true}],"unclear":[]}],"notes":""}'
    ].filter(Boolean).join('\n');
  }

  const uid = () => Math.random().toString(36).slice(2, 10);
  const num = v => parseAmount(v).value;
  const cleanDate = s => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? String(s) : '');

  /* AI JSON -> policies the agent must check. A benefit is flagged when the AI was unsure,
     the amount is missing, or the app's own reading of the name disagrees with the AI. */
  function fromAI(raw, learned) {
    const list = raw && Array.isArray(raw.policies) ? raw.policies : [];
    return list.map(p => {
      const ins = matchInsurer(p.insurer) || matchInsurer(p.productName);
      const unclear = new Set((p.unclear || []).map(String));
      const pol = {
        id: uid(), source: 'photo',
        insurer: ins ? ins.name : (p.insurer ? 'Other insurer' : ''),
        insurerRaw: p.insurer || '',
        productName: String(p.productName || '').trim(),
        policyNo: maskPolicyNo(p.policyNoLast4),
        lifeAssured: String(p.lifeAssured || '').trim(),
        planType: p.planType || 'other',
        status: ['inforce', 'lapsed', 'surrendered', 'matured'].includes(p.status) ? p.status : 'unknown',
        startDate: cleanDate(p.startDate),
        premium: num(p.premium), premiumFreq: parseFreq(p.premiumFrequency),
        cashValue: num(p.cashValue), cashValueDate: cleanDate(p.cashValueDate),
        bonus: num(p.bonus),
        benefits: [], checks: {}
      };
      if (!ins) pol.checks.insurer = 'Insurer not recognised: please pick it';
      if (pol.status === 'unknown') pol.checks.status = 'Is this policy in force?';
      if (pol.premium == null || !pol.premiumFreq) pol.checks.premium = 'Premium or frequency not clear';
      for (const f of unclear) if (['insurer', 'productName', 'premium', 'cashValue', 'bonus', 'status', 'startDate'].includes(f)) pol.checks[f] = pol.checks[f] || 'Hard to read on the photo';
      /* "Death / TPD" pays once for either event: show it under both, like a manual summary does */
      const bens = [];
      (p.benefits || []).forEach(b => {
        const n = norm(b.name);
        if (/death|kematian|身故/.test(n) && /tpd|total (and|&) permanent|hilang upaya|残疾/.test(n) && !/accident|kemalangan|意外/.test(n)) {
          bens.push(Object.assign({}, b, {category: 'death', name: b.name + ' (death)', either: true}));
          bens.push(Object.assign({}, b, {category: 'tpd', name: b.name + ' (TPD)', either: true}));
        } else bens.push(b);
      });
      bens.forEach(b => {
        const mine = classify(b.name, learned);
        const aiCat = CAT_IDS.includes(b.category) ? b.category : null;
        const cat = mine.learned ? mine.cat : (aiCat || mine.cat);
        const amt = parseAmount(b.amount), life = parseAmount(b.lifetimeLimit);
        const ben = {
          id: uid(), name: String(b.name || '').trim() || 'Unnamed benefit', cat,
          amount: amt.value, untilAge: num(b.untilAge),
          annual: num(b.annualLimit), lifetime: life.value,
          lifetimeUnlimited: !!(b.lifetimeUnlimited || life.unlimited),
          roomBoard: num(b.roomBoard), deductible: num(b.deductible)
        };
        if (b.either) ben.note = 'Paid once, on death or TPD';
        const why = [];
        if (b.sure === false) why.push('AI was not sure');
        if (!b.either && !mine.learned && aiCat &&mine.cat !== 'other' && mine.cat !== aiCat) why.push('Category unclear (' + catOf(aiCat).short + ' or ' + catOf(mine.cat).short + '?)');
        if (cat === 'medical') { if (ben.annual == null && ben.amount == null) why.push('Annual limit not found'); }
        else if (cat !== 'waiver' && ben.amount == null) why.push('Amount not found');
        if (why.length) ben.check = why.join('; ');
        pol.benefits.push(ben);
      });
      if (!pol.benefits.length) pol.checks.benefits = 'No benefits found: add them or retake the photo';
      return pol;
    });
  }

  function blankPolicy() {
    return {id: uid(), source: 'manual', insurer: '', insurerRaw: '', productName: '', policyNo: '', lifeAssured: '', planType: 'traditional',
      status: 'inforce', startDate: '', premium: null, premiumFreq: 'monthly', cashValue: null, cashValueDate: '', bonus: null,
      benefits: [blankBenefit('death')], checks: {}};
  }
  const blankBenefit = cat => ({id: uid(), name: '', cat: cat || 'death', amount: null, untilAge: null, annual: null, lifetime: null, lifetimeUnlimited: false, roomBoard: null, deductible: null});

  /* everything still waiting for the agent */
  function pendingChecks(c) {
    const out = [];
    (c.policies || []).forEach(p => {
      Object.entries(p.checks || {}).forEach(([f, why]) => out.push({policyId: p.id, field: f, why}));
      p.benefits.forEach(b => { if (b.check) out.push({policyId: p.id, benefitId: b.id, why: b.check}); });
    });
    return out;
  }

  /* ---------- the summary ---------- */
  const counts = p => p.status === 'inforce' || p.status === 'unknown';
  function summarise(c) {
    const pols = (c.policies || []).filter(counts);
    const t = {};
    for (const id of CAT_IDS) t[id] = {total: 0, missing: 0, policies: new Set(), maxAge: null, items: []};
    let cash = 0, cashN = 0, bonus = 0, bonusN = 0, prem = 0, premMissing = 0;
    const medical = [];
    pols.forEach(p => {
      p.benefits.forEach(b => {
        const T = t[b.cat] || t.other;
        T.policies.add(p.id); T.items.push({policy: p, benefit: b});
        if (b.untilAge != null) T.maxAge = Math.max(T.maxAge || 0, b.untilAge);
        if (b.cat === 'medical') { medical.push({policy: p, b}); return; }
        if (b.cat === 'waiver') return;
        if (b.amount == null) T.missing++; else T.total += b.amount;
      });
      if (p.cashValue != null) { cash += p.cashValue; cashN++; }
      if (p.bonus != null) { bonus += p.bonus; bonusN++; }
      const a = annualPremium(p); if (a == null) premMissing++; else prem += a;
    });
    const best = (k) => medical.reduce((m, x) => (x.b[k] != null && (m == null || x.b[k] > m) ? x.b[k] : m), null);
    const med = {
      plans: medical.length,
      annual: best('annual') != null ? best('annual') : best('amount'),
      lifetimeUnlimited: medical.some(x => x.b.lifetimeUnlimited),
      lifetime: best('lifetime'),
      roomBoard: best('roomBoard'),
      maxAge: t.medical.maxAge
    };
    const out = {cats: {}, medical: med, cash: {total: cash, n: cashN}, bonus: {total: bonus, n: bonusN},
      premium: {annual: prem, missing: premMissing}, policyCount: pols.length,
      excluded: (c.policies || []).length - pols.length,
      insurers: [...new Set(pols.map(p => p.insurer).filter(Boolean))]};
    for (const id of CAT_IDS) out.cats[id] = {total: t[id].total, missing: t[id].missing, policies: t[id].policies.size, maxAge: t[id].maxAge, items: t[id].items, drop: firstDrop(t[id].items, c.client && c.client.age)};
    /* guideline comparison only when the client's income is given */
    const inc = c.client && c.client.income;
    const g = c.guide || {death: 10, ci: 5};
    if (inc > 0) {
      out.gaps = [
        {id: 'death', label: 'Death', have: out.cats.death.total, need: inc * g.death, x: g.death},
        {id: 'tpd', label: 'TPD', have: out.cats.tpd.total, need: inc * g.death, x: g.death},
        {id: 'ci', label: 'Critical Illness', have: out.cats.ci.total, need: inc * g.ci, x: g.ci}
      ].map(r => Object.assign(r, {pct: r.need ? Math.min(100, Math.round(r.have / r.need * 100)) : 0, short: Math.max(0, r.need - r.have)}));
    }
    return out;
  }

  /* the first age (after today) at which some cover in this category ends, and what is left after it.
     Only benefits with a stated end age can drop; ones without an end age are assumed to continue. */
  function firstDrop(items, age) {
    const ends = items.filter(x => x.benefit.untilAge != null && x.benefit.amount != null && (age == null || x.benefit.untilAge > age))
      .map(x => x.benefit.untilAge);
    if (!ends.length) return null;
    const at = Math.min(...ends);
    const left = items.reduce((s, x) => s + (x.benefit.amount != null && (x.benefit.untilAge == null || x.benefit.untilAge > at) ? x.benefit.amount : 0), 0);
    const before = items.reduce((s, x) => s + (x.benefit.amount || 0), 0);
    return left < before ? {age: at, left} : null;
  }

  /* row of the comparison table for one policy */
  function policyRow(p) {
    const r = {};
    for (const id of CAT_IDS) r[id] = {total: 0, missing: false, has: false};
    p.benefits.forEach(b => {
      const x = r[b.cat] || r.other; x.has = true;
      const v = b.cat === 'medical' ? (b.annual != null ? b.annual : b.amount) : b.amount;
      if (b.cat === 'waiver') return;
      if (v == null) x.missing = true; else if (b.cat === 'medical') x.total = Math.max(x.total, v); else x.total += v;
    });
    return r;
  }

  /* ---------- formatting ---------- */
  function rm(v, opts) {
    opts = opts || {};
    if (v == null) return opts.dash || '—';
    if (opts.short && v >= 1e6) return 'RM' + (v / 1e6).toFixed(v % 1e6 ? 2 : 0).replace(/\.?0+$/, '') + 'm';
    if (opts.short && v >= 1e4) return 'RM' + (v / 1e3).toFixed(v % 1e3 ? 1 : 0).replace(/\.0$/, '') + 'k';
    return 'RM' + v.toLocaleString('en-MY', {minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2});
  }
  function learnKey(name) { return norm(name); }

  const API = {CATS, CAT_IDS, catOf, INSURERS, matchInsurer, insurerColor, classify, parseAmount, parseFreq, FREQ, annualPremium,
    maskPolicyNo, aiPrompt, fromAI, blankPolicy, blankBenefit, pendingChecks, summarise, policyRow, rm, norm, learnKey, uid};
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.PS = API;
})(this);
