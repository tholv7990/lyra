import { MediaType, type PromptMedia } from '@lyra/shared';
import { useTranslation } from 'react-i18next';
import { Modal } from './Modal';
import { XIcon } from '../layout/icons';

// Lightbox for a single attachment — used wherever a media thumbnail appears
// (chat messages, the composer, the prompt form). Images/video/audio play
// inline; any other file embeds in an iframe with an "Open" fallback link.
export function MediaViewer({
  media,
  onClose,
}: {
  media: PromptMedia | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  if (!media) return null;
  const { url, type, name } = media;
  return (
    <Modal onClose={onClose} className="media-viewer">
      <div className="mv-head">
        <span className="mv-name">{name ?? t('chats.fileFallback')}</span>
        <a className="mv-open" href={url} target="_blank" rel="noreferrer">
          {t('common.open')}
        </a>
        <button type="button" className="dialog-close" onClick={onClose} aria-label={t('common.close')}>
          <XIcon />
        </button>
      </div>
      <div className="mv-body">
        {type === MediaType.Image && <img src={url} alt={name ?? ''} />}
        {type === MediaType.Video && <video src={url} controls autoPlay />}
        {type === MediaType.Audio && <audio src={url} controls autoPlay />}
        {type === MediaType.File && <iframe className="mv-frame" src={url} title={name ?? 'file'} />}
      </div>
    </Modal>
  );
}
