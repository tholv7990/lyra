import { useTranslation } from 'react-i18next';
import { ChatsIcon, CheckIcon, CopyIcon } from '../layout/icons';
import { useCopyToClipboard } from '../lib/useCopyToClipboard';

// A prompt body shown the prompts.chat way: a monospace code-block under a header
// bar (label + copy, plus an optional run / open-in-chat). Copy is self-contained.
export function PromptCodeBlock({
  content,
  label,
  onRun,
  runLabel,
}: {
  content: string;
  label: string;
  onRun?: () => void;
  runLabel?: string;
}) {
  const { t } = useTranslation();
  const { copied, copy } = useCopyToClipboard();

  return (
    <div className="pcb">
      <div className="pcb-head">
        <span className="pcb-label">{label}</span>
        <div className="pcb-acts">
          <button type="button" className="pcb-act" onClick={() => copy(content)}>
            {copied ? <CheckIcon width={14} height={14} /> : <CopyIcon width={14} height={14} />}
            <span>{copied ? t('common.copied') : t('common.copy')}</span>
          </button>
          {onRun && (
            <button type="button" className="pcb-act pcb-run" onClick={onRun}>
              <ChatsIcon width={14} height={14} />
              <span>{runLabel}</span>
            </button>
          )}
        </div>
      </div>
      <pre className="pcb-body">{content}</pre>
    </div>
  );
}
