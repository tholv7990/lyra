import { Link } from 'react-router-dom';
import { Provider } from '@lyra/shared';
import { ProviderIcon } from '../components/ProviderIcon';
import './landing.css';

// ---- Small inline glyphs (kept local to the marketing page) ----
const Check = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
const Tick = () => (
  <svg className="l-tick" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" opacity="0.35" />
    <path d="m8 12 2.5 2.5L16 9" />
  </svg>
);
const Lock = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);
const Layers = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 2 9 5-9 5-9-5 9-5Z" />
    <path d="m3 12 9 5 9-5" />
    <path d="m3 17 9 5 9-5" />
  </svg>
);
const Key = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="7.5" cy="15.5" r="4.5" />
    <path d="m10.7 12.3 9.3-9.3M17 5l3 3M14 8l2 2" />
  </svg>
);

const MODELS: { provider: Provider; label: string }[] = [
  { provider: Provider.OpenAI, label: 'OpenAI' },
  { provider: Provider.Anthropic, label: 'Claude' },
  { provider: Provider.DeepSeek, label: 'DeepSeek' },
  { provider: Provider.Image, label: 'Image' },
  { provider: Provider.Video, label: 'Video' },
];

export function Landing() {
  return (
    <div className="lyra-landing">
      {/* ---- Nav ---- */}
      <header className="l-nav">
        <div className="l-container l-nav-inner">
          <Link to="/" className="l-brand" aria-label="Lyra">
            <img src="/lyra-logo-horizontal-light.svg" alt="Lyra" />
          </Link>
          <nav className="l-nav-links">
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#security">Security</a>
          </nav>
          <div className="l-nav-cta">
            <Link to="/login" className="l-btn l-btn-ghost l-btn-sm l-sign">Sign in</Link>
            <Link to="/signup" className="l-btn l-btn-primary l-btn-sm">Get started</Link>
          </div>
        </div>
      </header>

      {/* ---- Hero ---- */}
      <section className="l-hero">
        <div className="l-container l-hero-grid">
          <div className="l-hero-copy">
            <span className="l-eyebrow">The AI creative pipeline</span>
            <h1 className="l-h1">Turn one good prompt into a production line.</h1>
            <p className="l-hero-sub">
              Craft prompts in chat, compose them into pipelines, and run them across every
              product you sell — on any model, with a human gate before anything ships.
            </p>
            <div className="l-hero-cta">
              <Link to="/signup" className="l-btn l-btn-primary">Get started — free</Link>
              <a href="#how" className="l-btn l-btn-ghost">See how it works</a>
            </div>
            <p className="l-hero-note">Bring your own provider keys · no credit card to start</p>
          </div>

          {/* Pipeline-flow mock */}
          <div className="l-hero-visual">
            <div className="l-flow" role="img" aria-label="A Lyra pipeline running step by step, paused at an approval gate">
              <div className="l-flow-head">
                <span className="l-flow-dot" /><span className="l-flow-dot" /><span className="l-flow-dot" />
                <span className="l-flow-title">Product launch · run</span>
                <span className="l-flow-run">running</span>
              </div>

              <div className="l-node is-done">
                <span className="l-node-icon"><Check /></span>
                <span className="l-node-body">
                  <span className="l-node-name">Brief</span>
                  <span className="l-node-meta">claude · gate approved</span>
                </span>
                <span className="l-node-tag">DONE</span>
              </div>
              <div className="l-node is-done">
                <span className="l-node-icon"><Check /></span>
                <span className="l-node-body">
                  <span className="l-node-name">Insight</span>
                  <span className="l-node-meta">claude · auto</span>
                </span>
                <span className="l-node-tag">DONE</span>
              </div>
              <div className="l-node is-done">
                <span className="l-node-icon"><Check /></span>
                <span className="l-node-body">
                  <span className="l-node-name">Image prompts</span>
                  <span className="l-node-meta">gpt · auto</span>
                </span>
                <span className="l-node-tag">DONE</span>
              </div>
              <div className="l-node is-running">
                <span className="l-node-icon" />
                <span className="l-node-body">
                  <span className="l-node-name">Render</span>
                  <span className="l-node-meta">image · generating…</span>
                </span>
                <span className="l-node-tag">RUNNING</span>
              </div>
              <div className="l-node is-gate">
                <span className="l-node-icon" />
                <span className="l-node-body">
                  <span className="l-node-name">QA &amp; ship</span>
                  <span className="l-node-meta">awaiting approval</span>
                </span>
                <button type="button" className="l-node-approve" tabIndex={-1}>Approve</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Model strip ---- */}
      <section className="l-models">
        <div className="l-container">
          <p className="l-models-cap">Runs on the models you already use</p>
          <div className="l-models-row">
            {MODELS.map((m) => (
              <span className="l-model" key={m.label}>
                <ProviderIcon provider={m.provider} size={22} />
                {m.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ---- The shift ---- */}
      <section className="l-shift">
        <div className="l-container">
          <p className="l-shift-text">
            Prompting is easy. Doing it the same way twice — on brand, as a team — is the hard
            part. <em>Lyra makes your best prompt repeatable.</em>
          </p>
        </div>
      </section>

      {/* ---- How it works ---- */}
      <section className="l-section" id="how">
        <div className="l-container">
          <div className="l-section-head">
            <span className="l-eyebrow">How it works</span>
            <h2 className="l-h2">From a single prompt to a running pipeline.</h2>
            <p className="l-lead">Four moves take you from “that prompt works” to a flow your whole team can run on demand.</p>
          </div>
          <div className="l-how-grid">
            {[
              { n: 1, h: 'Chat', b: 'Find the prompt that works. Go multi-turn with any model and compare answers side by side.' },
              { n: 2, h: 'Save', b: 'Promote the keepers into a shared, on-brand prompt library — with media, tags, and variables.' },
              { n: 3, h: 'Compose', b: 'Chain prompts into a pipeline. Each step is a model plus a mode: run automatically, or pause at a gate.' },
              { n: 4, h: 'Run', b: 'Launch it on a project. The flow runs step by step, fills in your variables, and waits at your gates.' },
            ].map((s) => (
              <div className="l-step" key={s.n}>
                <span className="l-step-n">{s.n}</span>
                <h3 className="l-step-h">{s.h}</h3>
                <p className="l-step-b">{s.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Feature: Pipelines ---- */}
      <section className="l-feature-band" id="features">
        <div className="l-container l-feature">
          <div className="l-feature-copy">
            <span className="l-eyebrow">Pipelines</span>
            <h3 className="l-h3">Compose once. Run it forever.</h3>
            <p className="l-body">
              A pipeline is a chain of steps. Each step binds a prompt to a provider and model,
              set to run automatically or pause at a gate. Chain one step’s output into the
              next with <span className="l-chip">{'{input}'}</span> — no glue code.
            </p>
            <ul className="l-feature-points">
              <li><Tick /> Per-step model — mix Claude, GPT, and DeepSeek in one flow</li>
              <li><Tick /> Gate or auto on every step</li>
              <li><Tick /> Outputs chain from one step to the next</li>
            </ul>
          </div>
          <div className="l-feature-visual">
            <div className="l-panel">
              <p className="l-panel-label">Pipeline · product launch</p>
              {[
                { n: 1, name: 'Brief', model: Provider.Anthropic, ml: 'Claude', mode: 'gate' },
                { n: 2, name: 'Insight', model: Provider.Anthropic, ml: 'Claude', mode: 'auto' },
                { n: 3, name: 'Image prompts', model: Provider.OpenAI, ml: 'GPT', mode: 'auto' },
                { n: 4, name: 'Render', model: Provider.Image, ml: 'Image', mode: 'gate' },
              ].map((r) => (
                <div className="l-mock-row" key={r.n}>
                  <span className="l-rn">{r.n}</span>
                  <span className="l-rname">{r.name}</span>
                  <span className="l-rmodel"><ProviderIcon provider={r.model} size={14} />{r.ml}</span>
                  <span className={`l-modetag ${r.mode}`}>{r.mode.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---- Feature: Prompts library ---- */}
      <section className="l-feature-band">
        <div className="l-container l-feature rev">
          <div className="l-feature-copy">
            <span className="l-eyebrow">Prompts</span>
            <h3 className="l-h3">Your best prompts, reusable and on brand.</h3>
            <p className="l-body">
              Promote the prompts that work into a shared library — with media, tags, and
              variables. Drop one into a project and it fills in <span className="l-chip">{'{product}'}</span>,{' '}
              <span className="l-chip">{'{niche}'}</span>, and the rest automatically.
            </p>
            <ul className="l-feature-points">
              <li><Tick /> Variables fill in per project</li>
              <li><Tick /> Attach reference media and tag for reuse</li>
              <li><Tick /> Open any prompt back in chat to keep tuning</li>
            </ul>
          </div>
          <div className="l-feature-visual">
            <div className="l-panel">
              <p className="l-panel-label">Library</p>
              <div className="l-mock-prompt">
                <div className="l-pt">Studio product render</div>
                <p className="l-pp">A clean studio render of <span className="l-chip">{'{product}'}</span>, soft light, on-brand palette…</p>
                <div className="l-tags"><span className="l-tag">image</span><span className="l-tag">on-brand</span></div>
              </div>
              <div className="l-mock-prompt">
                <div className="l-pt">UGC hook script</div>
                <p className="l-pp">Write a 15s UGC hook for <span className="l-chip">{'{product}'}</span> in the <span className="l-chip">{'{niche}'}</span> niche…</p>
                <div className="l-tags"><span className="l-tag">video</span><span className="l-tag">script</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Feature: Gates ---- */}
      <section className="l-feature-band">
        <div className="l-container l-feature">
          <div className="l-feature-copy">
            <span className="l-eyebrow">Control</span>
            <h3 className="l-h3">Nothing ships until someone says so.</h3>
            <p className="l-body">
              Mark any step as a gate and the run pauses there, holding the result for review.
              Approve to continue, or edit the prompt and re-run. AI moves fast; your brand
              stays in your hands.
            </p>
            <ul className="l-feature-points">
              <li><Tick /> Pause-for-approval on any step</li>
              <li><Tick /> Edit the prompt and re-run in place</li>
              <li><Tick /> Every run is visible to the team</li>
            </ul>
          </div>
          <div className="l-feature-visual">
            <div className="l-panel">
              <p className="l-panel-label">Run · awaiting approval</p>
              <div className="l-mock-gate">
                <div className="l-gt">
                  <span className="l-node-icon" style={{ width: 20, height: 20, borderColor: 'var(--l-primary)', color: 'var(--l-primary)' }} />
                  Brief
                  <span className="l-gstatus">GATE · WAITING</span>
                </div>
                <p className="l-gbody">“The Quiet Hero” — a calm, capable voice for the launch. Color story leans warm; hero shot stays minimal…</p>
                <div className="l-gactions">
                  <span className="l-gbtn primary">Approve</span>
                  <span className="l-gbtn">Edit &amp; re-run</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Feature: BYOK / providers ---- */}
      <section className="l-feature-band">
        <div className="l-container l-feature rev">
          <div className="l-feature-copy">
            <span className="l-eyebrow">Providers</span>
            <h3 className="l-h3">Any model. Your keys. One workflow.</h3>
            <p className="l-body">
              Bring your own provider keys per workspace — encrypted at rest and never exposed.
              Swap the model on a step in one click; the rest of the pipeline doesn’t change.
            </p>
            <ul className="l-feature-points">
              <li><Tick /> Bring-your-own keys, per workspace</li>
              <li><Tick /> Encrypted with AES-256-GCM</li>
              <li><Tick /> Swap models without touching the flow</li>
            </ul>
          </div>
          <div className="l-feature-visual">
            <div className="l-panel">
              <p className="l-panel-label">Workspace keys</p>
              {[
                { provider: Provider.OpenAI, name: 'OpenAI' },
                { provider: Provider.Anthropic, name: 'Anthropic' },
                { provider: Provider.DeepSeek, name: 'DeepSeek' },
              ].map((k) => (
                <div className="l-mock-key" key={k.name}>
                  <ProviderIcon provider={k.provider} size={18} />
                  <span className="l-kname">{k.name}</span>
                  <span className="l-kkey">sk-••••••••</span>
                  <span className="l-kok"><span className="l-dot" />Connected</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---- Security band ---- */}
      <section className="l-security" id="security">
        <div className="l-container">
          <div className="l-section-head">
            <span className="l-eyebrow">Security</span>
            <h2 className="l-h2">Your keys, your models, your control.</h2>
          </div>
          <div className="l-sec-grid">
            <div className="l-sec-item">
              <div className="l-sec-ico"><Lock /></div>
              <h3>Keys never leave the server</h3>
              <p>Provider keys are encrypted with AES-256-GCM and decrypted only to make a call. They’re never returned to the browser and never logged.</p>
            </div>
            <div className="l-sec-item">
              <div className="l-sec-ico"><Layers /></div>
              <h3>Per-workspace isolation</h3>
              <p>Every project, prompt, pipeline, and run is scoped to its workspace. Invite teammates and set roles — nothing crosses a boundary.</p>
            </div>
            <div className="l-sec-item">
              <div className="l-sec-ico"><Key /></div>
              <h3>Bring your own everything</h3>
              <p>Your keys, your models, your data. No metering and no lock-in — Lyra orchestrates the work; you stay in control.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Closing CTA ---- */}
      <section className="l-cta">
        <div className="l-container">
          <div className="l-cta-panel">
            <h2>Start building your pipeline.</h2>
            <p>Craft a prompt, compose a flow, and run it across your catalog. Free to start, with your own keys.</p>
            <div className="l-hero-cta">
              <Link to="/signup" className="l-btn l-btn-primary">Get started — free</Link>
              <a href="#how" className="l-btn l-btn-ghost">See how it works</a>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Footer ---- */}
      <footer className="l-footer">
        <div className="l-container">
          <div className="l-footer-grid">
            <div className="l-footer-brand">
              <img src="/lyra-logo-horizontal-light.svg" alt="Lyra" />
              <p>The creative pipeline for AI content teams.</p>
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
            <span>Built for teams who ship on brand.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
