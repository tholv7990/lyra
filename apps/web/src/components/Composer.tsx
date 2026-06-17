import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { MEDIA_ACCEPT, type PromptMedia, type Provider } from '@lyra/shared';
import { AttachmentPreviews } from './AttachmentPreviews';
import { ModelPicker } from './ModelPicker';
import { useAutoResize } from '../lib/useAutoResize';
import type { ModelCatalog } from '../lib/useModels';

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  /** Fired on ⌘/Ctrl+Enter (plain Enter inserts a newline — content is multi-line). */
  onSubmit?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  // attachments
  media: PromptMedia[];
  onRemoveMedia: (index: number) => void;
  uploading?: number;
  onFiles: (files: FileList | null) => void;
  // model picker
  catalog: ModelCatalog;
  provider: Provider;
  model: string;
  onModelChange: (provider: Provider, model: string) => void;
  // Send/stop button (Claude-style): the ↑ send turns into a ■ stop while busy.
  // Rendered when onSubmit (and/or onStop) is provided.
  busy?: boolean;
  onStop?: () => void;
  /** Enables the send button; defaults to "has text or attachments". */
  canSubmit?: boolean;
  // extra control left of the send button: a char counter (Create/Edit)
  trailing?: ReactNode;
  /** Extra class on the box (e.g. `pe-composer`). */
  className?: string;
}

// The one composer used by the prompt editor (Create/Edit) and the Try page:
// attachment previews + an auto-growing textarea + a bar with attach, the model
// picker, and a caller-supplied trailing control. One implementation, two pages.
export function Composer({
  value,
  onChange,
  onSubmit,
  placeholder,
  autoFocus,
  media,
  onRemoveMedia,
  uploading = 0,
  onFiles,
  catalog,
  provider,
  model,
  onModelChange,
  busy = false,
  onStop,
  canSubmit,
  trailing,
  className,
}: ComposerProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useAutoResize(taRef, value);

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onSubmit?.();
    }
  }

  return (
    <div className={`composer-box${className ? ` ${className}` : ''}`}>
      <AttachmentPreviews media={media} uploading={uploading} onRemove={onRemoveMedia} />
      <textarea
        ref={taRef}
        className="composer-input"
        rows={1}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
      />
      <div className="composer-bar">
        <button
          type="button"
          className="composer-add"
          onClick={() => fileRef.current?.click()}
          title="Attach files"
        >
          +
        </button>
        <input
          ref={fileRef}
          type="file"
          hidden
          multiple
          accept={MEDIA_ACCEPT}
          onChange={(e) => {
            onFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <ModelPicker catalog={catalog} provider={provider} model={model} onChange={onModelChange} />
        {trailing}
        {(onSubmit || onStop) &&
          (busy ? (
            <button type="button" className="send-btn stop" onClick={onStop} title="Stop">
              ■
            </button>
          ) : (
            <button
              type="button"
              className="send-btn"
              onClick={onSubmit}
              disabled={canSubmit !== undefined ? !canSubmit : !value.trim() && media.length === 0}
              title="Send"
            >
              ↑
            </button>
          ))}
      </div>
    </div>
  );
}
