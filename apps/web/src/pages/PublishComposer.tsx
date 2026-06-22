import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Channel, Project, PublishJob, PublishedPost } from '@lyra/shared';
import { useWorkspace } from '../workspace/useWorkspace';
import { api } from '../lib/api';
import { channelsApi } from '../lib/channels';
import { postsApi } from '../lib/posts';
import { platformColor as color, platformGlyph as glyph, platformLabel } from '../lib/platform';
import { fmtDate } from '../lib/format';
import { CheckIcon, PlusIcon } from '../layout/icons';
import './connectors.css';
import './publish.css';

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
  const [params] = useSearchParams();
  const ws = current?.id;

  const [channels, setChannels] = useState<Channel[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [mediaInput, setMediaInput] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [job, setJob] = useState<PublishJob | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentPosts, setRecentPosts] = useState<PublishedPost[]>([]);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  // What to record as a project post once the job finishes (captured at publish time
  // to dodge the poll closure's stale state). Null = workspace-level publish, not recorded.
  const pendingPostRef = useRef<{ projectId: string; caption: string; mediaUrls: string[]; channelIds: string[] } | null>(null);

  const load = useCallback(async () => {
    if (!ws) return;
    try {
      setChannels(await channelsApi.list(ws));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('connectors.error'));
    }
  }, [ws, t]);
  useEffect(() => { void load(); }, [load]);

  // Projects (to publish "for" a project — preselects that project's channels).
  useEffect(() => {
    if (!ws) return;
    api<Project[]>(`/workspaces/${ws}/projects`).then(setProjects).catch(() => setProjects([]));
  }, [ws]);

  // Choosing a project preselects its channels (kept to those still connected).
  // The selection stays editable — a project is a default, not a hard limit.
  const pickProject = (pid: string) => setProjectId(pid);

  // Preselect the project from /publish?project=:id once the project list loads
  // (independent of whether any channels are connected yet).
  const wantProject = params.get('project');
  useEffect(() => {
    if (!wantProject || projectId || !projects.length) return;
    if (projects.some((p) => p.id === wantProject)) setProjectId(wantProject);
  }, [wantProject, projects, projectId]);

  // Keep `picked` synced to the selected project's channels (intersected with the
  // live pool). Runs when the project or pool changes — both stable after load — so
  // manual channel toggles made afterwards persist.
  useEffect(() => {
    if (!projectId) return;
    const proj = projects.find((p) => p.id === projectId);
    // `channels` may be absent on projects served before the field shipped — default
    // to [] so this never throws on API skew.
    if (proj) setPicked((proj.channels ?? []).filter((c) => channels.some((ch) => ch.id === c)));
  }, [projectId, channels, projects]);

  // Load recent posts for the active project (when one is selected).
  useEffect(() => {
    if (!projectId) { setRecentPosts([]); return; }
    postsApi.list(projectId).then(setRecentPosts).catch(() => setRecentPosts([]));
  }, [projectId]);

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
        const j = await channelsApi.job(ws, jobId);
        if (!alive.current) return;
        setJob(j);
        if (j.status === 'done' || j.status === 'failed') {
          setPublishing(false);
          // Record the outcome as a project post (once), if this was project-scoped.
          const pend = pendingPostRef.current;
          if (pend && j.receipts?.length) {
            pendingPostRef.current = null;
            void postsApi
              .create(pend.projectId, { caption: pend.caption, mediaUrls: pend.mediaUrls, channelIds: pend.channelIds, targets: j.receipts })
              .then(() => postsApi.list(pend.projectId).then(setRecentPosts).catch(() => undefined))
              .catch(() => undefined);
          }
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
    pendingPostRef.current = projectId ? { projectId, caption, mediaUrls, channelIds: picked } : null;
    channelsApi
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

  // Selection summary
  const selCount = picked.length;

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
            {projects.length > 0 && (
              <div className="pub-project">
                <label htmlFor="pub-project">{t('connectors.forProject')}</label>
                <select id="pub-project" className="pub-input" value={projectId} onChange={(e) => pickProject(e.target.value)}>
                  <option value="">{t('connectors.noProject')}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
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
                        <span className="pub-channel-handle">{platformLabel(c.platform)}</span>
                      </span>
                      <span className="pub-channel-check">{on && <CheckIcon width={11} height={11} />}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {/* Selection summary badge */}
            {channels.length > 0 && (
              <div className="pub-sel-summary">
                <span className="pub-sel-badge">{selCount}</span>
                <span>
                  {selCount === 1
                    ? t('connectors.selSummaryOne')
                    : t('connectors.selSummaryOther', { count: selCount })}
                </span>
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
                    <button type="button" className="pub-thumb-x" aria-label={t('common.remove')} onClick={() => setMediaUrls((m) => m.filter((_, j) => j !== i))}>
                      <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
                    </button>
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
              <button type="button" className="pub-crawler-btn" onClick={() => navigate('/import')}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 2.4v7M5 6.6 8 9.6l3-3M2.8 10.4v1.8a1 1 0 0 0 1 1h8.4a1 1 0 0 0 1-1v-1.8"/>
                </svg>
                {t('connectors.fromCrawler')}
              </button>
            </div>
          </div>

          {/* Footer — desktop only (mobile uses sticky bottom bar) */}
          <div className="pub-foot pub-foot-desktop">
            <span className="pub-gate">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="7" width="10" height="6.5" rx="1.5"/>
                <path d="M5.2 7V5.4a2.8 2.8 0 0 1 5.6 0V7"/>
              </svg>
              <b>{t('connectors.reviewNote')}</b>
            </span>
            <button type="button" className="btn-primary btn-inline" disabled={!picked.length || publishing} onClick={publish}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13.6 2.4 7.2 8.8M13.6 2.4l-4 11.2-2.4-4.8-4.8-2.4Z"/>
              </svg>
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
                  <span className="cx-rname">{platformLabel(r.platform)} · {r.accountId}</span>
                  {r.status === 'ok' ? <span className="cx-ok">✓ {t('connectors.posted')}</span> : <span className="cx-fail">✗ {t('connectors.failed')}</span>}
                  {r.status === 'ok' && r.url
                    ? <a className="cx-rlink" href={r.url} target="_blank" rel="noreferrer">{t('connectors.viewPost')} ↗</a>
                    : <span className="cx-rerr">{r.error ?? ''}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: preview + recent posts */}
        <div className="pub-preview-col">
          {/* Preview */}
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
                  <span className="pub-post-avatar">{(previewChannel?.displayName ?? 'C').charAt(0).toUpperCase()}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="pub-post-name">{previewChannel?.displayName ?? 'Channel'}</div>
                    <div className="pub-post-handle">{previewChannel ? platformLabel(previewChannel.platform) : ''}</div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="var(--ink-tertiary)">
                    <circle cx="3" cy="8" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="13" cy="8" r="1.3"/>
                  </svg>
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

          {/* Recent posts */}
          <div className="pub-card pub-recent">
            <span className="pub-eyebrow" style={{ display: 'block', marginBottom: 12 }}>{t('connectors.recentPosts')}</span>
            {recentPosts.length === 0 ? (
              <p className="pub-recent-empty">{t('connectors.noRecentPosts')}</p>
            ) : (
              <div className="pub-recent-list">
                {recentPosts.slice(0, 5).map((post) => {
                  const statusColor =
                    post.status === 'ok' ? 'var(--success)' :
                    post.status === 'failed' ? 'var(--danger)' : 'var(--warning)';
                  const statusBg =
                    post.status === 'ok' ? 'color-mix(in srgb, var(--success) 14%, transparent)' :
                    post.status === 'failed' ? 'color-mix(in srgb, var(--danger) 14%, transparent)' :
                    'color-mix(in srgb, var(--warning) 14%, transparent)';
                  const statusIcon =
                    post.status === 'ok' ? (
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5 6.5 11 12.5 4.5"/></svg>
                    ) : post.status === 'failed' ? (
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 4.4v4.4M8 11.2h.01"/></svg>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8 4v4l2.6 1.6"/></svg>
                    );
                  const statusText =
                    post.status === 'ok' ? t('connectors.posted') :
                    post.status === 'failed' ? t('connectors.failed') :
                    t('connectors.publishing_state');
                  return (
                    <div className="pub-recent-item" key={post.id}>
                      <span className="pub-recent-icon" style={{ background: statusBg, color: statusColor }}>{statusIcon}</span>
                      <div className="pub-recent-body">
                        <div className="pub-recent-caption">{post.caption}</div>
                        <div className="pub-recent-meta">
                          <span className="pub-recent-chips">
                            {post.channelIds.map((cid, i) => {
                              const ch = channels.find((c) => c.id === cid);
                              return ch ? (
                                <span key={i} className="pub-recent-chip">
                                  <span className="pub-recent-dot" style={{ background: color(ch.platform) }} />
                                  {platformLabel(ch.platform)}
                                </span>
                              ) : null;
                            })}
                          </span>
                          <span className="pub-recent-status" style={{ color: statusColor }}>{statusText}</span>
                          <span className="pub-recent-date">· {fmtDate(post.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile sticky publish bar */}
      <div className="pub-mobile-bar">
        <button type="button" className="pub-mobile-publish" disabled={!picked.length || publishing} onClick={publish}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13.6 2.4 7.2 8.8M13.6 2.4l-4 11.2-2.4-4.8-4.8-2.4Z"/>
          </svg>
          {publishing ? t('connectors.publishing_state') : t('connectors.publishBtn', { count: picked.length })}
        </button>
      </div>
    </div>
  );
}
