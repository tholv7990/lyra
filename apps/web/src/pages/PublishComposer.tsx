import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Channel, PublishJob } from '@lyra/shared';
import { useWorkspace } from '../workspace/useWorkspace';
import { connectorsApi } from '../lib/connectors';
import './connectors.css';

const GLYPH: Record<string, string> = {
  tiktok: '♪', instagram: '◎', youtube: '▶', facebook: 'f', x: '𝕏',
};
const cls = (platform: string) => (GLYPH[platform] ? platform : 'generic');
const glyph = (platform: string) => GLYPH[platform] ?? '◆';

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
  const ws = current?.id;

  const [channels, setChannels] = useState<Channel[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [mediaInput, setMediaInput] = useState('');
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

  const poll = useCallback(
    async (jobId: string) => {
      if (!ws || !alive.current) return;
      try {
        const j = await connectorsApi.job(ws, jobId);
        if (!alive.current) return;
        setJob(j);
        if (j.status === 'done' || j.status === 'failed') {
          setPublishing(false);
          return;
        }
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

  return (
    <div className="cx-page">
      <h2 className="cx-title">{t('connectors.publishTitle')}</h2>
      <p className="cx-sub">{t('connectors.publishSubtitle')}</p>
      {error && <p className="cx-error">{error}</p>}

      <div className="cx-section">
        <div className="cx-label">{t('connectors.postTo')}</div>
        {channels.length === 0 ? (
          <p className="cx-empty">{t('connectors.noChannels')}</p>
        ) : (
          <div className="cx-chips">
            {channels.map((c) => {
              const on = picked.includes(c.id);
              return (
                <button
                  key={c.id}
                  className={`cx-chip ${on ? 'on' : ''}`}
                  onClick={() => setPicked((p) => togglePick(p, c.id))}
                >
                  <span className={`cx-dot ${cls(c.platform)}`}>{glyph(c.platform)}</span>
                  {c.displayName}{on ? ' ✓' : ''}
                </button>
              );
            })}
          </div>
        )}

        <div className="cx-label">{t('connectors.caption')}</div>
        <textarea
          className="cx-ta"
          maxLength={MAX_CAPTION}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
        <div className="cx-meta">{caption.length} / {MAX_CAPTION}</div>

        <div className="cx-media-row">
          {mediaUrls.map((u, i) => (
            <div className="cx-thumb" key={`${u}-${i}`}>
              <img src={u} alt="" />
              <button className="cx-x" onClick={() => setMediaUrls((m) => m.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <input
            className="cx-input"
            style={{ maxWidth: 220 }}
            placeholder={t('connectors.mediaUrlPlaceholder')}
            value={mediaInput}
            onChange={(e) => setMediaInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addMedia(); }}
          />
          <button className="cx-add-media" title={t('connectors.addMedia')} onClick={addMedia}>＋</button>
        </div>

        <div className="cx-foot">
          <span className="cx-gate">🔒 <b>{t('connectors.reviewNote')}</b></span>
          <button className="cx-btn-primary" disabled={!picked.length || publishing} onClick={publish}>
            {publishing ? t('connectors.publishing_state') : t('connectors.publishBtn', { count: picked.length })}
          </button>
        </div>
      </div>

      {job?.receipts && job.receipts.length > 0 && (
        <div className="cx-section">
          <div className="cx-label">{t('connectors.results')}</div>
          {job.receipts.map((r) => (
            <div className="cx-rcpt" key={`${r.platform}-${r.accountId}`}>
              <span className={`cx-dot ${cls(r.platform)}`}>{glyph(r.platform)}</span>
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
  );
}
