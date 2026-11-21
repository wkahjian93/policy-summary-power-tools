/* REDEFINE On Field: voice note -> follow-up letter + client farm record. Pure logic (no DOM), used by the app and test.js. */
(function (root) {
  'use strict';
  const MEETING_TYPES = [
    {id: 'approach', zh: '接触 Approach', en: 'Approach'},
    {id: 'fact_find', zh: '了解需求 / Open', en: 'Open'},
    {id: 'presentation', zh: 'Proposal 讲解 Present', en: 'Present'},
    {id: 'follow_up', zh: '跟进 Follow-up', en: 'Follow-up'},
    {id: 'closing', zh: '成交 Close', en: 'Close'},
    {id: 'recruitment', zh: '招募 Recruitment', en: 'Recruitment'},
    {id: 'service', zh: '服务 / Review', en: 'Service / review'},
    {id: 'other', zh: '其他', en: 'Other'}
  ];
  /* sales activity categories (the Activities section) */
  const ACTIVITIES = [
    {id: 'approach', zh: '接触', en: 'Approach'}, {id: 'open', zh: 'Open', en: 'Open'}, {id: 'present', zh: '讲解', en: 'Present'},
    {id: 'follow_up', zh: '跟进', en: 'Follow-Up'}, {id: 'close', zh: '成交', en: 'Close'}
  ];
  function activityOf(m) {
    if (m.type === 'closing' || m.outcome === 'closed') return 'close';
    return {approach: 'approach', fact_find: 'open', presentation: 'present', follow_up: 'follow_up'}[m.type] || 'other';
  }
  /* every stage one meeting reached: the meeting's own type, plus what it led to (tags O/P/F, or a close) */
  function stagesOf(m) {
    const t = m.tags || [], s = [];
    const add = x => { if (!s.includes(x)) s.push(x); };
    if (m.type === 'approach') add('approach');
    if (m.type === 'fact_find' || (m.type === 'approach' && t.includes('O'))) add('open');
    if (m.type === 'presentation' || (t.includes('P') && ['approach', 'fact_find', 'follow_up'].includes(m.type))) add('present');
    if (m.type === 'follow_up' || (t.includes('F') && m.type !== 'closing')) add('follow_up');
    if (m.type === 'closing' || m.outcome === 'closed') add('close');
    if (!s.length) add('other');
    return s;
  }
  /* existing client (policies we manage) or prospect; older records decide by whether policies were added */
  const kindOf = c => c.kind || ((c.policies || []).length ? 'client' : 'prospect');
  /* a face-to-face 三访 visit (a WhatsApp/call follow-up is a sales activity but not a visit) */
  const isVisit = m => m.visit !== false;
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
  const tagsFor = type => ({approach: [], presentation: ['P'], closing: ['P'], follow_up: ['F'], recruitment: ['R']})[type] || ['O'];   // approach: no appointment yet (tick O when one is made)   // approach, open, service, other -> O

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
      '- meeting.type: approach = first contact with someone new (no appointment yet); fact_find = Open, an appointment/fact-find meeting; presentation = a plan was presented; follow_up = following up after a presentation; closing = the case was closed.',
      '- "visit": true if the agent met the person face to face (in person or video call), false if it was only WhatsApp, message or phone call.',
      'Answer with JSON only:',
      '{"client":{"name":"","nickname":"","family":"","work":"","personality":"","cares":[""],"objections":[""]},' +
      '"meeting":{"type":"approach|fact_find|presentation|follow_up|closing|recruitment|service|other","summary":"2-4 factual sentences for the agent\'s own record","nextStep":"","followUpDate":"YYYY-MM-DD or null","outcome":"closed|considering|not_interested|none"},' +
      '"letter":{"title":"","greeting":"","discussed":[""],"matters":[""],"recommendation":"","nextStep":"","closing":""},' +
      '"concepts":["concept id"],"whatsapp":"","numbers":[{"what":"","value":""}],' +
      '"qa":{' + QUESTIONS.map(q => '"' + q.k + '":""').join(',') + '},"reportNote":"","tags":["O|F|P|R"],"time":"HH:MM or null","visit":true}',
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
      qa, reportNote: scrub(r.reportNote), tags: tags.length ? tags : tagsFor(type), time: timeOk(r.time), visit: r.visit !== false,
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
      tags: (d.tags || []).slice(), reportNote: d.reportNote || '', qa: Object.assign({}, d.qa || {}), visit: d.visit !== false}, d.meeting);
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
  /* 三访 visits on a day (face-to-face only); allActivities: true includes WhatsApp/call follow-ups too */
  function meetingsOn(cases, date, allActivities) {
    const out = [];
    (cases || []).forEach(c => { if (!c.sample) (c.meetings || []).forEach(m => { if (m.date === date && (allActivities || isVisit(m))) out.push({c, m}); }); });
    return out.sort((a, b) => (a.m.time || '99').localeCompare(b.m.time || '99'));
  }
  /* the Activities section: who was approached / opened / presented / followed up / closed on a day */
  function activitiesOn(cases, date) {
    const g = {approach: [], open: [], present: [], follow_up: [], close: [], other: []};
    /* one meeting can reach several stages (approached and got an appointment = Approach + Open; presented and closed = Present + Close);
       each person appears once per list even if met twice that day */
    const seen = {};
    meetingsOn(cases, date, true).forEach(x => stagesOf(x.m).forEach(s => {
      const k = s + '|' + x.c.id; if (seen[k]) return; seen[k] = 1; g[s].push(x);
    }));
    return g;
  }

  /* ---------- follow-up tracker: after a presentation, 5 follow-ups on Day 1–5 ----------
     Starts from the latest presentation. Each follow-up meeting/attempt dated on or after the presentation counts.
     Leaves the list when the person closes, or the agent stops tracking. */
  const FU_STEPS = 5;
  const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 864e5);
  function followTrack(c, today) {
    const ms = (c.meetings || []).slice().sort((x, y) => ((x.date || '') + (x.time || '')).localeCompare((y.date || '') + (y.time || '')));
    let pres = null;
    ms.forEach(m => { if (m.type === 'presentation' || (m.tags || []).includes('P') && m.type !== 'closing') pres = m; });
    if (!pres) return null;
    const after = ms.slice(ms.indexOf(pres) + 1);   // ms is in date/time order
    const closed = after.find(m => m.type === 'closing' || m.outcome === 'closed') || (pres.outcome === 'closed' ? pres : null);
    const dropped = (c.fuStop && c.fuStop >= pres.date) || after.some(m => m.outcome === 'not_interested');
    const steps = after.filter(m => m.type === 'follow_up').slice(0, FU_STEPS);
    const days = Math.max(0, daysBetween(pres.date, today)), done = steps.length;
    const dueBefore = Math.min(Math.max(days - 1, 0), FU_STEPS);   // follow-ups that were due before today (today's one is still on time)
    const last = steps.length ? steps[steps.length - 1].date : pres.date;
    const sinceLast = Math.max(0, daysBetween(last, today));
    const status = closed ? 'closed' : dropped ? 'stopped' : done >= FU_STEPS ? 'done5' : 'active';
    const reasons = [];
    if (status === 'active' && done < dueBefore) reasons.push(`${dueBefore - done} follow-up${dueBefore - done > 1 ? 's' : ''} behind`);
    if ((status === 'active' || status === 'done5') && sinceLast >= 3) reasons.push(`no follow-up for ${sinceLast} days`);
    if (status === 'done5') reasons.push('5 follow-ups done, not closed yet');
    return {pres, presDate: pres.date, days, done, steps, status, sinceLast, attention: reasons.length > 0, reasons,
      slots: Array.from({length: FU_STEPS}, (_, i) => ({n: i + 1, due: addDays(pres.date, i + 1), done: steps[i] || null, late: !steps[i] && days > i + 1, today: !steps[i] && days === i + 1}))};
  }
  function followList(cases, today) {
    return (cases || []).filter(c => !c.sample).map(c => ({c, t: followTrack(c, today)}))
      .filter(x => x.t && (x.t.status === 'active' || x.t.status === 'done5'))
      .sort((a, b) => (b.t.attention - a.t.attention) || (b.t.days - a.t.days));
  }
  const isRecruit = m => (m.tags || []).includes('R');
  /* per day: distinct clients met, presentations, closed, recruitment visits */
  function dayStats(cases) {
    const days = {};
    (cases || []).forEach(c => { if (c.sample) return; (c.meetings || []).forEach(m => {
      if (!isVisit(m)) return;   // 三访 numbers count face-to-face visits only
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
    const fill = s => String(s).replace(/\{name\}/g, o.reportName || o.agentName || '').replace(/\{base\}/g, o.base || '')
      .replace(/\{date\}/g, `${d}/${mo}/${y}`).replace(/\{day\}/g, wd).replace(/\(\s*\)/g, '').replace(/[ \t]+\n/g, '\n');
    if (typeof o.headline === 'string' && o.headline.trim()) lines.push(fill(o.headline).trim());   // the agent's own headline (lines before the date)
    else {
      if (head.trim()) lines.push(head.trim());
      lines.push(o.opening == null ? '以愉快的心情与大家一起修练三访。' : o.opening);
    }
    if (typeof o.headline === 'string' && /\{date\}/.test(o.headline)) lines.push('');   // the headline already shows the date
    else lines.push('', `${d}/${mo}/${y} (${wd})`, '');
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
    if (typeof o.endLine === 'string' && o.endLine.trim()) lines.push('', fill(o.endLine).trim());   // the agent's own closing line(s)
    return lines.join('\n').trim();
  }
  /* ---------- two devices edited the same client: keep both sides' work ----------
     Meetings and policies are joined by id (deleted ones stay deleted); for anything both changed, the newer copy wins.
     Traits (cares, objections) are joined; family/work/personality take the newer non-empty value. */
  function mergeCase(a, b) {
    if (!a) return b; if (!b) return a;
    const newer = (a.updated || '') >= (b.updated || '') ? a : b, older = newer === a ? b : a;
    const out = JSON.parse(JSON.stringify(newer));
    const removed = {meetings: [], policies: []};
    for (const k of ['meetings', 'policies']) {
      removed[k] = [...new Set([...((a.removed || {})[k] || []), ...((b.removed || {})[k] || [])])];
      const gone = new Set(removed[k]), byId = new Map();
      (older[k] || []).forEach(x => { if (x && x.id && !gone.has(x.id)) byId.set(x.id, x); });
      (newer[k] || []).forEach(x => { if (x && x.id && !gone.has(x.id)) byId.set(x.id, x); });   // newer wins on the same id
      out[k] = JSON.parse(JSON.stringify([...byId.values()]));
    }
    out.meetings.sort((x, y) => ((x.date || '') + (x.time || '')).localeCompare((y.date || '') + (y.time || '')));
    out.removed = removed;
    const tn = (newer.client && newer.client.traits) || {}, to = (older.client && older.client.traits) || {};
    if (tn.family || to.family || (tn.cares || []).length || (to.cares || []).length) {
      const t = out.client.traits = Object.assign({}, to, tn);
      for (const k of ['family', 'work', 'personality']) t[k] = tn[k] || to[k] || '';
      for (const k of ['cares', 'objections']) { const seen = new Set(), all = []; [...(to[k] || []), ...(tn[k] || [])].forEach(v => { const key = String(v).toLowerCase(); if (!seen.has(key)) { seen.add(key); all.push(v); } }); t[k] = all; }
    }
    if (a.created && b.created) out.created = a.created < b.created ? a.created : b.created;
    return out;
  }
  /* remember a deleted meeting/policy so another device's copy doesn't bring it back */
  function markRemoved(c, kind, id) { c.removed = c.removed || {meetings: [], policies: []}; c.removed[kind] = c.removed[kind] || []; if (!c.removed[kind].includes(id)) c.removed[kind].push(id); }

  /* ---------- REDEFINE Prospecting: lead activity collected with the agent's link code -> quick logs ----------
     One lead = up to two quick logs on that prospect's farm (created as a 🌱 prospect if new):
       📞 called (+ 📅 appointment set)  -> Approach, not a 三访 visit; with an appointment it is tagged O and the follow-up date is the appointment
       ☕ appointment done               -> Open (了解需求), a face-to-face visit (counts for 三访)
     Ids carry the step time, so undo + redo in Prospecting gives a fresh entry (deleted ids stay deleted across devices). */
  const PROSPECTING_URL = 'https://script.google.com/macros/s/AKfycbwGwiZTn-y6gTpZFRCDbvnYoyhwM3kLfvLK6yESCvMzchR0DC0mAerWhv0wk_dhWbEF/exec';
  const myt = iso => new Date(new Date(iso).getTime() + 8 * 3600e3).toISOString();
  const stamp = iso => new Date(iso).getTime().toString(36);
  function applyProspecting(cases, items, opt) {
    const o = opt || {}, newId = o.newId || (() => Math.random().toString(36).slice(2, 10)), now = o.now || new Date().toISOString();
    let changed = 0, created = 0;
    (items || []).forEach(it => {
      const id = String(it.id || ''), name = str(it.name).slice(0, 60); if (!id || !name) return;
      const tag = it.source === 'roadshow' ? 'roadshow' : 'referral', gone = it.status === 'rejected';
      const met = (it.appt === 'pending' || it.appt === 'approved') && it.apptAt;
      const want = {};
      if (!gone && it.calledAt) {
        const plan = it.planAt ? myt(it.planAt) : '';
        want['pr_' + id + '_c' + stamp(it.calledAt)] = {type: 'approach', date: myt(it.calledAt).slice(0, 10), time: myt(it.calledAt).slice(11, 16), visit: false,
          tags: plan ? ['O'] : [], summary: '📞 Called (' + tag + ', from Prospecting)' + (plan ? ' · 📅 appointment ' + plan.slice(0, 10) + ' ' + plan.slice(11, 16) : (it.noAppt ? ' · no appointment' : '')),
          nextStep: plan ? 'Appointment ' + plan.slice(11, 16) : '', followUpDate: plan ? plan.slice(0, 10) : '', outcome: it.noAppt ? 'not_interested' : 'none'};
      }
      if (!gone && met) want['pr_' + id + '_a' + stamp(it.apptMark || it.apptAt)] = {type: 'fact_find', date: myt(it.apptAt).slice(0, 10), time: myt(it.apptAt).slice(11, 16), visit: true,
        tags: tagsFor('fact_find'), summary: '☕ Appointment done (' + tag + ', from Prospecting)', nextStep: '', followUpDate: '', outcome: 'none'};
      let c = cases.find(x => !x.sample && (x.meetings || []).some(m => String(m.id).indexOf('pr_' + id + '_') === 0)) || matchClient(cases, name);
      const keys = Object.keys(want);
      if (!c) {
        if (!keys.length) return;
        c = {id: newId(), created: now, updated: now, kind: 'prospect', client: {name, nickname: '', age: null, income: null}, guide: Object.assign({}, o.guide || {death: 10, ci: 5}), policies: [], meetings: [], from: 'prospecting'};
        cases.push(c); created++;
      }
      c.meetings = c.meetings || [];
      const removed = new Set(((c.removed || {}).meetings) || []);
      c.meetings.filter(m => String(m.id).indexOf('pr_' + id + '_') === 0 && !want[m.id]).forEach(m => { markRemoved(c, 'meetings', m.id); c.meetings = c.meetings.filter(x => x !== m); changed++; });
      keys.forEach(k => {
        if (removed.has(k)) return;   // the agent deleted it here: don't bring it back
        const w = want[k], m = c.meetings.find(x => x.id === k);
        if (!m) { c.meetings.push(Object.assign({id: k, concepts: [], sentPdf: false, letterTitle: '', reportNote: '', qa: {}, src: 'prospecting'}, w)); changed++; return; }
        ['date', 'time', 'tags', 'nextStep', 'followUpDate'].forEach(f => { if (JSON.stringify(m[f]) !== JSON.stringify(w[f])) { m[f] = w[f]; changed++; } });
      });
      c.meetings.sort((x, y) => ((x.date || '') + (x.time || '')).localeCompare((y.date || '') + (y.time || '')));
      c.updated = now;
    });
    return {changed, created};
  }

  /* ---------- after a close: the REDEFINE service checklist ---------- */
  const AFTER_CLOSE = [
    {k: 'summary', label: 'Policy summary done', hint: 'Add their policies and send the summary PDF'},
    {k: 'referral', label: 'Asked for referrals', hint: 'Log the referral page in REDEFINE Prospecting', url: 'https://wkahjian93.github.io/redefine-referrals-tracker/'},
    {k: 'nominee', label: 'Nominee form done', hint: 'Fill it in REDEFINE Form Filler', url: 'https://wkahjian93.github.io/redefine-form-filler/'},
    {k: 'econnect', label: 'e-Connect set up for the client', hint: 'Help them register and log in to Great Eastern e-Connect'}
  ];

  /* ---------- REDEFINE Calendar link: appointment from a quick log -> Calendar event; Calendar Done -> On Field visit ---------- */
  const CAL_API = 'https://script.google.com/macros/s/AKfycbxNFMDYdHCtNvvK8w99FdPaStvhqU0Lb8Zi-qmQH0XwXarXZ-3UmAu75GODSoswU80/exec';
  const NEXT_CAL_TYPE = {approach: 'present', fact_find: 'present', presentation: 'followup', follow_up: 'followup', closing: 'service', recruitment: 'recruit', service: 'service'};
  const CAL_TO_TYPE = {approach: 'approach', open: 'fact_find', present: 'presentation', followup: 'follow_up', close: 'closing', recruit: 'recruitment', service: 'service', crm: 'service', joinfield: 'follow_up'};
  /* local date + HH:MM (Malaysia time on the phone) -> the Calendar's event */
  function calEventFor(o) {
    const start = new Date(o.date + 'T' + (o.time || '10:00') + ':00');
    const type = o.calType || NEXT_CAL_TYPE[o.fromType] || 'followup';
    const verb = {present: 'Present', followup: 'Follow up', recruit: 'Recruit chat', service: 'Service'}[type] || 'Meet';
    return {title: (verb + ' ' + (o.name || '')).trim(), type, start: start.toISOString(), end: new Date(start.getTime() + 3600e3).toISOString(), allDay: false,
      place: o.place || '', notes: ((o.nextStep ? o.nextStep + ' · ' : '') + '(from REDEFINE On Field)').slice(0, 1500), vis: 'private', with: [], remind: '30'};
  }
  /* a Calendar event marked Done / Closed -> the visit to log in On Field (stable id, so several devices never log it twice) */
  function eventToMeeting(e, appt) {
    const s = new Date(e.start), pad = n => String(n).padStart(2, '0');
    const date = s.getFullYear() + '-' + pad(s.getMonth() + 1) + '-' + pad(s.getDate()), time = pad(s.getHours()) + ':' + pad(s.getMinutes());
    const closed = e.out === 'closed';
    const type = CAL_TO_TYPE[e.type] || CAL_TO_TYPE[appt && appt.calType] || 'follow_up';
    const tags = tagsFor(type).slice();
    const label = {approach: 'Approach', fact_find: 'Open', presentation: 'Presentation', follow_up: 'Follow-up', service: 'Service', recruitment: 'Recruitment'}[type] || 'Meeting';
    return {id: 'cal-' + e.id, date, time, type, outcome: closed ? 'closed' : 'none', visit: true, tags, calEventId: e.id, concepts: [], qa: {}, sentPdf: false,
      summary: label + ' done (from REDEFINE Calendar)' + (closed ? ' · closed 🎉' : ''), reportNote: label + ' done' + (closed ? ', closed.' : '.'), nextStep: '', followUpDate: ''};
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

  const api = {stagesOf, AFTER_CLOSE, calEventFor, eventToMeeting, CAL_API, ACTIVITIES, activityOf, kindOf, isVisit, activitiesOn, followTrack, followList, FU_STEPS, daysBetween, mergeCase, markRemoved, CAL_URL, CRM_URL, calendarLink, dinglianLink, TARGET, TARGETS, QUESTIONS, TAGS, tagsFor, meetingsOn, dayStats, streak, weekStats, monthStats, timeLabel, noteFor, reportText, addDays,
    MEETING_TYPES, LANGS, HINT, hintFor, buildPrompt, normalizeDraft, scrub, matchClient, applyToFarm, brief, typeLabel, applyProspecting, PROSPECTING_URL};
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FU = api;
})(this);
