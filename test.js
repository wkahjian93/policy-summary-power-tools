// node test.js — checks recognition, messy-number handling, "never guess" rules and the summary maths.
const PS = require('./docs/logic.js');
const sampleCase = require('./docs/demo.js');
let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (ok ? '' : `\n         got ${JSON.stringify(got)}\n         want ${JSON.stringify(want)}`));
};

console.log('Insurer recognition');
const ins = s => (PS.matchInsurer(s) || {name: null}).name;
eq('GE Life full legal name', ins('GREAT EASTERN LIFE ASSURANCE (MALAYSIA) BERHAD'), 'Great Eastern Life');
eq('GE Takaful beats GE', ins('Great Eastern Takaful Berhad'), 'Great Eastern Takaful');
eq('Prudential BSN Takaful', ins('PRUDENTIAL BSN TAKAFUL BERHAD'), 'Prudential BSN Takaful');
eq('Prudential short form', ins('PAMB'), 'Prudential');
eq('AIA Bhd.', ins('AIA Bhd.'), 'AIA');
eq('AIA PUBLIC Takaful', ins('AIA PUBLIC Takaful Bhd'), 'AIA PUBLIC Takaful');
eq('Allianz Life', ins('Allianz Life Insurance Malaysia Berhad'), 'Allianz Life');
eq('HLA', ins('HLA'), 'Hong Leong Assurance');
eq('Chinese name 大东方', ins('大东方人寿'), 'Great Eastern Life');
eq('unknown insurer is not guessed', ins('XYZ Assurance Bhd'), null);
eq('"pru" inside a word is not matched', ins('Prudent Savings Co'), null);

console.log('Benefit names -> category');
const cat = s => PS.classify(s).cat;
eq('Critical Illness Rider', cat('Critical Illness Rider'), 'ci');
eq('Early stage CI', cat('Early Stage Critical Illness'), 'eci');
eq('Late stage stays CI', cat('Late Stage Critical Illness'), 'ci');
eq('Malay Penyakit Kritikal', cat('Manfaat Penyakit Kritikal'), 'ci');
eq('Chinese 危疾', cat('危疾保障'), 'ci');
eq('Hospital & Surgical', cat('Hospital & Surgical Rider'), 'medical');
eq('Medical card (Malay)', cat('Kad Perubatan'), 'medical');
eq('Hospital income', cat('Hospital Income Benefit'), 'hospital');
eq('Accidental death -> accident', cat('Accidental Death Benefit'), 'accident');
eq('Payor waiver', cat('Payor Waiver of Premium'), 'waiver');
eq('TPD', cat('Total and Permanent Disability'), 'tpd');
eq('Kematian', cat('Manfaat Kematian'), 'death');
eq('unknown name -> other, not sure', PS.classify('Funeral expenses').sure, false);
eq('learned name wins', PS.classify('Smart Shield', {'smart shield': 'ci'}).cat, 'ci');

console.log('Messy numbers');
const amt = s => PS.parseAmount(s);
eq('RM 150,000.00', amt('RM 150,000.00').value, 150000);
eq('150k', amt('150k').value, 150000);
eq('1.5 mil', amt('1.5 mil').value, 1500000);
eq('RM2 juta', amt('RM2 juta').value, 2000000);
eq('Unlimited -> unlimited, no number', amt('Unlimited'), {value: null, unlimited: true});
eq('Tiada had', amt('Tiada had').unlimited, true);
eq('"N/A" -> none', amt('N/A'), {value: null, none: true});
eq('blurred "15O,0OO" -> not read, not zero', amt('15O,0OO').value, null);
eq('negative -> not read', amt(-5).value, null);
eq('monthly freq (Malay)', PS.parseFreq('Bulanan'), 'monthly');
eq('policy no -> last 4', PS.maskPolicyNo('0123-456-7890'), '••••7890');
eq('IC number dropped', PS.maskPolicyNo('900101-07-1234'), '');

console.log('Photo reading result (messy portal screenshot)');
const raw = {pageKind: 'portal', policies: [
  {insurer: 'GREAT EASTERN LIFE ASSURANCE (MALAYSIA) BERHAD', productName: 'Smart Protect', policyNoLast4: 'X1234567', status: 'inforce', premium: 'RM 350.00', premiumFrequency: 'Monthly',
    cashValue: '18,420', benefits: [
      {name: 'Death/TPD', category: 'death', amount: 'RM300,000', sure: true},
      {name: 'Critical Illness', category: 'ci', amount: null, sure: true},
      {name: 'Smart Medic Rider', category: 'medical', annualLimit: '1.5m', lifetimeLimit: 'No limit', roomBoard: '250', sure: true},
      {name: 'Hospital Income', category: 'death', amount: '100', sure: false}
    ], unclear: ['bonus']},
  {insurer: 'Some New Insurer', productName: 'Plan A', status: 'whatever', premium: null, benefits: []}
]};
const got = PS.fromAI(raw);
const p0 = got[0], p1 = got[1];
eq('2 policies found', got.length, 2);
eq('insurer recognised', p0.insurer, 'Great Eastern Life');
eq('policy no masked', p0.policyNo, '••••4567');
eq('premium cleaned', [p0.premium, p0.premiumFreq], [350, 'monthly']);
eq('Death/TPD split into two', p0.benefits.slice(0, 2).map(b => [b.cat, b.amount]), [['death', 300000], ['tpd', 300000]]);
eq('missing CI amount kept empty + flagged', [p0.benefits[2].amount, !!p0.benefits[2].check], [null, true]);
eq('medical limits read, lifetime unlimited', [p0.benefits[3].annual, p0.benefits[3].lifetimeUnlimited, p0.benefits[3].roomBoard], [1500000, true, 250]);
eq('AI category disagreement flagged', /Category unclear/.test(p0.benefits[4].check || ''), true);
eq('unclear bonus flagged', !!p0.checks.bonus, true);
eq('unknown insurer -> must pick', [p1.insurer, !!p1.checks.insurer], ['Other insurer', true]);
eq('odd status -> must confirm', [p1.status, !!p1.checks.status], ['unknown', true]);
eq('no benefits -> flagged', !!p1.checks.benefits, true);
eq('checks counted', PS.pendingChecks({policies: got}).length >= 7, true);

console.log('Joining parts of a policy read in different batches');
{
  const part1 = PS.fromAI({policies: [{insurer: 'Great Eastern Life', productName: 'Plan X', policyNoLast4: '1234', status: 'inforce', premium: 300, premiumFrequency: 'monthly',
    benefits: [{name: 'Death Benefit', category: 'death', amount: 200000}, {name: 'Critical Illness', category: 'ci', amount: null}]}]})[0];
  const part2 = PS.fromAI({policies: [{insurer: 'GREAT EASTERN LIFE ASSURANCE (MALAYSIA) BERHAD', productName: 'PLAN X', policyNoLast4: '', status: 'unknown', cashValue: 12000,
    benefits: [{name: 'Critical Illness', category: 'ci', amount: 80000}, {name: 'Medical Rider', category: 'medical', annualLimit: 1000000}]}]})[0];
  const other = PS.fromAI({policies: [{insurer: 'AIA', productName: 'Plan X', policyNoLast4: '1234', status: 'inforce', premium: 100, premiumFrequency: 'monthly',
    benefits: [{name: 'Death Benefit', category: 'death', amount: 50000}]}]})[0];
  const diffNo = PS.fromAI({policies: [{insurer: 'Great Eastern Life', productName: 'Plan X', policyNoLast4: '9999', status: 'inforce', premium: 50, premiumFrequency: 'monthly',
    benefits: [{name: 'Death Benefit', category: 'death', amount: 10000}]}]})[0];
  const m = PS.mergePolicies([part1, other, part2, diffNo]);
  const ge = m.find(p => p.policyNo === '••••1234' && p.insurer === 'Great Eastern Life');
  eq('3 policies left (GE 1234 joined; AIA and GE 9999 kept apart)', m.length, 3);
  eq('cash value filled from 2nd part', ge.cashValue, 12000);
  eq('CI amount filled and its flag cleared', [ge.benefits.find(b => b.cat === 'ci').amount, !!ge.benefits.find(b => b.cat === 'ci').check], [80000, false]);
  eq('medical rider added, no duplicate death', [ge.benefits.filter(b => b.cat === 'medical').length, ge.benefits.filter(b => b.cat === 'death').length], [1, 1]);
  eq('status kept as in force', ge.status, 'inforce');
  eq('different insurer, same number: not joined', m.some(p => p.insurer === 'AIA'), true);
}

console.log('On Field: voice note -> draft -> farm');
{
  const FU = require('./docs/followup.js'), K = require('./docs/concepts.js');
  const ids = K.CONCEPTS.map(k => k.id);
  eq('13 concepts, unique ids', [ids.length, new Set(ids).size], [13, 13]);
  const p = FU.buildPrompt({transcript: '今天见陈先生 lah, 他担心 medical card 不够', lang: 'zh', agentName: 'Ali', client: null, concepts: K.CONCEPTS, date: '2026-11-13'});
  eq('prompt names all 5 languages', ['Mandarin', 'Hokkien', 'Cantonese', 'English', 'Malay'].every(w => p.includes(w)), true);
  eq('speech hint covers dialect particles', ['lah', '咯', 'medical card', 'TPD'].every(w => FU.HINT.includes(w)), true);
  const d = FU.normalizeDraft({client: {name: '陈先生', family: '太太和两个孩子', cares: ['medical cost', 'Medical cost'], objections: ['premium high']},
    meeting: {type: 'presentation', summary: 'Showed plan. His IC 900101-07-1234, phone 012-345 6789.', nextStep: 'Call Friday', followUpDate: '2026-11-20', outcome: 'considering'},
    letter: {title: '今天谈的事', discussed: ['A', 'B']}, concepts: ['tree', 'made-up', 'umbrella'], whatsapp: 'Hi', numbers: [{what: 'premium', value: 'RM250/month'}]}, ids);
  eq('IC and phone scrubbed from farm summary', /900101|345 6789/.test(d.meeting.summary), false);
  eq('unknown concept ids dropped', d.concepts, ['tree', 'umbrella']);
  eq('numbers listed for checking, unchecked', d.numbers, [{what: 'premium', value: 'RM250/month', ok: false}]);
  eq('bad meeting type -> other', FU.normalizeDraft({meeting: {type: 'party'}}, ids).meeting.type, 'other');
  const c = {id: 'c1', client: {name: '陈先生'}, policies: []};
  FU.applyToFarm(c, d, {date: '2026-11-13'});
  FU.applyToFarm(c, FU.normalizeDraft({client: {cares: ['MEDICAL COST', 'kids education']}, meeting: {type: 'follow_up', summary: 'Second chat'}}, ids), {date: '2026-11-20'});
  eq('2 meetings in date order', c.meetings.map(m => m.date), ['2026-11-13', '2026-11-20']);
  eq('cares merged without duplicates', c.client.traits.cares, ['medical cost', 'kids education']);
  eq('family kept when later note is blank', c.client.traits.family, '太太和两个孩子');
  eq('match by name ignoring 先生/spaces', FU.matchClient([c], '陈 先生') === c, true);
  eq('no match for a different client', FU.matchClient([c], 'Ah Seng'), null);
  const b = FU.brief(c, '2026-11-27');
  eq('brief starts with last meeting and days ago', /^Last met 2026-11-20 \(7 days ago\)/.test(b[0]), true);
}

console.log('三访 report');
{
  const FU = require('./docs/followup.js');
  const mk = (id, name, ms) => ({id, client: {name}, policies: [], meetings: ms.map(([date, type, outcome, nextStep, sentPdf]) => ({date, type, outcome: outcome || 'none', nextStep: nextStep || '', sentPdf: !!sentPdf}))});
  const cases = [
    mk('a', '陈先生', [['2026-11-12', 'fact_find'], ['2026-11-13', 'presentation', 'considering', '下星期五 call', true]]),
    mk('b', 'Ah Seng', [['2026-11-12', 'fact_find'], ['2026-11-13', 'fact_find', 'none', '下次谈 medical']]),
    mk('c', '李太太', [['2026-11-12', 'follow_up'], ['2026-11-13', 'closing', 'closed']]),
    mk('d', 'Kumar', [['2026-11-11', 'fact_find'], ['2026-11-11', 'follow_up']]),
    Object.assign(mk('s', 'Sample', [['2026-11-13', 'fact_find']]), {sample: true})
  ];
  const days = FU.dayStats(cases);
  eq('13 Nov: 3 people, 1 presentation, 1 closed (sample ignored)', [days['2026-11-13'].met, days['2026-11-13'].pres, days['2026-11-13'].closed], [3, 1, 1]);
  eq('same client twice in a day counts once', days['2026-11-11'].met, 1);
  eq('streak: 12 and 13 Nov at 3+ = 2 days', FU.streak(days, '2026-11-13'), 2);
  eq('streak not broken while today is still in progress', FU.streak(days, '2026-11-14'), 2);
  const w = FU.weekStats(days, '2026-11-13');   // Fri; week starts Mon 9 Nov
  eq('week from Monday: 7 visits, 2 days at 3+', [w.start, w.met, w.hit], ['2026-11-09', 7, 2]);
  eq('recruit visits counted per day', FU.dayStats([{id: 'x', client: {name: 'x'}, meetings: [{date: '2026-11-13', type: 'fact_find', tags: ['O', 'R']}]}])['2026-11-13'].rec, 1);
  eq('time labels', ['09:00', '13:30', '12:00', '00:15'].map(FU.timeLabel), ['9am', '1:30pm', '12pm', '12:15am']);
  /* the team's own example report, rebuilt from data */
  const rex = [
    ['09:00', ['P'], 'Ms Koay', 'Direct approach, simple survey done got holding one P company medical card, proposed GCCR for her and claimed will consider. Will follow up.'],
    ['10:00', ['P'], 'Ah Ming', 'Direct approach, holding p company medical card also, proposed him GCCR. Will consider and follow up again.'],
    ['11:00', ['O', 'R'], 'Jia Yi', 'Direct approach, just graduated from secondary school but started working already have a strong push factor she don’t want 靠家里人。 Add contact and will send CFG test for her.'],
    ['12:00', ['O', 'R'], 'Tong Xuan', 'Direct approach, Jia Yi is her friend, have same thought also. Added contact and will send CFG test for her.'],
    ['13:00', ['O'], 'Ajax', 'Direct approach, he subscribed a financial app called kaotim? And he bought something like PA. Open him for review and do CFF.'],
    ['14:00', ['O'], 'Sim Guo Liang', 'Direct approach, open for present income protection and will meet up at KL next month.']
  ].map(([time, tags, name, note]) => ({time, tags, name, note}));
  const want = `Rex👑 (SG Farlim)
以愉快的心情与大家一起修练三访。

13/11/2026 (Friday)

V: 06/18
R: 03/06
Total: 24/18

第一访 9am (P)
Ms Koay
${rex[0].note}

第二访 10am (P)
Ah Ming
${rex[1].note}

第三访 11am (O,R)
Jia Yi
${rex[2].note}

第四访 12pm (O,R)
Tong Xuan
${rex[3].note}

第五访 1pm (O)
Ajax
${rex[4].note}

第六访 2pm (O)
Sim Guo Liang
${rex[5].note}`;
  const got = FU.reportText({date: '2026-11-13', reportName: 'Rex👑', base: 'SG Farlim', items: rex, week: {met: 6, rec: 3}, month: {met: 24}, targets: {week: 18, recruit: 6, month: 18}});
  eq('report matches the team format exactly', got, want);
  eq('hide names uses Client A, B…', /\nClient A\n/.test(FU.reportText({date: '2026-11-13', items: rex, hideNames: true})) && !/Ms Koay/.test(FU.reportText({date: '2026-11-13', items: rex, hideNames: true})), true);
  eq('default targets 18 / 6 / 72', FU.reportText({date: '2026-11-13', items: [], week: {met: 2, rec: 0}, month: {met: 9}}).split('\n').slice(4, 7), ['V: 02/18', 'R: 00/06', 'Total: 09/72']);
  eq('11 guide questions in the AI instructions', FU.QUESTIONS.length === 11 && FU.QUESTIONS.every(q => FU.buildPrompt({transcript: 'x', concepts: [], date: '2026-11-13'}).includes(q.k + ' = ')), true);
  const dq = FU.normalizeDraft({meeting: {type: 'fact_find'}, qa: {duration: '45 min', plan: 'Income protection, ANP RM4,200', next: 'Meet KL next month', made: 'x'}, tags: ['o', 'r', 'Z'], time: '9:05', reportNote: 'Direct approach. IC 900101-07-1234'}, []);
  eq('qa answers kept, unknown keys dropped', [dq.qa.duration, dq.qa.plan, dq.qa.cff, 'made' in dq.qa], ['45 min', 'Income protection, ANP RM4,200', '', false]);
  eq('tags cleaned, time padded, IC scrubbed from report note', [dq.tags, dq.time, /900101/.test(dq.reportNote)], [['O', 'R'], '09:05', false]);
  eq('no tags from AI -> from meeting type', FU.normalizeDraft({meeting: {type: 'presentation'}}, []).tags, ['P']);
  eq('default tags: open O, follow up F, recruitment R', ['fact_find', 'follow_up', 'recruitment', 'service'].map(t => FU.tagsFor(t).join()), ['O', 'F', 'R', 'O']);
  eq('recruitment is a meeting type, fact find says Open', [FU.MEETING_TYPES.some(t => t.id === 'recruitment'), FU.MEETING_TYPES.find(t => t.id === 'fact_find').zh], [true, '了解需求 / Open']);
  eq('tags kept in O,F,P,R order', FU.normalizeDraft({tags: ['R', 'P', 'F']}, []).tags, ['F', 'P', 'R']);
}

console.log('Links to Calendar and 定联');
{
  const FU = require('./docs/followup.js');
  const cal = new URL(FU.calendarLink('', {name: '陈先生', nextStep: 'Call after he talks to his wife', followUpDate: '2026-11-21', time: '10:30'}));
  const q = new URLSearchParams(cal.hash.split('?')[1]);
  eq('calendar link goes to the live Calendar New event', cal.origin + cal.pathname + cal.hash.split('?')[0], 'https://wkahjian93.github.io/redefine-calendar/#/new');
  eq('calendar link fields survive encoding', [q.get('t'), q.get('d'), q.get('s'), q.get('n')], ['Follow up 陈先生: Call after he talks to his wife', '2026-11-21', '10:30', 'Call after he talks to his wife']);
  eq('no date when unknown', new URLSearchParams(FU.calendarLink('x/', {name: 'A'}).split('?')[1]).has('d'), false);
  const dl = FU.dinglianLink('', ' Ah Seng & Co ');
  eq('定联 link finds the person by name', [dl.split('#')[0], new URLSearchParams(dl.split('#routine?')[1]).get('find')], ['https://remembered.dwz-rooms-server.workers.dev/', 'Ah Seng & Co']);
}

console.log('Phone, iPad and laptop editing the same client');
{
  const FU = require('./docs/followup.js');
  const base = {id: 'c1', created: '2026-11-01T00:00:00Z', updated: '2026-11-10T00:00:00Z', client: {name: '陈先生', traits: {family: '2 kids', cares: ['medical cost'], objections: []}},
    meetings: [{id: 'm1', date: '2026-11-10', summary: 'first'}], policies: [{id: 'p1', insurer: 'AIA'}]};
  const phone = JSON.parse(JSON.stringify(base)), ipad = JSON.parse(JSON.stringify(base));
  phone.meetings.push({id: 'm2', date: '2026-11-18', time: '10:00', summary: 'phone meeting'}); phone.client.traits.cares.push('kids education'); phone.updated = '2026-11-18T02:00:00Z';
  ipad.policies.push({id: 'p2', insurer: 'Prudential'}); ipad.client.name = '陈先生 (Bayan Lepas)'; ipad.updated = '2026-11-18T02:00:30Z';
  const m = FU.mergeCase(phone, ipad);
  eq('meeting from phone AND policy from iPad both kept', [m.meetings.map(x => x.id), m.policies.map(x => x.id)], [['m1', 'm2'], ['p1', 'p2']]);
  eq('newer name wins, cares joined', [m.client.name, m.client.traits.cares], ['陈先生 (Bayan Lepas)', ['medical cost', 'kids education']]);
  eq('same result whichever device merges', JSON.stringify(FU.mergeCase(ipad, phone).meetings.map(x => x.id)) + JSON.stringify(FU.mergeCase(ipad, phone).policies.map(x => x.id)), '["m1","m2"]["p1","p2"]');
  const laptop = JSON.parse(JSON.stringify(m)); FU.markRemoved(laptop, 'meetings', 'm1'); laptop.meetings = laptop.meetings.filter(x => x.id !== 'm1'); laptop.updated = '2026-11-18T03:00:00Z';
  eq('meeting deleted on laptop stays deleted when merged with old phone copy', FU.mergeCase(phone, laptop).meetings.map(x => x.id), ['m2']);
  const edited = JSON.parse(JSON.stringify(m)); edited.meetings[0].summary = 'fixed typo'; edited.updated = '2026-11-18T04:00:00Z';
  eq('edit to the same meeting: newer wins', FU.mergeCase(m, edited).meetings.find(x => x.id === 'm1').summary, 'fixed typo');
}

console.log('Clients vs prospects, activities, follow-up tracker');
{
  const FU = require('./docs/followup.js');
  eq('kind: set, or by whether policies exist', [FU.kindOf({kind: 'prospect', policies: [1]}), FU.kindOf({policies: [1]}), FU.kindOf({policies: []})], ['prospect', 'client', 'prospect']);
  const M = (id, date, type, extra) => Object.assign({id, date, type, outcome: 'none'}, extra || {});
  const people = [
    {id: 'a', client: {name: 'A'}, policies: [], meetings: [M('a1', '2026-11-18', 'approach')]},
    {id: 'b', client: {name: 'B'}, policies: [], meetings: [M('b1', '2026-11-18', 'fact_find'), M('b2', '2026-11-18', 'follow_up', {visit: false})]},
    {id: 'c', client: {name: 'C'}, policies: [], meetings: [M('c1', '2026-11-18', 'closing', {outcome: 'closed'})]}
  ];
  const g = FU.activitiesOn(people, '2026-11-18');
  eq('activities split by type', ['approach', 'open', 'present', 'follow_up', 'close'].map(k => g[k].length), [1, 1, 0, 1, 1]);
  eq('WhatsApp follow-up is an activity but not a 三访 visit', [FU.meetingsOn(people, '2026-11-18').length, FU.meetingsOn(people, '2026-11-18', true).length, FU.dayStats(people)['2026-11-18'].met], [3, 4, 3]);
  const p = {id: 'p', client: {name: 'P'}, policies: [], meetings: [M('p1', '2026-11-10', 'fact_find'), M('p2', '2026-11-12', 'presentation'), M('p3', '2026-11-13', 'follow_up', {visit: false}), M('p4', '2026-11-14', 'follow_up')]};
  const t = FU.followTrack(p, '2026-11-17');
  eq('tracker: 5 days since presentation, 2 of 5 done', [t.presDate, t.days, t.done, t.status], ['2026-11-12', 5, 2, 'active']);
  eq('tracker: slots Day 1-5 with due dates, 2 late, Day 5 due today', [t.slots.map(s => s.due), t.slots.filter(s => s.late).length, t.slots[4].today], [['2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17'], 2, true]);
  eq('tracker: needs attention (behind, quiet 3 days)', [t.attention, t.reasons], [true, ['2 follow-ups behind', 'no follow-up for 3 days']]);
  eq('no presentation -> not tracked', FU.followTrack({meetings: [M('x', '2026-11-12', 'fact_find')]}, '2026-11-17'), null);
  const closed = JSON.parse(JSON.stringify(p)); closed.meetings.push(M('p5', '2026-11-16', 'closing', {outcome: 'closed'}));
  eq('closed leaves the list', [FU.followTrack(closed, '2026-11-17').status, FU.followList([closed], '2026-11-17').length], ['closed', 0]);
  const stopped = Object.assign(JSON.parse(JSON.stringify(p)), {fuStop: '2026-11-16'});
  eq('stop tracking leaves the list', FU.followList([stopped], '2026-11-17').length, 0);
  const again = JSON.parse(JSON.stringify(stopped)); again.meetings.push(M('p6', '2026-11-20', 'presentation'));
  eq('a new presentation starts tracking again from Day 0', [FU.followTrack(again, '2026-11-20').presDate, FU.followTrack(again, '2026-11-20').done, FU.followList([again], '2026-11-20').length], ['2026-11-20', 0, 1]);
  const ontime = {id: 'o', client: {name: 'O'}, meetings: [M('o1', '2026-11-12', 'presentation'), M('o2', '2026-11-13', 'follow_up')]};
  eq('on schedule -> no attention flag', FU.followTrack(ontime, '2026-11-13').attention, false);
  eq('presented yesterday, Day 1 due today -> not behind yet', FU.followTrack({meetings: [M('k', '2026-11-17', 'presentation')]}, '2026-11-18').attention, false);
  eq('AI visit flag: false only when said', [FU.normalizeDraft({visit: false}, []).visit, FU.normalizeDraft({}, []).visit], [false, true]);
}

console.log('Stages copy forward, headline/end line, Calendar link');
{
  const FU = require('./docs/followup.js');
  const M = (id, type, extra) => Object.assign({id, date: '2026-11-21', time: '10:00', type, outcome: 'none', tags: FU.tagsFor(type)}, extra || {});
  eq('approach alone: Approach only', FU.stagesOf(M('1', 'approach')), ['approach']);
  eq('approach that made an appointment (O): Approach + Open', FU.stagesOf(M('1', 'approach', {tags: ['O']})), ['approach', 'open']);
  eq('open that presented (P): Open + Present', FU.stagesOf(M('1', 'fact_find', {tags: ['O', 'P']})), ['open', 'present']);
  eq('presentation that closed: Present + Close', FU.stagesOf(M('1', 'presentation', {outcome: 'closed'})), ['present', 'close']);
  eq('follow-up that closed: Follow-up + Close', FU.stagesOf(M('1', 'follow_up', {outcome: 'closed'})), ['follow_up', 'close']);
  eq('closing meeting: Close only (not Present)', FU.stagesOf(M('1', 'closing', {tags: ['P'], outcome: 'closed'})), ['close']);
  const people = [{id: 'a', client: {name: 'A'}, meetings: [M('a1', 'approach', {tags: ['O']}), M('a2', 'approach', {time: '15:00'})]}];
  const g = FU.activitiesOn(people, '2026-11-21');
  eq('same person twice on one list -> listed once', [g.approach.length, g.open.length], [1, 1]);
  const items = [{name: 'Ms Koay', time: '09:00', tags: ['P'], note: 'Direct approach.'}];
  const txt = FU.reportText({date: '2026-11-13', reportName: 'Rex👑', base: 'SG Farlim', items, week: {met: 1, rec: 0}, month: {met: 1},
    headline: '🔥 {name} ({base}) 🔥\n三访打卡！{date} {day}', endLine: '加油！明天继续 💪 — {name}'});
  eq('custom headline replaces the first lines', txt.split('\n').slice(0, 2), ['🔥 Rex👑 (SG Farlim) 🔥', '三访打卡！13/11/2026 Friday']);
  eq('headline with {date} does not repeat the date line', txt.split('\n').filter(l => l.includes('13/11/2026')).length, 1);
  eq('headline without {date} keeps the date line', FU.reportText({date: '2026-11-13', reportName: 'Rex', items: [], headline: 'Hi {name}'}).split('\n').slice(0, 3), ['Hi Rex', '', '13/11/2026 (Friday)']);
  eq('custom end line at the bottom', txt.split('\n').slice(-1)[0], '加油！明天继续 💪 — Rex👑');
  eq('empty base leaves no empty brackets', FU.reportText({date: '2026-11-13', reportName: 'Rex', items: [], headline: '{name} ({base})'}).split('\n')[0], 'Rex');
  const ev = FU.calEventFor({date: '2026-11-25', time: '14:30', name: '陈先生', fromType: 'presentation', nextStep: 'Bring the revised plan'});
  eq('quick log appointment -> private Calendar follow-up event', [ev.title, ev.type, ev.vis, new Date(ev.start).getHours(), (new Date(ev.end) - new Date(ev.start)) / 60000], ['Follow up 陈先生', 'followup', 'private', 14, 60]);
  eq('after an approach/open the appointment is a presentation', FU.calEventFor({date: '2026-11-25', name: 'X', fromType: 'fact_find'}).type, 'present');
  const back = FU.eventToMeeting({id: 'ev123', type: 'followup', out: 'closed', start: new Date('2026-11-25T14:30:00').toISOString()}, {});
  eq('Calendar Closed -> On Field visit, closed, stable id', [back.id, back.date, back.time, back.type, back.outcome, back.visit, FU.stagesOf(back)], ['cal-ev123', '2026-11-25', '14:30', 'follow_up', 'closed', true, ['follow_up', 'close']]);
  eq('after-close checklist has 4 items', FU.AFTER_CLOSE.map(x => x.k), ['summary', 'referral', 'nominee', 'econnect']);
}

console.log('Summary maths (sample client)');
const c = sampleCase(PS), s = PS.summarise(c);
eq('death = 300k + 100k + 200k (lapsed 50k not counted)', s.cats.death.total, 600000);
eq('TPD = 300k + 100k', s.cats.tpd.total, 400000);
eq('CI = 100k + 150k', s.cats.ci.total, 250000);
eq('early CI 50k + 1 not stated', [s.cats.eci.total, s.cats.eci.missing], [50000, 1]);
eq('medical: highest annual, unlimited lifetime, room', [s.medical.annual, s.medical.lifetimeUnlimited, s.medical.roomBoard], [1500000, true, 250]);
eq('cash value 18,420 + 21,300', s.cash.total, 39720);
eq('bonus', s.bonus.total, 8650);
eq('premium/yr = 4,200 + 2,400 + 2,160 + 1,140', s.premium.annual, 9900);
eq('policies in force / excluded', [s.policyCount, s.excluded], [4, 1]);
eq('guideline: death 600k of 840k', [s.gaps[0].pct, s.gaps[0].short], [71, 240000]);
eq('guideline: CI 250k of 420k', [s.gaps[2].pct, s.gaps[2].short], [60, 170000]);
eq('death cover drops to 400k at 65 (term plan ends)', s.cats.death.drop, {age: 65, left: 400000});
eq('CI drops to 100k at 70', s.cats.ci.drop, {age: 70, left: 100000});
eq('sample has 1 item to confirm', PS.pendingChecks(c).length, 1);
eq('RM format', [PS.rm(1500000, {short: true}), PS.rm(250000, {short: true}), PS.rm(9900), PS.rm(null)], ['RM1.5m', 'RM250k', 'RM9,900', '—']);

// REDEFINE Prospecting: collected lead activity -> quick logs on the farm
{
  const FU = require('./docs/followup.js');
  const cs = [{id: 'k1', client: {name: 'Mei Ling'}, kind: 'prospect', meetings: [], policies: []}];
  const items = [
    {id: 'r1', name: 'Mei Ling', source: 'referral', status: 'approved', calledAt: '2026-11-21T02:00:00Z', planAt: '2026-11-23T07:00:00Z', appt: '', apptAt: ''},
    {id: 'r2', name: 'New Person', source: 'roadshow', status: 'pending', calledAt: '2026-11-21T03:00:00Z', planAt: '', noAppt: 1}
  ];
  const r = FU.applyProspecting(cs, items);
  eq('prospecting: 1 new prospect, Mei Ling matched by name', [r.created, cs.length, cs[0].meetings.length], [1, 2, 1]);
  eq('prospecting: call with appointment = Approach tagged O, follow up on the appointment day', [cs[0].meetings[0].type, cs[0].meetings[0].tags, cs[0].meetings[0].followUpDate, cs[0].meetings[0].visit], ['approach', ['O'], '2026-11-23', false]);
  eq('prospecting: same items again add nothing', FU.applyProspecting(cs, items).changed, 0);
  items[0].appt = 'pending'; items[0].apptAt = '2026-11-23T07:00:00Z'; items[0].apptMark = '2026-11-23T09:00:00Z';
  FU.applyProspecting(cs, items);
  eq('prospecting: appointment done = Open visit at 3pm MYT (三访)', cs[0].meetings.filter(m => m.type === 'fact_find').map(m => [m.date, m.time, m.visit]), [['2026-11-23', '15:00', true]]);
  items[0].status = 'rejected'; FU.applyProspecting(cs, items);
  eq('prospecting: lead not counted -> its quick logs removed', cs[0].meetings.length, 0);
}

console.log('Policy / proposal comparison');
{
  const c = sampleCase(PS), prop = c.policies.find(PS.isProposal), ge = c.policies[0];
  eq('proposal never counts in the summary (death stays 600k)', PS.summarise(c).cats.death.total, 600000);
  eq('proposal checks are left out of the summary checks', PS.pendingChecks({policies: [Object.assign({}, prop, {checks: {premium: 'x'}})]}).length, 0);
  eq('...but listed for the comparison', PS.pendingChecks({policies: [Object.assign({}, prop, {checks: {premium: 'x'}})]}, true).length, 1);
  const cols = [ge, prop].map(PS.compareCol);
  eq('columns: cover, medical annual, waiver, cover-to age', [cols[1].v.death, cols[1].v.ci, cols[1].v.medical, cols[1].waiver, cols[1].end.age, cols[0].end.age], [500000, 300000, 2000000, true, 100, 100]);
  eq('riders listed by name', cols[1].riders, ['Critical illness rider', 'Early critical illness rider', 'Medical rider', 'Payor waiver rider']);
  const d = PS.keyDiffs(cols);
  eq('neutral differences vs first column', d.filter(x => x.kind === 'diff').map(x => [x.cat, x.delta]), [['death', 200000], ['tpd', 200000], ['ci', 200000], ['eci', 50000], ['medical', 500000]]);
  eq('premium difference per year', d.find(x => x.kind === 'premium').delta, 420 * 12 - 350 * 12);
  const pol = PS.compareCol(c.policies[3]), mis = PS.keyDiffs([pol, PS.compareCol(prop)]);
  eq('cover only in the proposal is flagged "only"', mis.filter(x => x.kind === 'only').map(x => x.cat), ['tpd', 'ci', 'eci', 'medical', 'waiver']);
  eq('cover only in the first column is flagged "missing"', mis.filter(x => x.kind === 'missing').map(x => x.cat), ['accident', 'hospital']);
  const W = PS.coverWith(c, [prop], []), R = PS.coverWith(c, [prop], [ge.id]);
  eq('total cover: today vs added proposal', [W.today.cats.death.total, W.withEach[0].s.cats.death.total], [600000, 1100000]);
  eq('total cover when it replaces the first policy', R.withEach[0].s.cats.death.total, 800000);
  const ai = PS.fromAI({policies: [{insurer: 'Great Eastern', productName: 'X', status: 'unknown', premium: 300, premiumFrequency: 'monthly', coverageToAge: 100, premiumTermYears: 20, benefits: [{name: 'Basic death', category: 'death', amount: 100000, rider: false}, {name: 'CI rider', category: 'ci', amount: 50000, rider: true}]}]}, {})[0];
  eq('AI reads term, paying term and riders', [ai.coverTo, ai.payYears, ai.benefits.map(b => b.rider)], [100, 20, [false, true]]);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
