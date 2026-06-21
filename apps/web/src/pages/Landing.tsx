import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { Provider } from '@lyra/shared';
import { BrandLogo } from '../components/BrandLogo';
import { LanguageToggleButton, ThemeToggleButton } from '../components/PrefControls';
import { ProviderIcon } from '../components/ProviderIcon';
import './landing.css';

// ---- Small inline glyphs (kept local to the marketing page) ----
const Tick = () => (
  <svg
    className="l-tick"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" opacity="0.3" />
    <path d="m8 12 2.5 2.5L16 9" />
  </svg>
);
const Lock = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);
const Layers = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m12 2 9 5-9 5-9-5 9-5Z" />
    <path d="m3 12 9 5 9-5" />
    <path d="m3 17 9 5 9-5" />
  </svg>
);
const Key = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="7.5" cy="15.5" r="4.5" />
    <path d="m10.7 12.3 9.3-9.3M17 5l3 3M14 8l2 2" />
  </svg>
);
// Task-board status glyphs (Projects feature mockup).
const ProgGlyph = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6" stroke="#ff6b1a" strokeWidth="1.6" />
    <path d="M8 8V2.6A5.4 5.4 0 0 1 8 13.4Z" fill="#ff6b1a" />
  </svg>
);
const DoneGlyph = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="7" fill="#1f8a4c" />
    <path d="M5 8.2 7 10.2 11 6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Model strip: providers you bring keys for. Video is roadmap, marked Soon.
const MODELS: { provider: Provider; label: string; soon?: boolean }[] = [
  { provider: Provider.OpenAI, label: 'OpenAI' },
  { provider: Provider.Anthropic, label: 'Claude' },
  { provider: Provider.DeepSeek, label: 'DeepSeek' },
  { provider: Provider.Image, label: 'Image' },
  { provider: Provider.Video, label: 'Video', soon: true },
];

const FLOW: { n: number; key: string; soon?: boolean }[] = [
  { n: 1, key: 'find', soon: true },
  { n: 2, key: 'brand' },
  { n: 3, key: 'create', soon: true },
  { n: 4, key: 'approve' },
  { n: 5, key: 'publish' },
];

// Output gallery: the kinds of creative one product fans out into.
const MAKE: { cls: string; key: string; seed: string; w: number; h: number }[] = [
  { cls: 'l-make-1', key: 'studio', seed: 'lyra-studio-product', w: 900, h: 600 },
  { cls: 'l-make-2', key: 'lifestyle', seed: 'lyra-lifestyle-scene', w: 600, h: 400 },
  { cls: 'l-make-3', key: 'ugc', seed: 'lyra-ugc-reel', w: 600, h: 400 },
  { cls: 'l-make-4', key: 'ads', seed: 'lyra-ad-variation', w: 600, h: 700 },
  { cls: 'l-make-5', key: 'marketplace', seed: 'lyra-marketplace-listing', w: 600, h: 700 },
  { cls: 'l-make-6', key: 'seasonal', seed: 'lyra-seasonal-campaign', w: 600, h: 700 },
];

// Channel chips shown on the hero campaign-flow preview.
const CHANNELS = ['TikTok', 'Instagram', 'Bluesky', 'X'];

const SECURITY: { Icon: () => ReactElement; key: string }[] = [
  { Icon: Lock, key: 'keys' },
  { Icon: Layers, key: 'workspace' },
  { Icon: Key, key: 'byo' },
];

// Reveal-on-scroll: enhances an already-visible default; collapses under
// prefers-reduced-motion (the CSS guard makes .l-reveal fully visible, and we
// also bail out of observing entirely below).
function useScrollReveal() {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>('.l-reveal'));
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // No animation path: content stays visible (the CSS default). Never hide it.
    if (reduce || !('IntersectionObserver' in window)) return;
    // Enable the hidden-then-animate state only now that we can observe.
    root.classList.add('reveal-on');
    const reveal = (el: Element) => el.classList.add('is-in');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            reveal(entry.target);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    );
    els.forEach((el) => io.observe(el));
    // Failsafe: if the observer never fires (bfcache restore, hidden tab during
    // load, mobile quirk), reveal everything so nothing ships blank.
    const failsafe = window.setTimeout(() => els.forEach(reveal), 1600);
    return () => {
      io.disconnect();
      window.clearTimeout(failsafe);
    };
  }, []);
  return rootRef;
}

// Back-to-top: appears after scrolling down; smooth-scrolls to the top.
function ScrollTopButton() {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 700);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <button
      type="button"
      className={`l-scrolltop${show ? ' is-shown' : ''}`}
      aria-label={t('landing.backToTop')}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m6 14 6-6 6 6" />
      </svg>
    </button>
  );
}

export function Landing() {
  const { t } = useTranslation();
  const rootRef = useScrollReveal();

  return (
    <div className="lyra-landing" ref={rootRef}>
      {/* ---- Nav ---- */}
      <header className="l-nav">
        <div className="l-container l-nav-inner">
          <Link to="/" className="l-brand" aria-label="Lyra">
            <BrandLogo />
          </Link>
          <nav className="l-nav-links" aria-label={t('landing.navAria')}>
            <a href="#how">{t('landing.navHow')}</a>
            <a href="#pipelines">{t('landing.navPipelines')}</a>
            <a href="#marketplace">{t('landing.navMarketplace')}</a>
            <a href="#security">{t('landing.navSecurity')}</a>
          </nav>
          <div className="l-nav-cta">
            <div className="l-nav-prefs" aria-label={t('landing.preferences')}>
              <LanguageToggleButton />
              <ThemeToggleButton />
            </div>
            <Link to="/login" className="l-btn l-btn-ghost l-btn-sm l-nav-hide-sm">{t('landing.signIn')}</Link>
            <Link to="/signup" className="l-btn l-btn-primary l-btn-sm">{t('landing.startFree')}</Link>
          </div>
        </div>
      </header>

      <main>
        {/* ---- Hero ---- */}
        <section className="l-hero">
          <div className="l-container l-hero-grid">
            <div className="l-hero-copy">
              <span className="l-eyebrow">{t('landing.eyebrow')}</span>
              <h1 className="l-h1">{t('landing.heroTitle')}</h1>
              <p className="l-hero-sub">{t('landing.heroSub')}</p>
              <div className="l-hero-cta">
                <Link to="/signup" className="l-btn l-btn-primary">{t('landing.startFree')}</Link>
                <a href="#how" className="l-btn l-btn-ghost">{t('landing.seeHow')}</a>
              </div>
              <p className="l-hero-note">{t('landing.noCard')}</p>
            </div>

            {/* Campaign-flow preview: a single product carried Find → Publish.
                Local gpt-image-1 generated assets (/public/landing), not a div-mock. */}
            <div
              className="l-campaign"
              aria-label={t('landing.campaignAria')}
            >
              <div className="l-campaign-head">
                <span className="l-campaign-title">{t('landing.campaignFlow')}</span>
                <span className="l-campaign-stages">{t('landing.campaignStages')}</span>
              </div>

              <figure className="l-campaign-hero">
                <img
                  src="/landing/lyra-campaign-hero.webp"
                  width={800}
                  height={520}
                  loading="eager"
                  alt={t('landing.campaignHeroAlt')}
                />
                {/* TODO: swap for real brand asset */}
                <figcaption className="l-campaign-chip">{t('landing.brandedHero')}</figcaption>
              </figure>

              <div className="l-campaign-row">
                <figure className="l-campaign-thumb">
                  <img
                    src="/landing/lyra-campaign-found.webp"
                    width={360}
                    height={360}
                    loading="lazy"
                    alt={t('landing.campaignFoundAlt')}
                  />
                  {/* TODO: swap for real brand asset */}
                  <figcaption className="l-campaign-chip sm">{t('landing.found')}</figcaption>
                </figure>
                <figure className="l-campaign-thumb">
                  <img
                    src="/landing/lyra-campaign-ugc.webp"
                    width={360}
                    height={360}
                    loading="lazy"
                    alt={t('landing.campaignUgcAlt')}
                  />
                  {/* TODO: swap for real brand asset */}
                  <figcaption className="l-campaign-chip sm">{t('landing.ugcReel')}</figcaption>
                </figure>
                <figure className="l-campaign-thumb">
                  <img
                    src="/landing/lyra-campaign-ad.webp"
                    width={360}
                    height={360}
                    loading="lazy"
                    alt={t('landing.campaignAdAlt')}
                  />
                  {/* TODO: swap for real brand asset */}
                  <figcaption className="l-campaign-chip sm">{t('landing.ad')}</figcaption>
                </figure>
              </div>

              <div className="l-campaign-publish">
                <span className="l-campaign-publish-label">{t('landing.publishingTo')}</span>
                <span className="l-campaign-channels">
                  {CHANNELS.map((c) => (
                    <span className="l-campaign-channel" key={c}>{c}</span>
                  ))}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ---- Model strip ---- */}
        <section className="l-models">
          <div className="l-container">
            <p className="l-models-cap">{t('landing.modelsCap')}</p>
            <div className="l-models-row">
              {MODELS.map((m) => (
                <span className="l-model" key={m.label}>
                  <ProviderIcon provider={m.provider} size={22} />
                  {m.label}
                  {m.soon && <span className="l-soon">{t('landing.soon')}</span>}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ---- Pain → Promise ---- */}
        <section className="l-pain">
          <div className="l-container">
            <p className="l-pain-text l-reveal">
              {t('landing.painText')}
            </p>
            <span className="l-pain-emph l-reveal">
              <Trans i18nKey="landing.painEmph" components={{ b: <b /> }} />
            </span>
          </div>
        </section>

        {/* ---- The flow: 5 connected funnel stages ---- */}
        <section className="l-flow" id="how">
          <div className="l-container">
            <div className="l-section-head l-section-head-centered">
              <span className="l-eyebrow">{t('landing.flowEyebrow')}</span>
              <h2 className="l-h2">{t('landing.flowTitle')}</h2>
              <p className="l-lead">{t('landing.flowLead')}</p>
            </div>
            <ol className="l-flow-track">
              {FLOW.map((s, i) => (
                <li className="l-flow-step l-reveal" key={s.n}>
                  <div className="l-flow-card">
                    <span className="l-flow-n">{s.n}</span>
                    <h3 className="l-flow-h">{t(`landing.flow.${s.key}.h`)}</h3>
                    <p className="l-flow-b">{t(`landing.flow.${s.key}.b`)}</p>
                    <span className={`l-flow-chip${s.soon ? ' soon' : ''}`}>{t(`landing.flow.${s.key}.chip`)}</span>
                  </div>
                  {i < FLOW.length - 1 && (
                    <span className="l-flow-arrow" aria-hidden="true">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ==================== FEATURE BANDS ==================== */}
        <div id="features">
          {/* Prompts & Marketplace (collage) */}
          <section className="l-feature-band" id="marketplace">
            <div className="l-container l-feature">
              <div className="l-feature-copy l-reveal">
                <span className="l-eyebrow">{t('landing.features.library.eyebrow')}</span>
                <h3 className="l-h3">{t('landing.features.library.title')}</h3>
                <p className="l-body">
                  <Trans i18nKey="landing.features.library.body" components={{ chip: <span className="l-chip" /> }} />
                </p>
                <ul className="l-feature-points">
                  <li><Tick /> {t('landing.features.library.point1')}</li>
                  <li><Tick /> <Trans i18nKey="landing.features.library.point2" components={{ chip: <span className="l-chip" /> }} /></li>
                  <li><Tick /> {t('landing.features.library.point3')}</li>
                </ul>
              </div>
              <div className="l-feature-visual l-reveal">
                <div className="l-feature-collage">
                  <div className="span-rows">
                    <img src="/landing/lyra-pipe-main.webp" width={700} height={900} loading="lazy" alt={t('landing.features.library.alt')} />
                  </div>
                  <div><img src="/landing/lyra-pipe-brief.webp" width={500} height={400} loading="lazy" alt="" /></div>
                  <div><img src="/landing/lyra-pipe-render.webp" width={500} height={400} loading="lazy" alt="" /></div>
                </div>
              </div>
            </div>
          </section>

          {/* Pipelines & the run engine (gate glimpse, reversed) */}
          <section className="l-feature-band" id="pipelines">
            <div className="l-container l-feature rev">
              <div className="l-feature-copy l-reveal">
                <span className="l-eyebrow">{t('landing.features.pipeline.eyebrow')}</span>
                <h3 className="l-h3">{t('landing.features.pipeline.title')}</h3>
                <p className="l-body">
                  <Trans i18nKey="landing.features.pipeline.body" components={{ chip: <span className="l-chip" />, b: <b /> }} />
                </p>
                <ul className="l-feature-points">
                  <li><Tick /> {t('landing.features.pipeline.point1')}</li>
                  <li><Tick /> {t('landing.features.pipeline.point2')}</li>
                  <li><Tick /> {t('landing.features.pipeline.point3')}</li>
                </ul>
              </div>
              <div className="l-feature-visual l-reveal">
                <div className="l-glimpse" role="img" aria-label={t('landing.features.pipeline.glimpseAria')}>
                  <img src="/landing/lyra-gate-render.webp" width={900} height={720} loading="lazy" alt="" />
                  <div className="l-glimpse-card" aria-hidden="true">
                    <div className="l-glimpse-top">
                      <span className="l-glimpse-gate-dot" />
                      {t('landing.features.pipeline.heroShot')}
                      <span className="l-glimpse-status">{t('landing.features.pipeline.gateWaiting')}</span>
                    </div>
                    <p className="l-glimpse-body">{t('landing.features.pipeline.glimpseBody')}</p>
                    <div className="l-glimpse-actions">
                      <span className="l-glimpse-btn primary">{t('landing.features.pipeline.approve')}</span>
                      <span className="l-glimpse-btn">{t('landing.features.pipeline.viewOutput')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Projects & task board (mockup) */}
          <section className="l-feature-band">
            <div className="l-container l-feature">
              <div className="l-feature-copy l-reveal">
                <span className="l-eyebrow">{t('landing.features.projects.eyebrow')}</span>
                <h3 className="l-h3">{t('landing.features.projects.title')}</h3>
                <p className="l-body">
                  <Trans i18nKey="landing.features.projects.body" components={{ b: <b /> }} />
                </p>
                <ul className="l-feature-points">
                  <li><Tick /> {t('landing.features.projects.point1')}</li>
                  <li><Tick /> {t('landing.features.projects.point2')}</li>
                  <li><Tick /> {t('landing.features.projects.point3')}</li>
                </ul>
              </div>
              <div className="l-feature-visual l-reveal">
                <div className="l-board" aria-hidden="true">
                  <div className="l-board-head">
                    <span className="l-board-title">{t('landing.features.projects.boardTitle')}</span>
                    <span className="l-board-badge">{t('landing.features.projects.draft')}</span>
                  </div>
                  <div className="l-board-col">
                    <div className="l-board-colh"><ProgGlyph />{t('landing.features.projects.inProgress')}<span>2</span></div>
                    <div className="l-board-card">
                      <div className="l-board-card-top"><ProgGlyph />{t('landing.features.projects.task1')}</div>
                      <div className="l-board-card-meta">
                        <span className="l-board-tag" style={{ color: '#0891b2', background: '#0891b21f' }}>{t('landing.features.projects.task1Tag')}</span>
                        <span className="l-board-run gate">{t('landing.features.projects.task1Run')}</span>
                        <span className="l-board-grow" />
                        <span className="l-board-av" style={{ background: '#7c5cff' }}>TL</span>
                      </div>
                    </div>
                    <div className="l-board-card">
                      <div className="l-board-card-top"><ProgGlyph />{t('landing.features.projects.task2')}</div>
                      <div className="l-board-card-meta">
                        <span className="l-board-tag" style={{ color: '#d6409f', background: '#d6409f1f' }}>{t('landing.features.projects.task2Tag')}</span>
                        <span className="l-board-run">{t('landing.features.projects.task2Run')}</span>
                        <span className="l-board-grow" />
                        <span className="l-board-av" style={{ background: '#0891b2' }}>MT</span>
                      </div>
                    </div>
                  </div>
                  <div className="l-board-col">
                    <div className="l-board-colh"><DoneGlyph />{t('landing.features.projects.complete')}<span>2</span></div>
                    <div className="l-board-card">
                      <div className="l-board-card-top"><DoneGlyph />{t('landing.features.projects.task3')}</div>
                      <div className="l-board-card-meta">
                        <span className="l-board-tag" style={{ color: '#db2777', background: '#ec48991f' }}>{t('landing.features.projects.task3Tag')}</span>
                        <span className="l-board-run done">{t('landing.features.projects.task3Run')}</span>
                        <span className="l-board-grow" />
                        <span className="l-board-av" style={{ background: '#0891b2' }}>MT</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Crawl (full-width band, different family) */}
          <section className="l-feature-band">
            <div className="l-container l-crawl l-reveal">
              <div className="l-crawl-copy">
                <span className="l-eyebrow">{t('landing.features.import.eyebrow')}</span>
                <h3 className="l-h3">{t('landing.features.import.title')}</h3>
                <p className="l-body">{t('landing.features.import.body')}</p>
                <ul className="l-feature-points l-crawl-points">
                  <li><Tick /> {t('landing.features.import.point1')}</li>
                  <li><Tick /> {t('landing.features.import.point2')}</li>
                  <li><Tick /> {t('landing.features.import.point3')}</li>
                </ul>
              </div>
              <div className="l-crawl-strip" aria-hidden="true">
                <span className="l-crawl-url">https://cozyclaw.shop/products/cat-cave</span>
                <span className="l-crawl-arrow">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M6 13l6 6 6-6" />
                  </svg>
                </span>
                <span className="l-crawl-tiles">
                  <img src="/landing/lyra-crawl-a.webp" width={240} height={240} loading="lazy" alt={t('landing.features.import.altA')} />
                  <img src="/landing/lyra-crawl-b.webp" width={240} height={240} loading="lazy" alt={t('landing.features.import.altB')} />
                  <img src="/landing/lyra-crawl-c.webp" width={240} height={240} loading="lazy" alt={t('landing.features.import.altC')} />
                </span>
              </div>
            </div>
          </section>

          {/* Publish (image-led, reversed) */}
          <section className="l-feature-band">
            <div className="l-container l-feature rev">
              <div className="l-feature-copy l-reveal">
                <span className="l-eyebrow">{t('landing.features.publish.eyebrow')}</span>
                <h3 className="l-h3">{t('landing.features.publish.title')}</h3>
                <p className="l-body">{t('landing.features.publish.body')}</p>
                <ul className="l-feature-points">
                  <li><Tick /> {t('landing.features.publish.point1')}</li>
                  <li><Tick /> {t('landing.features.publish.point2')}</li>
                </ul>
                <p className="l-feature-note">{t('landing.features.publish.note')}</p>
              </div>
              <div className="l-feature-visual l-reveal">
                <div className="l-publish">
                  <img src="/landing/lyra-publish-campaign.webp" width={900} height={720} loading="lazy" alt={t('landing.features.publish.alt')} />
                  <div className="l-publish-rail" aria-hidden="true">
                    {['TikTok', 'Instagram', 'YouTube', 'Facebook'].map((c) => (
                      <span className="l-publish-pill" key={c}>
                        <span className="l-publish-dot" />
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ---- What you can make (colorful gallery — design: after Publish) ---- */}
        <section className="l-gallery-sec">
          <div className="l-container">
            <div className="l-section-head l-section-head-centered">
              <span className="l-eyebrow">{t('landing.galleryEyebrow')}</span>
              <h2 className="l-h2">{t('landing.galleryTitle')}</h2>
              <p className="l-lead">{t('landing.galleryLead')}</p>
            </div>
            <div className="l-gallery">
              {MAKE.map((m) => (
                <figure className={`l-make ${m.cls} l-reveal`} key={m.key}>
                  <img
                    src={`/landing/${m.seed}.webp`}
                    width={m.w}
                    height={m.h}
                    loading="lazy"
                    alt={t(`landing.make.${m.key}.alt`)}
                  />
                  <figcaption className="l-make-chip">{t(`landing.make.${m.key}.label`)}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* ---- Security ---- */}
        <section className="l-security" id="security">
          <div className="l-container">
            <div className="l-section-head l-section-head-centered">
              <span className="l-eyebrow">{t('landing.securityEyebrow')}</span>
              <h2 className="l-h2">{t('landing.securityTitle')}</h2>
              <p className="l-lead">{t('landing.securityLead')}</p>
            </div>
            <div className="l-sec-grid">
              {SECURITY.map(({ Icon, key }) => (
                <div className="l-sec-item l-reveal" key={key}>
                  <div className="l-sec-ico"><Icon /></div>
                  <h3>{t(`landing.security.${key}.h`)}</h3>
                  <p>{t(`landing.security.${key}.b`)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---- Closing CTA ---- */}
        <section className="l-cta">
          <div className="l-container">
            <div className="l-cta-panel">
              <h2>{t('landing.ctaTitle')}</h2>
              <p>{t('landing.ctaBody')}</p>
              <div className="l-cta-actions">
                <Link to="/signup" className="l-btn l-btn-onwarm-solid">{t('landing.startFree')}</Link>
                <a href="#how" className="l-btn l-btn-onwarm">{t('landing.bookWalkthrough')}</a>
              </div>
              <p className="l-cta-note">{t('landing.noCard')}</p>
            </div>
          </div>
        </section>
      </main>

      {/* ---- Footer ---- */}
      <footer className="l-footer">
        <div className="l-container">
          <div className="l-footer-grid">
            <div className="l-footer-brand">
              <BrandLogo />
              <p>{t('landing.footerTagline')}</p>
            </div>
            <div className="l-footer-col">
              <h4>{t('landing.footerProduct')}</h4>
              <a href="#pipelines">{t('landing.navPipelines')}</a>
              <a href="#marketplace">{t('landing.navMarketplace')}</a>
              <a href="#features">{t('landing.projects')}</a>
              <a href="#features">{t('landing.publish')}</a>
              <a href="#features">{t('landing.crawler')}</a>
            </div>
            <div className="l-footer-col">
              <h4>{t('landing.footerResources')}</h4>
              <a href="#">{t('landing.docs')}</a>
              <a href="#">{t('landing.changelog')}</a>
              <a href="#security">{t('landing.navSecurity')}</a>
              <a href="#">{t('landing.status')}</a>
            </div>
            <div className="l-footer-col">
              <h4>{t('landing.footerCompany')}</h4>
              <a href="#">{t('landing.about')}</a>
              <a href="#">{t('landing.careers')}</a>
              <a href="#">{t('landing.contact')}</a>
            </div>
          </div>
          <div className="l-footer-bottom">
            <span>{t('landing.copyright')}</span>
            <span>{t('landing.footerBottom')}</span>
          </div>
        </div>
      </footer>
      <ScrollTopButton />
    </div>
  );
}
