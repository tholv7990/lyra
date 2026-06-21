import { useState, type MouseEvent } from 'react';
import { MediaType } from '@lyra/shared';
import { useTranslation } from 'react-i18next';
import { Modal } from './Modal';
import { XIcon } from '../layout/icons';

// The minimal shape the lightbox needs. PromptMedia satisfies it; run Assets map
// to it ({ url, type, name? }). One viewer for every media thumbnail in the app.
export interface ViewableMedia {
  url: string;
  type: MediaType;
  name?: string;
}

// Lightbox for a single piece of media — used wherever a media thumbnail appears
// (chat messages, the composer/prompt form, run-step assets). Images/video/audio
// play inline; any other file embeds in an iframe with an "Open" fallback link.
export function MediaViewer({
  media,
  onClose,
}: {
  media: ViewableMedia | null;
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

// Convenience for thumbnails: `open(media)` returns an onClick handler that opens
// the lightbox (cmd/ctrl/middle-click still follows the raw href). Render the
// returned `viewer` once. One shared viewer for every media thumbnail.
export function useMediaViewer() {
  const [viewing, setViewing] = useState<ViewableMedia | null>(null);
  const open = (media: ViewableMedia) => (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.button === 1) return;
    e.preventDefault();
    setViewing(media);
  };
  return { open, viewer: <MediaViewer media={viewing} onClose={() => setViewing(null)} /> };
}
