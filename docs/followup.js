/* REDEFINE On Field: voice note -> follow-up letter + client farm record. Pure logic (no DOM), used by the app and test.js. */
(function (root) {
  'use strict';
  const MEETING_TYPES = [
    {id: 'fact_find', zh: '了解需求', en: 'Fact find'},
    {id: 'presentation', zh: 'Proposal 讲解', en: 'Presentation'},
    {id: 'follow_up', zh: 'Follow up', en: 'Follow-up'},
    {id: 'closing', zh: '成交', en: 'Closing'},
    {id: 'service', zh: '服务 / Review', en: 'Service / review'},
    {id: 'other', zh: '其他', en: 'Other'}
  ];
  const OUTCOMES = ['closed', 'considering', 'not_interested', 'none'];
  const LANGS = {zh: '简体中文 (Malaysian Chinese, warm, natural; English insurance terms like medical card, CI are fine)', en: 'English (Malaysian, warm, plain)', ms: 'Bahasa Melayu (mesra, mudah)'};

  /* words that help the speech model spell mixed Malaysian speech correctly */
  const HINT = 'Malaysian insurance agent voice note after meeting a client. Mixed Malaysian Mandarin, Hokkien, Cantonese, English and Malay in one sentence. ' +
    'Words: medical card, 医药卡, critical illness, CI, 危疾, TPD, 保费 premium, 保额 sum assured, ILP, investment-linked, takaful, Great Eastern, ePartner, proposal, presentation, fact find, follow up, ' +
    'income protection, 收入保障, 储蓄, 退休, 孩子, 太太, 老板, uncle, auntie, boss, lah, lor, meh, 咯, 啦, 咩, 酱, 几时, 没有钱, 考虑, Penang, KL, RM, ringgit.';

  function hintFor(clientName) { return (clientName ? 'Client: ' + clientName + '. ' : '') + HINT; }

  function buildPrompt(o) {
    // o: {transcript, lang, agentName, client (existing case or null), concepts: [{id, zh, en}], date}
    const c = o.client;
    const known = c ? JSON.stringify({
      name: c.client.name, nickname: c.client.nickname || '', traits: c.client.traits || {},
      lastMeetings: (c.meetings || []).slice(-3).map(m => ({date: m.date, type: m.type, summary: m.summary, nextStep: m.nextStep}))
    }) : 'none (new client)';
    return [
      'You help a Malaysian life-insurance agent (team REDEFINE, Great Eastern Life) after a client meeting.',
      'Below is the agent\'s spoken note, transcribed by machine. It may mix Malaysian Mandarin, Hokkien, Cantonese, English and Malay, and may have transcription mistakes. Understand dialect and slang (e.g. 咯/啦/lah, Hokkien words written in Chinese characters or romanised) and fix obvious mishearings from context.',
      'Agent: ' + (o.agentName || 'the agent') + '. Meeting date: ' + o.date + '.',
      'What the agent already knows about this client: ' + known,
      'Concept pages the agent can attach (choose at most 3 that match what was actually discussed; none if nothing fits): ' + o.concepts.map(k => k.id + ' = ' + k.zh + ' / ' + k.en).join('; '),
      'RULES:',
      '- Use only what the agent said. Never invent facts, numbers, products, benefits, promises or quotes. If something is unclear, leave it out.',
      '- PRIVACY: in "farm" and "client" never write IC numbers, phone numbers, addresses, bank details, or specific medical conditions/diagnoses/medical history. Write health concerns generally (e.g. "worried about medical costs").',
      '- The letter goes to the client. Write it in ' + LANGS[o.lang || 'zh'] + ', in the agent\'s own first-person voice: sincere, warm, professional, specific to this client, not salesy, no exaggerated claims, no guaranteed returns. Address the client the way the agent does (e.g. 陈先生, Ah Seng, Puan Aminah).',
      '- In the letter you may mention medical issues only as the client\'s concern in general words, never a diagnosis.',
      '- List EVERY number the agent mentioned (premiums, sum assured, ages, years, RM amounts, percentages) in "numbers" so the agent can double-check them.',
      '- whatsapp: a short WhatsApp message (3-6 lines) in the same language, to send together with the PDF, ending with a soft ask to meet again.',
      'Answer with JSON only:',
      '{"client":{"name":"","nickname":"","family":"","work":"","personality":"","cares":[""],"objections":[""]},' +
      '"meeting":{"type":"fact_find|presentation|follow_up|closing|service|other","summary":"2-4 factual sentences for the agent\'s own record","nextStep":"","followUpDate":"YYYY-MM-DD or null","outcome":"closed|considering|not_interested|none"},' +
      '"letter":{"title":"","greeting":"","discussed":[""],"matters":[""],"recommendation":"","nextStep":"","closing":""},' +
      '"concepts":["concept id"],"whatsapp":"","numbers":[{"what":"","value":""}]}',
      'AGENT\'S NOTE:\n' + String(o.transcript || '').slice(0, 12000)
    ].join('\n');
  }

  const str = v => String(v == null ? '' : v).trim();
  const list = v => (Array.isArray(v) ? v : v ? [v] : []).map(str).filter(Boolean).slice(0, 8);
  const dateOk = v => /^\d{4}-\d{2}-\d{2}$/.test(str(v)) ? str(v) : '';
  /* strip anything that looks like an IC, phone or long account number, in case the AI copies one */
  const scrub = s => str(s).replace(/\b\d{6}-?\d{2}-?\d{4}\b/g, '[removed]').replace(/(\+?6?01\d[-\s]?\d{3,4}[-\s]?\d{4})/g, '[removed]').replace(/\b\d{10,}\b/g, '[removed]');

  function normalizeDraft(raw, validIds) {
    const r = raw || {}, c = r.client || {}, m = r.meeting || {}, l = r.letter || {};
    const ids = new Set(validIds || []);
    return {
      client: {name: scrub(c.name), nickname: scrub(c.nickname), family: scrub(c.family), work: scrub(c.work), personality: scrub(c.personality),
        cares: list(c.cares).map(scrub), objections: list(c.objections).map(scrub)},
      meeting: {type: MEETING_TYPES.some(t => t.id === m.type) ? m.type : 'other', summary: scrub(m.summary), nextStep: scrub(m.nextStep),
        followUpDate: dateOk(m.followUpDate), outcome: OUTCOMES.includes(m.outcome) ? m.outcome : 'none'},
      letter: {title: str(l.title), greeting: str(l.greeting), discussed: list(l.discussed), matters: list(l.matters),
        recommendation: str(l.recommendation), nextStep: str(l.nextStep), closing: str(l.closing)},
      concepts: list(r.concepts).filter(id => ids.has(id)).slice(0, 3),
      whatsapp: str(r.whatsapp),
      numbers: (Array.isArray(r.numbers) ? r.numbers : []).map(n => ({what: str(n && n.what), value: str(n && n.value), ok: false})).filter(n => n.value).slice(0, 20)
    };
  }

  /* find an existing client whose name or nickname matches what the AI heard */
  const norm = s => str(s).toLowerCase().replace(/\s+/g, '').replace(/(先生|小姐|太太|女士|mr|ms|mrs|encik|puan|cik|uncle|auntie)/g, '');
  function matchClient(cases, name) {
    const n = norm(name);
    if (!n) return null;
    return cases.find(c => !c.sample && (norm(c.client.name) === n || norm(c.client.nickname) === n)) ||
      cases.find(c => !c.sample && n.length >= 2 && (norm(c.client.name).includes(n) || n.includes(norm(c.client.name)) && norm(c.client.name).length >= 2)) || null;
  }

  /* add the meeting to the client's farm record; traits only grow, never overwrite with blanks */
  function applyToFarm(c, d, extra) {
    const t = c.client.traits = c.client.traits || {family: '', work: '', personality: '', cares: [], objections: []};
    for (const k of ['family', 'work', 'personality']) if (d.client[k]) t[k] = d.client[k];
    for (const k of ['cares', 'objections']) { t[k] = t[k] || []; d.client[k].forEach(v => { if (!t[k].some(x => x.toLowerCase() === v.toLowerCase())) t[k].push(v); }); }
    if (d.client.nickname && !c.client.nickname) c.client.nickname = d.client.nickname;
    c.meetings = c.meetings || [];
    const m = Object.assign({id: Math.random().toString(36).slice(2, 10), date: extra.date, concepts: d.concepts.slice(), sentPdf: !!extra.sentPdf, letterTitle: d.letter.title}, d.meeting);
    c.meetings.push(m);
    c.meetings.sort((a, b) => a.date.localeCompare(b.date));
    c.updated = new Date().toISOString();
    return m;
  }

  /* 30-second brief before seeing the client again, built on the phone (no AI needed) */
  function brief(c, today) {
    const ms = (c.meetings || []), last = ms[ms.length - 1], t = c.client.traits || {};
    const lines = [];
    const days = last ? Math.round((new Date(today) - new Date(last.date)) / 864e5) : null;
    if (last) lines.push(`Last met ${last.date}${days != null ? ` (${days} day${days === 1 ? '' : 's'} ago)` : ''}: ${typeLabel(last.type)}. ${last.summary}`);
    else lines.push('No meetings recorded yet.');
    if (t.family || t.work) lines.push([t.family, t.work].filter(Boolean).join(' · '));
    if (t.cares && t.cares.length) lines.push('Cares about: ' + t.cares.join(', '));
    if (t.objections && t.objections.length) lines.push('Concerns raised: ' + t.objections.join(', '));
    if (last && last.nextStep) lines.push('Agreed next step: ' + last.nextStep);
    if (ms.length > 1) lines.push(`${ms.length} meetings since ${ms[0].date}.`);
    return lines;
  }
  const typeLabel = id => { const t = MEETING_TYPES.find(x => x.id === id); return t ? t.en : 'Meeting'; };

  /* ---------- 三访 daily report ---------- */
  const TARGET = 3;
  function meetingsOn(cases, date) {
    const out = [];
    (cases || []).forEach(c => { if (!c.sample) (c.meetings || []).forEach(m => { if (m.date === date) out.push({c, m}); }); });
    return out;
  }
  /* per day: distinct clients met, presentations, closed */
  function dayStats(cases) {
    const days = {};
    (cases || []).forEach(c => { if (c.sample) return; (c.meetings || []).forEach(m => {
      const d = days[m.date] = days[m.date] || {met: 0, pres: 0, closed: 0, ids: {}};
      if (!d.ids[c.id]) { d.ids[c.id] = 1; d.met++; }
      if (m.type === 'presentation') d.pres++;
      if (m.outcome === 'closed' || m.type === 'closing') d.closed++;
    }); });
    return days;
  }
  const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  /* days in a row with 3+ people met; today still counts as "in progress" so it doesn't break the streak */
  function streak(days, today) {
    let d = (days[today] && days[today].met >= TARGET) ? today : addDays(today, -1), n = 0;
    while (days[d] && days[d].met >= TARGET) { n++; d = addDays(d, -1); }
    return n;
  }
  function weekStats(days, today) {
    const dow = (new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7;   // Monday = 0
    const start = addDays(today, -dow);
    let met = 0, hit = 0, pres = 0, closed = 0;
    for (let i = 0; i <= dow; i++) { const s = days[addDays(start, i)]; if (s) { met += s.met; pres += s.pres; closed += s.closed; if (s.met >= TARGET) hit++; } }
    return {start, met, hit, pres, closed, daysSoFar: dow + 1};
  }
  const TYPE_ZH = {fact_find: '了解需求', presentation: 'Proposal 讲解', follow_up: 'Follow up', closing: '成交', service: '服务', other: '见面'};
  const short = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  function reportText(o) {
    // o: {date, agentName, items: [{name, type, nextStep, outcome, sentPdf}], reflection, tomorrow, streak, week, hideNames, lang}
    const en = o.lang === 'en', dd = o.date.slice(8, 10) + '/' + o.date.slice(5, 7);
    const met = new Set(o.items.map(i => i.key || i.name)).size;
    const lines = [(en ? '📋 3-Visit Report ' : '📋 三访报告 ') + dd + (o.agentName ? ' · ' + o.agentName : ''),
      (met >= TARGET ? '✅ ' : '⏳ ') + (en ? 'Met today: ' : '今日见面：') + met + '/' + TARGET, ''];
    o.items.forEach((it, i) => {
      const who = o.hideNames ? (en ? 'Client ' : '客户 ') + String.fromCharCode(65 + i) : it.name;
      const closed = it.outcome === 'closed' || it.type === 'closing';
      const bits = closed && it.type === 'closing' ? [] : [en ? typeLabel(it.type) : TYPE_ZH[it.type] || '见面'];
      if (closed) bits.push(en ? 'closed 🎉' : '成交 🎉');
      else {
        if (it.sentPdf) bits.push(en ? 'follow-up PDF sent' : '已 send PDF');
        if (it.nextStep) bits.push(short(it.nextStep, 32));
      }
      lines.push(`${i + 1}. ${who} — ${bits.join(en ? ', ' : '，')}`);
    });
    if (!o.items.length) lines.push(en ? '(no meetings recorded)' : '（今天没有记录见面）');
    lines.push('');
    if (o.reflection) lines.push((en ? '💡 Reflection: ' : '💡 今日反思：') + o.reflection.trim());
    if (o.tomorrow) lines.push((en ? '🎯 Tomorrow: ' : '🎯 明天目标：') + o.tomorrow.trim());
    const w = o.week;
    if (o.streak || (w && w.met)) lines.push((o.streak ? (en ? `🔥 ${o.streak} day${o.streak > 1 ? 's' : ''} in a row at 3+` : `🔥 连续 ${o.streak} 天达标`) : '') + (o.streak && w ? ' · ' : '') + (w ? (en ? `This week: ${w.met} visits` : `本周 ${w.met} 访`) : ''));
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  const api = {TARGET, meetingsOn, dayStats, streak, weekStats, reportText, addDays,
    MEETING_TYPES, LANGS, HINT, hintFor, buildPrompt, normalizeDraft, scrub, matchClient, applyToFarm, brief, typeLabel};
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FU = api;
})(this);
