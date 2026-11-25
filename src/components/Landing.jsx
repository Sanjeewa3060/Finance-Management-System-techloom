import React from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  CheckCircle2,
  FileText,
  Lock,
  LogIn,
  PieChart,
  Receipt,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import AppIcon from './AppIcon.jsx'

const FEATURES = [
  {
    icon: Building2,
    title: 'Department Finance',
    description: 'Track revenue, purchases, expenses and profitability for each department.',
  },
  {
    icon: FileText,
    title: 'Transactions',
    description: 'Record sales, purchases, expenses and other entries with full history.',
  },
  {
    icon: TrendingUp,
    title: 'Reports & Analytics',
    description: 'Visualize performance with detailed reports and export options.',
  },
  {
    icon: PieChart,
    title: 'Budget Control',
    description: 'Set department budgets and get alerts when approaching limits.',
  },
  {
    icon: Receipt,
    title: 'Receipt Proof',
    description: 'Attach image or PDF receipts to keep a clear record of transactions.',
  },
  {
    icon: Lock,
    title: 'Secure Administration',
    description: 'Manage accounts, audit logs and sensitive events with full control.',
  },
]

const HIGHLIGHTS = [
  'Department-wise tracking',
  'Real-time financial insights',
  'Secure and centralized',
]

export default function Landing() {
  return (
    <div className="landing-page landing-page--hero">
      <div className="landing-hero-media" aria-hidden="true">
        <img src="/landing-hero.jpg" alt="" className="landing-hero-media__img" />
        <div className="landing-hero-media__veil" />
      </div>

      <div className="landing-shell landing-shell--hero">
        <nav className="landing-nav landing-nav--hero" aria-label="Landing" />

        <main className="landing-main landing-main--hero">
          <section className="landing-hero landing-hero--copy">
            <div className="landing-hero-row">
              <div className="landing-hero-panel">
                <div className="landing-reveal landing-reveal--1 landing-eyebrow">
                  <AppIcon icon={Sparkles} size="sm" className="text-emerald-400" />
                  Finance management platform
                </div>

                <h1 className="landing-reveal landing-reveal--2 landing-hero-title">
                  Financial clarity{' '}
                  <span className="landing-hero-title__accent">across every department.</span>
                </h1>

                <p className="landing-reveal landing-reveal--3 landing-hero-sub">
                  Track sales, purchases, expenses and profitability from one structured financial workspace.
                </p>

                <ul className="landing-reveal landing-reveal--4 landing-highlights">
                  {HIGHLIGHTS.map((item) => (
                    <li key={item}>
                      <AppIcon icon={CheckCircle2} size="sm" className="text-emerald-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="landing-reveal landing-reveal--5 landing-hero-aside">
                <Link to="/" className="landing-brand landing-brand--aside">
                  <img src="/kaionex-main.svg" alt="KAIONEX" className="landing-brand__logo" />
                  <span className="landing-brand__text">
                    <span className="landing-brand__sep">|</span>
                    <span className="landing-brand__product">Finance Management System (FMS)</span>
                  </span>
                </Link>
                <Link to="/login" className="landing-btn-primary landing-btn-login">
                  <AppIcon icon={LogIn} size="sm" />
                  Login
                </Link>
              </div>
            </div>
          </section>

          <section className="landing-features landing-features--hero">
            {FEATURES.map((feature, index) => (
              <article
                key={feature.title}
                className={`landing-feature-card landing-feature-card--hero landing-reveal landing-reveal--${6 + index}`}
              >
                <div className="landing-feature-icon">
                  <AppIcon icon={feature.icon} size="md" className="text-emerald-400" />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </section>
        </main>
      </div>
    </div>
  )
}
