import { useEffect, useState } from 'react'
import { ArrowRight, ExternalLink, Globe, Mail, Monitor } from 'lucide-react'
import { KAIONEX_PRODUCTS } from './KaionexProducts.js'

const LINKS = {
  website: 'https://techloom.ai/',
  contact: 'mailto:info@techloom.ai',
  facebook: 'https://www.facebook.com/techloomai/',
  instagram: 'https://www.instagram.com/techloom.ai/',
  linkedin: 'https://www.linkedin.com/company/techloom-ai',
}

const ROTATE_MS = 5500

function FacebookIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M14 8.5h2.5V5.2c-.4-.1-1.7-.2-3.1-.2-3.1 0-5.2 1.9-5.2 5.3V13H5.5v3.6H8.2V22h3.7v-5.4h2.8l.4-3.6h-3.2v-2.4c0-1 .3-1.7 1.8-1.7z" />
    </svg>
  )
}

function InstagramIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function LinkedInIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M6.3 9.2H3.4V20.5h2.9V9.2zM4.9 3.5A1.7 1.7 0 1 0 4.9 6.9 1.7 1.7 0 0 0 4.9 3.5zM13.1 9c-1.5 0-2.5.8-2.9 1.6V9.2H7.4c0 .8 0 11.3 0 11.3h2.9v-6.3c0-.3 0-.7.1-1 .3-.7.9-1.4 2-1.4 1.4 0 2 1.1 2 2.7v6H17.2v-6.8C17.2 10.5 15.6 9 13.1 9z" />
    </svg>
  )
}

/** Left-side Techloom.ai + KAIONEX product ads (EMS / POS / E-COM). */
export default function LoginProductShowcase() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [animKey, setAnimKey] = useState(0)
  const active = KAIONEX_PRODUCTS[index]

  useEffect(() => {
    KAIONEX_PRODUCTS.forEach((product) => {
      const img = new Image()
      img.src = product.image
    })
  }, [])

  useEffect(() => {
    if (paused) return undefined
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % KAIONEX_PRODUCTS.length)
      setAnimKey((k) => k + 1)
    }, ROTATE_MS)
    return () => window.clearInterval(id)
  }, [paused])

  function selectProduct(i) {
    setIndex(i)
    setAnimKey((k) => k + 1)
  }

  return (
    <aside
      className="login-showcase"
      aria-label="Techloom.ai KAIONEX product highlights"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="login-showcase__bg" aria-hidden>
        {KAIONEX_PRODUCTS.map((product, i) => (
          <div
            key={product.id}
            className={`login-showcase__photo${i === index ? ' is-active' : ''}`}
          >
            <img
              src={product.image}
              alt=""
              className="login-showcase__photo-img"
              draggable={false}
            />
          </div>
        ))}
        <div className="login-showcase__veil" />
        <div className="login-showcase__orb login-showcase__orb--a" />
        <div className="login-showcase__orb login-showcase__orb--b" />
      </div>

      <div className="login-showcase__content">
        <div className="login-showcase__main">
          <div className="login-showcase__top">
            <p className="login-showcase__brand">
              <a
                href={LINKS.website}
                target="_blank"
                rel="noopener noreferrer"
                className="login-showcase__brand-link"
              >
                Techloom.ai
              </a>
            </p>
            <p className="login-showcase__pill">
              <Monitor className="size-3.5" aria-hidden />
              KAIONEX product suite
            </p>
          </div>

          <article key={`${active.id}-${animKey}`} className="login-showcase__slide is-active" aria-live="polite">
            <p className="login-showcase__kaionex-line">{active.kaionexName}</p>
            <h2 className="login-showcase__title">{active.tagline}</h2>
            <p className="login-showcase__name">{active.name.toUpperCase()}</p>
            <p className="login-showcase__blurb">{active.blurb}</p>
            <ul className="login-showcase__points">
              {active.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </article>

          <div className="login-showcase__controls">
            <div className="login-showcase__tabs" role="tablist" aria-label="Product ads">
              {KAIONEX_PRODUCTS.map((product, i) => (
                <button
                  key={product.id}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  className={i === index ? 'is-active' : ''}
                  onClick={() => selectProduct(i)}
                >
                  {product.badge}
                </button>
              ))}
            </div>
            <a
              href={LINKS.website}
              className="login-showcase__cta"
              target="_blank"
              rel="noopener noreferrer"
            >
              Learn more <ArrowRight className="size-4" aria-hidden />
            </a>
          </div>

          <div className="login-showcase__progress" aria-hidden>
            <span
              key={`${active.id}-${paused ? 'p' : 'r'}-${animKey}`}
              className={`login-showcase__progress-bar${paused ? ' is-paused' : ''}`}
              style={{ '--rotate-ms': `${ROTATE_MS}ms` }}
            />
          </div>
        </div>

        <footer className="login-showcase__footer">
          <div className="login-showcase__social" aria-label="Social media">
            <a href={LINKS.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
              <FacebookIcon className="size-4" />
            </a>
            <a href={LINKS.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <InstagramIcon className="size-4" />
            </a>
            <a href={LINKS.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
              <LinkedInIcon className="size-4" />
            </a>
          </div>
          <div className="login-showcase__links">
            <a href={LINKS.website} target="_blank" rel="noopener noreferrer">
              <Globe className="size-3.5" aria-hidden />
              techloom.ai
              <ExternalLink className="size-3" aria-hidden />
            </a>
            <a href={LINKS.contact}>
              <Mail className="size-3.5" aria-hidden />
              Contact
            </a>
          </div>
        </footer>
      </div>
    </aside>
  )
}
