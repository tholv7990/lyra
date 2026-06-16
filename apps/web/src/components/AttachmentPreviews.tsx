import { MediaType, type PromptMedia } from '@lyra/shared';

function extLabel(name?: string) {
  if (!name) return 'FILE';
  const i = name.lastIndexOf('.');
  return (i >= 0 ? name.slice(i + 1) : 'file').toUpperCase().slice(0, 4);
}

// Shared attachment row used by the prompt-testing composer and the create-prompt
// form. Images render as real thumbnails (like ChatGPT/Claude); other files show
// as a typed chip. Pass onRemove to make them removable.
export function AttachmentPreviews({
  media,
  uploading = 0,
  onRemove,
}: {
  media: PromptMedia[];
  uploading?: number;
  onRemove?: (index: number) => void;
}) {
  if (media.length === 0 && uploading === 0) return null;
  return (
    <div className="composer-attachments">
      {media.map((m, i) =>
        m.type === MediaType.Image ? (
          <span className="att-thumb" key={`${m.url}-${i}`}>
            <img src={m.url} alt={m.name ?? 'image'} />
            {onRemove && (
              <button
                type="button"
                className="att-x on-thumb"
                onClick={() => onRemove(i)}
                aria-label="Remove"
              >
                ×
              </button>
            )}
          </span>
        ) : (
          <span className="att-chip" key={`${m.url}-${i}`}>
            <span className="att-kind">{extLabel(m.name)}</span>
            <span className="att-name">{m.name}</span>
            {onRemove && (
              <button
                type="button"
                className="att-x"
                onClick={() => onRemove(i)}
                aria-label="Remove"
              >
                ×
              </button>
            )}
          </span>
        ),
      )}
      {uploading > 0 && (
        <span className="att-chip">
          <span className="spinner" /> Uploading…
        </span>
      )}
    </div>
  );
}
