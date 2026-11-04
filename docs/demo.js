/* Made-up sample client for showing the format. Insurer names are real; every product name,
   amount and date here is invented for illustration and is not any insurer's actual plan. */
(function (root) {
  function sampleCase(PS) {
    const B = (cat, name, amount, extra) => Object.assign(PS.blankBenefit(cat), {name, amount}, extra || {});
    return {
      id: PS.uid(), sample: true, created: new Date().toISOString(), updated: new Date().toISOString(),
      client: {name: 'Tan Mei Ling', age: 34, income: 84000},
      guide: {death: 10, ci: 5},
      policies: [
        {id: PS.uid(), source: 'photo', insurer: 'Great Eastern Life', productName: 'Investment-linked protection plan (sample)', policyNo: '••••4821',
          lifeAssured: 'Tan Mei Ling', planType: 'investment-linked', status: 'inforce', startDate: '2019-03-15', premium: 350, premiumFreq: 'monthly',
          cashValue: 18420, cashValueDate: '2026-09-30', bonus: null, checks: {},
          benefits: [
            B('death', 'Death / TPD benefit (death)', 300000, {untilAge: 100, note: 'Paid once, on death or TPD'}),
            B('tpd', 'Death / TPD benefit (TPD)', 300000, {untilAge: 70, note: 'Paid once, on death or TPD'}),
            B('ci', 'Critical illness rider', 100000, {untilAge: 75}),
            B('eci', 'Early critical illness rider', 50000, {untilAge: 75}),
            B('medical', 'Medical rider', null, {annual: 1500000, lifetimeUnlimited: true, roomBoard: 250, deductible: 0, untilAge: 80}),
            B('waiver', 'Payor waiver rider', null)
          ]},
        {id: PS.uid(), source: 'manual', insurer: 'AIA', productName: 'Whole life participating plan (sample)', policyNo: '••••7310',
          lifeAssured: 'Tan Mei Ling', planType: 'traditional', status: 'inforce', startDate: '2012-07-01', premium: 2400, premiumFreq: 'yearly',
          cashValue: 21300, cashValueDate: '2026-07-01', bonus: 8650, checks: {},
          benefits: [B('death', 'Basic death benefit', 100000, {untilAge: 100}), B('tpd', 'TPD benefit', 100000, {untilAge: 70})]},
        {id: PS.uid(), source: 'photo', insurer: 'Prudential', productName: 'Critical illness plan (sample)', policyNo: '••••0592',
          lifeAssured: 'Tan Mei Ling', planType: 'traditional', status: 'inforce', startDate: '2016-05-20', premium: 180, premiumFreq: 'monthly',
          cashValue: null, cashValueDate: '', bonus: null, checks: {},
          benefits: [B('ci', 'Critical illness benefit', 150000, {untilAge: 70}),
            Object.assign(B('eci', 'Early stage CI benefit', null, {untilAge: 70}), {check: 'Amount not found'})]},
        {id: PS.uid(), source: 'photo', insurer: 'Tokio Marine Life', productName: 'Term life plan (sample)', policyNo: '••••1188',
          lifeAssured: 'Tan Mei Ling', planType: 'term', status: 'inforce', startDate: '2021-11-02', premium: 95, premiumFreq: 'monthly',
          cashValue: null, cashValueDate: '', bonus: null, checks: {},
          benefits: [B('death', 'Death benefit', 200000, {untilAge: 65}), B('accident', 'Accidental death benefit', 100000, {untilAge: 65}),
            B('hospital', 'Hospital income benefit (per day)', 100, {untilAge: 65})]},
        {id: PS.uid(), source: 'manual', insurer: 'Hong Leong Assurance', productName: 'Endowment plan (sample)', policyNo: '••••2046',
          lifeAssured: 'Tan Mei Ling', planType: 'traditional', status: 'lapsed', startDate: '2010-01-10', premium: 100, premiumFreq: 'monthly',
          cashValue: null, cashValueDate: '', bonus: null, checks: {},
          benefits: [B('death', 'Death benefit', 50000)]}
      ]
    };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = sampleCase; else root.sampleCase = sampleCase;
})(this);
