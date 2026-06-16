import { useRef, useState, type DragEvent } from 'react';
import {
  isAllowedMedia,
  MEDIA_ACCEPT,
  MEDIA_MAX_BYTES,
  MediaType,
  type PromptMedia,
} from '@lyra/shared';
import { api } from '../lib/api';

interface FileUploadProps {
  value: PromptMedia[];
  workspaceId: string;
  onAdd: (media: PromptMedia) => void;
  onRemove: (index: number) => void;
}

const CAT_COLOR: Record<MediaType, string> = {
  [MediaType.Image]: '#ec4899',
  [MediaType.Audio]: '#f59e0b',
  [MediaType.Video]: '#ef4444',
  [MediaType.File]: '#5e6ad2',
};

function formatBytes(n?: number): string {
  if (n === undefined) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function extLabel(name?: string): string {
  if (!name) return 'FILE';
  const i = name.lastIndexOf('.');
  return (i >= 0 ? name.slice(i + 1) : 'file').toUpperCase().slice(0, 4);
}

export function FileUpload({ value, workspaceId, onAdd, onRemove }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadOne(file: File) {
    if (!isAllowedMedia(file.type, file.name)) {
      setError(`${file.name}: file type not allowed`);
      return;
    }
    if (file.size > MEDIA_MAX_BYTES) {
      setError(`${file.name}: exceeds the 25 MB limit`);
      return;
    }
    setUploading((u) => [...u, file.name]);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const media = await api<PromptMedia>(`/workspaces/${workspaceId}/files`, {
        method: 'POST',
        body: fd,
      });
      onAdd(media);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not upload ${file.name}`);
    } finally {
      setUploading((u) => {
        const i = u.indexOf(file.name);
        return i === -1 ? u : [...u.slice(0, i), ...u.slice(i + 1)];
      });
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    setError(null);
    Array.from(files).forEach((f) => void uploadOne(f));
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div>
      <div
        className={`dropzone ${dragOver ? 'over' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={MEDIA_ACCEPT}
          hidden
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <svg className="dz-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 16V4M7 9l5-5 5 5" />
          <path d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
        </svg>
        <div className="dz-text">
          <strong>Click to upload</strong> or drag and drop
        </div>
        <div className="dz-hint">Images, PDF, Office docs, audio, video — up to 25 MB</div>
      </div>

      {error && <p className="error" style={{ margin: '8px 0 0' }}>{error}</p>}

      {(value.length > 0 || uploading.length > 0) && (
        <div className="media-tiles">
          {value.map((m, i) => (
            <div className="media-tile" key={`${m.url}-${i}`}>
              {m.type === MediaType.Image ? (
                <a href={m.url} target="_blank" rel="noreferrer" className="media-thumb">
                  <img src={m.url} alt={m.name ?? 'image'} />
                </a>
              ) : (
                <a
                  href={m.url}
                  target="_blank"
                  rel="noreferrer"
                  className="media-thumb file"
                  style={{ background: `${CAT_COLOR[m.type]}14`, color: CAT_COLOR[m.type] }}
                >
                  {extLabel(m.name)}
                </a>
              )}
              <div className="media-tile-meta">
                <span className="nm" title={m.name}>{m.name}</span>
                <span className="sz">{formatBytes(m.size)}</span>
              </div>
              <button
                type="button"
                className="media-tile-x"
                aria-label="Remove"
                onClick={() => onRemove(i)}
              >
                ×
              </button>
            </div>
          ))}
          {uploading.map((name) => (
            <div className="media-tile uploading" key={`up-${name}`}>
              <div className="media-thumb file">
                <span className="spinner" />
              </div>
              <div className="media-tile-meta">
                <span className="nm" title={name}>{name}</span>
                <span className="sz">Uploading…</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
