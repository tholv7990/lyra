import type { ProjectBrandKit } from '@lyra/shared';

export interface BrandKitSectionProps {
  brandKit: ProjectBrandKit;
  uploading: boolean;
  onLogoFile: (files: FileList | null) => void;
  onClearLogo: () => void;
  onAccentChange: (hex: string) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

export function BrandKitSection({ brandKit, uploading, onLogoFile, onClearLogo, onAccentChange, t }: BrandKitSectionProps) {
  return (
    <section className="pe-section">
      <div className="pe-label">{t('projects.brandLabel')}</div>
      <div className="pe-sub">{t('projects.brandHelp')}</div>
      <div className="pe-brand-row">
        {brandKit.logoUrl ? (
          <div className="pe-brand-logo">
            <img src={brandKit.logoUrl} alt={t('projects.brandLogo')} />
            <button type="button" className="pe-var-del" title={t('projects.brandClearLogo')} aria-label={t('projects.brandClearLogo')} onClick={onClearLogo}>✕</button>
          </div>
        ) : (
          <label className="pe-brand-add">
            {uploading ? t('common.saving') : t('projects.brandAddLogo')}
            <input type="file" accept="image/*" hidden onChange={(e) => onLogoFile(e.target.files)} />
          </label>
        )}
        <label className="pe-brand-accent">
          {t('projects.brandAccent')}
          <input type="color" value={brandKit.accentColor ?? '#0075de'} onChange={(e) => onAccentChange(e.target.value)} />
        </label>
      </div>
    </section>
  );
}
