import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChannelType, type Channel } from '@lyra/shared';
import { useWorkspace } from '../workspace/useWorkspace';
import { connectorsApi } from '../lib/connectors';
import { channelsApi } from '../lib/channels';
import { fmtDate } from '../lib/format';
import { platformColor, platformGlyph, platformLabel } from '../lib/platform';
import { Modal } from '../components/Modal';
import { Field } from '../components/Field';
import { PlatformSelect } from '../components/PlatformSelect';
import { GologinMark } from '../components/GologinMark';
import { PlusIcon, PublishIcon, TrashIcon, XIcon } from '../layout/icons';
import './connectors.css';

const emptyForm = { platform: 'tiktok', displayName: '', profileId: '', proxy: '' };

// Built-ins → Connections. The workspace's channel grid (Postiz pool + GoLogin),
// each card with full info + post activity. Adding a channel opens a modal; the
// Postiz API key now lives in Settings.
export function Connections() {
  const { t } = useTranslation();
  const { current } = useWorkspace();
  const ws = current?.id;

  const [channels, setChannels] = useState<Channel[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [connType, setConnType] = useState<ChannelType>(ChannelType.GoLogin);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ws) return;
    try {
      setChannels(await channelsApi.list(ws));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('connectors.error'));
    }
  }, [ws, t]);
  useEffect(() => { void load(); }, [load]);

  async function act(fn: () => Promise<unknown>) {
    if (!ws) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('connectors.error'));
    } finally {
      setBusy(false);
    }
  }

  const openAdd = () => { setConnType(ChannelType.GoLogin); setForm(emptyForm); setError(null); setAddOpen(true); };

  const openPostiz = () =>
    void act(async () => {
      const { url } = await connectorsApi.connectLink(ws!, 'postiz');
      window.open(url, '_blank', 'noopener');
    });

  const addChannel = () =>
    void act(async () => {
      await channelsApi.create(ws!, {
        platform: form.platform,
        displayName: form.displayName.trim(),
        profileId: form.profileId.trim(),
        ...(form.proxy.trim() ? { proxy: form.proxy.trim() } : {}),
      });
      setAddOpen(false);
      await load();
    });

  const removeChannel = (c: Channel) => void act(async () => { await channelsApi.remove(ws!, c.id); await load(); });

  const canAdd = !!form.displayName.trim() && !!form.profileId.trim();

  return (
    <div className="cx-page">
      <div className="cx-head-row">
        <div>
          <h2 className="cx-title">{t('connectors.connectionsTitle')}</h2>
          <p className="cx-sub">{t('connectors.connectionsSubtitle')}</p>
        </div>
        <button type="button" className="btn-primary btn-inline" onClick={openAdd}>
          <PlusIcon width={15} height={15} /> {t('connectors.addChannel')}
        </button>
      </div>

      {error && !addOpen && <p className="cx-error">{error}</p>}

      {channels.length === 0 ? (
        <p className="empty">{t('connectors.noChannelsYet')}</p>
      ) : (
        <div className="ch-grid">
          {channels.map((c) => (
            <article className="ch-card" key={c.id}>
              <div className="ch-card-head">
                <span className="ch-ic" style={{ background: platformColor(c.platform) }}>{platformGlyph(c.platform)}</span>
                <div className="ch-id">
                  <div className="ch-name" title={c.displayName}>{c.displayName}</div>
                  <div className="ch-meta">
                    {platformLabel(c.platform)}
                    <span className={`cx-type cx-type-${c.type}`}>
                      {c.type === ChannelType.GoLogin ? <GologinMark size={11} /> : <PublishIcon width={11} height={11} />}
                      {c.type === ChannelType.GoLogin ? t('connectors.viaGoLogin') : t('connectors.viaPostiz')}
                    </span>
                  </div>
                </div>
                {c.type === ChannelType.GoLogin && (
                  <button className="ch-del" onClick={() => removeChannel(c)} title={t('connectors.removeChannel')} aria-label={t('connectors.removeChannel')} disabled={busy}>
                    <TrashIcon width={15} height={15} />
                  </button>
                )}
              </div>
              <div className="ch-stats">
                <div className="ch-stat"><span>{t('connectors.statCreated')}</span><b>{c.createdAt ? fmtDate(c.createdAt) : '—'}</b></div>
                <div className="ch-stat"><span>{t('connectors.statPosts')}</span><b>{c.postCount ?? 0}</b></div>
                <div className="ch-stat"><span>{t('connectors.statLastPost')}</span><b>{c.lastPostAt ? fmtDate(c.lastPostAt) : '—'}</b></div>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="cx-section cx-media">
        <div className="cx-sec-head">
          <span className="cx-sec-title">{t('connectors.mediaImport')}</span>
          <span className="cx-badge-ok">● {t('connectors.connected')}</span>
        </div>
        <p className="cx-note">{t('connectors.cobaltNote')}</p>
      </div>

      {addOpen && (
        <Modal onClose={() => setAddOpen(false)} className="cx-add-modal">
          <div className="cx-modal-head">
            <h3>{t('connectors.addChannelTitle')}</h3>
            <button type="button" className="cx-modal-x" onClick={() => setAddOpen(false)} aria-label={t('common.close')}><XIcon /></button>
          </div>
          <div className="cx-modal-body">
            <div className="field">
              <span>{t('connectors.connectionType')}</span>
              <div className="cx-seg">
                <button type="button" className={connType === ChannelType.GoLogin ? 'on' : ''} onClick={() => setConnType(ChannelType.GoLogin)}>
                  <GologinMark size={13} /> {t('connectors.viaGoLogin')}
                </button>
                <button type="button" className={connType === ChannelType.Postiz ? 'on' : ''} onClick={() => setConnType(ChannelType.Postiz)}>
                  <PublishIcon width={13} height={13} /> {t('connectors.viaPostiz')}
                </button>
              </div>
            </div>

            {connType === ChannelType.GoLogin ? (
              <>
                <div className="field">
                  <span id="m-plat">{t('connectors.channelPlatform')}</span>
                  <PlatformSelect value={form.platform} onChange={(platform) => setForm({ ...form, platform })} labelledBy="m-plat" />
                </div>
                <Field label={t('connectors.channelDisplayName')}>
                  <input className="text-input" value={form.displayName} placeholder="@handle" onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
                </Field>
                <Field label={t('connectors.gologinProfileId')}>
                  <input className="text-input" value={form.profileId} placeholder="6a33…" onChange={(e) => setForm({ ...form, profileId: e.target.value })} />
                </Field>
                <Field label={t('connectors.gologinProxy')}>
                  <input className="text-input" value={form.proxy} placeholder="optional" onChange={(e) => setForm({ ...form, proxy: e.target.value })} />
                </Field>
                {error && <p className="cx-error">{error}</p>}
                <div className="cx-modal-actions">
                  <button type="button" className="btn-ghost btn-inline" onClick={() => setAddOpen(false)}>{t('common.cancel')}</button>
                  <button type="button" className="btn-primary btn-inline" disabled={busy || !canAdd} onClick={addChannel}>{t('connectors.addChannelBtn')}</button>
                </div>
              </>
            ) : (
              <div className="cx-postiz-note">
                <p>{t('connectors.postizAutoNote')}</p>
                <button type="button" className="btn-ghost btn-inline" onClick={openPostiz}>{t('connectors.manageInPostiz')} ↗</button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
