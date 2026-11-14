/* REDEFINE On Field: voice note -> follow-up letter + client farm record. Pure logic (no DOM), used by the app and test.js. */
(function (root) {
  'use strict';
  const MEETING_TYPES = [
    {id: 'fact_find', zh: '了解需求 / Open', en: 'Fact find / Open'},
    {id: 'recruitment', zh: '招募 Recruitment', en: 'Recruitment'},
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

  /* REDEFINE farm guide: shown while recording, and the AI files the answers under these keys */
  const QUESTIONS = [
    {k: 'duration', zh: '花了多久时间？', en: 'How long did it take?'},
    {k: 'done', zh: '简短总结：你做了什么？', en: 'Short summary: what did you do?'},
    {k: 'cff', zh: '他的 CFF 优先顺序和原因？', en: 'His CFF priorities and reasons?'},
    {k: 'stage', zh: '哪个阶段遇到问题？问题是什么？(Relax—Disturb—Release—Close)', en: 'Which stage had an issue, and what? (Relax–Disturb–Release–Close)'},
    {k: 'income', zh: '他的收入和现金流？', en: 'His income and cash flow?'},
    {k: 'hot', zh: '有找到 hot button 吗？', en: 'Any hot button found?'},
    {k: 'concept', zh: '你跟他讲了什么 concept？', en: 'What concept did you propose?'},
    {k: 'plan', zh: '你 release 了什么 plan 和 ANP？', en: 'What plan and ANP did you release?'},
    {k: 'objections', zh: '他有什么 objection？', en: 'What were the objections?'},
    {k: 'handling', zh: '你怎样处理 objection？', en: 'How did you handle them?'},
    {k: 'next', zh: '下一步跟他约了什么？', en: 'What next move did you arrange?'}
  ];
  const TAGS = ['O', 'F', 'P', 'R'];   // O = appointment made, F = follow up, P = presentation, R = recruitment activity
  const tagsFor = type => ({presentation: ['P'], closing: ['P'], follow_up: ['F'], recruitment: ['R']})[type] || ['O'];

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
      '- "qa" is the agent\'s private farm record. Answer each question briefly from what the agent said, in the language the agent mostly used; leave "" when not mentioned: ' + QUESTIONS.map(q => q.k + ' = ' + q.en).join('; ') + '. CFF = the client\'s financial priorities from the fact find. Plan and ANP: write exactly what the agent said (plan names, annualised premium); do not calculate.',
      '- "reportNote": 1-3 short sentences for the team\'s daily 三访 report, in the agent\'s style, e.g. "Direct approach, simple survey done, holding a company medical card, proposed income protection, will consider. Will follow up." Use the agent\'s main language (English if mixed). No IC, phone or medical details.',
      '- "tags": "O" if an appointment was made / first opening, "F" if it was a follow-up meeting, "P" if a plan/proposal was presented, "R" if it was a recruitment activity (career talk, CFG test, part-time, joining). One or more.',
      '- "time": the meeting time as HH:MM 24-hour if the agent said it, else null.',
      'Answer with JSON only:',
      '{"client":{"name":"","nickname":"","family":"","work":"","personality":"","cares":[""],"objections":[""]},' +
      '"meeting":{"type":"fact_find|recruitment|presentation|follow_up|closing|service|other","summary":"2-4 factual sentences for the agent\'s own record","nextStep":"","followUpDate":"YYYY-MM-DD or null","outcome":"closed|considering|not_interested|none"},' +
      '"letter":{"title":"","greeting":"","discussed":[""],"matters":[""],"recommendation":"","nextStep":"","closing":""},' +
      '"concepts":["concept id"],"whatsapp":"","numbers":[{"what":"","value":""}],' +
      '"qa":{' + QUESTIONS.map(q => '"' + q.k + '":""').join(',') + '},"reportNote":"","tags":["P|O|R"],"time":"HH:MM or null"}',
      'AGENT\'S NOTE:\n' + String(o.transcript || '').slice(0, 12000)
    ].join('\n');
  }

  const str = v => String(v == null ? '' : v).trim();
  const list = v => (Array.isArray(v) ? v : v ? [v] : []).map(str).filter(Boolean).slice(0, 8);
  const dateOk = v => /^\d{4}-\d{2}-\d{2}$/.test(str(v)) ? str(v) : '';
  const timeOk = v => { const t = str(v).match(/^(\d{1,2}):(\d{2})$/); return t && +t[1] < 24 && +t[2] < 60 ? t[1].padStart(2, '0') + ':' + t[2] : ''; };
  /* strip anything that looks like an IC, phone or long account number, in case the AI copies one */
  const scrub = s => str(s).replace(/\b\d{6}-?\d{2}-?\d{4}\b/g, '[removed]').replace(/(\+?6?01\d[-\s]?\d{3,4}[-\s]?\d{4})/g, '[removed]').replace(/\b\d{10,}\b/g, '[removed]');

  function normalizeDraft(raw, validIds) {
    const r = raw || {}, c = r.client || {}, m = r.meeting || {}, l = r.letter || {};
    const ids = new Set(validIds || []);
    const type = MEETING_TYPES.some(t => t.id === m.type) ? m.type : 'other';
    const qa = {}; QUESTIONS.forEach(q => { qa[q.k] = scrub(r.qa && r.qa[q.k]); });
    const tags = TAGS.filter(t => list(r.tags).map(x => x.toUpperCase()).includes(t));
    return {
      qa, reportNote: scrub(r.reportNote), tags: tags.length ? tags : tagsFor(type), time: timeOk(r.time),
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
    const m = Object.assign({id: Math.random().toString(36).slice(2, 10), date: extra.date, time: d.time || extra.time || '', concepts: d.concepts.slice(), sentPdf: !!extra.sentPdf, letterTitle: d.letter.title,
      tags: (d.tags || []).slice(), reportNote: d.reportNote || '', qa: Object.assign({}, d.qa || {})}, d.meeting);
    c.meetings.push(m);
    c.meetings.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
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
  const TARGETS = {week: 18, recruit: 6, month: 72};   // defaults; the agent can change them in Settings
  function meetingsOn(cases, date) {
    const out = [];
    (cases || []).forEach(c => { if (!c.sample) (c.meetings || []).forEach(m => { if (m.date === date) out.push({c, m}); }); });
    return out.sort((a, b) => (a.m.time || '99').localeCompare(b.m.time || '99'));
  }
  const isRecruit = m => (m.tags || []).includes('R');
  /* per day: distinct clients met, presentations, closed, recruitment visits */
  function dayStats(cases) {
    const days = {};
    (cases || []).forEach(c => { if (c.sample) return; (c.meetings || []).forEach(m => {
      const d = days[m.date] = days[m.date] || {met: 0, pres: 0, closed: 0, rec: 0, ids: {}, recIds: {}};
      if (!d.ids[c.id]) { d.ids[c.id] = 1; d.met++; }
      if (isRecruit(m) && !d.recIds[c.id]) { d.recIds[c.id] = 1; d.rec++; }
      if (m.type === 'presentation' || (m.tags || []).includes('P')) d.pres++;
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
    let met = 0, hit = 0, pres = 0, closed = 0, rec = 0;
    for (let i = 0; i <= dow; i++) { const s = days[addDays(start, i)]; if (s) { met += s.met; pres += s.pres; closed += s.closed; rec += s.rec || 0; if (s.met >= TARGET) hit++; } }
    return {start, met, hit, pres, closed, rec, daysSoFar: dow + 1};
  }
  function monthStats(days, today) {
    let met = 0, rec = 0;
    Object.keys(days).forEach(d => { if (d.slice(0, 7) === today.slice(0, 7) && d <= today) { met += days[d].met; rec += days[d].rec || 0; } });
    return {met, rec};
  }
  /* "09:00" -> "9am", "13:30" -> "1:30pm" */
  function timeLabel(t) {
    const m = String(t || '').match(/^(\d{1,2}):(\d{2})$/); if (!m) return '';
    const h = +m[1], ap = h < 12 ? 'am' : 'pm', h12 = h % 12 || 12;
    return h12 + (m[2] === '00' ? '' : ':' + m[2]) + ap;
  }
  const ORD = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  const ordinal = i => '第' + (ORD[i] || String(i + 1)) + '访';
  const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const pad2 = n => String(n).padStart(2, '0');
  /* REDEFINE 三访 report, in the team's format:
     o: {date, reportName, base, opening, items: [{name, time, tags, note}], week: {met, rec}, month: {met}, targets, reflection, tomorrow, hideNames} */
  function reportText(o) {
    const T = Object.assign({}, TARGETS, o.targets || {}), [y, mo, d] = o.date.split('-');
    const wd = WEEKDAY[new Date(o.date + 'T00:00:00Z').getUTCDay()];
    const head = (o.reportName || o.agentName || '') + (o.base ? ' (' + o.base + ')' : '');
    const lines = [];
    if (head.trim()) lines.push(head.trim());
    lines.push(o.opening == null ? '以愉快的心情与大家一起修练三访。' : o.opening);
    lines.push('', `${d}/${mo}/${y} (${wd})`, '');
    const w = o.week || {met: 0, rec: 0}, m = o.month || {met: 0};
    lines.push(`V: ${pad2(w.met)}/${pad2(T.week)}`, `R: ${pad2(w.rec || 0)}/${pad2(T.recruit)}`, `Total: ${pad2(m.met)}/${pad2(T.month)}`);
    o.items.forEach((it, i) => {
      const tags = (it.tags || []).length ? ' (' + it.tags.join(',') + ')' : '';
      const time = timeLabel(it.time);
      lines.push('', `${ordinal(i)}${time ? ' ' + time : ''}${tags}`, o.hideNames ? 'Client ' + String.fromCharCode(65 + i) : it.name);
      if (it.note) lines.push(it.note.trim());
    });
    if (!o.items.length) lines.push('', '(今天还没有记录见面)');
    if (o.reflection) lines.push('', '💡 ' + o.reflection.trim());
    if (o.tomorrow) lines.push('🎯 ' + o.tomorrow.trim());
    return lines.join('\n').trim();
  }
  /* links into the other REDEFINE apps */
  const CAL_URL = 'https://wkahjian93.github.io/redefine-calendar/', CRM_URL = 'https://remembered.dwz-rooms-server.workers.dev/';
  function calendarLink(base, o) {
    // REDEFINE Calendar opens a pre-filled New event (nothing is saved until the agent taps Add)
    const q = new URLSearchParams();
    q.set('t', ('Follow up ' + (o.name || '') + (o.nextStep ? ': ' + short(o.nextStep, 50) : '')).trim());
    if (/^\d{4}-\d{2}-\d{2}$/.test(o.followUpDate || '')) q.set('d', o.followUpDate);
    if (/^\d{2}:\d{2}$/.test(o.time || '')) q.set('s', o.time);
    if (o.nextStep) q.set('n', o.nextStep);
    return (base || CAL_URL) + '#/new?' + q.toString();
  }
  // 定联 tab of the Customer Relationship App jumps to this person (or offers to add them)
  const dinglianLink = (base, name) => (base || CRM_URL) + '#routine?find=' + encodeURIComponent(String(name || '').trim());
  const short = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

  /* one meeting -> the line under its name in the report */
  function noteFor(m) {
    if (m.reportNote) return m.reportNote;
    const bits = [m.summary && m.summary !== 'Quick log' ? m.summary : '', m.nextStep ? (/^next/i.test(m.nextStep) ? m.nextStep : 'Next: ' + m.nextStep) : ''].filter(Boolean);
    return bits.join(' ');
  }

  const api = {CAL_URL, CRM_URL, calendarLink, dinglianLink, TARGET, TARGETS, QUESTIONS, TAGS, tagsFor, meetingsOn, dayStats, streak, weekStats, monthStats, timeLabel, noteFor, reportText, addDays,
    MEETING_TYPES, LANGS, HINT, hintFor, buildPrompt, normalizeDraft, scrub, matchClient, applyToFarm, brief, typeLabel};
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FU = api;
})(this);
