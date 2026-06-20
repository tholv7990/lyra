import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApiKeyInfo, ModelOption } from '@lyra/shared';
import { fmtDate } from '../lib/format';
import { modelModality, type ProviderCatalogEntry } from '../lib/providerCatalog';
import { ModalityIcon } from '../lib/promptType';
import { ProviderBadge } from './ProviderBadge';
import { ChevronIcon, RefreshIcon, PencilIcon, TrashIcon } from '../layout/icons';

const collapseKey = (id: string) => `lyra:provider-collapsed:${id}`;

// One added provider: a collapsible card that merges the key (status, who added
// it, when) with its fetched models — each model tagged with its output modality.
export function ProviderCard({
  entry,
  keyInfo,
  models,
  loading,
  loadMsg,
  canManage,
  onLoad,
  onReplace,
  onRemove,
}: {
  entry: ProviderCatalogEntry;
  keyInfo: ApiKeyInfo;
  models: ModelOption[];
  loading: boolean;
  loadMsg?: string;
  canManage: boolean;
  onLoad: () => void;
  onReplace: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(collapseKey(entry.id)) === '1');

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(collapseKey(entry.id), next ? '1' : '0');
      return next;
    });
  }

  return (
    <div className={`prov-card${collapsed ? ' collapsed' : ''}`}>
      <div className="prov-head">
        <button className="prov-head-main" onClick={toggle} aria-expanded={!collapsed}>
          <ProviderBadge entry={entry} size={26} />
          <span className="prov-name">{entry.label}</span>
          <span className="prov-key">
            <span className="key-dot on" />
            {t('settings.keySet', { last4: keyInfo.last4 })}
          </span>
          <span className="prov-mods">
            {entry.modalities.map((m) => (
              <ModalityIcon key={m} type={m} title={t(`settings.modality.${m}`)} />
            ))}
          </span>
          <ChevronIcon className="prov-chevron" width={16} height={16} aria-hidden="true" />
        </button>
        {canManage && (
          <div className="prov-actions">
            <button type="button" className="icon-btn" title={t('settings.replaceKey')} aria-label={t('settings.replaceKey')} onClick={onReplace}>
              <PencilIcon width={15} height={15} />
            </button>
            <button type="button" className="icon-btn prov-del" title={t('settings.removeKeyTitle')} aria-label={t('settings.removeKeyTitle')} onClick={onRemove}>
              <TrashIcon width={15} height={15} />
            </button>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="prov-body">
          <p className="prov-meta">
            {t('settings.addedBy', { name: keyInfo.createdBy?.name ?? '—', date: fmtDate(keyInfo.createdAt) })}
          </p>
          <div className="prov-models-head">
            <span className="prov-models-title">{t('settings.modelsCount', { count: models.length })}</span>
            {canManage && (
              <button type="button" className="btn-ghost prov-load" disabled={loading} onClick={onLoad}>
                <RefreshIcon width={14} height={14} className={loading ? 'icon spin' : 'icon'} />
                {loading ? t('settings.loadingModels') : t('settings.loadModels')}
              </button>
            )}
          </div>
          {models.length === 0 ? (
            <p className="prov-hint">{t('settings.noModelsYet')}</p>
          ) : (
            <div className="prov-models">
              {models.map((m) => (
                <span className="model-tag" key={m.id} title={m.id}>
                  <ModalityIcon type={modelModality(m.id)} size={12} />
                  {m.label}
                </span>
              ))}
            </div>
          )}
          {loadMsg && <p className="prov-msg">{loadMsg}</p>}
        </div>
      )}
    </div>
  );
}
