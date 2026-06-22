import { useTranslation } from 'react-i18next';

export function Monitor() {
  const { t } = useTranslation();

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t('monitor.title')}</h1>
        <p className="subtitle">{t('monitor.subtitle')}</p>
      </div>
      <div className="page-content">
        {/* Placeholder for Task 10 implementation */}
      </div>
    </div>
  );
}
