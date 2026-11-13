/* REDEFINE concept library for follow-up PDFs (from the REDEFINE "Medical Protection" and "Income Protection" lessons).
   Every page is the same for the whole team. Numbers are illustrative teaching figures, never quotes or product facts.
   No product names, benefits or promotions here: those belong to the agent's approved materials. */
(function (root) {
  const C = {navy: '#1F3A68', gold: '#C9962E', red: '#B5452F', green: '#1E8A6E', grey: '#9AA1B0', soft: '#F4F1E8'};
  const svg = (inner, h = 220) => `<svg viewBox="0 0 600 ${h}" width="100%" height="${h}" xmlns="http://www.w3.org/2000/svg" font-family="Inter,Arial,sans-serif">${inner}</svg>`;

  const CONCEPTS = [
    {id: 'extinguisher', group: 'medical', zh: '灭火器', en: 'The fire extinguisher',
      key: '不是机率大小的问题，而是后果很严重的问题。', keyEn: 'It is not about how likely it is. It is about how serious the result would be.',
      lines: [['每间店都有灭火器，大部分从来没有用过。', 'Every shop keeps an extinguisher, though most never use it.'],
        ['店主不是在等火灾，而是知道一旦发生，输不起。', 'The owner is not expecting a fire; they simply cannot afford one.'],
        ['保险也一样：不是不相信自己的身体，而是输不起辛苦赚来的钱。', 'Insurance is the same: not doubting your health, just protecting what you worked for.']],
      art: svg(`<rect x="0" y="0" width="600" height="220" rx="18" fill="${C.soft}"/>
        <rect x="250" y="40" width="70" height="150" rx="22" fill="${C.red}"/><rect x="268" y="18" width="34" height="30" rx="6" fill="${C.navy}"/>
        <path d="M302 30 h50 l18 18" stroke="${C.navy}" stroke-width="8" fill="none" stroke-linecap="round"/><rect x="262" y="90" width="46" height="40" rx="6" fill="#fff" opacity=".85"/>
        <text x="285" y="117" text-anchor="middle" font-size="18" font-weight="700" fill="${C.red}">FIRE</text>
        <text x="90" y="110" font-size="44">🏪</text><text x="440" y="110" font-size="44">🏠</text>
        <text x="300" y="212" text-anchor="middle" font-size="14" fill="${C.navy}">宁可百日不用，不可一日不备</text>`)},
    {id: 'timeline', group: 'medical', zh: '时间线：不是会不会，而是几时', en: 'The lifetime timeline',
      key: '问题不是会不会发生，而是几时发生。', keyEn: 'The question is not if, but when.',
      lines: [['只看"最近"，严重疾病好像很少见。', 'Looking only at "lately", serious illness feels rare.'],
        ['把时间线拉长到一生，大约每5个人就有3-4个会遇到（教学数字）。', 'Across a whole lifetime, roughly 3–4 in 5 people face one (teaching figure).'],
        ['我们控制不到几时，所以趁健康时准备。', 'We cannot choose when, so we prepare while healthy.']],
      art: svg(`<rect width="600" height="220" rx="18" fill="${C.soft}"/>
        <line x1="50" y1="120" x2="550" y2="120" stroke="${C.navy}" stroke-width="6" stroke-linecap="round"/>
        ${[0, 20, 40, 60, 80, 100].map((a, i) => `<circle cx="${50 + i * 100}" cy="120" r="9" fill="${C.navy}"/><text x="${50 + i * 100}" y="155" text-anchor="middle" font-size="16" fill="${C.navy}">${a}</text>`).join('')}
        <rect x="70" y="60" width="70" height="34" rx="17" fill="#fff" stroke="${C.grey}"/><text x="105" y="83" text-anchor="middle" font-size="14" fill="${C.grey}">现在</text>
        <path d="M150 105 Q300 20 520 100" stroke="${C.red}" stroke-width="4" fill="none" stroke-dasharray="8 8"/>
        <text x="330" y="50" text-anchor="middle" font-size="26" font-weight="700" fill="${C.red}">几时？ When?</text>
        <text x="300" y="200" text-anchor="middle" font-size="13" fill="${C.grey}">年龄 Age</text>`)},
    {id: 'inflation', group: 'medical', zh: '努力是为了更好的生活', en: 'Work for a better life, not for medical bills',
      key: '努力是为了更好的生活，不是为了医药费。', keyEn: 'We work hard for a better life, not for medical bills.',
      lines: [['医疗费每年上涨（教学用10%）。', 'Medical costs rise every year (10% used for teaching).'],
        ['今天RM70k的手术，30年后约RM1.2 million（示例）。', 'A RM70k operation today ≈ RM1.2 million in 30 years (illustration).'],
        ['自己存，等于每个月存约RM3,300，几乎一整份薪水。', 'Saving it alone ≈ RM3,300 a month, almost a whole salary.']],
      art: svg(`<rect width="600" height="220" rx="18" fill="${C.soft}"/>
        ${[[110, 30, 'RM70k', 'Today'], [250, 70, 'RM181k', '+10y'], [390, 120, 'RM470k', '+20y'], [520, 175, 'RM1.2m', '+30y']].map(([x, h, v, l]) => `<rect x="${x - 40}" y="${190 - h}" width="80" height="${h}" rx="8" fill="${l === '+30y' ? C.red : C.navy}"/><text x="${x}" y="${182 - h}" text-anchor="middle" font-size="16" font-weight="700" fill="${C.navy}">${v}</text><text x="${x}" y="210" text-anchor="middle" font-size="13" fill="${C.grey}">${l}</text>`).join('')}`)},
    {id: 'twins', group: 'medical', zh: '小明 vs 小华', en: 'Two friends, one difference',
      key: '你努力的意义，已经不一样了。', keyEn: 'The meaning of your hard work becomes different.',
      lines: [['两个人同样收入、同样储蓄30年。', 'Same income, same savings for 30 years.'],
        ['同样遇到大病：小明有医药卡，储蓄留给生活；小华的储蓄全部变成医药费。', 'Same illness: one has a medical card and keeps his savings for life; the other spends them all on bills.'],
        ['区别不只是有没有卡，而是努力为了什么。', 'The difference is not the card. It is what the hard work was for.']],
      art: svg(`<rect width="600" height="220" rx="18" fill="${C.soft}"/>
        <rect x="40" y="30" width="240" height="160" rx="16" fill="#fff"/><rect x="320" y="30" width="240" height="160" rx="16" fill="#fff"/>
        <text x="160" y="80" text-anchor="middle" font-size="40">🙂</text><text x="440" y="80" text-anchor="middle" font-size="40">😟</text>
        <text x="160" y="120" text-anchor="middle" font-size="18" font-weight="700" fill="${C.navy}">小明 ✓ 医药卡</text><text x="440" y="120" text-anchor="middle" font-size="18" font-weight="700" fill="${C.navy}">小华 ✗</text>
        <text x="160" y="160" text-anchor="middle" font-size="15" fill="${C.green}">储蓄 → 更好的生活</text><text x="440" y="160" text-anchor="middle" font-size="15" fill="${C.red}">储蓄 → 医药费</text>`)},
    {id: 'emergency', group: 'medical', zh: '小钱 vs 大钱', en: 'Small money vs big money emergencies',
      key: '小钱放银行，大钱交给保险。', keyEn: 'Keep small emergencies in the bank; transfer the big ones to insurance.',
      lines: [['小钱应急：钱包丢了、车坏了 —— 3到6个月开销就够。', 'Small: lost wallet, broken car. 3–6 months of expenses is enough.'],
        ['大钱应急：大病、意外、残障 —— 可能要几十万。', 'Big: serious illness, accident, disability. May need hundreds of thousands.'],
        ['把一小部分应急钱变成保障，是 risk transfer。', 'Turning a small part of it into cover is a risk transfer.']],
      art: svg(`<rect width="600" height="220" rx="18" fill="${C.soft}"/>
        <rect x="60" y="60" width="200" height="120" rx="20" fill="#fff" stroke="${C.navy}" stroke-width="3"/><text x="160" y="110" text-anchor="middle" font-size="34">🏦</text><text x="160" y="150" text-anchor="middle" font-size="16" fill="${C.navy}">小钱 3–6 个月</text>
        <path d="M340 70 Q440 20 540 70 Z" fill="${C.navy}"/><line x1="440" y1="70" x2="440" y2="170" stroke="${C.navy}" stroke-width="5"/><path d="M440 170 q0 14 -14 14" stroke="${C.navy}" stroke-width="5" fill="none"/>
        <text x="440" y="205" text-anchor="middle" font-size="16" fill="${C.navy}">大钱 → 保险</text>`)},
    {id: 'buttons', group: 'medical', zh: '红键 vs 白键', en: 'The red button or the white button',
      key: '确定的好处，胜过承担不起的风险。', keyEn: 'A sure benefit beats a risk you cannot afford.',
      lines: [['红键：确定拿到保障。白键：50%机会大赚，50%一无所有。', 'Red: sure protection. White: 50% big win, 50% lose everything.'],
        ['大部分人按红键，因为白键的后果承担不起。', 'Most press red, because the white downside is unaffordable.'],
        ['准备医药卡，就是按红键。', 'Getting a medical card is pressing red.']],
      art: svg(`<rect width="600" height="220" rx="18" fill="${C.soft}"/>
        <circle cx="200" cy="105" r="62" fill="${C.red}"/><circle cx="400" cy="105" r="62" fill="#fff" stroke="${C.grey}" stroke-width="4"/>
        <text x="200" y="112" text-anchor="middle" font-size="20" font-weight="700" fill="#fff">确定</text><text x="400" y="112" text-anchor="middle" font-size="20" font-weight="700" fill="${C.grey}">50 / 50</text>
        <text x="200" y="200" text-anchor="middle" font-size="15" fill="${C.navy}">红键 Red</text><text x="400" y="200" text-anchor="middle" font-size="15" fill="${C.navy}">白键 White</text>`)},
    {id: 'sources', group: 'medical', zh: '大病急用钱，钱从哪里来？', en: 'Big bill tomorrow: where does the money come from?',
      key: '责任是自己的，不要推给家人和社会。', keyEn: 'The responsibility is ours, not our family\'s or society\'s.',
      lines: [['父母？是他们的退休钱。朋友？通常只能借几千。', 'Parents? Their retirement money. Friends? Usually a few thousand.'],
        ['储蓄和投资？是为了更好的生活；市场不好时卖会亏。', 'Savings and investments? Meant for life; selling in a bad market loses.'],
        ['公司福利？离职就没有了。保障是唯一马上付、不连累别人的来源。', 'Company cover? Gone if you leave. Your own cover pays without burdening anyone.']],
      art: svg(`<rect width="600" height="220" rx="18" fill="${C.soft}"/>
        <rect x="235" y="75" width="130" height="70" rx="14" fill="${C.red}"/><text x="300" y="118" text-anchor="middle" font-size="20" font-weight="700" fill="#fff">大病账单</text>
        ${[['👴', 70, 50], ['🤝', 70, 170], ['📈', 530, 50], ['🏢', 530, 170], ['🛡️', 300, 30]].map(([e, x, y]) => `<text x="${x}" y="${y + 12}" text-anchor="middle" font-size="34">${e}</text><line x1="${x}" y1="${y}" x2="300" y2="110" stroke="${e === '🛡️' ? C.green : C.grey}" stroke-width="${e === '🛡️' ? 5 : 2}" stroke-dasharray="${e === '🛡️' ? '' : '6 6'}"/>`).join('')}`)},
    {id: 'umbrella', group: 'medical', zh: '雨伞的价钱', en: 'The price of an umbrella',
      key: '用小钱解决大问题，证明你有智慧。', keyEn: 'Solving a big problem with small money is wisdom.',
      lines: [['晴天，RM5 的伞都嫌贵；下大雨，RM30 也卖完。', 'On a sunny day RM5 is too much; in a storm RM30 umbrellas sell out.'],
        ['没有保障：用 RM240k 解决 RM240k 的问题。', 'Without cover: a RM240k problem costs RM240k.'],
        ['有保障：用每年约 RM2,400 的保费解决（示例）。', 'With cover: about RM2,400 a year of premium solves it (illustration).']],
      art: svg(`<rect width="600" height="220" rx="18" fill="${C.soft}"/>
        <path d="M180 120 Q300 10 420 120 Z" fill="${C.navy}"/><line x1="300" y1="120" x2="300" y2="195" stroke="${C.navy}" stroke-width="6"/><path d="M300 195 q0 16 -18 16" stroke="${C.navy}" stroke-width="6" fill="none"/>
        ${Array.from({length: 14}, (_, i) => `<line x1="${60 + i * 37}" y1="${20 + (i % 3) * 15}" x2="${50 + i * 37}" y2="${45 + (i % 3) * 15}" stroke="${C.grey}" stroke-width="3" stroke-linecap="round"/>`).join('')}
        <text x="110" y="180" text-anchor="middle" font-size="22" font-weight="700" fill="${C.red}">RM240k</text><text x="490" y="180" text-anchor="middle" font-size="22" font-weight="700" fill="${C.green}">RM2.4k</text>`)},
    {id: 'tree', group: 'income', zh: '门前的大树', en: 'The tree in front of the house',
      key: '别只保护结果，忘了保护根源。', keyEn: 'Don\'t protect only the fruit and forget the root.',
      lines: [['家人、房子、车子，是大树的果实。医药卡保护这些成果。', 'Family, home, car are the fruit. A medical card protects them.'],
        ['但大树能一直长，是因为薪水像雨水一样每年灌溉。', 'But the tree keeps growing because your salary waters it every year.'],
        ['收入保障，保护的是根。两个都重要。', 'Income protection guards the root. Both matter.']],
      art: svg(`<rect width="600" height="220" rx="18" fill="${C.soft}"/>
        <ellipse cx="300" cy="80" rx="150" ry="65" fill="${C.green}"/><rect x="285" y="120" width="30" height="60" fill="#8A5A36"/>
        <path d="M300 180 L250 205 M300 180 L300 210 M300 180 L350 205" stroke="#8A5A36" stroke-width="6" stroke-linecap="round"/>
        <text x="235" y="75" font-size="26">🏠</text><text x="290" y="60" font-size="26">❤️</text><text x="340" y="85" font-size="26">🚗</text>
        <text x="470" y="80" font-size="15" fill="${C.navy}">医药卡 → 果实</text><text x="400" y="205" font-size="15" fill="${C.navy}">收入保障 → 根</text>
        ${[60, 90, 120].map(x => `<text x="${x}" y="${40 + x / 3}" font-size="20">💧</text>`).join('')}`)},
    {id: 'warranty', group: 'income', zh: '薪水的 warranty', en: 'A warranty for your salary',
      key: '越是珍贵，越需要保障。', keyEn: 'The more precious it is, the more it needs protecting.',
      lines: [['手机、电视、车子都有 warranty，因为它们珍贵。', 'Phones, TVs and cars come with a warranty because they are valuable.'],
        ['你的薪水比它们都珍贵。', 'Your salary is worth more than all of them.'],
        ['如果有一天薪水"坏了"，你希望它有几年的 warranty？', 'If your income "broke" one day, how many years of warranty would you want?']],
      art: svg(`<rect width="600" height="220" rx="18" fill="${C.soft}"/>
        ${[['📱', 90], ['📺', 210], ['🚗', 330]].map(([e, x]) => `<text x="${x}" y="110" text-anchor="middle" font-size="44">${e}</text><text x="${x}" y="150" text-anchor="middle" font-size="14" fill="${C.green}">✓ warranty</text>`).join('')}
        <rect x="410" y="60" width="150" height="100" rx="16" fill="#fff" stroke="${C.gold}" stroke-width="4"/><text x="485" y="105" text-anchor="middle" font-size="22" font-weight="700" fill="${C.navy}">薪水</text><text x="485" y="140" text-anchor="middle" font-size="18" font-weight="700" fill="${C.red}">warranty?</text>`)},
    {id: 'ability', group: 'income', zh: '你的工作能力值多少？', en: 'What is your ability to work worth?',
      key: '不买一个亿，也至少不要贱卖。', keyEn: 'You may not insure RM100 million, but don\'t sell it cheap.',
      lines: [['如果有人要买你一辈子的工作能力，你会卖多少钱？', 'If someone wanted to buy your lifetime ability to work, what would your price be?'],
        ['疾病和意外来的时候，不会问你同不同意。', 'Illness and accidents take it without asking.'],
        ['打开保单看看保额：是不是卖得太便宜？', 'Look at your sum assured: is it priced too cheap?']],
      art: svg(`<rect width="600" height="220" rx="18" fill="${C.soft}"/>
        <text x="300" y="95" text-anchor="middle" font-size="54" font-weight="700" fill="${C.navy}">RM ? ? ?</text>
        <text x="300" y="150" text-anchor="middle" font-size="18" fill="${C.grey}">你一辈子能赚的钱 · Your lifetime earnings</text><text x="300" y="195" text-anchor="middle" font-size="30">🔨</text>`)},
    {id: 'golden', group: 'income', zh: '黄金时期', en: 'The golden earning years',
      key: '用35年的收入，支撑80年的生活。', keyEn: 'About 35 working years pay for about 80 years of life.',
      lines: [['大约25到60岁才有收入。', 'Income usually comes only from about 25 to 60.'],
        ['开销却从出生到老都在。', 'Expenses run from birth to old age.'],
        ['黄金时期出事，断掉的是支撑一生的那段收入。', 'Trouble in the golden years cuts the income that funds everything.']],
      art: svg(`<rect width="600" height="220" rx="18" fill="${C.soft}"/>
        <rect x="50" y="140" width="500" height="22" rx="11" fill="${C.grey}" opacity=".4"/><text x="300" y="185" text-anchor="middle" font-size="14" fill="${C.grey}">开销 Expenses 0 → 80</text>
        <rect x="206" y="80" width="219" height="34" rx="17" fill="${C.gold}"/><text x="315" y="103" text-anchor="middle" font-size="16" font-weight="700" fill="#fff">收入 Income 25 → 60</text>
        ${[0, 25, 60, 80].map(a => `<text x="${50 + a * 6.25}" y="70" text-anchor="middle" font-size="15" fill="${C.navy}">${a}</text>`).join('')}`)},
    {id: 'greyarea', group: 'income', zh: '活下来了，但人生已经不一样', en: 'Surviving, but life is different',
      key: '可怕的不是死亡，而是明明活着，却再也回不去。', keyEn: 'The frightening part is not death, but surviving and never getting your old life back.',
      lines: [['有些意外和疾病不会夺走生命，却会影响工作能力和收入。', 'Some accidents and illnesses leave you alive but less able to work and earn.'],
        ['医药卡付医药费，但不补回减少的收入。', 'A medical card pays the hospital, not the lost income.'],
        ['所以要看清楚保障里的"灰色地带"，和顾问一起检查。', 'So check the "grey areas" in your cover with your adviser.']],
      art: svg(`<rect width="600" height="220" rx="18" fill="${C.soft}"/>
        <path d="M60 150 L200 150 L240 90 L300 170 L360 120 L540 120" stroke="${C.navy}" stroke-width="5" fill="none" stroke-linejoin="round"/>
        <rect x="300" y="40" width="240" height="140" rx="12" fill="${C.grey}" opacity=".18"/><text x="420" y="70" text-anchor="middle" font-size="16" font-weight="700" fill="${C.navy}">灰色地带 Grey area</text>
        <text x="120" y="135" text-anchor="middle" font-size="14" fill="${C.green}">收入 100%</text><text x="450" y="110" text-anchor="middle" font-size="14" fill="${C.red}">收入 50%?</text>`)}
  ];
  const byId = id => CONCEPTS.find(c => c.id === id);
  const api = {CONCEPTS, byId};
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.REDEFINE_CONCEPTS = api;
})(this);
