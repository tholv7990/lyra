import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { MEDIA_ACCEPT, unknownStepRefs, type PromptMedia, type PromptVar, type Provider } from '@lyra/shared';
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
  /** Hide the ↑ send button (e.g. the prompt editor, which saves via its header
   *  ✓ — ⌘/Ctrl+Enter still fires onSubmit). */
  hideSend?: boolean;
  // extra control left of the send button: a char counter (Create/Edit)
  trailing?: ReactNode;
  /** Extra class on the box (e.g. `pe-composer`). */
  className?: string;
  /** Insertable variable chips for the run/builder step editors. Omit to hide the row. */
  vars?: PromptVar[];
  /** Every step name in the run — flags dangling {step:X} refs. Omit to skip the check. */
  stepNames?: string[];
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
  hideSend = false,
  trailing,
  className,
  vars,
  stepNames,
}: ComposerProps) {
  const { t } = useTranslation();
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useAutoResize(taRef, value);

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onSubmit?.();
    }
  }

  // Insert a variable token at the cursor (append if the textarea isn't focused).
  function insertToken(token: string) {
    const ta = taRef.current;
    if (!ta) {
      onChange(value + token);
      return;
    }
    const start = ta.selectionStart ?? value.length;
    const end = ta.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + token.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  const dangling = stepNames ? unknownStepRefs(value, stepNames) : [];

  return (
    <div className={`composer-box${className ? ` ${className}` : ''}`}>
      <AttachmentPreviews media={media} uploading={uploading} onRemove={onRemoveMedia} />
      {vars && vars.length > 0 && (
        <div className="rn-vars">
          <span className="rn-vars-label">{t('run.insert')}</span>
          {vars.map((v) => (
            <button
              key={v.token}
              type="button"
              className={`var-chip kind-${v.kind}`}
              title={`Insert ${v.token}`}
              onClick={() => insertToken(v.token)}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}
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
      {dangling.length > 0 && (
        <p className="rn-var-warn">
          {t('run.unknownStepRef')}: {dangling.map((n) => `{step:${n}}`).join(', ')}
        </p>
      )}
      <div className="composer-bar">
        <button
          type="button"
          className="composer-add"
          onClick={() => fileRef.current?.click()}
          title={t('common.attachFiles')}
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
        {!hideSend && (onSubmit || onStop) &&
          (busy ? (
            <button type="button" className="send-btn stop" onClick={onStop} title={t('common.stop')}>
              ■
            </button>
          ) : (
            <button
              type="button"
              className="send-btn"
              onClick={onSubmit}
              disabled={canSubmit !== undefined ? !canSubmit : !value.trim() && media.length === 0}
              title={t('common.send')}
            >
              ↑
            </button>
          ))}
      </div>
    </div>
  );
}
