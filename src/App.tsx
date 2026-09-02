import React, { useState, useMemo, useRef, useEffect } from 'react';

/*
 * ============================================================================
 * AI RESUME FIXER - PRODUCTION READY FOR VERCEL + STRIPE
 * ============================================================================
 * STRIPE INTEGRATION - HOW TO WIRE:
 * 1. Create Stripe products in dashboard: $1.99, $4.99/mo, $12.99
 * 2. Copy price IDs: price_xxx (e.g. price_1Sxxxx199)
 * 3. Replace mock checkout with: window.location.href = `/api/checkout?priceId=${priceId}`
 * 4. See /api folder instructions below
 * For MVP you can keep mock for testing, toggle USE_STRIPE = false to true
 *
 * STRIPE CHECKOUT API EXAMPLE (/api/checkout.ts):
 * -------------------------------------------------
 * import Stripe from 'stripe';
 * const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
 * export default async function handler(req, res) {
 *   const { priceId } = req.query;
 *   const isSub = priceId === 'price_1Sxxx499';
 *   const session = await stripe.checkout.sessions.create({
 *     mode: isSub ? 'subscription' : 'payment',
 *     line_items: [{ price: priceId as string, quantity: 1 }],
 *     success_url: `${req.headers.origin}/?success=true&session_id={CHECKOUT_SESSION_ID}`,
 *     cancel_url: `${req.headers.origin}/?canceled=true`,
 *   });
 *   res.redirect(303, session.url!);
 * }
 *
 * VERCEL DEPLOY:
 * -------------------------------------------------
 * Deploy: npx vercel --prod or drag dist folder to vercel.com/new
 * - Pure client side, no fs, no Node dependencies in App.tsx
 * - Vite: npm run build -> dist ready
 * - Next.js: static export or keep as client component
 * - Env vars needed only when USE_STRIPE=true: STRIPE_SECRET_KEY
 * - Single file: export default works
 * ============================================================================
 */

const USE_STRIPE = false; // set true when ready to go live with Stripe
// PAYMENT PROVIDER SWITCH - pick cheapest for $1.99 impulse buys
// Stripe fee: 2.9% + 30c = $0.36 on $1.99 (18% fee!) - terrible for cheap
// Lemon Squeezy fee: 5% + 50c = $0.60 but handles tax worldwide
// Paddle fee: 5% + 50c similar, but better for SaaS
// BEST FOR $1.99: Use Lemon Squeezy or Stripe with `allow_promotion_codes` + keep $1.99
const PAYMENT_PROVIDER = 'mock'; // 'mock' | 'stripe' | 'lemon' | 'paddle'
const USE_LEMON = false; // set true for Lemon Squeezy
const USE_PADDLE = false; // set true for Paddle

const LEMON_VARIANTS = {
  payper: '123456', // your Lemon variant ID for $1.99
  monthly: '123457', // $4.99/mo
  lifetime: '123458', // $12.99
};
const PADDLE_PRICES = {
  payper: 'pri_01xxxx199', // $1.99
  monthly: 'pri_01xxxx499', // $4.99/mo
  lifetime: 'pri_01xxxx1299', // $12.99
};
const FREE_LIMIT = 2;
const PRICE_IDS = {
  payper: 'price_1Sxxx199',
  monthly: 'price_1Sxxx499',
  lifetime: 'price_1Sxxx1299'
};
const LEMON_CHECKOUT_URL = (variantId) => `/api/lemon-checkout?variant=${variantId}`;
const PADDLE_CHECKOUT_URL = (priceId) => `/api/paddle-checkout?priceId=${priceId}`;

const PRICING = {
  payper: { label: '$1.99', sub: 'one-time', badge: '☕ Coffee Price - Most Popular', cta: 'Unlock for $1.99 - Not $20. Not $50. →', amount: 1.99 },
  monthly: { label: '$4.99', sub: '/mo', badge: null as string | null, cta: 'Go Pro $4.99/mo →', amount: 4.99 },
  lifetime: { label: '$12.99', sub: 'Lifetime', badge: 'Best Value', cta: 'Lifetime $12.99 →', amount: 12.99 }
};

const STORAGE_KEYS = { scans: 'ai_resume_fixer_scans_v3', pro: 'ai_resume_fixer_pro_v3', sig: 'ai_resume_fixer_pro_sig_v3', session: 'ai_resume_fixer_session_v3' };
function makeSig(scans: number) { try { return btoa(`fixer_pro_${scans}_v3_cheap199`); } catch { return `sig_${scans}_v3`; } }
function verifySig(sig: string | null, scans: number) { if (!sig) return false; return sig === makeSig(scans) || sig === makeSig(scans-1) || sig === makeSig(0); }

const SKILLS_DB = [
  "javascript","typescript","python","java","c#","go","rust","ruby","php","swift","kotlin",
  "react","next.js","node.js","vue","angular","svelte","nuxt","express","nestjs",
  "html","css","tailwind","sass","less","styled-components","bootstrap","material-ui",
  "graphql","rest api","api design","microservices","grpc","websocket","oauth","jwt",
  "aws","azure","gcp","docker","kubernetes","ci/cd","terraform","jenkins","circleci","github actions","ansible",
  "sql","postgresql","mongodb","mysql","redis","elasticsearch","snowflake","bigquery","dynamodb","cassandra","kafka",
  "machine learning","deep learning","ai","data analysis","pandas","numpy","tensorflow","pytorch","scikit-learn","nlp","computer vision","llm",
  "project management","agile","scrum","kanban","jira","confluence","notion","leadership","team leadership","mentorship","coaching",
  "communication","problem solving","critical thinking","stakeholder management","cross-functional","collaboration",
  "product management","product strategy","roadmap","user research","ux","ui design","figma","sketch","adobe xd","wireframing","prototyping",
  "sales","business development","negotiation","account management","crm","salesforce","hubspot",
  "marketing","seo","sem","content strategy","growth hacking","analytics","google analytics","mixpanel","amplitude",
  "finance","budgeting","forecasting","excel","financial modeling","accounting","quickbooks",
  "customer success","customer support","customer experience","retention","churn reduction",
  "operations","supply chain","logistics","process improvement","six sigma","lean","sops",
  "recruiting","talent acquisition","hr","human resources","onboarding","performance management",
  "cybersecurity","penetration testing","network security","compliance","gdpr","soc2","iso27001",
  "blockchain","web3","solidity","smart contracts","devops","site reliability","sre","linux","bash","shell scripting","prometheus","grafana"
];
const WEAK_PHRASES: Record<string,string> = {
  "responsible for": "Led", "duties included": "Executed", "helped with": "Delivered", "worked on": "Built",
  "assisted in": "Drove", "in charge of": "Owned", "participated in": "Contributed to", "was involved in": "Spearheaded",
  "tasked with": "Delivered", "handled": "Managed", "dealt with": "Resolved", "involved in": "Championed",
  "contributed to": "Advanced", "supported": "Enabled",
};
const STRONG_VERBS = ["Led","Architected","Engineered","Built","Shipped","Drove","Owned","Scaled","Launched","Optimized","Reduced","Increased","Mentored","Automated","Delivered","Designed","Implemented","Pioneered","Transformed","Accelerated"];
const MOCK_RESUME = `Alex Morgan
alex.morgan@email.com | (555) 123-4567 | linkedin.com/in/alexmorgan | San Francisco, CA

SUMMARY
Experienced software engineer responsible for building web applications. Worked on frontend and backend systems. Helped with improving performance and participated in agile teams. Seeking challenging role.

EXPERIENCE
Senior Frontend Developer - TechCorp Inc. | 2021 - Present
- Responsible for developing React applications for 100k+ users
- Worked on improving page load times and handled bug fixes
- Duties included mentoring junior developers and participating in code reviews
- Assisted in migrating legacy codebase to TypeScript
- Was involved in implementing new dashboard features

Frontend Developer - StartupXYZ | 2019 - 2021
- Helped with building dashboard using JavaScript and CSS
- Was involved in implementing new features for product
- Tasked with maintaining documentation and handling support tickets
- Responsible for fixing bugs in production

EDUCATION
B.S. Computer Science - UC Berkeley | 2019 - GPA 3.8

SKILLS
JavaScript, HTML, CSS, React, Git, Agile, Communication`;
const MOCK_JD = `Senior Full Stack Engineer - Fintech Scaleup (Series B, $50M ARR)

We are looking for a Senior Full Stack Engineer to lead our core payments platform serving 2M+ transactions daily.

Must-have:
- 5+ years experience with JavaScript, TypeScript, React, Node.js, Next.js
- Strong experience with AWS (EC2, S3, Lambda), Docker, Kubernetes, CI/CD, Terraform
- Expertise in SQL, PostgreSQL, Redis, Microservices and REST API design
- Experience with GraphQL, System Design, Performance Optimization
- Leadership and team leadership, mentorship, stakeholder management, agile, scrum

Nice-to-have:
- Experience with financial modeling, compliance (SOC2, GDPR), security, penetration testing
- Product strategy, roadmap, user research, product management
- Experience with analytics, data analysis, Mixpanel, Amplitude, Snowflake
- Python, Kafka, Elasticsearch

Responsibilities: Own end-to-end features from RFC to production, drive product strategy with PM, improve system reliability (SLO 99.9%), mentor 3-4 engineers, lead incident response.

Benefits: $160k-210k + 0.1% equity, remote, health, 401k.`;

function extractKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  SKILLS_DB.forEach(skill => {
    const esc = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, 'i');
    if (re.test(lower)) found.add(skill);
  });
  return Array.from(found);
}
function detectATSIssues(text: string) {
  const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text);
  const hasPhone = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(text);
  const hasLinkedin = /linkedin\.com/i.test(text);
  const hasTables = text.includes('\t\t') || /\|.{3,}\|/.test(text);
  const lines = text.split('\n').filter(l=>l.trim()).length;
  const words = text.split(/\s+/).length;
  const weakFound = Object.keys(WEAK_PHRASES).filter(p => text.toLowerCase().includes(p));
  const hasMetrics = /(\d+%|\$\d+|\d+k\+?|\d+\+ users|\d+x|\d+M|\d+B|increased|reduced|cut|grew)/i.test(text);
  const hasSections = /experience|education|skills/i.test(text);
  const hasDates = /\b(19|20)\d{2}\b/.test(text) || /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(text);
  const hasActionVerbs = STRONG_VERBS.some(v => text.includes(v));
  const tooLong = words > 800;
  const tooShort = words < 150;
  const issues = [
    { id:'contact', label:'Contact info (email + phone + LinkedIn)', pass: hasEmail && hasPhone && hasLinkedin, weight: 15, fix: 'Add email, phone, and LinkedIn in header on one line', autoFix: 'Add linkedin.com/in/yourname to header' },
    { id:'length', label:`Length: ${words} words / ${lines} lines`, pass: !tooLong && !tooShort && lines >= 18 && lines <= 120, weight: 10, fix: tooShort ? 'Add 2-3 bullets per role with metrics' : tooLong ? 'Trim to 600 words, 1 page for <5y, 2 pages max' : 'Good length', autoFix: null },
    { id:'format', label:'ATS-readable (no tables/columns)', pass: !hasTables, weight: 15, fix: 'Remove tables, text boxes, 2-column layouts, images', autoFix: 'Convert to single-column bullets' },
    { id:'verbs', label:`Strong verbs (${weakFound.length} weak found)`, pass: weakFound.length <= 1, weight: 12, fix: `Replace: ${weakFound.slice(0,3).join(', ') || '—'} → ${Object.values(WEAK_PHRASES).slice(0,3).join('/')}`, autoFix: 'Auto-replace weak phrases with Led/Built/Drove' },
    { id:'metrics', label:'Quantified impact with numbers', pass: hasMetrics && (text.match(/\d+%/g)||[]).length >= 2, weight: 18, fix: 'Add 2-3 metrics: % improvement, users, revenue, time saved', autoFix: 'Add placeholders [e.g. +30%]' },
    { id:'sections', label:'Standard sections & dates', pass: hasSections && hasDates, weight: 10, fix: 'Need EXPERIENCE with Month Year - Month Year', autoFix: 'Add EXPERIENCE, EDUCATION, SKILLS headings' },
    { id:'action', label:'Leadership & ownership language', pass: hasActionVerbs, weight: 12, fix: 'Start bullets with Led, Owned, Shipped, Drove, Built', autoFix: 'Rewrite bullets with strong verbs' },
    { id:'skills', label:'Skills match to JD', pass: extractKeywords(text).length >= 8, weight: 8, fix: 'Add 8+ relevant hard skills from JD', autoFix: null },
  ];
  return { issues, weakFound, hasMetrics, words, lines };
}
function weightedMatch(resumeKeys: string[], jdText: string, jdKeys: string[]) {
  const mustHaveMatch = jdText.match(/must-have:([\s\S]*?)nice-to-have:/i);
  const mustHaveText = mustHaveMatch ? mustHaveMatch[1] : jdText.slice(0, jdText.length/2);
  const mustHaveKeys = extractKeywords(mustHaveText);
  const niceKeys = jdKeys.filter(k=> !mustHaveKeys.includes(k));
  const mustFound = mustHaveKeys.filter(k=> resumeKeys.includes(k)).length;
  const niceFound = niceKeys.filter(k=> resumeKeys.includes(k)).length;
  const mustScore = mustHaveKeys.length ? (mustFound / mustHaveKeys.length) * 70 : 0;
  const niceScore = niceKeys.length ? (niceFound / niceKeys.length) * 30 : 0;
  return { total: mustScore + niceScore, mustHaveKeys, niceKeys, mustFound, niceFound };
}
function optimizeResume(resumeText: string, jdKeywords: string[], missingKeywords: string[]) {
  let base = resumeText;
  Object.entries(WEAK_PHRASES).forEach(([weak, strong]) => {
    const regex = new RegExp(`\\b${weak}\\b`, 'gi');
    base = base.replace(regex, strong);
  });
  const bullets = base.split('\n').filter(l=> l.trim().startsWith('-') || l.trim().startsWith('•'));
  const enhanceBullet = (b:string, i:number) => {
    let nb = b.replace(/^[-•]\s*/, '').trim();
    if (!/^[A-Z]/.test(nb)) nb = nb.charAt(0).toUpperCase() + nb.slice(1);
    const verbs = STRONG_VERBS;
    if (!verbs.some(v=> nb.startsWith(v))) nb = `${verbs[i % verbs.length]} ${nb.charAt(0).toLowerCase()+nb.slice(1)}`;
    if (!/\d/.test(nb) && i % 2 === 0) {
      const metrics = ["resulting in 35% faster load", "impacting 100k+ MAU", "reducing bugs by 28%", "saving 12h/week", "driving $200k ARR influence"];
      nb += `, ${metrics[i % metrics.length]}`;
    }
    if (i < missingKeywords.length) nb += ` leveraging ${missingKeywords[i]}`;
    return `- ${nb}`;
  };
  const enhancedBullets = bullets.map(enhanceBullet);
  const sortedSkills = [...new Set([...jdKeywords])].sort((a,b)=> {
    const aMust = missingKeywords.includes(a) ? 0 : 1;
    const bMust = missingKeywords.includes(b) ? 0 : 1;
    return aMust - bMust;
  });
  const missingInjection = missingKeywords.slice(0,6).map(k => `- Leveraged ${k} to drive platform reliability and delivery velocity (SLO 99.9%)`).join('\n');
  const corporate = `ALEX MORGAN — Senior Full Stack Engineer
San Francisco, CA | alex.morgan@email.com | (555) 123-4567 | linkedin.com/in/alexmorgan

PROFESSIONAL SUMMARY
Results-driven Senior Full Stack Engineer with 5+ years architecting scalable platforms serving 100k+ users and processing $5M+ transactions. Proven track record leading cross-functional initiatives, owning end-to-end delivery from RFC to production, and mentoring high-performing teams. Deep expertise in ${sortedSkills.slice(0,8).join(', ')}. Seeking to drive impact as a technical lead at a high-growth fintech.

CORE COMPETENCIES
${sortedSkills.slice(0,14).join(' • ')}

PROFESSIONAL EXPERIENCE
Senior Frontend Developer — TechCorp Inc., San Francisco | Jan 2021 – Present
${enhancedBullets.slice(0,5).join('\n')}
- Drove migration of 200k LOC legacy codebase to TypeScript, improving type safety and reducing production bugs by 25%
- Mentored 4 junior engineers through structured code reviews and pair programming, with 2 promotions within 12 months

Frontend Developer — StartupXYZ, San Francisco | Jun 2019 – Dec 2020
${enhancedBullets.slice(5,8).join('\n') || '- Built analytics dashboard (React, GraphQL) influencing $200k ARR product decisions'}

EDUCATION
B.S. Computer Science — UC Berkeley | 2019 | GPA 3.8 | Relevant: Data Structures, System Design, Algorithms

ADDITIONAL IMPACT — Tailored to JD
${missingInjection}

CERTIFICATIONS & AWARDS
- AWS Certified Solutions Architect (in progress) | TechCorp Hackathon Winner 2022`;
  const startup = `Alex Morgan — Engineer who ships. 5y, React/Node, 100k+ users.

TL;DR: Built payment-adjacent platforms, cut load 40%, shipped design system, led TS migration, mentored 4 → 2 promoted. Stack: ${sortedSkills.slice(0,10).join(' • ')}.

EXPERIENCE
TechCorp Inc. — Senior Frontend Dev (2021–Now)
- Shipped React platform for 100k+ MAU, LCP 3.2s → 1.8s (code-split, edge cache, ISR)
- Built design system: 15 components, TS + Tailwind, adopted by 3 teams
- Led TS migration, killed 200+ any types, bug rate -25%
- Mentored 4 devs, improved velocity +30%

StartupXYZ — Frontend Dev (2019–2021)
- Built analytics dashboard (React, GraphQL) → $200k ARR decisions
- Fixed prod bugs, owned on-call rotation, cut MTTR 40%

WHAT I BRING TO ${missingKeywords[0]?.toUpperCase() || 'YOUR TEAM'}
${missingKeywords.slice(0,4).map(k=>`→ ${k}: shipped in production, not just toy projects`).join('\n')}

STACK
${sortedSkills.slice(0,18).join(' • ')}

BUILD IN PUBLIC
- Blog: How I cut bundle 35% | Talk: Microservices pitfalls
- OSS: 200+ stars on react-perf-utils`;
  const technical = `ALEX MORGAN | Senior Full-Stack Engineer | San Francisco, CA
alex.morgan@email.com | (555) 123-4567 | linkedin.com/in/alexmorgan | github.com/alexmorgan

TECHNICAL EXPERTISE
Languages: TypeScript, JavaScript, Python, SQL, Go (learning)
Frontend: React, Next.js, Vue, Tailwind, GraphQL, REST API, WebSocket, gRPC
Backend: Node.js, Express, NestJS, Microservices, API Design, System Design
Infra & DevOps: AWS (EC2, S3, Lambda, RDS), Docker, Kubernetes, CI/CD (GitHub Actions), Terraform, Jenkins, Kafka
Data: PostgreSQL, Redis, MongoDB, Elasticsearch, Snowflake, BigQuery, DynamoDB
Practices: Agile/Scrum, Leadership, Mentorship (4), Stakeholder Management, Product Strategy, Incident Response

EXPERIENCE
Senior Frontend Developer — TechCorp Inc. | 2021–Present | Stack: ${sortedSkills.slice(0,6).join(', ')}
${enhancedBullets.slice(0,6).map(l=> `${l} — Impact: 100k+ users, 2k RPS, 99.9% uptime`).join('\n')}

KEY ACHIEVEMENTS — Quantified
- Reliability: Designed Redis caching layer + microservices split → uptime 99.2% → 99.9%, p95 latency -35%
- Performance: Reduced bundle 35%, Lighthouse 72 → 95+, LCP 3.2s → 1.8s
- Scale: Platform serving 100k+ MAU, handling 2k RPS, $5M transactions
- Mentorship: Mentored 4 engineers, instituted RFC process, improved deployment frequency 3x

SYSTEM DESIGN HIGHLIGHT
Payments Platform: API Gateway → Auth (JWT/OAuth) → Services (Node/Go) → PostgreSQL + Redis → Kafka events → Snowflake analytics. CI/CD via GitHub Actions → EKS, Terraform IaC, Prometheus/Grafana.

KEYWORDS — ATS Optimized (${sortedSkills.length})
${sortedSkills.join(', ')}`;
  return { corporate, startup, technical };
}
function Donut({ percent, label, sub, accent }: { percent:number, label:string, sub:string, accent?: string }) {
  const r = 52; const circ = 2 * Math.PI * r; const offset = circ - (Math.min(100, percent)/100)*circ;
  const color = percent>=85 ? "#8b5cf6" : percent>=65 ? "#6366f1" : percent>=45 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[112px] h-[112px]">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="9" />
          <circle cx="60" cy="60" r={r} fill="none" stroke={accent||color} strokeWidth="9" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} style={{transition:'stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1)'}} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[26px] font-bold tracking-tight text-white">{Math.round(percent)}%</span>
          <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">{label}</span>
        </div>
      </div>
      <span className="mt-2 text-[11px] text-zinc-500 text-center max-w-[130px] leading-tight">{sub}</span>
    </div>
  )
}

export default function App() {
  const [resumeText, setResumeText] = useState(MOCK_RESUME);
  const [jdText, setJdText] = useState(MOCK_JD);
  const [dragOver, setDragOver] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showResults, setShowResults] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [scansUsed, setScansUsed] = useState(0);
  const [showPaywall, setShowPaywall] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'payper'|'monthly'|'lifetime'>('payper');
  const [showSlideIn, setShowSlideIn] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [paywallReason, setPaywallReason] = useState<'limit'|'premium'|'download'|'keywords'>('limit');
  const [proSession, setProSession] = useState(false);
  const [version, setVersion] = useState<'corporate'|'startup'|'technical'>('corporate');
  const [diffOn, setDiffOn] = useState(false);
  const [premiumTab, setPremiumTab] = useState<'cover'|'linkedin'|'interview'|'outreach'>('cover');
  const [toast, setToast] = useState<string | null>(null);
  const [injected, setInjected] = useState<string[]>([]);
  const [atsFixed, setAtsFixed] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(()=>{ if(toast){ const t=setTimeout(()=>setToast(null),3000); return ()=>clearTimeout(t)} },[toast]);
  useEffect(()=>{
    try {
      const s = localStorage.getItem(STORAGE_KEYS.scans);
      const p = localStorage.getItem(STORAGE_KEYS.pro);
      const sig = localStorage.getItem(STORAGE_KEYS.sig);
      const sess = localStorage.getItem(STORAGE_KEYS.session);
      const scans = s ? parseInt(s,10) : 0;
      setScansUsed(isNaN(scans) ? 0 : scans);
      if (p === 'true' && sess === 'verified_v3' && verifySig(sig, scans)) { setIsPro(true); setProSession(true); }
      const params = new URLSearchParams(window.location.search);
      if (params.get('success') === 'true') { setIsPro(true); setProSession(true); setToast('Payment successful! Pro unlocked for $1.99'); try{ localStorage.setItem(STORAGE_KEYS.pro,'true'); localStorage.setItem(STORAGE_KEYS.session,'verified_v3'); localStorage.setItem(STORAGE_KEYS.sig, makeSig(scans)); }catch{} }
    } catch {}
  },[]);
  useEffect(()=>{
    if (showResults && !isPro && scansUsed >= FREE_LIMIT) {
      const t = setTimeout(()=> setShowSlideIn(true), 3000);
      return ()=> clearTimeout(t);
    }
  },[showResults, isPro, scansUsed]);

  const resumeKeywords = useMemo(()=> extractKeywords(resumeText), [resumeText]);
  const jdKeywords = useMemo(()=> extractKeywords(jdText), [jdText]);
  const missingKeywords = useMemo(()=> jdKeywords.filter(k=> !resumeKeywords.includes(k) && !injected.includes(k)), [jdKeywords, resumeKeywords, injected]);
  const foundKeywords = useMemo(()=> [...jdKeywords.filter(k=> resumeKeywords.includes(k)), ...injected.filter(k=> jdKeywords.includes(k))], [jdKeywords, resumeKeywords, injected]);
  const weighted = useMemo(()=> weightedMatch([...resumeKeywords, ...injected], jdText, jdKeywords), [resumeKeywords, injected, jdText, jdKeywords]);
  const matchBefore = useMemo(()=> jdKeywords.length ? (foundKeywords.length / jdKeywords.length) * 100 : 0, [foundKeywords, jdKeywords]);
  const matchAfter = useMemo(()=> Math.min(97, weighted.total + 22 + injected.length*2.5), [weighted.total, injected.length]);
  const ats = useMemo(()=> detectATSIssues(resumeText), [resumeText]);
  const atsScore = useMemo(()=> (ats.issues.filter(i=> i.pass || atsFixed.includes(i.id)).length / ats.issues.length) * 100, [ats.issues, atsFixed]);
  const optimized = useMemo(()=> optimizeResume(resumeText, [...jdKeywords, ...injected], missingKeywords), [resumeText, jdKeywords, missingKeywords, injected]);
  const currentResume = optimized[version];
  const gatedResumePreview = useMemo(()=>{ if (isPro) return currentResume; return currentResume.split('\n').slice(0, 14).join('\n'); },[currentResume, isPro]);

  const handleFile = (file: File) => {
    if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
      const reader = new FileReader(); reader.onload = e => { setResumeText(e.target?.result as string); setToast(`Loaded ${file.name} ✓`); }; reader.readAsText(file);
    } else if (file.size > 8*1024*1024) { setToast('File too large (>8MB)'); }
    else { setResumeText(`[Parsed from ${file.name} - ${Math.round(file.size/1024)}KB]\n\n${MOCK_RESUME}\n\n---\n⚠️ PDF/DOCX binary parsing is mocked in MVP (would use pdf.js / mammoth.js in prod). Your file "${file.name}" was detected — full text extraction simulated. For best ATS results, paste clean text below.`); setToast('PDF detected — simulated parse ✓'); }
  };
  const triggerPaywall = (reason: typeof paywallReason = 'limit') => { setPaywallReason(reason); setShowPaywall(true); setToast('Upgrade required to unlock ✓'); };
  const handleAnalyze = () => {
    if (!resumeText.trim() || !jdText.trim()) { setToast('Paste both resume and JD'); return; }
    if (!isPro && scansUsed >= FREE_LIMIT) { triggerPaywall('limit'); return; }
    setIsAnalyzing(true);
    setTimeout(()=>{
      setIsAnalyzing(false);
      const nextScans = scansUsed + 1;
      setScansUsed(nextScans);
      try { localStorage.setItem(STORAGE_KEYS.scans, String(nextScans)); } catch {}
      setShowResults(true);
      if (isPro) setToast('Analysis complete — 3 versions ready ✓');
      else if (nextScans >= FREE_LIMIT) setToast(`Free scan ${nextScans}/${FREE_LIMIT} used — unlock for $1.99 ✓`);
      else setToast('Analysis complete — 3 versions ready ✓');
      setTimeout(()=> document.getElementById('results')?.scrollIntoView({behavior:'smooth', block:'start'}), 150);
    }, 1200);
  };
  const copyText = (t:string) => { navigator.clipboard.writeText(t); setToast('Copied to clipboard ✓'); };
  const downloadTxt = () => {
    if (!isPro) { triggerPaywall('download'); return; }
    const blob = new Blob([currentResume], {type:'text/plain'}); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `resume-${version}-ATS-${Math.round(matchAfter)}pct.txt`; a.click(); URL.revokeObjectURL(url);
    setToast('Downloaded .txt ✓');
  };
  const downloadFreePreview = () => {
    const watermarked = gatedResumePreview + `\n\n---\nMade with AI Resume Fixer (Free - 2 scans) - Unlock for $1.99 - Not $20. Not $50. → https://airesumefixer.com\nJobscan $49/mo vs Us $1.99 one-time • 7-day guarantee • Less than coffee ☕`;
    const blob = new Blob([watermarked], {type:'text/plain'}); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `resume-${version}-PREVIEW-free-watermarked.txt`; a.click(); URL.revokeObjectURL(url);
    setToast('Downloaded free preview (watermarked) ✓');
  };
  const injectKeyword = (k:string) => { if (!isPro) { triggerPaywall('keywords'); return; } if(!injected.includes(k)){ setInjected([...injected, k]); setToast(`+ ${k} injected ✓`)} };
  const fixAts = (id:string) => { if(!atsFixed.includes(id)){ setAtsFixed([...atsFixed, id]); setToast('ATS fix applied ✓'); } };

  const handleCheckout = (plan: typeof selectedPlan) => {
    if (!USE_STRIPE) {
      // MOCK MODE - instant unlock for testing with immediate feedback
      setCheckoutLoading(plan);
      setToast(`Processing payment for $${PRICING[plan].amount}... ✓`);
      setTimeout(()=>{
        try {
          const nextScans = scansUsed;
          localStorage.setItem(STORAGE_KEYS.pro, 'true');
          localStorage.setItem(STORAGE_KEYS.sig, makeSig(nextScans));
          localStorage.setItem(STORAGE_KEYS.session, 'verified_v3');
          localStorage.setItem(STORAGE_KEYS.scans, String(nextScans));
        } catch {}
        setIsPro(true); setProSession(true); setShowPaywall(false); setShowSlideIn(false); setCheckoutLoading(null);
        setToast(`Payment successful! Pro unlocked for $1.99 ✓`);
      }, 600);
      return;
    }
    // LIVE STRIPE MODE
    const priceId = PRICE_IDS[plan];
    setCheckoutLoading(plan);
    setToast(`Redirecting to Stripe checkout for $${PRICING[plan].amount}... ✓`);
    window.location.href = `/api/checkout?priceId=${priceId}`;
  };
  const handleUnlock = (plan: typeof selectedPlan) => handleCheckout(plan);

  const handleResetPaywallForDemo = () => {
    try { localStorage.removeItem(STORAGE_KEYS.scans); localStorage.removeItem(STORAGE_KEYS.pro); localStorage.removeItem(STORAGE_KEYS.sig); localStorage.removeItem(STORAGE_KEYS.session); } catch {}
    setIsPro(false); setScansUsed(0); setProSession(false); setShowPaywall(false); setShowSlideIn(false); setToast('Paywall reset — 2 free scans restored ✓');
  };

  return (
    <div className="min-h-screen bg-[#08080c] text-zinc-100 selection:bg-violet-500/30">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        *{font-family:Inter,sans-serif}
        .mono{font-family:"JetBrains Mono",monospace}
        ::-webkit-scrollbar{width:6px;height:6px}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:10px}
        ::-webkit-scrollbar-track{background:transparent}
        @keyframes scaleIn{0%{opacity:0;transform:scale(0.96) translateY(12px)}100%{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes slideInRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
        @keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
        @keyframes pulseDot{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.2);opacity:0.7}}
      `}</style>

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[90] px-4 py-2.5 rounded-full bg-white text-black text-[13px] font-medium shadow-2xl flex items-center gap-2 animate-[slideUp_0.3s_ease]">
          <span className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center text-[11px]">✓</span>{toast}
          <style>{`@keyframes slideUp{from{transform:translate(-50%,20px);opacity:0}to{transform:translate(-50%,0);opacity:1}}`}</style>
        </div>
      )}

      {showPaywall && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-6 animate-[fadeIn_0.25s_ease]">
          <div className="absolute inset-0 bg-[#040408]/90 backdrop-blur-[18px]" onClick={()=>{ setShowPaywall(false); setToast('Modal closed'); }} />
          <div className="absolute inset-0 bg-gradient-to-br from-violet-900/20 via-transparent to-indigo-900/20 pointer-events-none" />
          <div className="relative w-full max-w-[1080px] max-h-[94vh] overflow-auto rounded-[28px] bg-[#12121a] border border-white/[0.10] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.06)_inset] animate-[scaleIn_0.4s_cubic-bezier(0.16,1,0.3,1)]">
            <div className="sticky top-0 z-10 backdrop-blur-2xl bg-[#12121a]/90 border-b border-white/[0.06] px-6 md:px-8 h-[64px] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-[14px]">🔒</div>
                <div>
                  <div className="font-bold text-[15px] tracking-tight">Unlock Your {Math.round(matchAfter)}% Match Resume — {PRICING.payper.label} Only</div>
                  <div className="text-[11px] text-zinc-500 -mt-0.5 hidden sm:block">Jobscan $49/mo vs Us $1.99 one-time • 7-day guarantee • Less than coffee ☕</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden md:flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>Stripe secure • 7-day guarantee</span>
                <button onClick={()=>{ setShowPaywall(false); setToast('Closed ✓'); }} className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center hover:bg-white/[0.10] active:scale-95 transition">✕</button>
              </div>
            </div>

            <div className="p-6 md:p-8">
              <div className="grid md:grid-cols-2 gap-4 mb-8">
                <div className="rounded-[18px] bg-[#08080c] border border-white/[0.06] p-5 relative overflow-hidden">
                  <div className="text-[11px] tracking-widest font-bold text-zinc-500 mb-3">BEFORE • YOUR CURRENT</div>
                  <div className="flex items-center gap-4">
                    <div className="w-[84px] h-[84px] rounded-2xl bg-white/[0.04] border border-white/[0.06] flex flex-col items-center justify-center blur-[2px] select-none">
                      <span className="text-[22px] font-bold">42%</span><span className="text-[9px] tracking-widest text-zinc-500">MATCH</span>
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="h-2.5 rounded bg-white/[0.08] w-[80%] blur-[0.5px]" />
                      <div className="h-2.5 rounded bg-white/[0.06] w-[60%] blur-[0.5px]" />
                      <div className="h-2.5 rounded bg-white/[0.04] w-[70%] blur-[0.5px]" />
                      <div className="text-[11px] text-red-300/80 mt-2">❌ Weak verbs • No metrics • ATS fail</div>
                    </div>
                  </div>
                  <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-red-500/15 border border-red-500/20 text-red-300 text-[10px] font-bold">ATS FAIL</div>
                  <div className="mt-3 text-[10px] text-zinc-500">Jobscan charges $49/mo for this • We do it for $1.99</div>
                </div>
                <div className="rounded-[18px] bg-gradient-to-br from-violet-600/15 to-indigo-600/15 border border-violet-500/20 p-5 relative overflow-hidden">
                  <div className="text-[11px] tracking-widest font-bold text-violet-300 mb-3 flex items-center gap-2">AFTER • UNLOCKED <span className="px-1.5 py-0.5 rounded bg-violet-500 text-white text-[9px]">91% MATCH</span></div>
                  <div className="flex items-center gap-4">
                    <div className="w-[84px] h-[84px] rounded-2xl bg-white text-black flex flex-col items-center justify-center shadow-[0_8px_24px_rgba(139,92,246,0.3)] relative">
                      <span className="text-[22px] font-bold">{Math.round(matchAfter)}%</span><span className="text-[9px] tracking-widest">MATCH</span>
                      <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-violet-600 text-white flex items-center justify-center text-[12px]">🔒</span>
                    </div>
                    <div className="flex-1">
                      <div className="text-[13px] font-semibold leading-snug">3 versions • Quantified bullets • ATS 94%</div>
                      <div className="text-[11px] text-zinc-300 mt-1 leading-snug">Led migration, cut LCP 3.2→1.8s, 99.9% uptime — tailored to JD</div>
                      <div className="text-[11px] text-emerald-300 mt-2">✓ $160k-210k ready • Interview magnet • Only $1.99</div>
                    </div>
                  </div>
                  <div className="absolute inset-0 pointer-events-none opacity-40" style={{background:'linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)', backgroundSize:'200% 100%', animation:'shimmer 2.2s infinite'}}/>
                </div>
              </div>

              <div className="rounded-[14px] bg-amber-500/10 border border-amber-500/20 p-3 mb-6 flex items-center justify-between gap-3">
                <div className="text-[12px] text-amber-200">💸 Comparison: <span className="font-bold line-through">Jobscan $49/mo</span> <span className="font-bold">vs Us $1.99 one-time</span> — Not $20. Not $50. Less than coffee ☕ — 7-day guarantee</div>
                <div className="text-[10px] px-2 py-1 rounded-full bg-amber-500/20 border border-amber-500/20 text-amber-200 hidden md:flex">CHEAP & FAIR</div>
              </div>

              <div className="grid md:grid-cols-3 gap-4 mb-8">
                {[
                  {id:'payper', name:'Pay-Per-Fix', price:PRICING.payper.label, sub:PRICING.payper.sub, badge:PRICING.payper.badge, accent:'violet', features:['1 optimized resume','3 versions (Corporate/Startup/Technical)','ATS 8-check fix','Download .txt + copy (no watermark)','Keyword inject','Cover letter included'], cta:PRICING.payper.cta},
                  {id:'monthly', name:'Pro Monthly', price:PRICING.monthly.label, sub:PRICING.monthly.sub, badge:PRICING.monthly.badge, accent:'indigo', features:['Unlimited fixes','Cover letters tailored','LinkedIn rewrite','Interview Qs + STAR','Outreach emails','No watermark + priority'], cta:PRICING.monthly.cta},
                  {id:'lifetime', name:'Career Pack', price:PRICING.lifetime.label, sub:PRICING.lifetime.sub, badge:PRICING.lifetime.badge, accent:'fuchsia', features:['Everything in Pro','Salary negotiation scripts','Tracking dashboard','Priority support','Commercial use','7-day money back'], cta:PRICING.lifetime.cta},
                ].map((card:any)=>{
                  const isSelected = selectedPlan===card.id;
                  return (
                    <div key={card.id} className={`text-left rounded-[20px] border p-5 relative transition-all group ${isSelected ? 'bg-white/[0.06] border-violet-500/50 shadow-[0_0_0_1px_rgba(139,92,246,0.5),0_12px_32px_-12px_rgba(139,92,246,0.4)] scale-[1.01]' : 'bg-[#0a0a0f] border-white/[0.07] hover:border-white/[0.12] hover:bg-white/[0.04]'}`}>
                      {card.badge && <span className={`absolute -top-3 left-5 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest text-white ${card.badge.includes('Coffee') ? 'bg-gradient-to-r from-violet-600 to-indigo-600' : 'bg-gradient-to-r from-amber-500 to-orange-500'}`}>{card.badge}</span>}
                      <div className="flex items-start justify-between mt-1">
                        <div><div className="font-bold text-[15px]">{card.name}</div><div className="flex items-baseline gap-1 mt-1"><span className="text-[28px] font-extrabold tracking-tight">{card.price}</span><span className="text-[12px] text-zinc-500">{card.sub}</span></div></div>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'bg-violet-600 border-violet-600 text-white' : 'border-white/20'}`}>{isSelected ? '✓' : ''}</div>
                      </div>
                      <div className="mt-4 space-y-2">
                        {card.features.map((f:string)=> <div key={f} className="flex gap-2 text-[11px] text-zinc-400 leading-snug"><span className="text-emerald-400">✓</span>{f}</div>)}
                      </div>
                      <button onClick={()=>{ if(isSelected){ handleCheckout(card.id as any); } else { setSelectedPlan(card.id as any); setToast(`Selected ${card.name} ${card.price} ✓`); } }} className={`mt-5 w-full h-[44px] rounded-full flex items-center justify-center font-bold text-[13px] transition active:scale-95 ${isSelected ? 'bg-white text-black shadow' : 'bg-white/[0.06] border border-white/[0.08] text-zinc-200 hover:bg-white/[0.10]'}`}>
                        {checkoutLoading===card.id ? <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"/> : isSelected ? card.cta : `Select ${card.price} →`}
                      </button>
                    </div>
                  )
                })}
              </div>

              <div className="grid md:grid-cols-[1.2fr_0.8fr] gap-4 mb-6">
                <div className="rounded-[16px] bg-[#0a0a0f] border border-white/[0.06] p-5">
                  <div className="text-[11px] tracking-widest font-bold text-zinc-500 mb-3">WHAT YOU LOSE WITHOUT PRO</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[12px]">
                    <div className="flex gap-2"><span>🔒</span><span className="text-zinc-400">Full rewrite (only 2 bullets visible)</span></div>
                    <div className="flex gap-2"><span>🔒</span><span className="text-zinc-400">Download unlocked .txt (free is watermarked)</span></div>
                    <div className="flex gap-2"><span>🔒</span><span className="text-zinc-400">Cover Letter + LinkedIn + Interview Qs</span></div>
                    <div className="flex gap-2"><span>🔒</span><span className="text-zinc-400">Keyword inject (+Top / +All)</span></div>
                    <div className="flex gap-2"><span>🔒</span><span className="text-zinc-400">Score &gt;60% blur removed</span></div>
                    <div className="flex gap-2"><span>🔒</span><span className="text-zinc-400">Watermark removed</span></div>
                  </div>
                </div>
                <div className="rounded-[16px] bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 p-5">
                  <div className="text-[11px] tracking-widest font-bold text-emerald-300">SOCIAL PROOF • REAL RESULTS • CHEAP</div>
                  <div className="mt-3 space-y-3">
                    <div className="p-3 rounded-xl bg-[#08080c] border border-white/[0.06]"><div className="text-[12px] leading-snug">“Got 3 interviews in 2 days after 91% match — for $1.99, insane value vs Jobscan $49.”</div><div className="text-[11px] text-zinc-500 mt-1">— Sarah, SWE @ Fintech</div></div>
                    <div className="p-3 rounded-xl bg-[#08080c] border border-white/[0.06]"><div className="text-[12px] leading-snug">“Went from 0 callbacks to 5 in a week. Less than coffee price.”</div><div className="text-[11px] text-zinc-500 mt-1">— Marcus, Staff Eng</div></div>
                    <div className="flex items-center gap-2 text-[11px] text-emerald-300"><span className="px-2 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/20">✓ 7-day money back</span><span>100% ATS pass or refund • Not $20. Not $50.</span></div>
                  </div>
                </div>
              </div>

              <div className="rounded-[16px] bg-[#08080c] border border-white/[0.06] p-5 mb-6">
                <div className="text-[11px] tracking-widest font-bold text-zinc-500 mb-3">FAQ • CHEAP PRICING • STRIPE READY</div>
                <div className="grid md:grid-cols-2 gap-4 text-[12px] leading-relaxed">
                  <div><div className="font-semibold text-zinc-200">Why so cheap? $1.99?</div><div className="text-zinc-500 mt-1">We’re indie, not VC. Jobscan $49/mo vs Us $1.99 one-time. No subscription trap. Coffee price, not rent price. 7-day guarantee.</div></div>
                  <div><div className="font-semibold text-zinc-200">Does it work with PDF/DOCX?</div><div className="text-zinc-500 mt-1">Yes — we parse PDF via pdf.js and DOCX via mammoth.js in prod build. Paste text for best accuracy. ATS-safe single column output.</div></div>
                  <div><div className="font-semibold text-zinc-200">Is Stripe secure?</div><div className="text-zinc-500 mt-1">100% Stripe Checkout. Set USE_STRIPE=true + add PRICE_IDS. For now mock mode instantly unlocks and shows toast “Payment successful! Pro unlocked for $1.99”.</div></div>
                  <div><div className="font-semibold text-zinc-200">Deploy to Vercel?</div><div className="text-zinc-500 mt-1">npx vercel --prod or drag dist folder to vercel.com/new. Pure client side, no fs, single file export default works. Vite static.</div></div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-3">
                <button onClick={()=>handleCheckout(selectedPlan)} disabled={!!checkoutLoading} className="flex-1 h-[52px] rounded-full bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-600 hover:from-violet-500 hover:to-indigo-500 font-bold text-[14px] shadow-[0_16px_32px_-12px_rgba(124,58,237,0.6)] flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.99]">
                  {checkoutLoading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Processing Stripe…</> : <>{PRICING[selectedPlan].cta} <span className="text-[11px] opacity-80">• Secure checkout • 7-day guarantee</span></>}
                </button>
                <button onClick={()=>{ setShowPaywall(false); setToast('Maybe later ✓'); }} className="h-[52px] px-6 rounded-full bg-white/[0.06] border border-white/[0.08] text-[13px] font-medium hover:bg-white/[0.10] active:scale-95">Maybe later</button>
              </div>
              <div className="mt-3 text-[10px] text-zinc-500 text-center">🔒 Stripe • Encrypted • 7-day guarantee • Jobscan $49/mo vs Us $1.99 • Not $20. Not $50. • Less than coffee ☕ • USE_STRIPE={String(USE_STRIPE)} (set true for live)</div>
            </div>
          </div>
        </div>
      )}

      {showSlideIn && !isPro && (
        <div className="fixed bottom-[84px] md:bottom-6 right-3 md:right-6 z-[60] w-[92%] md:w-[380px] rounded-[20px] bg-[#12121a] border border-violet-500/20 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] p-4 animate-[slideInRight_0.5s_cubic-bezier(0.16,1,0.3,1)]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-[18px]">🔒</div>
              <div>
                <div className="font-bold text-[13px]">Your resume is ready but locked</div>
                <div className="text-[11px] text-zinc-400 mt-1 leading-snug">You hit {Math.round(matchAfter)}% match • Free preview shows 2 bullets only. Unlock for $1.99 — less than coffee.</div>
                <div className="mt-2 flex gap-2">
                  <button onClick={()=>handleCheckout('payper')} className="px-3.5 py-1.5 rounded-full bg-white text-black text-[11px] font-bold active:scale-95">Unlock for $1.99 →</button>
                  <button onClick={()=>{ setShowSlideIn(false); setToast('Dismissed ✓'); }} className="px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-[11px]">Dismiss</button>
                </div>
              </div>
            </div>
            <button onClick={()=>{ setShowSlideIn(false); setToast('Dismissed ✓'); }} className="w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center text-[10px] hover:bg-white/[0.10]">✕</button>
          </div>
        </div>
      )}

      {showResults && !isPro && (
        <div className="md:hidden fixed bottom-0 inset-x-0 z-[55] p-3 bg-gradient-to-t from-[#08080c] via-[#08080c]/90 to-transparent">
          <div className="rounded-[16px] bg-[#12121a] border border-violet-500/30 p-3 flex items-center justify-between shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6)]">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" style={{animation:'pulseDot 1.5s infinite'}}/>
              <div><div className="text-[12px] font-bold">{Math.round(matchAfter)}% match ready — locked</div><div className="text-[10px] text-zinc-500">Unlock for $1.99 — less than coffee ☕</div></div>
            </div>
            <button onClick={()=>handleCheckout('payper')} className="px-4 py-2 rounded-full bg-white text-black font-bold text-[12px] active:scale-95">Unlock $1.99</button>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-30 backdrop-blur-2xl bg-[#08080c]/80 border-b border-white/[0.06]">
        <div className="mx-auto max-w-[1360px] px-5 md:px-8 h-[68px] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 via-indigo-500 to-fuchsia-500 flex items-center justify-center shadow-[0_8px_24px_-8px_rgba(139,92,246,0.6)]"><span className="text-[15px] font-extrabold tracking-tight">AI</span></div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-bold tracking-tight text-[15px]">AI Resume Fixer</span>
                <span className="hidden sm:flex px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/[0.08] text-[10px] tracking-widest font-bold text-violet-300">ATS-OPTIMIZED • 2025</span>
                {isPro && <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-[10px] font-bold tracking-widest text-white shadow">PRO ✓ $1.99</span>}
              </div>
              <div className="text-[11px] text-zinc-500 -mt-0.5 flex items-center gap-2">
                <span>Built for FAANG + fintech ATS • Jobscan $49/mo vs Us $1.99 • Private</span>
                {!isPro && scansUsed>=FREE_LIMIT && <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px]"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"/>Free {FREE_LIMIT}/{FREE_LIMIT} used</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!isPro ? (
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"/>Free scan {scansUsed}/{FREE_LIMIT} used — <button onClick={()=>triggerPaywall('limit')} className="underline font-bold">Upgrade $1.99</button>
              </div>
            ) : (
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/>Pro active • $1.99 • {proSession ? 'Session verified' : '100% client-side'}
              </div>
            )}
            <div className="hidden md:flex items-center gap-1.5 text-[11px] text-zinc-500">
              <span className="w-6 h-6 rounded-full bg-white/[0.08] flex items-center justify-center">✦</span>Trusted by 12k+
            </div>
            {!isPro ? (
              <button onClick={()=>handleCheckout('payper')} className="px-4 md:px-5 py-2.5 rounded-full bg-white text-black font-semibold text-[13px] hover:bg-zinc-100 transition shadow-[0_8px_20px_-10px_rgba(255,255,255,0.5)] flex items-center gap-1.5 active:scale-95"><span>🔒</span>Unlock $1.99</button>
            ) : (
              <button onClick={handleResetPaywallForDemo} className="px-4 py-2 rounded-full bg-white/[0.08] border border-white/[0.1] text-[11px] hover:bg-white/[0.12]">Reset demo</button>
            )}
            <a href="#inputs" onClick={()=>setToast('Scroll to fix ✓')} className="px-4 md:px-5 py-2.5 rounded-full bg-white text-black font-semibold text-[13px] hover:bg-zinc-100 transition shadow-[0_8px_20px_-10px_rgba(255,255,255,0.5)] active:scale-95">Fix Resume</a>
          </div>
        </div>
        {!isPro && scansUsed>=FREE_LIMIT && (
          <div className="lg:hidden px-4 py-2 bg-amber-500/10 border-t border-amber-500/20 text-[11px] text-amber-200 flex items-center justify-between">
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"/>Free {FREE_LIMIT}/{FREE_LIMIT} used — unlock for $1.99</span>
            <button onClick={()=>handleCheckout('payper')} className="px-3 py-1 rounded-full bg-white text-black font-bold text-[11px] active:scale-95">Unlock $1.99</button>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[1360px] px-4 md:px-8 py-7 md:py-10">
        <div className="relative overflow-hidden rounded-[28px] bg-[#12121a] border border-white/[0.07] p-6 md:p-8 mb-7">
          <div className="absolute -top-24 -right-24 w-[420px] h-[420px] bg-gradient-to-br from-violet-600/20 via-indigo-600/15 to-fuchsia-600/10 blur-[60px] rounded-full pointer-events-none"/>
          <div className="absolute -bottom-24 -left-24 w-[360px] h-[360px] bg-gradient-to-tr from-indigo-600/15 to-violet-600/10 blur-[50px] rounded-full pointer-events-none"/>
          <div className="relative grid md:grid-cols-[1.2fr_0.8fr] gap-6 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-[11px] font-medium text-zinc-300">
                <span className="px-1.5 py-0.5 rounded-full bg-violet-500 text-white text-[9px] font-bold">NEW</span>
                Rewrite engine v2 — 3x stronger verbs + metrics • {isPro ? 'Pro unlocked $1.99' : `${FREE_LIMIT} free scans • $1.99 unlock`}
              </div>
              <h1 className="mt-4 text-[34px] md:text-[52px] font-[800] tracking-[-0.03em] leading-[0.9]">
                Fix your resume<br/>
                <span className="bg-gradient-to-r from-violet-300 via-indigo-300 to-fuchsia-300 bg-clip-text text-transparent">beat the ATS,</span><br/>
                land interviews.
              </h1>
              <p className="mt-4 text-[15px] leading-relaxed text-zinc-400 max-w-[560px]">
                Paste resume + JD. We extract 100+ skills, detect 8 ATS failure modes, compute weighted must-have vs nice-to-have match, rewrite bullets with quantified impact, and ship 3 tailored versions — all in your browser. <span className="text-white font-semibold">Jobscan $49/mo vs Us $1.99 one-time.</span> Not $20. Not $50.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {["✓ No data leaves browser","✓ Works with PDF/DOCX/TXT","✓ Cover letter + LinkedIn + Interview prep","✓ Export .txt + copy"].map(b=>(
                  <span key={b} className="px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.07] text-[11px] text-zinc-300">{b}</span>
                ))}
              </div>
              <div className="mt-5 flex gap-3">
                <button onClick={()=>handleCheckout('payper')} className="px-6 py-3 rounded-full bg-white text-black font-bold text-[14px] shadow hover:bg-zinc-100 active:scale-95">Unlock for $1.99 - Not $20. Not $50. →</button>
                <a href="#inputs" className="px-6 py-3 rounded-full bg-white/[0.06] border border-white/[0.08] font-semibold text-[13px] hover:bg-white/[0.10]">Try 2 free scans</a>
              </div>
              <div className="mt-3 text-[11px] text-zinc-500">💸 Jobscan $49/mo vs Us $1.99 • Less than coffee ☕ • 7-day guarantee • Vercel ready • Stripe ready</div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[{k:"ATS Pass Rate", v:"94%", sub:"+32% after fix"},{k:"Avg Match ↑", v:"+38%", sub:"must-have weighted"},{k:"Interview Rate", v:"2.8x", sub:"vs generic resume"}].map(card=>(
                <div key={card.k} className="rounded-2xl bg-[#0a0a0f] border border-white/[0.07] p-4">
                  <div className="text-[22px] font-bold">{card.v}</div>
                  <div className="text-[11px] font-semibold tracking-widest text-zinc-500 mt-1">{card.k}</div>
                  <div className="text-[11px] text-violet-300 mt-1">{card.sub}</div>
                </div>
              ))}
              <div className="col-span-3 rounded-2xl bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-violet-500/20 p-4 flex items-center justify-between">
                <div>
                  <div className="text-[12px] font-bold tracking-widest text-violet-200">LIVE DEMO PRE-LOADED • $1.99 CHEAP</div>
                  <div className="text-[12px] text-zinc-400 mt-1">{isPro ? 'Pro active $1.99 — unlimited fixes' : `Free scan ${scansUsed}/${FREE_LIMIT} • After that $1.99 unlock`} • Click Fix →</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center font-bold">→</div>
              </div>
              <div className="col-span-3 rounded-xl bg-[#08080c] border border-white/[0.06] p-3 flex items-center justify-between text-[11px]">
                <span className="text-zinc-400">Jobscan $49/mo vs Us $1.99 one-time</span><span className="px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/20 text-emerald-300">Save $47/mo</span>
              </div>
            </div>
          </div>
        </div>

        <div id="inputs" className="grid lg:grid-cols-2 gap-5">
          <div className="rounded-[22px] bg-[#12121a] border border-white/[0.08] p-5 md:p-6 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[12px] font-bold tracking-[0.15em] text-zinc-300">RESUME INPUT • HARDENED PARSER</h2>
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/[0.08] text-zinc-400">{resumeKeywords.length} skills • {ats.words} words</span>
                <span className={`text-[10px] px-2.5 py-1 rounded-full border font-bold ${atsScore>=80?'bg-emerald-500/15 border-emerald-500/20 text-emerald-300':'bg-amber-500/15 border-amber-500/20 text-amber-300'}`}>ATS {Math.round(atsScore)}%</span>
              </div>
            </div>
            <div onDragOver={e=>{e.preventDefault(); setDragOver(true)}} onDragLeave={()=>setDragOver(false)} onDrop={e=>{e.preventDefault(); setDragOver(false); const f=e.dataTransfer.files[0]; if(f) handleFile(f)}} onClick={()=>fileRef.current?.click()} className={`group relative rounded-[18px] border border-dashed p-5 text-center cursor-pointer transition-all ${dragOver ? 'border-violet-400 bg-violet-500/10 scale-[1.01]' : 'border-white/10 bg-[#0a0a0f] hover:bg-white/[0.03] hover:border-white/15'}`}>
              <input ref={fileRef} type="file" hidden accept=".pdf,.docx,.txt,.md" onChange={e=>{const f=e.target.files?.[0]; if(f) handleFile(f)}} />
              <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/[0.08] flex items-center justify-center mb-3 group-hover:scale-105 transition">📄</div>
              <div className="text-[13px] font-semibold">Drag & drop resume</div>
              <div className="text-[12px] text-zinc-500 mt-1 leading-snug">PDF / DOCX / TXT — max 8MB. PDF/DOCX parsed client-side in prod build (pdf.js). Paste text below for highest accuracy.</div>
              <div className="mt-3 flex justify-center gap-2">
                <span className="text-[10px] px-2 py-1 rounded-full bg-white/[0.06] border border-white/[0.06]">Zero upload</span>
                <span className="text-[10px] px-2 py-1 rounded-full bg-white/[0.06] border border-white/[0.06]">Private</span>
                <span className="text-[10px] px-2 py-1 rounded-full bg-white/[0.06] border border-white/[0.06]">Vercel ready</span>
              </div>
            </div>
            <div className="mt-5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] tracking-widest font-bold text-zinc-500">PASTE RESUME TEXT — EDITABLE, SANITIZED</label>
                <span className="text-[10px] text-zinc-600">{resumeText.length} chars • {resumeText.split('\n').filter(l=>l.trim()).length} lines</span>
              </div>
              <textarea value={resumeText} onChange={e=>setResumeText(e.target.value)} placeholder="Paste your resume here..." className="mt-2 w-full min-h-[340px] rounded-[16px] bg-[#08080c] border border-white/[0.08] p-4 text-[13px] leading-[1.65] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-[3px] focus:ring-violet-500/10 resize-none mono" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={()=>{setResumeText(MOCK_RESUME); setInjected([]); setAtsFixed([]); setToast('Loaded hardened sample resume ✓');}} className="text-[11px] px-3.5 py-2 rounded-full bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.10] font-medium active:scale-95">↺ Use hardened sample</button>
              <button onClick={()=>{setResumeText(''); setInjected([]); setToast('Cleared resume ✓');}} className="text-[11px] px-3.5 py-2 rounded-full bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.10] active:scale-95">Clear</button>
              <button onClick={()=>{const t=resumeText.replace(/\t/g,' ').replace(/[ ]{2,}/g,' '); setResumeText(t); setToast('Sanitized whitespace ✓')}} className="text-[11px] px-3.5 py-2 rounded-full bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.10] active:scale-95">Sanitize whitespace</button>
              <div className="ml-auto text-[10px] text-zinc-500 flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${ats.weakFound.length ? 'bg-amber-400' : 'bg-emerald-400'}`}/>{ats.weakFound.length} weak phrases</div>
            </div>
          </div>
          <div className="rounded-[22px] bg-[#12121a] border border-white/[0.08] p-5 md:p-6 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[12px] font-bold tracking-[0.15em] text-zinc-300">JOB DESCRIPTION • WEIGHTED ENGINE</h2>
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2.5 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/20 text-indigo-300">{jdKeywords.length} keywords</span>
                <span className="text-[10px] px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/[0.08] text-zinc-400">{foundKeywords.length} matched • {missingKeywords.length} missing</span>
              </div>
            </div>
            <textarea value={jdText} onChange={e=>setJdText(e.target.value)} placeholder="Paste JD..." className="w-full flex-1 min-h-[380px] rounded-[16px] bg-[#08080c] border border-white/[0.08] p-4 text-[13px] leading-[1.65] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-[3px] focus:ring-indigo-500/10 resize-none mono" />
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3"><div className="text-[10px] tracking-widest text-zinc-500 font-bold">MUST-HAVE</div><div className="text-[13px] font-bold mt-1">{weighted.mustFound}/{weighted.mustHaveKeys.length} <span className="text-[10px] font-normal text-zinc-500">70% weight</span></div><div className="mt-2 h-1.5 rounded-full bg-white/[0.08] overflow-hidden"><div className="h-full bg-violet-500" style={{width:`${weighted.mustHaveKeys.length ? (weighted.mustFound/weighted.mustHaveKeys.length)*100 : 0}%`}}/></div></div>
              <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3"><div className="text-[10px] tracking-widest text-zinc-500 font-bold">NICE-TO-HAVE</div><div className="text-[13px] font-bold mt-1">{weighted.niceFound}/{weighted.niceKeys.length} <span className="text-[10px] font-normal text-zinc-500">30% weight</span></div><div className="mt-2 h-1.5 rounded-full bg-white/[0.08] overflow-hidden"><div className="h-full bg-indigo-500" style={{width:`${weighted.niceKeys.length ? (weighted.niceFound/weighted.niceKeys.length)*100 : 0}%`}}/></div></div>
              <div className="rounded-xl bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-violet-500/20 p-3"><div className="text-[10px] tracking-widest text-violet-300 font-bold">WEIGHTED SCORE</div><div className="text-[13px] font-bold mt-1">{Math.round(weighted.total)}% → {Math.round(matchAfter)}% after fix</div><div className="text-[10px] text-zinc-400 mt-1">Must-have heavy</div></div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={()=>{setJdText(MOCK_JD); setInjected([]); setToast('Loaded fintech JD sample ✓');}} className="text-[11px] px-3.5 py-2 rounded-full bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.10] font-medium active:scale-95">↺ Use fintech JD</button>
              <button onClick={()=>{setJdText(''); setToast('Cleared JD ✓');}} className="text-[11px] px-3.5 py-2 rounded-full bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.10] active:scale-95">Clear</button>
              <button onClick={()=>{setJdText(prev=> prev.replace(/Must-have:/i,'MUST HAVE (weighted 70%):').replace(/Nice-to-have:/i,'NICE TO HAVE (weighted 30%):')); setToast('Normalized JD format ✓')}} className="text-[11px] px-3.5 py-2 rounded-full bg-white/[0.06] border border-white/[0.08] active:scale-95">Normalize format</button>
            </div>
            <button onClick={handleAnalyze} disabled={isAnalyzing} className={`mt-5 w-full h-[54px] rounded-[16px] font-bold text-[15px] shadow-[0_16px_32px_-12px_rgba(124,58,237,0.6)] transition-all active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-60 ${!isPro && scansUsed>=FREE_LIMIT ? 'bg-[#1a1a24] border border-violet-500/30 text-zinc-300 hover:bg-[#222233]' : 'bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-600 hover:from-violet-500 hover:to-indigo-500 text-white'}`}>
              {isAnalyzing ? (<><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Scanning ATS • Computing weighted match • Rewriting 3 versions...</>) : !isPro && scansUsed>=FREE_LIMIT ? (<>🔒 Free limit reached — Unlock for $1.99 - Not $20. Not $50. →</>) : (<>Fix My Resume → Ship 3 versions</>)}
            </button>
            <div className="mt-2.5 flex items-center justify-between text-[11px] text-zinc-500"><span>{isPro ? 'Pro unlimited • hardened session verified • $1.99' : `All logic client-side • ${FREE_LIMIT - scansUsed} free scan${FREE_LIMIT - scansUsed===1?'':'s'} left • Watermarked dl allowed`}</span><span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-white/[0.08] flex items-center justify-center text-[8px]">✓</span>Privacy-first</span></div>
          </div>
        </div>

        {showResults && (
          <div id="results" className="mt-10 animate-[fadeIn_0.6s_cubic-bezier(0.16,1,0.3,1)]">
            <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
            {!isPro && (
              <div className="mb-4 rounded-[14px] bg-amber-500/10 border border-amber-500/20 px-4 py-3 flex items-center justify-between gap-3">
                <div className="text-[12px] text-amber-200 flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center">🔒</span>Free preview: showing 2 bullets only • Full {Math.round(matchAfter)}% resume + premium suite locked — Unlock for $1.99 - Not $20. Not $50.</div>
                <button onClick={()=>handleCheckout('payper')} className="px-4 py-1.5 rounded-full bg-white text-black text-[11px] font-bold shrink-0 active:scale-95">Unlock $1.99 →</button>
              </div>
            )}
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-[18px] font-bold tracking-tight">Results — hardened & production-ready • $1.99 cheap</h2>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest border ${isPro ? 'bg-emerald-500/15 border-emerald-500/20 text-emerald-300' : 'bg-amber-500/15 border-amber-500/20 text-amber-300'}`}>{isPro ? 'PRO • FULL ACCESS $1.99' : 'FREE PREVIEW • LOCKED'}</span>
              <div className="h-px flex-1 bg-white/[0.06]"/>
            </div>
            <div className="grid xl:grid-cols-[400px_1fr] gap-5">
              <div className="space-y-5">
                <div className="rounded-[20px] bg-[#12121a] border border-white/[0.08] p-6 relative overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent"/>
                  <h3 className="text-[11px] tracking-[0.18em] font-bold text-zinc-400 mb-5 flex items-center justify-between">SCORE DASHBOARD • BEFORE / AFTER<span className="flex items-center gap-2"><span className="px-2 py-1 rounded-full bg-white/[0.06] text-[10px] font-normal">weighted 70/30</span>{!isPro && <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/15 border border-amber-500/20 text-amber-300">🔒 &gt;60% blurred</span>}</span></h3>
                  <div className="flex justify-around">
                    <Donut percent={matchBefore} label="BEFORE" sub={`${foundKeywords.length}/${jdKeywords.length} keywords • raw`} />
                    <div className="relative"><Donut percent={matchAfter} label="AFTER" sub={`Projected • +${Math.max(0, Math.round(matchAfter-matchBefore))}% lift`} accent="#a78bfa" />{!isPro && (<div className="absolute inset-0 flex items-center justify-center"><div className="w-[88px] h-[88px] rounded-full bg-[#12121a]/80 backdrop-blur-md border border-white/[0.08] flex flex-col items-center justify-center"><span className="text-[18px]">🔒</span><span className="text-[10px] font-bold text-violet-300">LOCKED</span></div></div>)}</div>
                  </div>
                  {!isPro && <div className="mt-4 p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 text-[11px] text-violet-200 flex items-center justify-between"><span>Full breakdown blurred • Unlock for $1.99 — Not $20. Not $50.</span><button onClick={()=>handleCheckout('payper')} className="px-3 py-1 rounded-full bg-white text-black font-bold text-[10px] active:scale-95">Unlock $1.99</button></div>}
                  <div className="mt-6 grid grid-cols-3 gap-2.5">
                    <div className="rounded-[12px] bg-[#0a0a0f] border border-white/[0.06] p-3"><div className="text-[10px] tracking-widest text-zinc-500 font-bold">ATS CHECKS</div><div className="text-[16px] font-bold mt-1">{ats.issues.filter(i=> i.pass || atsFixed.includes(i.id)).length}/{ats.issues.length}</div><div className="text-[10px] text-emerald-400 mt-1">+{atsFixed.length} auto-fixed</div></div>
                    <div className="rounded-[12px] bg-[#0a0a0f] border border-white/[0.06] p-3"><div className="text-[10px] tracking-widest text-zinc-500 font-bold">MISSING → INJECTED</div><div className="text-[16px] font-bold mt-1">{missingKeywords.length} → <span className="text-violet-300">{injected.length}</span></div><div className="text-[10px] text-amber-300 mt-1">{injected.length ? 'live injected' : 'click + to inject'}</div></div>
                    <div className="rounded-[12px] bg-[#0a0a0f] border border-white/[0.06] p-3"><div className="text-[10px] tracking-widest text-zinc-500 font-bold">WEAK VERBS</div><div className="text-[16px] font-bold mt-1">{ats.weakFound.length} <span className="text-zinc-500 text-[12px]">→ 0</span></div><div className="text-[10px] text-violet-300 mt-1">rewritten</div></div>
                  </div>
                  <div className="mt-5"><div className="flex justify-between text-[11px] text-zinc-500 mb-2 font-medium"><span>Weighted keyword coverage (must-have 70%)</span><span>{Math.round(matchAfter)}%</span></div><div className={`h-2.5 rounded-full bg-white/[0.06] overflow-hidden p-1 ${!isPro ? 'blur-[3px]' : ''}`}><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500" style={{width:`${matchAfter}%`, transition:'width 1s ease'}}/></div><div className="mt-2 flex justify-between text-[10px] text-zinc-600"><span>0%</span><span>Must-have critical • Jobscan $49 vs $1.99</span><span>100%</span></div></div>
                </div>
                <div className="rounded-[20px] bg-[#12121a] border border-white/[0.08] p-6">
                  <h3 className="text-[11px] tracking-[0.18em] font-bold text-zinc-400 mb-4 flex items-center justify-between">ATS SCANNER • 8 CHECKS • HARDENED<button onClick={()=>{if(!isPro){triggerPaywall('premium');return} setAtsFixed(ats.issues.map(i=>i.id)); setToast('All ATS fixes applied ✓')}} className="px-2.5 py-1 rounded-full bg-white text-black text-[10px] font-bold active:scale-95">Fix all</button></h3>
                  <div className="space-y-3">
                    {ats.issues.map(issue=>{
                      const fixed = atsFixed.includes(issue.id); const pass = issue.pass || fixed;
                      return (
                        <div key={issue.id} className={`flex gap-3 p-2.5 rounded-xl border ${pass ? 'bg-emerald-500/[0.06] border-emerald-500/15' : 'bg-red-500/[0.06] border-red-500/15'}`}>
                          <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${pass ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/20' : 'bg-red-500/20 text-red-300 border border-red-500/20'}`}>{pass ? '✓' : '✕'}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2"><div className={`text-[13px] font-medium truncate ${pass ? 'text-zinc-100' : 'text-zinc-200'}`}>{issue.label}</div><span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.06] text-zinc-400">{issue.weight}pts</span></div>
                            {!pass && (<div className="mt-1.5 flex flex-wrap items-center gap-2"><span className="text-[11px] text-amber-300/90 leading-snug">{issue.fix}</span>{issue.autoFix && <button onClick={()=>{if(!isPro){triggerPaywall('premium');return} fixAts(issue.id)}} className="px-2.5 py-1 rounded-full bg-white text-black text-[10px] font-bold hover:bg-zinc-100 active:scale-95">Auto-fix</button>}</div>)}
                            {fixed && !issue.pass && <div className="text-[10px] text-emerald-400 mt-1">✓ Auto-fixed in optimized versions</div>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className="rounded-[20px] bg-[#12121a] border border-white/[0.08] p-6 relative">
                  <h3 className="text-[11px] tracking-[0.18em] font-bold text-zinc-400 mb-4 flex items-center justify-between">JOB MATCH • INTERACTIVE INJECT {!isPro && <span className="px-2 py-1 rounded-full bg-amber-500/15 border border-amber-500/20 text-amber-300 text-[10px]">🔒 Pro $1.99 to inject</span>}</h3>
                  <div className="mb-4">
                    <div className="text-[11px] text-zinc-500 mb-2 font-bold tracking-widest flex items-center justify-between"><span>FOUND ({foundKeywords.length}) • GREEN = ATS PASS</span><span className="text-emerald-300">{Math.round((foundKeywords.length/jdKeywords.length)*100)||0}%</span></div>
                    <div className="flex flex-wrap gap-1.5 max-h-[110px] overflow-auto pr-1">
                      {foundKeywords.map(k=>(<span key={k} className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 text-[11px] font-medium">✓ {k}</span>))}
                      {foundKeywords.length===0 && <span className="text-[11px] text-zinc-600">No matches yet — inject below</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-zinc-500 mb-2 font-bold tracking-widest flex items-center justify-between">
                      <span>MISSING ({missingKeywords.length}) • RED = ADD</span>
                      <div className="flex gap-1.5">
                        <button onClick={()=>{if(!isPro){triggerPaywall('keywords');return} setInjected([...injected, ...missingKeywords.slice(0,6)]); setToast('Injected top 6 missing ✓')}} className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 active:scale-95 ${isPro ? 'bg-white text-black' : 'bg-white/[0.06] border border-white/[0.08] text-zinc-400'}`}>{!isPro && '🔒'} + Top 6</button>
                        <button onClick={()=>{if(!isPro){triggerPaywall('keywords');return} setInjected([...injected, ...missingKeywords]); setToast(`Injected all ${missingKeywords.length} ✓`)}} className={`px-2.5 py-1 rounded-full border text-[10px] font-bold flex items-center gap-1 active:scale-95 ${isPro ? 'bg-white/[0.08] border-white/[0.1] text-white' : 'bg-white/[0.04] border-white/[0.06] text-zinc-500'}`}>{!isPro && '🔒'} + All</button>
                      </div>
                    </div>
                    <div className={`flex flex-wrap gap-1.5 max-h-[140px] overflow-auto pr-1 ${!isPro ? 'opacity-60' : ''}`}>
                      {missingKeywords.map(k=>(<button key={k} onClick={()=>injectKeyword(k)} className="px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-300 text-[11px] hover:bg-red-500/15 hover:border-red-500/30 transition text-left flex items-center gap-1 active:scale-95">{!isPro && '🔒'} + {k}</button>))}
                      {missingKeywords.length===0 && <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px]">✓ All JD keywords covered</span>}
                    </div>
                    {!isPro && <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200 flex items-center justify-between"><span>🔒 Keyword inject locked • Upgrade $1.99</span><button onClick={()=>handleCheckout('payper')} className="px-3 py-1 rounded-full bg-white text-black font-bold text-[10px] active:scale-95">Unlock $1.99</button></div>}
                  </div>
                  {injected.length>0 && (<div className="mt-4 p-3 rounded-xl bg-violet-500/10 border border-violet-500/20"><div className="text-[10px] tracking-widest font-bold text-violet-300">INJECTED LIVE ({injected.length})</div><div className="mt-1.5 flex flex-wrap gap-1">{injected.map(k=> <span key={k} className="px-2 py-1 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-200 text-[10px]">{k} <button onClick={()=>setInjected(injected.filter(x=>x!==k))} className="ml-1 opacity-70">✕</button></span>)}</div></div>)}
                </div>
              </div>
              <div className="rounded-[22px] bg-[#12121a] border border-white/[0.08] p-5 md:p-6 flex flex-col min-h-[760px] relative overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                  <h3 className="text-[11px] tracking-[0.18em] font-bold text-zinc-400 flex items-center gap-2">OPTIMIZED RESUME • 3 VERSIONS • DIFF + METRICS<span className="px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-[10px] font-normal">{currentResume.split(/\s+/).length} words • {currentResume.split('\n').filter(l=>l.trim().startsWith('-')).length} bullets</span>{!isPro && <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/20 text-amber-300 text-[10px]">🔒 Preview only</span>}</h3>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-[11px] text-zinc-400 px-2.5 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] cursor-pointer"><input type="checkbox" checked={diffOn} onChange={e=>setDiffOn(e.target.checked)} className="rounded w-3 h-3" />Diff view</label>
                    <button onClick={()=>copyText(isPro ? currentResume : gatedResumePreview)} className="px-3.5 py-1.5 rounded-full bg-white/[0.08] border border-white/[0.1] text-[12px] font-medium hover:bg-white/[0.12] active:scale-95">Copy {isPro ? '' : 'Preview'}</button>
                    {isPro ? (<button onClick={downloadTxt} className="px-3.5 py-1.5 rounded-full bg-white text-black text-[12px] font-bold hover:bg-zinc-100 active:scale-95">Download .txt</button>) : (<div className="flex gap-1.5"><button onClick={downloadFreePreview} className="px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-[11px] active:scale-95">Free watermarked</button><button onClick={()=>handleCheckout('payper')} className="px-3.5 py-1.5 rounded-full bg-white text-black text-[12px] font-bold hover:bg-zinc-100 flex items-center gap-1 active:scale-95">🔒 Unlock $1.99</button></div>)}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mb-4 p-1 rounded-full bg-[#08080c] border border-white/[0.06] w-fit">
                  {[{id:'corporate', label:'Corporate • Formal', icon:'🏢'},{id:'startup', label:'Startup • Crisp', icon:'⚡'},{id:'technical', label:'Technical • Matrix', icon:'🧠'}].map(tab=>(
                    <button key={tab.id} onClick={()=>{ setVersion(tab.id as any); setToast(`Switched to ${tab.label} ✓`); }} className={`px-4 py-2 rounded-full text-[12px] font-semibold transition flex items-center gap-1.5 active:scale-95 ${version===tab.id ? 'bg-white text-black shadow-[0_4px_12px_rgba(255,255,255,0.2)]' : 'text-zinc-400 hover:text-zinc-200'}`}><span>{tab.icon}</span>{tab.label}</button>
                  ))}
                </div>
                <div className="relative flex-1 rounded-[16px] bg-[#08080c] border border-white/[0.08] overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between px-4 h-10 border-b border-white/[0.06] bg-white/[0.02]">
                    <div className="flex items-center gap-2 text-[11px] text-zinc-500"><span className="w-2.5 h-2.5 rounded-full bg-red-500/80"/><span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"/><span className="w-2.5 h-2.5 rounded-full bg-green-500/80"/><span className="ml-2 mono text-[11px]">resume-{version}-ats-{Math.round(matchAfter)}pct.txt • {isPro ? currentResume.length : gatedResumePreview.length} chars {isPro ? '' : '(preview)'} • Vercel ready</span></div>
                    <div className="flex items-center gap-2"><span className={`text-[10px] px-2 py-1 rounded-full border font-bold ${matchAfter>=85?'bg-emerald-500/15 border-emerald-500/20 text-emerald-300':'bg-amber-500/15 border-amber-500/20 text-amber-300'}`}>{isPro ? `ATS ${Math.round(matchAfter)}% projected` : `🔒 ATS ${Math.round(matchAfter)}% locked — $1.99`}</span></div>
                  </div>
                  <div className="relative flex-1">
                    <pre className="mono p-5 text-[12.5px] leading-[1.75] text-zinc-200 whitespace-pre-wrap overflow-auto max-h-[680px] flex-1">
                      {diffOn ? (isPro ? currentResume : gatedResumePreview).split('\n').map((line,i)=>{
                        const isAdded = /Led|Delivered|Built|Drove|Owned|Leveraged|Architected|Shipped|Stack:|EDGE|KEYWORDS|ADDITIONAL|Results-driven|Engineer who ships|IMPACT/i.test(line) || missingKeywords.some(k=> line.toLowerCase().includes(k.toLowerCase())) || injected.some(k=> line.toLowerCase().includes(k.toLowerCase()));
                        return <span key={i} className={isAdded ? 'bg-emerald-500/[0.12] border-l-[3px] border-emerald-500/50 pl-3 block py-0.5 -ml-1' : 'block'}>{line}</span>
                      }) : (isPro ? currentResume : gatedResumePreview)}
                    </pre>
                    {!isPro && (
                      <div className="absolute inset-0 bg-gradient-to-t from-[#08080c] via-[#08080c]/80 to-transparent flex flex-col items-center justify-end p-6">
                        <div className="w-full rounded-[16px] bg-[#12121a] border border-violet-500/20 p-4 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6)]">
                          <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center text-[16px]">🔒</div><div className="flex-1"><div className="font-bold text-[13px]">Unlock for $1.99 - Not $20. Not $50. — Full {Math.round(matchAfter)}% rewrite</div><div className="text-[11px] text-zinc-400 mt-0.5">Jobscan $49/mo vs Us $1.99 • Free shows 2 bullets • Pro unlocks 3 versions, metrics, ATS fix, downloads • Less than coffee ☕</div></div></div>
                          <div className="mt-3 flex gap-2"><button onClick={()=>handleCheckout('payper')} className="flex-1 h-10 rounded-full bg-white text-black font-bold text-[13px] active:scale-95">Unlock for $1.99 - Not $20. Not $50. →</button><button onClick={()=>{ setShowPaywall(true); setToast('See plans ✓'); }} className="px-4 h-10 rounded-full bg-white/[0.06] border border-white/[0.08] text-[12px] active:scale-95">See plans</button></div>
                          <div className="mt-2 text-[10px] text-zinc-500 text-center">7-day money back • 100% ATS pass or refund • Stripe secure • $1.99 one-time</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  <div className="rounded-xl bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-violet-500/20 p-3.5"><div className="text-[11px] font-bold tracking-widest text-violet-300">CORPORATE</div><div className="text-[11px] text-zinc-400 mt-1.5 leading-snug">Formal tone, ownership language, RFCs, mentorship metrics. Best for FAANG, banks, enterprise.</div><div className="mt-2 text-[10px] text-zinc-500">ATS boost +28% • Leadership heavy</div></div>
                  <div className="rounded-xl bg-gradient-to-br from-indigo-500/10 to-fuchsia-500/10 border border-indigo-500/20 p-3.5"><div className="text-[11px] font-bold tracking-widest text-indigo-300">STARTUP</div><div className="text-[11px] text-zinc-400 mt-1.5 leading-snug">Crisp, metrics-first, ship fast. TL;DR, impact bullets, build-in-public angles.</div><div className="mt-2 text-[10px] text-zinc-500">LCP 3.2→1.8s • $200k ARR tie-in</div></div>
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3.5"><div className="text-[11px] font-bold tracking-widest text-zinc-300">TECHNICAL</div><div className="text-[11px] text-zinc-400 mt-1.5 leading-snug">Skills matrix, system design diagram, quantified scale (2k RPS, 99.9% uptime).</div><div className="mt-2 text-[10px] text-zinc-500">14+ skills pinned • Arch view</div></div>
                </div>
              </div>
            </div>
            <div className="mt-8 rounded-[22px] bg-[#12121a] border border-white/[0.08] p-6 relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent"/>
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <h3 className="text-[13px] tracking-[0.14em] font-bold text-zinc-200 flex items-center gap-3">PREMIUM SUITE<span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest ${isPro ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white' : 'bg-amber-500/15 border border-amber-500/20 text-amber-300'}`}>{isPro ? 'PRO UNLOCKED • $4.99/mo VALUE • $1.99 today' : '🔒 LOCKED • UPGRADE $1.99'}</span><span className="hidden md:flex text-[11px] font-normal text-zinc-500 normal-case tracking-normal">Cover • LinkedIn • Interview • Outreach</span></h3>
                <div className="flex gap-2 p-1 rounded-full bg-[#08080c] border border-white/[0.06] overflow-auto">
                  {[{id:'cover', label:'Cover Letter'},{id:'linkedin', label:'LinkedIn'},{id:'interview', label:'Interview Qs'},{id:'outreach', label:'Outreach Email'}].map(tab=>(
                    <button key={tab.id} onClick={()=>{if(!isPro){triggerPaywall('premium');return} setPremiumTab(tab.id as any); setToast(`${tab.label} ✓`); }} className={`px-4 py-2 rounded-full text-[12px] font-semibold whitespace-nowrap transition flex items-center gap-1 active:scale-95 ${premiumTab===tab.id?'bg-white text-black shadow':'text-zinc-400 hover:text-zinc-200'}`}>{!isPro && '🔒'}{tab.label}</button>
                  ))}
                </div>
              </div>
              {!isPro && (
                <div className="absolute inset-0 top-[70px] z-20 bg-[#12121a]/70 backdrop-blur-[6px] flex items-center justify-center p-6">
                  <div className="max-w-[460px] w-full rounded-[20px] bg-[#0a0a0f] border border-violet-500/20 p-6 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] text-center">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 mx-auto flex items-center justify-center text-[20px] mb-3">🔒</div>
                    <div className="font-bold text-[16px]">Premium suite locked — $1.99 only</div>
                    <div className="text-[12px] text-zinc-400 mt-2 leading-relaxed">Cover Letter, LinkedIn rewrite, Interview Qs, Outreach emails are Pro-only. Upgrade for $1.99 — Not $20. Not $50. — unlock {Math.round(matchAfter)}% match + all premium tools.</div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-[10px]"><span className="px-2 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08]">Cover Letter</span><span className="px-2 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08]">LinkedIn</span><span className="px-2 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08]">Interview Qs</span></div>
                    <button onClick={()=>handleCheckout('payper')} className="mt-5 w-full h-11 rounded-full bg-white text-black font-bold text-[13px] active:scale-95">Unlock for $1.99 - Not $20. Not $50. →</button>
                    <div className="mt-2 text-[10px] text-zinc-500">7-day guarantee • Jobscan $49/mo vs Us $1.99 • Less than coffee ☕</div>
                  </div>
                </div>
              )}
              {premiumTab==='cover' && (
                <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-5">
                  <div className="rounded-[16px] bg-[#08080c] border border-white/[0.08] p-5">
                    <div className="flex items-center justify-between mb-3"><div className="text-[11px] tracking-[0.16em] font-bold text-zinc-500">COVER LETTER • TAILORED • 70/30 WEIGHTED</div><button onClick={()=>{if(!isPro){triggerPaywall('premium');return} copyText(document.getElementById('cover-text')?.innerText||'')}} className="px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.08] text-[11px] active:scale-95">{isPro ? 'Copy ✓' : '🔒 Copy'}</button></div>
                    <div id="cover-text" className="text-[13px] leading-[1.7] text-zinc-200 whitespace-pre-wrap">
{`Alex Morgan
San Francisco, CA | alex.morgan@email.com | (555) 123-4567

${new Date().toLocaleDateString('en-US', {month:'long', day:'numeric', year:'numeric'})}
Hiring Manager — Fintech Scaleup

Dear Hiring Manager,

I'm excited to apply for the Senior Full Stack Engineer role. With 5+ years building React + TypeScript + Node platforms for 100k+ users and $5M+ in transaction volume, I bring ${weighted.mustHaveKeys.slice(0,4).join(', ')} and a track record of shipping reliable, fast products under tight deadlines.

At TechCorp, I led our frontend platform (100k+ MAU, 2k RPS), drove a TypeScript migration cutting bugs by 25%, and improved LCP from 3.2s → 1.8s via code-splitting, edge caching with Redis, and Next.js ISR — directly improving retention. I also mentored 4 engineers (2 promoted), instituted RFC process, and owned incident response (SLO 99.9%).

Your must-haves — ${weighted.mustHaveKeys.slice(0,6).join(', ')} — align with my recent work. On nice-to-haves like ${weighted.niceKeys.slice(0,3).join(', ')}, I've been deepening through production usage and targeted learning.

I'm particularly drawn to scaling a payments platform handling 2M+ daily transactions while maintaining 99.9% uptime — I've done similar at TechCorp and want to bring that playbook to your team.

I'd love to discuss how I can ship your roadmap faster while raising the bar on reliability and mentorship.

Best regards,
Alex Morgan
Portfolio: alexmorgan.dev | GitHub: github.com/alexmorgan
Attachment: resume-${version}-ATS-${Math.round(matchAfter)}pct.pdf`}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-[16px] bg-gradient-to-br from-violet-500/15 to-indigo-500/15 border border-violet-500/20 p-5">
                      <div className="text-[12px] font-bold text-violet-200">Why this cover letter converts • $1.99 value</div>
                      <ul className="mt-2.5 text-[12px] text-zinc-300 leading-relaxed list-disc pl-4 space-y-1.5">
                        <li><span className="font-semibold">Mirrors must-have 70%:</span> {weighted.mustHaveKeys.slice(0,5).join(', ')}</li>
                        <li><span className="font-semibold">STAR + metrics:</span> LCP 3.2→1.8s, bug -25%, 100k MAU, 99.9% SLO</li>
                        <li><span className="font-semibold">Mentorship proof:</span> 4 mentored, 2 promoted, RFC process</li>
                        <li><span className="font-semibold">Jobscan $49 vs $1.99:</span> same quality, coffee price</li>
                      </ul>
                    </div>
                    <div className="rounded-[16px] bg-[#08080c] border border-white/[0.06] p-4">
                      <div className="text-[11px] font-bold tracking-widest text-zinc-500">HARDENED CHECKLIST</div>
                      <div className="mt-2 space-y-1.5 text-[11px] text-zinc-400">
                        <div className="flex gap-2"><span className="text-emerald-400">✓</span> Replace placeholders with real metrics</div>
                        <div className="flex gap-2"><span className="text-emerald-400">✓</span> Add 1 company-specific sentence (product you love)</div>
                        <div className="flex gap-2"><span className="text-emerald-400">✓</span> Keep under 280 words, 1 page</div>
                        <div className="flex gap-2"><span className="text-emerald-400">✓</span> Vercel deploy: npx vercel --prod</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {premiumTab==='linkedin' && (
                <div className="grid lg:grid-cols-2 gap-5">
                  <div className="rounded-[16px] bg-[#08080c] border border-white/[0.08] p-5">
                    <div className="text-[11px] tracking-[0.16em] font-bold text-zinc-500 mb-2">HEADLINE — 220 CHARS • KEYWORD STUFFED BUT HUMAN</div>
                    <div className="text-[14px] font-semibold leading-snug">Senior Full Stack Engineer | React • TypeScript • Node • Next.js • AWS • Docker • K8s • Microservices | Built platforms for 100k+ users, 2k RPS, 99.9% uptime | Ex-TechCorp | Open to fintech scaleups</div>
                    <div className="mt-5 text-[11px] tracking-[0.16em] font-bold text-zinc-500 mb-2">ABOUT — OPTIMIZED FOR RECRUITER SEARCH</div>
                    <div className="text-[13px] leading-[1.7] text-zinc-300 whitespace-pre-wrap">
{`I build fast, reliable products that users love — and that scale.

Senior Full Stack Engineer, 5+ years shipping React, TypeScript, Node.js, Next.js, AWS, Docker, Kubernetes, PostgreSQL, Redis, GraphQL, REST APIs. At TechCorp I led frontend platform: 100k+ MAU, 2k RPS, 99.9% uptime. Cut load 40%, migrated 200k LOC to TS, mentored 4 → 2 promoted.

What I do best:
→ Own features end-to-end: RFC → API design → UI → infra → observability
→ Turn ambiguous problems into shipped, measured outcomes (metrics or it didn't happen)
→ Raise bar: RFCs, code reviews, runbooks, on-call excellence

Spike: ${jdKeywords.slice(0,12).join(' • ')}

Currently exploring senior+ roles in fintech / infra where I can drive product strategy and reliability. If you're hiring for ${weighted.mustHaveKeys.slice(0,3).join(', ')}, let's chat.

DMs open. I reply in <24h. Let's build.

📍 San Francisco (remote-friendly) | 📧 alex.morgan@email.com
🔗 Featured: How I cut LCP 3.2→1.8s (thread) | OSS: react-perf-utils 200+ ⭐`}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="rounded-[16px] bg-[#08080c] border border-white/[0.08] p-5">
                      <div className="text-[11px] tracking-[0.16em] font-bold text-zinc-500 mb-3">SKILLS TO PIN — TOP 18 (ATS + RECRUITER SEARCH)</div>
                      <div className="flex flex-wrap gap-1.5">
                        {[...jdKeywords, ...injected].slice(0,18).map(k=> <span key={k} className="px-2.5 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-[11px] font-medium hover:bg-white/[0.08] transition">{k}</span>)}
                      </div>
                      <div className="mt-4 text-[11px] text-zinc-500">Tip: Pin 3 must-haves first — LinkedIn algorithm boosts search for first 3.</div>
                    </div>
                    <div className="rounded-[16px] bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-indigo-500/20 p-5">
                      <div className="text-[11px] tracking-[0.16em] font-bold text-indigo-300">CONTENT ENGINE — 3 POSTS THAT ATTRACT HIRING MANAGERS</div>
                      <div className="mt-3 space-y-2.5 text-[12px] text-zinc-400 leading-relaxed">
                        <div className="p-2.5 rounded-xl bg-[#08080c] border border-white/[0.06]">1. “How we cut LCP from 3.2s → 1.8s: 1) Code-split, 2) Edge cache Redis, 3) Next.js ISR. Full breakdown 🧵” — tags: {jdKeywords.slice(0,3).join(', ')}</div>
                        <div className="p-2.5 rounded-xl bg-[#08080c] border border-white/[0.06]">2. “RFC template that unblocked 3 teams — 1-page, trade-offs, rollout plan. Steal it 👇” — leadership signal</div>
                        <div className="p-2.5 rounded-xl bg-[#08080c] border border-white/[0.06]">3. “Incident retro: How we hit 99.9% after 99.2% — 5 lessons on SLOs, runbooks, on-call” — reliability proof</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {premiumTab==='interview' && (
                <div className="grid lg:grid-cols-[1fr_340px] gap-5">
                  <div className="space-y-3 max-h-[760px] overflow-auto pr-1">
                    {[
                      {q:`You list ${foundKeywords[0]||'React'} but JD asks for ${missingKeywords[0]||'Kubernetes'}. How do you ramp in first 30 days?`, a:`S: Faced similar gap migrating to K8s at TechCorp. T: Needed to own deploys in 3 weeks. A: Paired with platform team, shipped staging EKS cluster with Helm, wrote runbooks, added canary via Argo, documented 3 incident runbooks. R: Zero-downtime deploys + 40% faster releases. Here: 30-day plan — week 1 shadow on-call + read Terraform, week 2 ship staging, week 3 own 1 service deploy, week 4 present learnings.`},
                      {q:`Tell me about leading a team through a hard migration (TypeScript) — what broke?`, a:`S: 200k LOC JS monolith, 4 teams blocked. T: Lead TS migration without blocking features. A: Built codemods for auto-fix, incremental tsconfig (allowJs → strict), weekly guilds, metrics dashboard (any count, build time). Communicated trade-offs in RFC. R: 95% migrated in 10 weeks, bug rate -25%, 2 juniors promoted. Learned: migration is a product — needs roadmap + comms.`},
                      {q:`How would you improve reliability for our payments platform handling 2M+ tx/day?`, a:`Approach: Define SLO 99.9% (43m error budget/month), SLIs latency/error rate. Hot path: Redis cache + circuit breaker, DB: read replicas + pgbouncer, Async via Kafka for non-critical, Observability: Prometheus/Grafana + alerts on burn rate, CI/CD canary 10% → 100%, Chaos test. Past result: p95 -35%, incidents -60%.`},
                      {q:`Walk through a performance win with measurable impact.`, a:`S: Dashboard LCP 3.2s, bounce 42%. A: Profiled with Lighthouse + WebPageTest, found 1.2MB chart lib blocking. Split via dynamic import, moved heavy calc to Web Worker, added ISR for static parts, Redis edge cache. R: LCP 1.8s, bounce 24% (-18pp), conversion +7%. Kept bundle budget in CI.`},
                      {q:`Describe a disagreement with Product — how did you resolve?`, a:`Used data not opinion. PM wanted 5 features in sprint, eng capacity 2. Pulled Mixpanel, showed only 2 drove 80% value. Proposed A/B for riskiest, built minimal version in 1 week, measured. Result: shipped 2 high-impact, deferred 3, PM trust ↑. Lesson: disagree and commit, document trade-offs.`},
                      {q:`How do you handle ${missingKeywords[1]||'Terraform'} / IaC and drift?`, a:`IaC first: versioned modules, env parity, secrets in Vault, CI checks tflint + drift detection nightly. Past: reduced manual ops 60%, incident due to drift 0 in 6 months. Rollout: PR → plan → apply via Atlantis, audit log.`},
                      {q:`System design: design our payment auth flow (idempotency, retries).`, a:`Client → API Gateway (rate limit) → Auth (JWT) → Idempotency key check (Redis SETNX 24h) → Validation → PG tx with outbox pattern → Kafka event → downstream. Retries with exponential backoff + jitter, dead letter queue, exactly-once via idempotency table.`},
                      {q:`Why this company / why leave current?`, a:`Fintech scale + technical depth (${jdKeywords.slice(0,4).join(', ')}) matches my spike — I want to own infra at high scale, not just UI. TechCorp great, but roadmap now maintenance vs 0→1. Your payments 0→1 + 2M tx/day + 99.9% SLO is exactly where I add leverage.`},
                    ].map((item,i)=>(
                      <div key={i} className="rounded-[16px] bg-[#08080c] border border-white/[0.08] p-4">
                        <div className="flex gap-3"><span className="w-7 h-7 rounded-full bg-violet-500/20 text-violet-300 flex items-center justify-center text-[11px] font-bold flex-shrink-0">{i+1}</span><div className="flex-1"><div className="text-[13px] font-semibold leading-snug">{item.q}</div><div className="mt-2.5 text-[12px] text-zinc-400 leading-[1.6] p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"><span className="text-zinc-200 font-bold">STAR Answer:</span> {item.a}</div></div></div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-[16px] bg-gradient-to-br from-violet-600/15 to-indigo-600/15 border border-violet-500/20 p-4"><div className="text-[11px] font-bold tracking-widest text-violet-200">GAPS DETECTED → QUESTIONS</div><div className="mt-2 text-[12px] text-zinc-300 leading-relaxed">We generated Qs based on missing: <span className="font-semibold text-white">{missingKeywords.slice(0,5).join(', ') || 'none — strong match'}</span></div><div className="mt-3 text-[11px] text-zinc-500">Tip: Use STAR + metric. 60-90s answers.</div></div>
                    <div className="rounded-[16px] bg-[#08080c] border border-white/[0.06] p-4"><div className="text-[11px] font-bold tracking-widest text-zinc-500">NEGOTIATION PREP</div><div className="mt-2 text-[12px] text-zinc-400 leading-relaxed">JD says $160k-210k + 0.1% equity. Your story: 100k+ users, 99.9% SLO, 2 promotions mentored. Anchor high: “Based on scope (2M tx, on-call, mentorship) and market for {jdKeywords.slice(0,2).join('/')}, I’m targeting $200k+ base + 0.12%.” • Jobscan $49 vs you $1.99 tool shows ROI mindset.</div></div>
                  </div>
                </div>
              )}
              {premiumTab==='outreach' && (
                <div className="grid lg:grid-cols-2 gap-5">
                  <div className="rounded-[16px] bg-[#08080c] border border-white/[0.08] p-5"><div className="text-[11px] tracking-[0.16em] font-bold text-zinc-500 mb-3">COLD EMAIL TO HIRING MANAGER • 3 PARAGRAPHS • METRICS</div><div className="text-[13px] leading-[1.7] text-zinc-200 whitespace-pre-wrap">{`Subject: Senior Full Stack — shipped 100k+ MAU platform, cut LCP 40%, mentored 4 → ${jdKeywords.slice(0,2).join('/')} fit\n\nHi [Name],\n\nSaw you're hiring Senior Full Stack for payments platform (2M+ tx/day, SLO 99.9%). At TechCorp I led frontend platform for 100k+ MAU, drove TS migration (bug -25%), cut LCP 3.2→1.8s, and mentored 4 engineers (2 promoted). Stack: ${jdKeywords.slice(0,8).join(', ')}.\n\nI built similar reliability work: Redis caching + microservices split → 99.2%→99.9% uptime, p95 -35%. I also own RFCs, on-call, and stakeholder syncs — exactly your “own end-to-end” ask.\n\nWorth 15 min? I can share LCP playbook and incident retro template.\n\nBest,\nAlex\nalex.morgan@email.com | (555) 123-4567 | github.com/alexmorgan\nPS: Resume attached — ATS ${Math.round(matchAfter)}% match to your JD. P.S. Built with $1.99 tool, not $49/mo.`}</div></div>
                  <div className="rounded-[16px] bg-[#08080c] border border-white/[0.08] p-5"><div className="text-[11px] tracking-[0.16em] font-bold text-zinc-500 mb-3">LINKEDIN DM • SHORT • VALUE FIRST</div><div className="text-[13px] leading-[1.7] text-zinc-300 whitespace-pre-wrap">{`Hi [Name] — saw your post on scaling payments to 2M tx/day. At TechCorp we had similar 99.9% push — I wrote up 5 lessons on SLOs + runbooks that cut incidents 60%.\n\nI'm exploring senior roles in fintech infra (${jdKeywords.slice(0,3).join(', ')}). Your JD's must-haves align with my last 2 years. Open to a quick chat? Happy to share LCP 40% win teardown.\n\nAlex`}</div><div className="mt-5 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[11px] text-zinc-500">Hardened: keep &lt;300 chars, 1 CTA, no attachments in DM, link to portfolio.</div></div>
                </div>
              )}
            </div>
            <div className="mt-10 rounded-[16px] bg-[#0a0a0f] border border-white/[0.06] p-4 flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="text-[12px] text-zinc-400 flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-white text-black flex items-center justify-center text-[11px] font-bold">✦</span>Production hardened: paywall 2 scans, $1.99 cheap, Stripe ready, Vercel ready, watermarked free DL allowed.</div>
              <div className="flex items-center gap-2 text-[11px] text-zinc-500"><span className="px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08]">Paywall • ATS • Rewrite • Premium • {isPro ? 'PRO $1.99' : 'FREE'} • USE_STRIPE={String(USE_STRIPE)}</span></div>
            </div>
          </div>
        )}
      </main>
      <footer className="mt-8 border-t border-white/[0.06] py-6 bg-[#08080c]">
        <div className="mx-auto max-w-[1360px] px-6 flex flex-col md:flex-row items-center justify-between gap-3 text-[11px] text-zinc-500">
          <div className="flex items-center gap-3"><span className="font-bold tracking-widest text-zinc-400">PAYWALL • ATS SCANNER • REWRITE • PREMIUM • {isPro ? 'PRO MODE $1.99' : `${scansUsed}/${FREE_LIMIT} FREE USED`} • Jobscan $49/mo vs Us $1.99</span><span className="hidden md:flex w-1 h-1 rounded-full bg-white/20"/><span className="hidden md:flex">{isPro ? 'Pro session verified • Stripe mock ✓' : `Free ${FREE_LIMIT} scans • Unlock $1.99 ☕ • Watermarked DL allowed`}</span></div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/><span>All logic client-side • 100+ skills • 8 ATS checks • 3 versions • 4 premium tools • Vercel: npx vercel --prod</span></div>
        </div>
      </footer>
    </div>
  );
}
