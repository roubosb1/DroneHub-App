/* ══════════════════════════════════════════════════════════════════
   US PAYROLL — per-state withholding calculators + filing guides
   For platform creators running payroll in any US state.

   RATES YEAR: 2026 federal (Pub 15-T percentage method, OBBBA
   brackets); state rates are the latest known (2025–2026) and each
   state carries its own `yr` tag. Always sanity-check against the
   state's current withholding tables before filing — rates change
   every January and some mid-year.
   ══════════════════════════════════════════════════════════════════ */

// ── Federal constants (2026) ─────────────────────────────────────────────────
const USP_FED = {
  year: 2026,
  ssRate: 0.062,        ssWageBase: 184500,     // employee + employer each
  medRate: 0.0145,      medAddlRate: 0.009,     medAddlThreshold: 200000,
  futaRate: 0.006,      futaBase: 7000,         // after full state credit
  stdDed: { single: 16100, married: 32200, hoh: 24150 },
  // 2026 brackets (taxable income, single). Married = double each threshold
  // except the top two, per IRS 2026 inflation adjustment.
  brackets: {
    single: [[12400,.10],[50400,.12],[105700,.22],[201775,.24],[256225,.32],[640600,.35],[Infinity,.37]],
    married:[[24800,.10],[100800,.12],[211400,.22],[403550,.24],[512450,.32],[768700,.35],[Infinity,.37]],
    hoh:    [[17700,.10],[67450,.12],[105700,.22],[201750,.24],[256200,.32],[640600,.35],[Infinity,.37]],
  },
};

const USP_FREQ = { weekly:52, biweekly:26, semimonthly:24, monthly:12, annual:1 };

// ── State modules ────────────────────────────────────────────────────────────
// type: 'none' | 'flat' | 'brackets'
// brackets: [[upTo, rate], ...] on annual taxable wages (single-filer tables;
//   most flat/bracket states use the same rates for all statuses)
// stdDed: annual amount subtracted before state tax (0 where the state builds
//   allowances differently — the guide flags it)
// extras: employee-paid add-ons (SDI / PFML style) [{label, rate, cap}]
// sui: employer unemployment-insurance wage base (new-employer rates vary)
const USP_STATES = [
  // ── No wage income tax ──
  {code:'AK',name:'Alaska',type:'none',yr:2026,sui:{base:51700,agency:'Alaska DOL Employment Security'},extras:[{label:'AK UI (employee share)',rate:0.005,cap:51700}],guide:{reg:'Alaska Dept. of Labor — Employment Security Tax online',wth:'No state income tax — no withholding returns',ui:'Quarterly contribution report (TQ01C)',notes:'Alaska is one of the few states where employees also pay a small UI contribution.'}},
  {code:'FL',name:'Florida',type:'none',yr:2026,sui:{base:7000,agency:'FL Dept. of Revenue (Reemployment Tax)'},guide:{reg:'Register with FL DOR for Reemployment Tax (RT-6 filer)',wth:'No state income tax — no withholding returns',ui:'Quarterly RT-6 report',notes:'New-hire reporting via FL New Hire Reporting Center within 20 days.'}},
  {code:'NV',name:'Nevada',type:'none',yr:2026,sui:{base:41800,agency:'NV DETR'},guide:{reg:'NV DETR Employer Self Service',wth:'No state income tax',ui:'Quarterly wage report via ESS portal',notes:'Nevada also levies the Modified Business Tax (MBT) on gross wages above a quarterly threshold — check current MBT rate.'}},
  {code:'NH',name:'New Hampshire',type:'none',yr:2026,sui:{base:14000,agency:'NH Employment Security'},guide:{reg:'NHES employer registration (NHUIS)',wth:'No tax on wages',ui:'Quarterly tax & wage report',notes:'No wage withholding; interest & dividends tax fully repealed in 2025.'}},
  {code:'SD',name:'South Dakota',type:'none',yr:2026,sui:{base:15000,agency:'SD Reemployment Assistance'},guide:{reg:'SD Dept. of Labor & Regulation',wth:'No state income tax',ui:'Quarterly wage report',notes:''}},
  {code:'TN',name:'Tennessee',type:'none',yr:2026,sui:{base:7000,agency:'TN Dept. of Labor & Workforce'},guide:{reg:'TNPAWS employer registration',wth:'No state income tax',ui:'Quarterly premium & wage report (LB-0456/0851)',notes:''}},
  {code:'TX',name:'Texas',type:'none',yr:2026,sui:{base:9000,agency:'Texas Workforce Commission'},guide:{reg:'TWC Unemployment Tax Services',wth:'No state income tax',ui:'Quarterly C-3 wage report via UTS',notes:'New-hire reporting through the TX Employer New Hire portal within 20 days.'}},
  {code:'WA',name:'Washington',type:'none',yr:2026,sui:{base:72800,agency:'WA Employment Security Dept.'},extras:[{label:'WA Paid Family & Medical Leave (employee share)',rate:0.0066,cap:184500},{label:'WA Cares long-term care',rate:0.0058,cap:Infinity}],guide:{reg:'WA ESD + Dept. of Revenue combined registration',wth:'No state income tax',ui:'Quarterly ESD wage report',notes:'PFML and WA Cares premiums are collected through the Paid Leave reporting portal each quarter.'}},
  {code:'WY',name:'Wyoming',type:'none',yr:2026,sui:{base:32400,agency:'WY Dept. of Workforce Services'},guide:{reg:'WYUI employer registration',wth:'No state income tax',ui:'Quarterly wage report',notes:''}},

  // ── Flat-rate states ──
  {code:'AZ',name:'Arizona',type:'flat',rate:0.025,yr:2026,stdDed:0,sui:{base:8000,agency:'AZ DES'},guide:{reg:'AZDOR + DES joint registration (AZTaxes.gov)',wth:'A1-QRT quarterly + A1-R annual reconciliation',ui:'Quarterly UC-018',notes:'Employees pick their own flat withholding % on Form A-4 (2.5% matches the tax rate for most).'}},
  {code:'CO',name:'Colorado',type:'flat',rate:0.044,yr:2026,stdDed:0,sui:{base:27200,agency:'CO Dept. of Labor & Employment'},extras:[{label:'CO FAMLI (employee share)',rate:0.0045,cap:184500}],guide:{reg:'MyBizColorado / CDOR withholding account',wth:'DR 1094 remittances (frequency by size) + annual DR 1093',ui:'Quarterly UI wage report (MyUI Employer+)',notes:'FAMLI paid-leave premiums are filed quarterly through the FAMLI+ portal.'}},
  {code:'GA',name:'Georgia',type:'flat',rate:0.0509,yr:2026,stdDed:12000,sui:{base:9500,agency:'GA DOL'},guide:{reg:'GA Tax Center withholding account + GDOL',wth:'G-7 return (monthly/quarterly by size) + G-1003 annual',ui:'Quarterly DOL-4N',notes:'Georgia is stepping its flat rate down annually — confirm the current-year rate each January.'}},
  {code:'ID',name:'Idaho',type:'flat',rate:0.053?0.053:0.053,yr:2025,stdDed:16100,sui:{base:56700,agency:'Idaho DOL'},guide:{reg:'Idaho TAP + DOL',wth:'Form 910 remittances + Form 967 annual',ui:'Quarterly UI report via Employer Portal',notes:''}},
  {code:'IL',name:'Illinois',type:'flat',rate:0.0495,yr:2026,stdDed:0,exemptAmt:2850,sui:{base:13900,agency:'IL IDES'},guide:{reg:'MyTax Illinois (IDOR + IDES together)',wth:'IL-941 quarterly, deposits semi-weekly/monthly by size',ui:'Quarterly UI-3/40 via MyTax',notes:'Personal exemption allowance (~$2,850) reduces taxable wages per employee.'}},
  {code:'IN',name:'Indiana',type:'flat',rate:0.0295,yr:2026,stdDed:0,exemptAmt:1000,sui:{base:9500,agency:'IN DWD'},guide:{reg:'INTIME withholding account + DWD (Uplink)',wth:'WH-1 remittances + WH-3 annual',ui:'Quarterly UC-1 via Uplink',notes:'County income taxes apply on top of the state rate — withhold at the employee\'s county rate.'}},
  {code:'IA',name:'Iowa',type:'flat',rate:0.038,yr:2026,stdDed:0,sui:{base:39500,agency:'Iowa Workforce Development'},guide:{reg:'GovConnectIowa + IWD myIowaUI',wth:'Quarterly withholding return via GovConnectIowa',ui:'Quarterly myIowaUI report',notes:'Iowa moved to a 3.8% flat tax in 2025.'}},
  {code:'KY',name:'Kentucky',type:'flat',rate:0.035,yr:2026,stdDed:3350,sui:{base:11700,agency:'KY Office of Unemployment Insurance'},guide:{reg:'Kentucky OneStop + KEWES for UI',wth:'K-1/K-3 returns (frequency by size)',ui:'Quarterly UI-3 via KEWES',notes:'Many Kentucky cities/counties levy occupational license taxes on wages — check the work location.'}},
  {code:'MA',name:'Massachusetts',type:'flat',rate:0.05,yr:2026,stdDed:0,sui:{base:15000,agency:'MA DUA'},extras:[{label:'MA PFML (employee share)',rate:0.0046,cap:184500}],guide:{reg:'MassTaxConnect + DUA Employer portal',wth:'M-941 returns (frequency by size)',ui:'Quarterly employment & wage detail via DUA',notes:'A 4% surtax applies to income over ~$1M (annual filing side, not routine withholding). PFML filed quarterly via MassTaxConnect.'}},
  {code:'MI',name:'Michigan',type:'flat',rate:0.0425,yr:2026,stdDed:0,exemptAmt:5800,sui:{base:9000,agency:'MI UIA'},guide:{reg:'MTO (Michigan Treasury Online) + UIA (MiWAM)',wth:'Form 5080 monthly/quarterly + 5081 annual',ui:'Quarterly UIA 1028 via MiWAM',notes:'Several Michigan cities (Detroit, Grand Rapids…) have their own city income tax withholding.'}},
  {code:'MS',name:'Mississippi',type:'flat',rate:0.044,yr:2025,stdDed:2300,exemptFirst:10000,sui:{base:14000,agency:'MS Dept. of Employment Security'},guide:{reg:'MS TAP + MDES',wth:'Form 89-105 returns (frequency by size) + annual reconciliation',ui:'Quarterly UI-2/3 via MDES portal',notes:'First $10,000 of taxable income is exempt; MS is phasing its rate down annually.'}},
  {code:'NC',name:'North Carolina',type:'flat',rate:0.0399,yr:2026,stdDed:12750,sui:{base:32600,agency:'NC DES'},guide:{reg:'NCDOR online + DES',wth:'NC-5 returns (frequency by size) + NC-3 annual',ui:'Quarterly NCUI 101',notes:'Withholding rate runs slightly above the income tax rate by design (0.1% cushion) — use the DOR tables.'}},
  {code:'PA',name:'Pennsylvania',type:'flat',rate:0.0307,yr:2026,stdDed:0,sui:{base:10000,agency:'PA Dept. of L&I (UC)'},extras:[{label:'PA UC employee share',rate:0.0007,cap:Infinity}],guide:{reg:'myPATH + UCMS',wth:'PA-501 deposits + PA-W3 quarterly reconciliation',ui:'Quarterly UC-2/2A via UCMS',notes:'Local Earned Income Tax (typically 1–2%+) must be withheld by work municipality — register with the local collector (e.g. Berkheimer/Keystone).'}},
  {code:'UT',name:'Utah',type:'flat',rate:0.0455,yr:2026,stdDed:0,sui:{base:48900,agency:'UT DWS'},guide:{reg:'Utah TAP + DWS',wth:'TC-941 returns quarterly + annual reconciliation',ui:'Quarterly UI report via DWS',notes:''}},

  // ── Progressive / bracket states (single-filer annual brackets) ──
  {code:'AL',name:'Alabama',type:'brackets',yr:2025,stdDed:3000,brackets:[[500,.02],[3000,.04],[Infinity,.05]],sui:{base:8000,agency:'AL DOL'},guide:{reg:'My Alabama Taxes + AL DOL eGov',wth:'A-6 monthly / A-1 quarterly + A-3 annual',ui:'Quarterly UC-CR-4',notes:'Some AL cities levy occupational taxes on wages.'}},
  {code:'AR',name:'Arkansas',type:'brackets',yr:2025,stdDed:2340,brackets:[[4500,.02],[8900,.039],[Infinity,.039]],sui:{base:7000,agency:'ADWS'},guide:{reg:'ATAP + ADWS',wth:'AR941M monthly + AR3MAR annual',ui:'Quarterly DWS-ARK-209B',notes:'Top rate has been cut repeatedly — verify the current top rate.'}},
  {code:'CA',name:'California',type:'brackets',yr:2025,stdDed:5540,brackets:[[10756,.011],[25499,.022],[40245,.044],[55866,.066],[70606,.088],[360659,.1023],[432787,.1133],[721314,.1243],[Infinity,.1353]],extras:[{label:'CA SDI',rate:0.012,cap:Infinity}],sui:{base:7000,agency:'CA EDD'},guide:{reg:'EDD e-Services for Business (single account for WH + UI + SDI)',wth:'DE 88 deposits (schedule follows your federal schedule) + DE 9/DE 9C quarterly',ui:'Included in DE 9 quarterly filing',notes:'SDI has no wage cap since 2024. California also levies 0.1% Employment Training Tax (employer).'}},
  {code:'CT',name:'Connecticut',type:'brackets',yr:2025,stdDed:0,exemptAmt:15000,brackets:[[10000,.02],[50000,.045],[100000,.055],[200000,.06],[250000,.065],[500000,.069],[Infinity,.0699]],extras:[{label:'CT Paid Leave',rate:0.005,cap:184500}],sui:{base:26100,agency:'CT DOL'},guide:{reg:'myconneCT + CT DOL ReEmployCT',wth:'CT-WH deposits + CT-941 quarterly + CT-W3 annual',ui:'Quarterly return via ReEmployCT',notes:'Personal exemption phases out with income; use DRS withholding calculation rules (Form CT-W4 codes).'}},
  {code:'DE',name:'Delaware',type:'brackets',yr:2025,stdDed:3250,brackets:[[2000,0],[5000,.022],[10000,.039],[20000,.048],[25000,.052],[60000,.0555],[Infinity,.066]],sui:{base:10500,agency:'DE DOL'},extras:[{label:'DE Paid Leave (employee share)',rate:0.004,cap:184500}],guide:{reg:'One Stop (revenue + UI together)',wth:'W-1 monthly or quarterly + W-3 annual',ui:'Quarterly UC-8',notes:'Delaware Paid Leave contributions began 2025.'}},
  {code:'DC',name:'District of Columbia',type:'brackets',yr:2025,stdDed:16100,brackets:[[10000,.04],[40000,.06],[60000,.065],[250000,.085],[500000,.0925],[1000000,.0975],[Infinity,.1075]],sui:{base:9000,agency:'DC DOES'},guide:{reg:'MyTax.DC + DOES ESSP',wth:'FR-900Q quarterly (or monthly by size) + FR-900A annual',ui:'Quarterly UC-30',notes:'DC Paid Family Leave is employer-paid (0.26% of wages) — no employee deduction.'}},
  {code:'HI',name:'Hawaii',type:'brackets',yr:2025,stdDed:4400,brackets:[[9600,.014],[19200,.032],[38400,.055],[48000,.064],[57600,.068],[76800,.072],[172800,.076],[225000,.079],[275000,.0825],[325000,.09],[425000,.10],[Infinity,.11]],extras:[{label:'HI TDI (typical employee share)',rate:0.005,cap:70000}],sui:{base:62000,agency:'HI DLIR'},guide:{reg:'Hawaii Tax Online + DLIR',wth:'HW-14 quarterly + HW-30 annual',ui:'Quarterly UC-B6',notes:'Hawaii brackets widened substantially starting 2025; TDI can be employer-covered.'}},
  {code:'KS',name:'Kansas',type:'brackets',yr:2025,stdDed:3605,brackets:[[23000,.052],[Infinity,.0558]],sui:{base:14000,agency:'KS DOL'},guide:{reg:'Kansas Customer Service Center + KDOL',wth:'KW-5 deposits + KW-3 annual',ui:'Quarterly wage report via KDOL',notes:'Kansas moved to a two-bracket system in 2024.'}},
  {code:'LA',name:'Louisiana',type:'flat',rate:0.03,yr:2026,stdDed:12500,sui:{base:7700,agency:'LA Workforce Commission'},guide:{reg:'LaTAP + LWC',wth:'L-1 quarterly + L-3 annual',ui:'Quarterly wage report via LAWATS',notes:'Louisiana switched to a 3% flat tax in 2025 with a larger standard deduction.'}},
  {code:'ME',name:'Maine',type:'brackets',yr:2025,stdDed:16100,brackets:[[26800,.058],[63450,.0675],[Infinity,.0715]],sui:{base:12000,agency:'ME DOL'},extras:[{label:'ME Paid Family Leave (employee share)',rate:0.005,cap:184500}],guide:{reg:'Maine Tax Portal + ReEmployME',wth:'Form 941ME quarterly',ui:'Quarterly UC-1 via ReEmployME',notes:'Maine PFML premiums started Jan 2025 (benefits 2026).'}},
  {code:'MD',name:'Maryland',type:'brackets',yr:2025,stdDed:2900,brackets:[[1000,.02],[2000,.03],[3000,.04],[100000,.0475],[125000,.05],[150000,.0525],[250000,.055],[Infinity,.0575]],sui:{base:8500,agency:'MD DOL'},guide:{reg:'Maryland Tax Connect + BEACON',wth:'MW506 remittances + MW508 annual',ui:'Quarterly via BEACON',notes:'County income taxes (2.25%–3.2%) are withheld together with state tax using combined MD tables.'}},
  {code:'MN',name:'Minnesota',type:'brackets',yr:2025,stdDed:14950,brackets:[[32570,.0535],[106990,.068],[198630,.0785],[Infinity,.0985]],sui:{base:43000,agency:'MN DEED'},extras:[{label:'MN Paid Leave (employee share)',rate:0.0044,cap:184500}],guide:{reg:'MN e-Services + UI Minnesota',wth:'Deposits by schedule + quarterly return via e-Services',ui:'Quarterly wage detail via UI MN',notes:'MN Paid Leave premiums began Jan 1 2026.'}},
  {code:'MO',name:'Missouri',type:'brackets',yr:2025,stdDed:16100,brackets:[[1313,0],[2626,.02],[3939,.025],[5252,.03],[6565,.035],[7878,.04],[9191,.045],[Infinity,.047]],sui:{base:9500,agency:'MO DOLIR'},guide:{reg:'MyTax Missouri + UInteract',wth:'MO-941 (frequency by size) + MO-W3 annual',ui:'Quarterly via UInteract',notes:'St. Louis and Kansas City levy a 1% earnings tax.'}},
  {code:'MT',name:'Montana',type:'brackets',yr:2025,stdDed:16100,brackets:[[21100,.047],[Infinity,.059]],sui:{base:45100,agency:'MT DLI'},guide:{reg:'Montana TAP + UI eServices',wth:'MW-1 deposits + MW-3 annual',ui:'Quarterly UI-5',notes:'Montana simplified to two brackets in 2024.'}},
  {code:'NE',name:'Nebraska',type:'brackets',yr:2025,stdDed:8600,brackets:[[4030,.0246],[24120,.0351],[38870,.0501],[Infinity,.052]],sui:{base:9000,agency:'NE DOL'},guide:{reg:'NebFile for Business + NEworks',wth:'Form 501 deposits + 941N quarterly + W-3N annual',ui:'Quarterly via NEworks',notes:'Top rate is stepping down annually toward 3.99%.'}},
  {code:'NJ',name:'New Jersey',type:'brackets',yr:2025,stdDed:0,exemptAmt:1000,brackets:[[20000,.014],[35000,.0175],[40000,.035],[75000,.05525],[500000,.0637],[1000000,.0897],[Infinity,.1075]],extras:[{label:'NJ UI/WF/SWF (employee)',rate:0.004,cap:44300},{label:'NJ Family Leave Insurance',rate:0.0033,cap:170550}],sui:{base:44300,agency:'NJ DOL'},guide:{reg:'NJ Business Gateway (Division of Taxation + DOL)',wth:'NJ-500 deposits + NJ-927 quarterly + NJ-W-3 annual',ui:'WR-30 wage report quarterly',notes:'Employee-side UI/FLI/DI deductions make NJ paystubs busier than most — show each line separately.'}},
  {code:'NM',name:'New Mexico',type:'brackets',yr:2025,stdDed:16100,brackets:[[5500,.015],[16500,.032],[33500,.043],[66500,.047],[210000,.049],[Infinity,.059]],sui:{base:33200,agency:'NM DWS'},guide:{reg:'NM TAP + DWS',wth:'TRD-41414 quarterly',ui:'Quarterly via NM DWS portal',notes:'2025 restructure added a lower 1.5% bottom bracket.'}},
  {code:'NY',name:'New York',type:'brackets',yr:2025,stdDed:8000,brackets:[[8500,.04],[11700,.045],[13900,.0525],[80650,.055],[215400,.06],[1077550,.0685],[5000000,.0965],[25000000,.103],[Infinity,.109]],extras:[{label:'NY Paid Family Leave',rate:0.00388,cap:91373},{label:'NY SDI (max $0.60/wk)',rate:0.005,cap:6240}],sui:{base:13000,agency:'NY DOL'},guide:{reg:'NY Business Express (Tax Dept + DOL joint NYS-100)',wth:'NYS-1 deposits + NYS-45 quarterly (combined WH + UI + wage reporting)',ui:'Included in NYS-45',notes:'NYC and Yonkers residents need city withholding on top of state. NYS-45 covers everything quarterly — one combined return.'}},
  {code:'ND',name:'North Dakota',type:'brackets',yr:2025,stdDed:16100,brackets:[[48475,0],[244825,.0195],[Infinity,.025]],sui:{base:45100,agency:'Job Service ND'},guide:{reg:'ND TAP + Job Service ND',wth:'Form 306 quarterly',ui:'Quarterly via UI EASY',notes:'A large zero bracket means many employees owe no ND withholding.'}},
  {code:'OH',name:'Ohio',type:'brackets',yr:2025,stdDed:0,brackets:[[26050,0],[100000,.0275],[Infinity,.0305]],sui:{base:9000,agency:'ODJFS'},guide:{reg:'Ohio Business Gateway + ODJFS (The SOURCE)',wth:'IT-501 deposits + IT-941 annual',ui:'Quarterly via The SOURCE',notes:'Ohio municipal income taxes (RITA/CCA or city-direct) are a separate withholding obligation for the work city.'}},
  {code:'OK',name:'Oklahoma',type:'brackets',yr:2025,stdDed:6350,brackets:[[1000,.0025],[2500,.0075],[3750,.0175],[4900,.0275],[7200,.0375],[Infinity,.0475]],sui:{base:28200,agency:'OESC'},guide:{reg:'OkTAP + OESC EZ Tax Express',wth:'WTH-10001 quarterly',ui:'Quarterly via EZ Tax Express',notes:''}},
  {code:'OR',name:'Oregon',type:'brackets',yr:2025,stdDed:2835,brackets:[[4400,.0475],[11050,.0675],[125000,.0875],[Infinity,.099]],extras:[{label:'OR Paid Leave (employee share)',rate:0.006,cap:184500},{label:'OR Statewide Transit Tax',rate:0.001,cap:Infinity}],sui:{base:54300,agency:'OR Employment Dept.'},guide:{reg:'Frances Online (combined payroll: WH + UI + Paid Leave + transit)',wth:'OQ quarterly combined return; deposits follow federal schedule',ui:'Included in Form OQ',notes:'Portland-metro employees may owe Multnomah PFA / Metro SHS local taxes.'}},
  {code:'RI',name:'Rhode Island',type:'brackets',yr:2025,stdDed:10900,brackets:[[79900,.0375],[181650,.0475],[Infinity,.0599]],extras:[{label:'RI TDI',rate:0.012,cap:91600}],sui:{base:31300,agency:'RI DLT'},guide:{reg:'RI Division of Taxation + DLT combined registration',wth:'RI-941 quarterly; deposits by schedule',ui:'Quarterly TX-17 (includes TDI)',notes:''}},
  {code:'SC',name:'South Carolina',type:'brackets',yr:2025,stdDed:16100,brackets:[[3560,0],[17830,.03],[Infinity,.062]],sui:{base:14000,agency:'SC DEW'},guide:{reg:'MyDORWAY + SUITS',wth:'WH-1605 quarterly + WH-1606 annual',ui:'Quarterly via SUITS',notes:'Top rate is being phased down (6.2% for 2025).'}},
  {code:'VT',name:'Vermont',type:'brackets',yr:2025,stdDed:7400,brackets:[[47900,.0335],[116000,.066],[242000,.076],[Infinity,.0875]],extras:[{label:'VT Child Care Contribution (employee share, optional)',rate:0.0011,cap:Infinity}],sui:{base:14800,agency:'VT DOL'},guide:{reg:'myVTax + VT DOL',wth:'WHT-436 quarterly + WHT-434 annual',ui:'Quarterly C-101',notes:'Employers may pass up to a quarter of the 0.44% child-care tax to employees.'}},
  {code:'VA',name:'Virginia',type:'brackets',yr:2025,stdDed:8750,brackets:[[3000,.02],[5000,.03],[17000,.05],[Infinity,.0575]],sui:{base:8000,agency:'VEC'},guide:{reg:'VA Tax online + VEC (iFile/eForms)',wth:'VA-5 (monthly/quarterly) or VA-15 semiweekly + VA-6 annual',ui:'Quarterly FC-20/21',notes:''}},
  {code:'WV',name:'West Virginia',type:'brackets',yr:2025,stdDed:0,brackets:[[10000,.0222],[25000,.0296],[40000,.0333],[60000,.0444],[Infinity,.0482]],sui:{base:9500,agency:'WorkForce WV'},guide:{reg:'MyTaxes WV + WorkForce WV',wth:'IT-101 remittances + IT-103 annual',ui:'Quarterly via WorkForce WV',notes:'Rates continue to trigger down with revenue growth — verify each year.'}},
  {code:'WI',name:'Wisconsin',type:'brackets',yr:2025,stdDed:13930,brackets:[[14680,.035],[29370,.044],[323290,.053],[Infinity,.0765]],sui:{base:14000,agency:'WI DWD'},guide:{reg:'My Tax Account + DWD',wth:'WT-6 deposits + WT-7 annual',ui:'Quarterly UCT-101',notes:''}},
];

// ── Calculation engine ───────────────────────────────────────────────────────
function _uspBracketTax(taxable, brackets){
  let tax=0, prev=0;
  for(const [upTo,rate] of brackets){
    if(taxable<=prev) break;
    tax+=(Math.min(taxable,upTo)-prev)*rate;
    prev=upTo;
  }
  return Math.max(tax,0);
}

// input: {state, gross (per period), freq, status ('single'|'married'|'hoh'),
//         step2 (bool), depCredit (annual $), otherIncome, otherDeductions, ytdGross}
function uspCalc(input){
  const periods=USP_FREQ[input.freq]||26;
  const gross=Number(input.gross)||0;
  const annual=gross*periods;
  const status=input.status||'single';
  const st=USP_STATES.find(s=>s.code===input.state);

  // ── Federal income tax (Pub 15-T percentage method, annualized) ──
  let adjAnnual=annual+(Number(input.otherIncome)||0)-(Number(input.otherDeductions)||0);
  const stdDed=USP_FED.stdDed[status]||USP_FED.stdDed.single;
  // Step 2 checkbox: use the "higher withholding" schedule = half brackets/deduction
  let fedTaxable, fedBrackets=USP_FED.brackets[status]||USP_FED.brackets.single;
  if(input.step2){
    fedTaxable=Math.max(adjAnnual-stdDed/2,0);
    fedBrackets=fedBrackets.map(([u,r],i,arr)=>[u===Infinity?Infinity:u/2,r]);
  } else {
    fedTaxable=Math.max(adjAnnual-stdDed,0);
  }
  let fedAnnual=_uspBracketTax(fedTaxable,fedBrackets);
  fedAnnual=Math.max(fedAnnual-(Number(input.depCredit)||0),0);
  const fedWH=fedAnnual/periods;

  // ── FICA ──
  const ytd=Number(input.ytdGross)||0;
  const ssTaxableThis=Math.max(Math.min(ytd+gross,USP_FED.ssWageBase)-Math.min(ytd,USP_FED.ssWageBase),0);
  const ss=ssTaxableThis*USP_FED.ssRate;
  let medicare=gross*USP_FED.medRate;
  if(ytd+gross>USP_FED.medAddlThreshold){
    const addlTaxable=Math.max(Math.min(ytd+gross,Infinity)-Math.max(ytd,USP_FED.medAddlThreshold),0);
    medicare+=Math.min(addlTaxable,gross)*USP_FED.medAddlRate;
  }

  // ── State income tax ──
  let stateWH=0, stateLines=[];
  if(st){
    if(st.type==='flat'||st.type==='brackets'){
      let stTaxable=annual-(st.stdDed||0)-(st.exemptAmt||0)-(st.exemptFirst||0);
      stTaxable=Math.max(stTaxable,0);
      const stAnnual=st.type==='flat'?stTaxable*st.rate:_uspBracketTax(stTaxable,st.brackets);
      stateWH=stAnnual/periods;
    }
    (st.extras||[]).forEach(x=>{
      const capLeft=x.cap===Infinity?gross:Math.max(Math.min(ytd+gross,x.cap)-Math.min(ytd,x.cap),0);
      const amt=Math.min(capLeft,gross)*x.rate;
      if(amt>0.004) stateLines.push({label:x.label,amt});
    });
  }
  const extrasTotal=stateLines.reduce((s,l)=>s+l.amt,0);

  // ── Employer side ──
  const erSS=ss; // employer matches (same base)
  const erMed=gross*USP_FED.medRate;
  const futaTaxable=Math.max(Math.min(ytd+gross,USP_FED.futaBase)-Math.min(ytd,USP_FED.futaBase),0);
  const futa=futaTaxable*USP_FED.futaRate;

  const totalTax=fedWH+ss+medicare+stateWH+extrasTotal;
  return {
    gross, periods, annual,
    fedWH, ss, medicare, stateWH, stateLines, extrasTotal,
    net: gross-totalTax, totalTax,
    employer:{ss:erSS,medicare:erMed,futa,suiBase:st?.sui?.base||null,suiAgency:st?.sui?.agency||''},
    state:st||null,
  };
}

// ── UI: calculator page ──────────────────────────────────────────────────────
const _uspF=n=>'$'+(Math.round(n*100)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});

function uspOpenCalc(){
  document.getElementById('usp-page')?.remove();
  const page=document.createElement('div');
  page.id='usp-page';
  page.className='mc-page';
  page.innerHTML=`
    <div class="mc-page-bar">
      <button class="mc-page-back" onclick="document.getElementById('usp-page').remove()"><svg width="10" height="17" viewBox="0 0 9 15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 1 2 7.5 8 14"/></svg></button>
      <div class="mc-page-title">US Payroll Calculator</div>
    </div>
    <div class="mc-page-body" style="padding-top:2px">
      <div class="mca-card" style="margin:0 0 12px">
        <div class="mca-row"><span class="mca-lbl">State</span>
          <select id="usp-state" class="mca-dt" style="min-width:150px" onchange="uspRun()">
            ${USP_STATES.map(s=>`<option value="${s.code}"${s.code==='CA'?' selected':''}>${s.name}</option>`).join('')}
          </select></div>
        <div class="mca-row"><span class="mca-lbl">Pay frequency</span>
          <select id="usp-freq" class="mca-dt" onchange="uspRun()">
            <option value="weekly">Weekly</option><option value="biweekly" selected>Bi-weekly</option>
            <option value="semimonthly">Semi-monthly</option><option value="monthly">Monthly</option>
          </select></div>
        <div class="mca-row"><span class="mca-lbl">Gross pay / period</span>
          <input id="usp-gross" class="mca-dt" type="number" inputmode="decimal" value="2500" style="width:110px;text-align:right" oninput="uspRun()"></div>
        <div class="mca-row"><span class="mca-lbl">YTD gross (before this)</span>
          <input id="usp-ytd" class="mca-dt" type="number" inputmode="decimal" value="0" style="width:110px;text-align:right" oninput="uspRun()"></div>
      </div>
      <div class="mca-card" style="margin:0 0 12px">
        <div class="mca-row"><span class="mca-lbl">W-4 filing status</span>
          <select id="usp-status" class="mca-dt" onchange="uspRun()">
            <option value="single">Single / MFS</option><option value="married">Married filing jointly</option><option value="hoh">Head of household</option>
          </select></div>
        <div class="mca-row"><span class="mca-lbl">W-4 Step 2 (two jobs)</span>
          <label class="mca-sw"><input type="checkbox" id="usp-step2" onchange="uspRun()"><i></i></label></div>
        <div class="mca-row"><span class="mca-lbl">Dependents credit (annual)</span>
          <input id="usp-dep" class="mca-dt" type="number" inputmode="decimal" value="0" style="width:110px;text-align:right" oninput="uspRun()"></div>
      </div>
      <div id="usp-result"></div>
      <button class="fr-newbtn" style="width:100%;margin-top:4px" onclick="uspOpenGuide(document.getElementById('usp-state').value)">📋 Filing guide for this state</button>
      <div style="font-size:10.5px;color:var(--muted);line-height:1.55;margin-top:14px">
        Federal: ${USP_FED.year} Pub 15-T percentage method (SS wage base ${_uspF(USP_FED.ssWageBase)}). State rates carry their own year tag — verify against the state's current withholding tables before filing. Local/city taxes are flagged in each filing guide but not computed here.
      </div>
    </div>`;
  document.body.appendChild(page);
  uspRun();
}
function uspRun(){
  const box=document.getElementById('usp-result'); if(!box) return;
  const r=uspCalc({
    state:document.getElementById('usp-state').value,
    freq:document.getElementById('usp-freq').value,
    gross:document.getElementById('usp-gross').value,
    ytdGross:document.getElementById('usp-ytd').value,
    status:document.getElementById('usp-status').value,
    step2:document.getElementById('usp-step2').checked,
    depCredit:document.getElementById('usp-dep').value,
  });
  const line=(l,v,c)=>`<div style="display:flex;justify-content:space-between;padding:7px 14px;font-size:13px"><span style="color:var(--muted)">${l}</span><span style="color:${c||'var(--offwhite)'};font-weight:600">${v}</span></div>`;
  box.innerHTML=`
    <div class="mca-card" style="margin:0 0 12px;padding:6px 0">
      ${line('Federal income tax','− '+_uspF(r.fedWH))}
      ${line('Social Security (6.2%)','− '+_uspF(r.ss))}
      ${line('Medicare','− '+_uspF(r.medicare))}
      ${r.state&&r.state.type!=='none'?line(r.state.name+' income tax ('+r.state.yr+')','− '+_uspF(r.stateWH)):line((r.state?.name||'State')+' income tax','$0.00 — no state income tax','var(--green)')}
      ${r.stateLines.map(l=>line(l.label,'− '+_uspF(l.amt))).join('')}
      <div style="height:1px;background:var(--border);margin:4px 14px"></div>
      ${line('<b style="color:var(--white)">Net pay</b>','<b>'+_uspF(r.net)+'</b>','var(--green)')}
    </div>
    <div class="mca-card" style="margin:0 0 12px;padding:6px 0">
      <div style="padding:8px 14px 2px;font-size:10.5px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">Employer cost (this period)</div>
      ${line('Social Security match',_uspF(r.employer.ss))}
      ${line('Medicare match',_uspF(r.employer.medicare))}
      ${line('FUTA (0.6% after credit)',_uspF(r.employer.futa))}
      ${r.employer.suiBase?line('State UI','rate varies — wage base '+_uspF(r.employer.suiBase)):''}
    </div>`;
}

// ── UI: filing guide page ────────────────────────────────────────────────────
function uspOpenGuide(code){
  const st=USP_STATES.find(s=>s.code===code); if(!st) return;
  document.getElementById('usp-guide-page')?.remove();
  const page=document.createElement('div');
  page.id='usp-guide-page';
  page.className='mc-page';
  const g=st.guide||{};
  const sec=(t,b)=>b?`<div style="margin-bottom:16px"><div style="font-size:11px;font-weight:800;color:var(--blue-bright);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">${t}</div><div style="font-size:13.5px;color:var(--offwhite);line-height:1.6">${b}</div></div>`:'';
  page.innerHTML=`
    <div class="mc-page-bar">
      <button class="mc-page-back" onclick="document.getElementById('usp-guide-page').remove()"><svg width="10" height="17" viewBox="0 0 9 15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 1 2 7.5 8 14"/></svg></button>
      <div class="mc-page-title">${st.name} — Filing Guide</div>
    </div>
    <div class="mc-page-body">
      ${sec('1 · Register as an employer',(g.reg||'Register with the state revenue department and workforce agency.')+' Also file federal Form SS-4 for an EIN if you don\'t have one, and report new hires to the state directory within 20 days.')}
      ${sec('2 · Withhold each payday','Use this calculator (or the state\'s tables) each pay run. '+(st.type==='none'?'No state income tax to withhold in '+st.name+'.':'Rates shown are '+st.yr+' — re-check every January.'))}
      ${sec('3 · Remit & file income tax withholding',g.wth||'')}
      ${sec('4 · Unemployment insurance (employer-paid)',(g.ui||'File quarterly wage reports.')+(st.sui?' Wage base: '+_uspF(st.sui.base)+' per employee per year with '+st.sui.agency+'. Your rate comes from your experience rating (new employers get a standard rate).':''))}
      ${sec('5 · Federal side (all states)','Deposit federal withholding + FICA per your IRS deposit schedule (monthly or semi-weekly), file Form 941 quarterly and Form 940 (FUTA) annually.')}
      ${sec('6 · Year-end','Issue W-2s to employees and file with the SSA by Jan 31, plus the state\'s annual reconciliation'+(g.wth&&/annual/i.test(g.wth)?' (see form above)':'')+'.')}
      ${g.notes?sec('Worth knowing',g.notes):''}
      <div style="font-size:10.5px;color:var(--muted);line-height:1.55;margin-top:6px">This guide is a working checklist, not legal or tax advice — agencies, forms, and rates change. Confirm on the agency sites before your first filing.</div>
    </div>`;
  document.body.appendChild(page);
}
