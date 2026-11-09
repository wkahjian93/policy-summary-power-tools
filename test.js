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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
