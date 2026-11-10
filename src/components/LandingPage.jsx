/**
 * BizaDesk landing page (React 19 / Vite)
 *
 * INSTRUCTIONS FOR THE CODING AGENT
 * 1. Place LandingPage.jsx and landing.css in the same folder (e.g. src/pages/).
 * 2. Render <LandingPage /> on the public route "/" (or wherever the marketing page should live).
 *    The app itself stays at https://desk.bizadoc.com, every CTA already links there via APP_URL.
 * 3. No new dependencies. No Tailwind needed: all styles are in landing.css and
 *    scoped under the .bd wrapper, so they cannot affect the rest of the app.
 *    landing.css uses native CSS nesting (supported by Vite and all current browsers).
 * 4. Dark mode only. Do not add a light theme.
 * 5. Keep copy, pricing and contact details exactly as written below.
 *    Edit the data arrays (FEATURES, PLANS, etc.) rather than the JSX when content changes.
 */
import { useState } from 'react'
import './landing.css'
import LandingChatbot from './LandingChatbot'

const APP_URL = 'https://desk.bizadoc.com'

const FEATURES = [
  ['🤖', 'Virtual IT Assistant', 'AI chat and voice that answers 24/7 with step-by-step fixes for Wi-Fi, VPN, printers and Remote Desktop. If it can’t solve it, escalate via WhatsApp, call or ticket.'],
  ['🎫', 'Smart Ticket Management', 'Full lifecycle from Open to In Progress to Resolved, role-based views, instant in-app notifications and filters by status, technician and date.'],
  ['⚡', 'Incident Command Centre', 'Live severity tracking, a proactive alert banner, and auto-escalation emails to staff and IT managers the moment an SLA is breached.'],
  ['🖥️', 'Quick Assist Sessions', 'Launch and share a 6-digit Windows Quick Assist code right inside the ticket chat. Nothing extra to install.'],
  ['📡', 'Service Monitoring', 'Watch email, VPN, internet and internal tools in real time. Services going offline trigger incidents and email alerts automatically.'],
  ['📚', 'Knowledge Base', '36 ready-made articles plus your own company guides. Enterprise teams can bulk-upload via JSON or CSV.'],
  ['👥', 'Team & User Management', 'Add technicians and staff in seconds with Admin, Technician and Staff roles, department assignment and password resets from the dashboard.'],
  ['💳', 'Payments & Refunds', 'Paystack checkout for individuals, one-click 100% refunds from the ticket, and business billing in NGN (Paystack) or USD (Stripe).'],
  ['🔐', 'Security & Audit', 'Full audit log with CSV export, XSS-safe inputs and database-level Row-Level Security so tenants can never see each other’s data.'],
]

const STATS = [
  ['24/7', 'AI assistant & WhatsApp support'],
  ['36', 'Built-in knowledge base articles'],
  ['100%', 'Money-back for individuals'],
  ['30 days', 'Free trial, no card'],
]

const STEPS = [
  ['Register your workspace', 'Create your business account and add your IT team and staff from the dashboard.'],
  ['Let AI take the first pass', 'Staff chat with the Virtual IT Assistant. Most everyday issues get solved before a ticket exists.'],
  ['Escalate and resolve', 'Tickets route to technicians, incidents trigger alerts, and everyone is notified at each step.'],
]

const PLANS = [
  {
    name: 'Standard Office', for: 'SMBs with up to 50 staff',
    monthly: '₦45,000', yearly: '₦432,000', yearlyNote: '₦36,000 a month, billed yearly',
    items: ['AI Virtual IT Assistant', 'Tickets & notifications', 'Incident command & monitoring', 'Built-in knowledge base'],
    cta: 'Start Free Trial',
  },
  {
    name: 'Enterprise Fleet', for: 'Large organisations, unlimited users', hot: true,
    monthly: '₦120,000', yearly: '₦1,152,000', yearlyNote: '₦96,000 a month, billed yearly',
    items: ['Everything in Standard', 'Unlimited users', 'Custom KB JSON/CSV bulk upload', 'Global KB sharing across tenants'],
    cta: 'Start Free Trial',
  },
  {
    name: 'Individual', for: 'Personal and home use', fixed: '₦3,500', fixedUnit: ' /incident', fixedNote: 'On-site visits from ₦10,000',
    items: ['Remote help by a technician', 'Physical on-site option', '100% money-back guarantee', 'Pay only when you need help'],
    cta: 'Get Help Now',
  },
]

const TICKETS = [
  ['Printer offline — Finance floor', 'w', 'IN PROGRESS'],
  ['Cannot access shared drive', 'o', 'OPEN'],
  ['Outlook keeps asking for password', 'r', 'RESOLVED'],
  ['New laptop setup — HR', 'o', 'OPEN'],
]

const SERVICES = [
  ['Email server', '#10b981', 'Online'],
  ['VPN gateway', '#f59e0b', 'Degraded'],
  ['Internet link', '#10b981', 'Online'],
]

const TRUST_BADGES = [
  '🔒 Bank-Grade 256-Bit SSL',
  '💳 PCI-DSS Certified Payments',
  '⚡ 99.9% Monitored Uptime SLA',
  '🛡️ 100% Money-Back Guarantee',
  '🇳🇬 Dedicated Local & Remote Support'
]

function Logo({ style }) {
  return (
    <a className="logo" href="#top" style={style}>
      <i>⚡</i>BizaDesk
    </a>
  )
}

function PlanCard({ plan, yearly, onGoToApp }) {
  const priced = !plan.fixed
  return (
    <div className={`pc${plan.hot ? ' hot' : ''}`}>
      {plan.hot && <span className="badge">BEST FOR LARGE TEAMS</span>}
      <h3>{plan.name}</h3>
      <div className="for">{plan.for}</div>
      <div className="amt">
        {priced ? (yearly ? plan.yearly : plan.monthly) : plan.fixed}
        <small>{priced ? (yearly ? ' /yr' : ' /mo') : plan.fixedUnit}</small>
      </div>
      <div className="sub">{priced ? (yearly ? plan.yearlyNote : '') : plan.fixedNote}</div>
      <ul className="ck">
        {plan.items.map((i) => <li key={i}>{i}</li>)}
      </ul>
      <a 
        className={`btn ${plan.hot ? 'p' : 'g'}`} 
        href={APP_URL}
        onClick={(e) => {
          if (onGoToApp) {
            e.preventDefault();
            onGoToApp();
          }
        }}
      >
        {plan.cta}
      </a>
    </div>
  )
}

export default function LandingPage({ onGoToApp }) {
  const [yearly, setYearly] = useState(false)

  const handleCtaClick = (e) => {
    if (onGoToApp) {
      e.preventDefault();
      onGoToApp();
    }
  };

  return (
    <div className="bd" id="top">
      <nav>
        <div className="wrap">
          <Logo />
          <div className="links">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#pricing">Pricing</a>
            <a href="#contact">Contact</a>
          </div>
          <a className="btn p" href={APP_URL} onClick={handleCtaClick} style={{ padding: '10px 18px', fontSize: 14 }}>Start Free Trial</a>
        </div>
      </nav>

      <header className="hero">
        <div className="wrap">
          <div className="pill"><span className="dot" />Built for Nigerian businesses and beyond</div>
          <h1>Autonomous IT support, <span>on your command.</span></h1>
          <p className="lead">
            BizaDesk is the smart multi-tenant helpdesk that resolves incidents faster with AI-guided
            troubleshooting, live monitoring and one clean dashboard for your whole team.
          </p>
          <div className="cta">
            <a className="btn p" href={APP_URL} onClick={handleCtaClick}>Start Free Trial →</a>
            <a className="btn g" href="#features">Explore features</a>
          </div>
          <div className="note">30-day free trial · No credit card required</div>

          <div className="mock" aria-hidden="true">
            <div className="bar"><b /><b /><b /><em>desk.bizadoc.com / dashboard</em></div>
            <div className="alert">
              ⚠️ <span><b>Active incident:</b> VPN gateway degraded — 14 staff affected. SLA timer running.</span>
            </div>
            <div className="mg">
              <div className="pn">
                <h4>Recent tickets</h4>
                {TICKETS.map(([t, c, s]) => (
                  <div className="tk" key={t}><span>{t}</span><span className={`tg ${c}`}>{s}</span></div>
                ))}
              </div>
              <div className="pn">
                <h4>Service status</h4>
                {SERVICES.map(([n, col, s]) => (
                  <div className="sv" key={n}><span>{n}</span><span><u style={{ background: col }} />{s}</span></div>
                ))}
                <div className="chat">🤖 “Try disconnecting and reconnecting the VPN, then flush DNS. Want me to walk you through it?”</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section style={{ paddingTop: 70 }}>
        <div className="wrap">
          <div className="stats">
            {STATS.map(([b, s]) => <div key={b}><b>{b}</b><span>{s}</span></div>)}
          </div>
        </div>
      </section>

      <section id="features" style={{ paddingTop: 20 }}>
        <div className="wrap">
          <div className="hd">
            <span className="eyebrow">Features</span>
            <h2>Everything your IT desk needs, in one place</h2>
            <p>From the first “my Wi-Fi isn’t working” to a full-blown outage, BizaDesk keeps your team calm and in control.</p>
          </div>
          <div className="grid">
            {FEATURES.map(([ic, t, d]) => (
              <div className="f" key={t}>
                <div className="ic">{ic}</div>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="alt" id="how">
        <div className="wrap">
          <div className="hd"><span className="eyebrow">How it works</span><h2>Up and running in minutes</h2></div>
          <div className="steps">
            {STEPS.map(([t, d]) => <div className="st" key={t}><h3>{t}</h3><p>{d}</p></div>)}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="hd"><span className="eyebrow">Who it’s for</span><h2>One platform, two ways to get help</h2></div>
          <div className="two">
            <div className="aud">
              <h3>Businesses</h3>
              <p>Register a workspace, onboard your IT team, and let staff raise tickets internally.</p>
              <ul className="ck">
                <li>No per-ticket fees</li>
                <li>Role-based access for every team member</li>
                <li>Incident command and live monitoring</li>
                <li>Custom knowledge base</li>
              </ul>
            </div>
            <div className="aud e">
              <h3>Individuals</h3>
              <p>Home or personal IT trouble? Pay only when you need a hand.</p>
              <ul className="ck">
                <li>Remote help from ₦3,500</li>
                <li>On-site visits from ₦10,000</li>
                <li>100% money-back guarantee</li>
                <li>Secure Paystack checkout</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="alt" id="pricing">
        <div className="wrap" style={{ textAlign: 'center' }}>
          <div className="hd">
            <span className="eyebrow">Pricing</span>
            <h2>Simple, honest pricing</h2>
            <p>Start free for 30 days. Save 20% when you pay annually.</p>
          </div>
          <div className="tog" role="group" aria-label="Billing period">
            <button type="button" className={!yearly ? 'on' : ''} onClick={() => setYearly(false)}>Monthly</button>
            <button type="button" className={yearly ? 'on' : ''} onClick={() => setYearly(true)}>Yearly <small>−20%</small></button>
          </div>
          <div className="price">
            {PLANS.map((p) => <PlanCard key={p.name} plan={p} yearly={yearly} onGoToApp={onGoToApp} />)}
          </div>
          <div className="trust">
            <span>30-day free trial</span><span>No credit card required</span>
            <span>20% off annual billing</span><span>PCI-DSS compliant payments</span>
          </div>
          <div className="built">{TRUST_BADGES.map((b) => <span key={b}>{b}</span>)}</div>
        </div>
      </section>

      <section style={{ paddingBottom: 0 }}>
        <div className="wrap">
          <div className="final">
            <h2>Give your team an IT desk that never sleeps.</h2>
            <p>Join businesses already resolving incidents faster. Your 30-day trial starts in a minute, no card needed.</p>
            <a className="btn p" href={APP_URL} onClick={handleCtaClick} style={{ fontSize: 16, padding: '15px 30px' }}>Start Free Trial →</a>
          </div>
        </div>
      </section>

      <footer id="contact">
        <div className="wrap">
          <div>
            <Logo style={{ color: 'var(--tx)', marginBottom: 10 }} />
            Autonomous IT Support &amp; Incident Command
          </div>
          <div>
            Email: <a href="mailto:helpdesk@bizadoc.com">helpdesk@bizadoc.com</a><br />
            WhatsApp / Hotline: <a href="https://wa.me/2349162029201">+234 916 202 9201</a>
          </div>
          <div>Office hours: Mon–Fri, 8am–6pm WAT<br />WhatsApp support: 24/7</div>
        </div>
      </footer>

      {/* Floating Interactive Hybrid IT Assistant */}
      <LandingChatbot onGoToApp={onGoToApp} />
    </div>
  )
}
