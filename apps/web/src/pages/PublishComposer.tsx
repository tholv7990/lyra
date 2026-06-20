import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { Channel, PublishJob } from '@lyra/shared';
import { useWorkspace } from '../workspace/useWorkspace';
import { connectorsApi } from '../lib/connectors';
import { CheckIcon, PlusIcon } from '../layout/icons';
import './connectors.css';
import './publish.css';

const GLYPH: Record<string, string> = {
  tiktok: '♪', instagram: '◎', youtube: '▶', facebook: 'f', x: '𝕏',
};
// External brand colours for the channel icon squares (like provider icons).
const PLATFORM_COLOR: Record<string, string> = {
  tiktok: '#111827', instagram: '#e1306c', youtube: '#ff0000', facebook: '#1877f2', x: '#111827',
};
const glyph = (platform: string) => GLYPH[platform] ?? '◆';
const color = (platform: string) => PLATFORM_COLOR[platform] ?? 'var(--ink-tertiary)';

// Pure: toggle a channel id in/out of the selected list (exported for tests).
export function togglePick(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

const MAX_CAPTION = 2200;

// Built-ins → Publish. Compose once, post to the selected connected channels. The
// Publish click is the gate; publishing runs as a job, receipts stream in via poll.
export function PublishComposer() {
  const { t } = useTranslation();
  const { current } = useWorkspace();
  const navigate = useNavigate();
  const ws = current?.id;

  const [channels, setChannels] = useState<Channel[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [mediaInput, setMediaInput] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [job, setJob] = useState<PublishJob | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const load = useCallback(async () => {
    if (!ws) return;
    try {
      setChannels((await connectorsApi.channels(ws)).channels);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('connectors.error'));
    }
  }, [ws, t]);
  useEffect(() => { void load(); }, [load]);

  const addMedia = () => {
    const u = mediaInput.trim();
    if (u) setMediaUrls((m) => [...m, u]);
    setMediaInput('');
  };
  const insert = (snippet: string) => setCaption((c) => (c ? `${c}${c.endsWith(' ') ? '' : ' '}${snippet}` : snippet));

  const poll = useCallback(
    async (jobId: string) => {
      if (!ws || !alive.current) return;
      try {
        const j = await connectorsApi.job(ws, jobId);
        if (!alive.current) return;
        setJob(j);
        if (j.status === 'done' || j.status === 'failed') { setPublishing(false); return; }
        setTimeout(() => void poll(jobId), 1500);
      } catch {
        if (alive.current) { setPublishing(false); setError(t('connectors.error')); }
      }
    },
    [ws, t],
  );

  const publish = () => {
    if (!ws || !picked.length || publishing) return;
    setPublishing(true);
    setError(null);
    setJob(null);
    connectorsApi
      .publish(ws, picked, caption, mediaUrls)
      .then((j) => { if (alive.current) { setJob(j); void poll(j.jobId); } })
      .catch((err) => {
        if (alive.current) { setPublishing(false); setError(err instanceof Error ? err.message : t('connectors.error')); }
      });
  };

  // Which channel the preview shows: the chosen tab, else the first picked, else the first channel.
  const previewChannel =
    channels.find((c) => c.id === previewId) ??
    channels.find((c) => picked.includes(c.id)) ??
    channels[0];
  const over = caption.length > MAX_CAPTION;

  return (
    <div className="pub">
      <header className="pub-head">
        <h1>{t('connectors.publishTitle')}</h1>
        <p>{t('connectors.publishSubtitle')}</p>
      </header>

      {error && <p className="error">{error}</p>}

      <div className="pub-grid">
        {/* COMPOSER */}
        <div className="pub-col">
          {/* Channels */}
          <div className="pub-card">
            <div className="pub-card-head">
              <span className="pub-eyebrow">{t('connectors.postTo')}</span>
              <button type="button" className="pub-link" onClick={() => navigate('/connections')}>
                <PlusIcon width={12} height={12} /> {t('connectors.manageInConnections')}
              </button>
            </div>
            {channels.length === 0 ? (
              <p className="muted">{t('connectors.noChannels')}</p>
            ) : (
              <div className="pub-channels">
                {channels.map((c) => {
                  const on = picked.includes(c.id);
                  return (
                    <button key={c.id} type="button" className={`pub-channel${on ? ' on' : ''}`} onClick={() => setPicked((p) => togglePick(p, c.id))}>
                      <span className="pub-ico" style={{ background: color(c.platform) }}>{glyph(c.platform)}</span>
                      <span className="pub-channel-id">
                        <span className="pub-channel-name">{c.displayName}</span>
                        <span className="pub-channel-handle">{c.platform}</span>
                      </span>
                      <span className="pub-channel-check">{on && <CheckIcon width={11} height={11} />}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Caption */}
          <div className="pub-card">
            <div className="pub-card-head">
              <span className="pub-eyebrow">{t('connectors.caption')}</span>
              <div className="pub-cap-tools">
                <button type="button" className="pub-tool" title="#" onClick={() => insert('#')}>#</button>
                <button type="button" className="pub-tool mono" onClick={() => insert('{product}')}>{'{product}'}</button>
              </div>
            </div>
            <textarea
              className="pub-ta"
              maxLength={MAX_CAPTION}
              placeholder={t('connectors.captionPlaceholder')}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
            <div className="pub-cap-foot">
              <span className="pub-cap-hint">{t('connectors.captionHint')}</span>
              <span className={`pub-count${over ? ' over' : ''}`}>{caption.length} / {MAX_CAPTION}</span>
            </div>
          </div>

          {/* Media */}
          <div className="pub-card">
            <span className="pub-eyebrow" style={{ display: 'block', marginBottom: 12 }}>{t('connectors.media')}</span>
            {mediaUrls.length > 0 && (
              <div className="pub-media-row">
                {mediaUrls.map((u, i) => (
                  <div className="pub-thumb" key={`${u}-${i}`}>
                    <img src={u} alt="" />
                    <button type="button" className="pub-thumb-x" aria-label={t('common.remove')} onClick={() => setMediaUrls((m) => m.filter((_, j) => j !== i))}>×</button>
                  </div>
                ))}
              </div>
            )}
            <div className="pub-media-add">
              <input
                className="pub-input"
                placeholder={t('connectors.mediaUrlPlaceholder')}
                value={mediaInput}
                onChange={(e) => setMediaInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addMedia(); }}
              />
              <button type="button" className="pub-add-btn" title={t('connectors.addMedia')} aria-label={t('connectors.addMedia')} onClick={addMedia}>
                <PlusIcon width={15} height={15} />
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="pub-foot">
            <span className="pub-gate">🔒 <b>{t('connectors.reviewNote')}</b></span>
            <button type="button" className="btn-primary btn-inline" disabled={!picked.length || publishing} onClick={publish}>
              {publishing ? t('connectors.publishing_state') : t('connectors.publishBtn', { count: picked.length })}
            </button>
          </div>

          {/* Results */}
          {job?.receipts && job.receipts.length > 0 && (
            <div className="pub-card">
              <span className="pub-eyebrow" style={{ display: 'block', marginBottom: 12 }}>{t('connectors.results')}</span>
              {job.receipts.map((r) => (
                <div className="cx-rcpt" key={`${r.platform}-${r.accountId}`}>
                  <span className="pub-ico sm" style={{ background: color(r.platform) }}>{glyph(r.platform)}</span>
                  <span className="cx-rname">{r.platform} · {r.accountId}</span>
                  {r.status === 'ok' ? <span className="cx-ok">✓ {t('connectors.posted')}</span> : <span className="cx-fail">✗ {t('connectors.failed')}</span>}
                  {r.status === 'ok' && r.url
                    ? <a className="cx-rlink" href={r.url} target="_blank" rel="noreferrer">{t('connectors.viewPost')} ↗</a>
                    : <span className="cx-rerr">{r.error ?? ''}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PREVIEW */}
        <div className="pub-preview-col">
          <div className="pub-preview">
            <div className="pub-preview-head">
              <span className="pub-eyebrow" style={{ flex: 1 }}>{t('connectors.preview')}</span>
              {channels.length > 0 && (
                <div className="pub-preview-tabs">
                  {channels.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`pub-tab${previewChannel?.id === c.id ? ' on' : ''}`}
                      title={c.displayName}
                      aria-label={c.displayName}
                      onClick={() => setPreviewId(c.id)}
                    >
                      <span className="pub-ico sm" style={{ background: color(c.platform), width: 18, height: 18, fontSize: 10, borderRadius: 5 }}>{glyph(c.platform)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="pub-preview-body">
              <div className="pub-post">
                <div className="pub-post-head">
                  <span className="pub-ico" style={{ background: color(previewChannel?.platform ?? '') }}>{glyph(previewChannel?.platform ?? '')}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="pub-post-name">{previewChannel?.displayName ?? 'Channel'}</div>
                    <div className="pub-post-handle">{previewChannel?.platform ?? ''}</div>
                  </div>
                </div>
                <div className="pub-post-media">
                  {mediaUrls[0] ? <img src={mediaUrls[0]} alt="" /> : t('connectors.previewEmpty')}
                </div>
                <div className={`pub-post-cap${caption ? '' : ' empty'}`}>
                  {caption || t('connectors.previewCaptionEmpty')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
