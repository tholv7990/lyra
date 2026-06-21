import { useState } from 'react';
import { MediaType, type PromptMedia } from '@lyra/shared';
import { useTranslation } from 'react-i18next';
import { MediaViewer } from './MediaViewer';

function extLabel(name?: string) {
  if (!name) return 'FILE';
  const i = name.lastIndexOf('.');
  return (i >= 0 ? name.slice(i + 1) : 'file').toUpperCase().slice(0, 4);
}

// Shared attachment row used by the prompt-testing composer and the create-prompt
// form. Images render as real thumbnails (like ChatGPT/Claude); other files show
// as a typed chip. Tapping either opens the media lightbox; pass onRemove to make
// them removable.
export function AttachmentPreviews({
  media,
  uploading = 0,
  onRemove,
}: {
  media: PromptMedia[];
  uploading?: number;
  onRemove?: (index: number) => void;
}) {
  const { t } = useTranslation();
  const [viewing, setViewing] = useState<PromptMedia | null>(null);
  if (media.length === 0 && uploading === 0) return null;
  return (
    <div className="composer-attachments">
      {media.map((m, i) =>
        m.type === MediaType.Image ? (
          <span className="att-thumb" key={`${m.url}-${i}`}>
            <img src={m.url} alt={m.name ?? 'image'} onClick={() => setViewing(m)} />
            {onRemove && (
              <button
                type="button"
                className="att-x on-thumb"
                onClick={() => onRemove(i)}
                aria-label={t('common.remove')}
              >
                ×
              </button>
            )}
          </span>
        ) : (
          <span className="att-chip" key={`${m.url}-${i}`}>
            <span className="att-open" onClick={() => setViewing(m)}>
              <span className="att-kind">{extLabel(m.name)}</span>
              <span className="att-name">{m.name}</span>
            </span>
            {onRemove && (
              <button
                type="button"
                className="att-x"
                onClick={() => onRemove(i)}
                aria-label={t('common.remove')}
              >
                ×
              </button>
            )}
          </span>
        ),
      )}
      {uploading > 0 && (
        <span className="att-chip">
          <span className="spinner" /> {t('common.uploading')}
        </span>
      )}
      {viewing && <MediaViewer media={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
