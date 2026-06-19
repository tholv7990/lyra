import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { Provider } from '@lyra/shared';
import { BrandLogo } from '../components/BrandLogo';
import { LanguageToggleButton, ThemeToggleButton } from '../components/PrefControls';
import { ProviderIcon } from '../components/ProviderIcon';
import { LoginIcon } from '../layout/icons';
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

// Model strip: providers you bring keys for. Video is roadmap, marked Soon.
const MODELS: { provider: Provider; label: string; soon?: boolean }[] = [
  { provider: Provider.OpenAI, label: 'OpenAI' },
  { provider: Provider.Anthropic, label: 'Claude' },
  { provider: Provider.DeepSeek, label: 'DeepSeek' },
  { provider: Provider.Image, label: 'Image' },
  { provider: Provider.Video, label: 'Video', soon: true },
];

// The five funnel stages, rendered as one connected flow (the centerpiece).
const FLOW: { n: number; h: string; b: string; chip: string; soon?: boolean }[] = [
  { n: 1, h: 'Find', b: 'Pull reference media from any TikTok, Instagram, or web link, and research what is selling.', chip: 'Import live, research soon', soon: true },
  { n: 2, h: 'Brand', b: 'Claude writes the brief and brand insight, then Lyra generates an on-brand image set.', chip: 'Live' },
  { n: 3, h: 'Create', b: 'Turn the brand into ad creative and UGC scripts, with video on the way.', chip: 'Images live, video soon', soon: true },
  { n: 4, h: 'Approve', b: 'Every money or brand decision pauses at a gate. Approve, or edit and re-run.', chip: 'Live' },
  { n: 5, h: 'Publish', b: 'Post to TikTok, Instagram, Bluesky, X and more, with per-channel delivery receipts.', chip: 'Live' },
];

// Output gallery: the kinds of creative one product fans out into.
const MAKE: { cls: string; label: string; seed: string; w: number; h: number; alt: string }[] = [
  { cls: 'l-make-1', label: 'Studio product shots', seed: 'lyra-studio-product', w: 900, h: 600, alt: 'Studio product photo of a skincare bottle on a clean seamless backdrop with soft directional light' },
  { cls: 'l-make-2', label: 'Lifestyle scenes', seed: 'lyra-lifestyle-scene', w: 600, h: 400, alt: 'Lifestyle photo of a product styled in a sunlit kitchen with warm tones' },
  { cls: 'l-make-3', label: 'UGC reels', seed: 'lyra-ugc-reel', w: 600, h: 400, alt: 'Creator holding a product to camera in a casual UGC reel still' },
  { cls: 'l-make-4', label: 'Ad variations', seed: 'lyra-ad-variation', w: 600, h: 700, alt: 'Bold ad creative variation of a product with punchy color blocking' },
  { cls: 'l-make-5', label: 'Marketplace listings', seed: 'lyra-marketplace-listing', w: 600, h: 700, alt: 'Clean marketplace listing photo of a product on a neutral background' },
  { cls: 'l-make-6', label: 'Seasonal campaigns', seed: 'lyra-seasonal-campaign', w: 600, h: 700, alt: 'Seasonal campaign image of a product styled with festive props and warm light' },
];

// Channel chips shown on the hero campaign-flow preview.
const CHANNELS = ['TikTok', 'Instagram', 'Bluesky', 'X'];

const SECURITY: { Icon: () => ReactElement; h: string; b: string }[] = [
  { Icon: Lock, h: 'Keys never leave the server', b: 'Provider keys are encrypted with AES-256-GCM and decrypted only to make a call. They are never returned to the browser and never logged.' },
  { Icon: Layers, h: 'Per-workspace isolation', b: 'Every project, prompt, pipeline, and run is scoped to its workspace. Invite teammates and set roles; nothing crosses a boundary.' },
  { Icon: Key, h: 'Bring your own everything', b: 'Your keys, your models, your data. No metering and no lock-in. Lyra orchestrates the work; you stay in control.' },
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
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m6 14 6-6 6 6" />
      </svg>
    </button>
  );
}

export function Landing() {
  const rootRef = useScrollReveal();

  return (
    <div className="lyra-landing" ref={rootRef}>
      {/* ---- Nav ---- */}
      <header className="l-nav">
        <div className="l-container l-nav-inner">
          <Link to="/" className="l-brand" aria-label="Lyra">
            <BrandLogo />
          </Link>
          <nav className="l-nav-links" aria-label="Primary">
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#security">Security</a>
          </nav>
          <div className="l-nav-cta">
            <div className="l-nav-prefs" aria-label="Preferences">
              <LanguageToggleButton />
              <Link to="/login" className="l-nav-icon-action l-nav-login" aria-label="Log in" title="Log in">
                <LoginIcon />
              </Link>
              <ThemeToggleButton />
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* ---- Hero ---- */}
        <section className="l-hero">
          <div className="l-container l-hero-grid">
            <div className="l-hero-copy">
              <span className="l-eyebrow">AI dropshipping co-pilot</span>
              <h1 className="l-h1">Find winning products. Brand them. Publish everywhere.</h1>
              <p className="l-hero-sub">
                Lyra runs your whole dropshipping funnel on prompt-first AI workflows you
                control: pull reference media and research products, generate on-brand images
                and ad creative, then post to every channel, approving the calls that matter.
              </p>
              <div className="l-hero-cta">
                <Link to="/signup" className="l-btn l-btn-primary">Start free</Link>
                <a href="#how" className="l-btn l-btn-ghost">See how it works</a>
              </div>
              <p className="l-hero-note">Bring your own AI keys, no credit card.</p>
            </div>

            {/* Campaign-flow preview: a single product carried Find → Publish.
                Local gpt-image-1 generated assets (/public/landing), not a div-mock. */}
            <div
              className="l-campaign"
              aria-label="A campaign moving through Lyra: a winning product, branded, made into creative, then published to channels"
            >
              <div className="l-campaign-head">
                <span className="l-campaign-title">Campaign flow</span>
                <span className="l-campaign-stages">Find, Brand, Create, Publish</span>
              </div>

              <figure className="l-campaign-hero">
                <img
                  src="/landing/lyra-campaign-hero.webp"
                  width={800}
                  height={520}
                  loading="eager"
                  alt="On-brand hero shot of a skincare bottle lit on a warm seamless backdrop"
                />
                {/* TODO: swap for real brand asset */}
                <figcaption className="l-campaign-chip">Branded hero</figcaption>
              </figure>

              <div className="l-campaign-row">
                <figure className="l-campaign-thumb">
                  <img
                    src="/landing/lyra-campaign-found.webp"
                    width={360}
                    height={360}
                    loading="lazy"
                    alt="Reference clip imported from a trending product video"
                  />
                  {/* TODO: swap for real brand asset */}
                  <figcaption className="l-campaign-chip sm">Found</figcaption>
                </figure>
                <figure className="l-campaign-thumb">
                  <img
                    src="/landing/lyra-campaign-ugc.webp"
                    width={360}
                    height={360}
                    loading="lazy"
                    alt="UGC reel still of a creator holding the product to camera"
                  />
                  {/* TODO: swap for real brand asset */}
                  <figcaption className="l-campaign-chip sm">UGC reel</figcaption>
                </figure>
                <figure className="l-campaign-thumb">
                  <img
                    src="/landing/lyra-campaign-ad.webp"
                    width={360}
                    height={360}
                    loading="lazy"
                    alt="Bold ad variation of the product with bright color blocking"
                  />
                  {/* TODO: swap for real brand asset */}
                  <figcaption className="l-campaign-chip sm">Ad</figcaption>
                </figure>
              </div>

              <div className="l-campaign-publish">
                <span className="l-campaign-publish-label">Publishing to</span>
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
            <p className="l-models-cap">Runs on the models you already pay for</p>
            <div className="l-models-row">
              {MODELS.map((m) => (
                <span className="l-model" key={m.label}>
                  <ProviderIcon provider={m.provider} size={22} />
                  {m.label}
                  {m.soon && <span className="l-soon">Soon</span>}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ---- Pain → Promise ---- */}
        <section className="l-pain">
          <div className="l-container">
            <p className="l-pain-text l-reveal">
              Dropshipping is really four jobs: find a winner, build the brand, make the ads,
              and post everywhere. Doing all four fast and on-brand is why most stores stall.
            </p>
            <span className="l-pain-emph l-reveal">
              Lyra runs the whole loop as <b>one AI workflow you control</b>.
            </span>
          </div>
        </section>

        {/* ---- What you can make (colorful centerpiece gallery) ---- */}
        <section className="l-gallery-sec">
          <div className="l-container">
            <div className="l-section-head l-section-head-centered">
              <h2 className="l-h2">One product. Every kind of content.</h2>
              <p className="l-lead">
                Point Lyra at a single product and it fans out into the shots, scenes, and clips
                your store actually needs to sell.
              </p>
            </div>
            <div className="l-gallery">
              {MAKE.map((m) => (
                <figure className={`l-make ${m.cls} l-reveal`} key={m.label}>
                  <img
                    src={`/landing/${m.seed}.webp`}
                    width={m.w}
                    height={m.h}
                    loading="lazy"
                    alt={m.alt}
                  />
                  {/* TODO: swap for real brand asset */}
                  <figcaption className="l-make-chip">{m.label}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* ---- The flow: 5 connected funnel stages (centerpiece) ---- */}
        <section className="l-flow" id="how">
          <div className="l-container">
            <div className="l-section-head l-section-head-centered">
              <h2 className="l-h2">From winning product to published campaign.</h2>
              <p className="l-lead">
                One pipeline carries a product through every stage. Compose it once, run it on
                your whole catalog.
              </p>
            </div>
            <ol className="l-flow-track">
              {FLOW.map((s, i) => (
                <li className="l-flow-step l-reveal" key={s.n}>
                  <div className="l-flow-card">
                    <span className="l-flow-n">{s.n}</span>
                    <h3 className="l-flow-h">{s.h}</h3>
                    <p className="l-flow-b">{s.b}</p>
                    <span className={`l-flow-chip${s.soon ? ' soon' : ''}`}>{s.chip}</span>
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
          {/* Feature A: Pipelines (image collage) */}
          <section className="l-feature-band">
            <div className="l-container l-feature">
              <div className="l-feature-copy l-reveal">
                <h3 className="l-h3">Compose once. Run it on every product.</h3>
                <p className="l-body">
                  A pipeline binds each step to a prompt and a model, set to gate or run
                  automatically; outputs chain with the <span className="l-chip">{'{input}'}</span> placeholder.
                  Or just describe your goal and Build with AI drafts the workflow for you,
                  grounded in your own prompt library.
                </p>
                <ul className="l-feature-points">
                  <li><Tick /> Per-step model (Claude, GPT, DeepSeek)</li>
                  <li><Tick /> Gate or auto on any step</li>
                  <li><Tick /> Build with AI from your library</li>
                </ul>
              </div>
              <div className="l-feature-visual l-reveal">
                <div className="l-feature-collage">
                  <div className="span-rows">
                    <img
                      src="/landing/lyra-pipe-main.webp"
                      width={700}
                      height={900}
                      loading="lazy"
                      alt="A polished product render produced as the final step of a pipeline run"
                    />
                    {/* TODO: swap for real brand asset */}
                  </div>
                  <div>
                    <img
                      src="/landing/lyra-pipe-brief.webp"
                      width={500}
                      height={400}
                      loading="lazy"
                      alt="A styled brief mood image generated early in the flow"
                    />
                    {/* TODO: swap for real brand asset */}
                  </div>
                  <div>
                    <img
                      src="/landing/lyra-pipe-render.webp"
                      width={500}
                      height={400}
                      loading="lazy"
                      alt="A rendered ad frame output by a later step in the same pipeline"
                    />
                    {/* TODO: swap for real brand asset */}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Feature B: Library (image-led, reversed) */}
          <section className="l-feature-band">
            <div className="l-container l-feature rev">
              <div className="l-feature-copy l-reveal">
                <h3 className="l-h3">Your brand, captured as prompts. Reused everywhere.</h3>
                <p className="l-body">
                  Promote winning prompts into a shared library; drop one on a product and it
                  fills <span className="l-chip">{'{product}'}</span>,{' '}
                  <span className="l-chip">{'{niche}'}</span>, and{' '}
                  <span className="l-chip">{'{homepage}'}</span> automatically.
                </p>
                <ul className="l-feature-points">
                  <li><Tick /> Variables fill per product</li>
                  <li><Tick /> Attach reference media + tags</li>
                  <li><Tick /> Reopen any prompt in chat to keep tuning</li>
                </ul>
              </div>
              <div className="l-feature-visual l-reveal">
                <div className="l-feature-photo">
                  <img
                    src="/landing/lyra-library-brand.webp"
                    width={900}
                    height={700}
                    loading="lazy"
                    alt="A cohesive set of on-brand product images sharing the same palette and styling"
                  />
                  {/* TODO: swap for real brand asset */}
                </div>
              </div>
            </div>
          </section>

          {/* Feature C: Crawl / media import (full-width band, different family) */}
          <section className="l-feature-band">
            <div className="l-container l-crawl l-reveal">
              <div className="l-crawl-copy">
                <h3 className="l-h3">Find the content. Import it in a click.</h3>
                <p className="l-body">
                  Paste any TikTok, Instagram, YouTube, or web link; Lyra resolves it and pulls
                  the media straight into your workflow as reference or raw material.
                </p>
                <ul className="l-feature-points l-crawl-points">
                  <li><Tick /> 1,000+ supported sites</li>
                  <li><Tick /> Video, image, and audio</li>
                  <li><Tick /> Straight into a pipeline</li>
                </ul>
              </div>
              <div className="l-crawl-strip" aria-hidden="true">
                <span className="l-crawl-url">
                  https://www.tiktok.com/@seller/video/winning-product
                </span>
                <span className="l-crawl-arrow">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M6 13l6 6 6-6" />
                  </svg>
                </span>
                <span className="l-crawl-tiles">
                  <img src="/landing/lyra-crawl-a.webp" width={240} height={240} loading="lazy" alt="Imported reference frame pulled from a product video" />
                  {/* TODO: swap for real brand asset */}
                  <img src="/landing/lyra-crawl-b.webp" width={240} height={240} loading="lazy" alt="Second imported reference frame from the same clip" />
                  {/* TODO: swap for real brand asset */}
                  <img src="/landing/lyra-crawl-c.webp" width={240} height={240} loading="lazy" alt="Third imported reference frame from the same clip" />
                  {/* TODO: swap for real brand asset */}
                </span>
              </div>
            </div>
          </section>

          {/* Feature D: Multi-channel publish (image-led, reversed) */}
          <section className="l-feature-band">
            <div className="l-container l-feature rev">
              <div className="l-feature-copy l-reveal">
                <h3 className="l-h3">Post everywhere from one place.</h3>
                <p className="l-body">
                  Connect your social accounts once, then publish a campaign to many channels in
                  a click and track per-channel delivery.
                </p>
                <ul className="l-feature-points">
                  <li><Tick /> TikTok, Instagram, Bluesky, X and more</li>
                  <li><Tick /> One compose, many channels</li>
                  <li><Tick /> Per-channel receipts</li>
                </ul>
                <p className="l-feature-note">Channels connect through your own Postiz workspace.</p>
              </div>
              <div className="l-feature-visual l-reveal">
                <div className="l-publish">
                  <img
                    src="/landing/lyra-publish-campaign.webp"
                    width={900}
                    height={720}
                    loading="lazy"
                    alt="A finished campaign image ready to publish across social channels"
                  />
                  {/* TODO: swap for real brand asset */}
                  <div className="l-publish-rail" aria-hidden="true">
                    {['TikTok', 'Instagram', 'Bluesky', 'X', 'YouTube'].map((c) => (
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

          {/* Feature E: Gates + BYOK (the ONE small real-UI glimpse, over a photo) */}
          <section className="l-feature-band">
            <div className="l-container l-feature">
              <div className="l-feature-copy l-reveal">
                <h3 className="l-h3">Nothing ships until you say so. Any model, your keys.</h3>
                <p className="l-body">
                  Mark any step a gate and the run holds the result for your review; approve, or
                  edit the prompt and re-run. Bring your own provider keys, encrypted per
                  workspace, and swap a step&rsquo;s model in one click.
                </p>
                <ul className="l-feature-points">
                  <li><Tick /> Pause-for-approval on any step</li>
                  <li><Tick /> BYO keys, encrypted AES-256-GCM</li>
                  <li><Tick /> Swap models without touching the flow</li>
                </ul>
              </div>
              <div className="l-feature-visual l-reveal">
                <div
                  className="l-glimpse"
                  role="img"
                  aria-label="A pipeline run paused at an approval gate, holding a generated image for review"
                >
                  <img
                    src="/landing/lyra-gate-render.webp"
                    width={900}
                    height={720}
                    loading="lazy"
                    alt=""
                  />
                  {/* TODO: swap for real brand asset */}
                  <div className="l-glimpse-card" aria-hidden="true">
                    <div className="l-glimpse-top">
                      <span className="l-glimpse-gate-dot" />
                      Hero shot
                      <span className="l-glimpse-status">GATE, WAITING</span>
                    </div>
                    <p className="l-glimpse-body">
                      Warm studio render on a soft seamless backdrop, on-brand palette, ready for review.
                    </p>
                    <div className="l-glimpse-actions">
                      <span className="l-glimpse-btn primary">Approve</span>
                      <span className="l-glimpse-btn">Edit &amp; re-run</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ---- Security ---- */}
        <section className="l-security" id="security">
          <div className="l-container">
            <div className="l-section-head l-section-head-centered">
              <h2 className="l-h2">Your keys, your models, your control.</h2>
            </div>
            <div className="l-sec-grid">
              {SECURITY.map(({ Icon, h, b }) => (
                <div className="l-sec-item l-reveal" key={h}>
                  <div className="l-sec-ico"><Icon /></div>
                  <h3>{h}</h3>
                  <p>{b}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---- Closing CTA ---- */}
        <section className="l-cta">
          <div className="l-container">
            <div className="l-cta-panel">
              <h2>Find your next winner.</h2>
              <p>
                Spin up your first workflow, run it on a product, and publish the result. Free
                to start, with your own keys.
              </p>
              <div className="l-cta-actions">
                <Link to="/signup" className="l-btn l-btn-onwarm-solid">Start free</Link>
                <a href="#how" className="l-btn l-btn-onwarm">See how it works</a>
              </div>
              <p className="l-cta-note">Bring your own AI keys, no credit card.</p>
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
              <p>The AI co-pilot for dropshipping.</p>
            </div>
            <div className="l-footer-col">
              <h4>Product</h4>
              <a href="#how">How it works</a>
              <a href="#features">Features</a>
              <a href="#security">Security</a>
              <Link to="/login">Sign in</Link>
            </div>
            <div className="l-footer-col">
              <h4>Company</h4>
              <a href="#">About</a>
              <a href="#">Blog</a>
              <a href="#">Contact</a>
            </div>
            <div className="l-footer-col">
              <h4>Legal</h4>
              <a href="#">Privacy</a>
              <a href="#">Terms</a>
            </div>
          </div>
          <div className="l-footer-bottom">
            <span>© 2026 Lyra</span>
            <span>Built for sellers who ship on brand.</span>
          </div>
        </div>
      </footer>
      <ScrollTopButton />
    </div>
  );
}
