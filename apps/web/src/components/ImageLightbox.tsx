import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from './Modal';
import { XIcon } from '../layout/icons';
import './ImageLightbox.css';

// A swipeable image gallery lightbox: prev/next arrows, ←/→ keyboard, touch swipe,
// and an "n / total" counter. Reuses the shared Modal (backdrop + Escape close).
export function ImageLightbox({
  images,
  startIndex = 0,
  onClose,
}: {
  images: string[];
  startIndex?: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const n = images.length;
  const [i, setI] = useState(() => Math.min(Math.max(startIndex, 0), Math.max(n - 1, 0)));
  const touchX = useRef<number | null>(null);

  const go = (d: number) => setI((p) => (p + d + n) % n);

  useEffect(() => {
    if (n < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [n]);

  if (!n) return null;

  return (
    <Modal onClose={onClose} className="img-lightbox">
      <button type="button" className="ilb-close" onClick={onClose} aria-label={t('common.close')}>
        <XIcon />
      </button>
      <div
        className="ilb-stage"
        onTouchStart={(e) => { touchX.current = e.touches[0]?.clientX ?? null; }}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const dx = (e.changedTouches[0]?.clientX ?? 0) - touchX.current;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          touchX.current = null;
        }}
      >
        {n > 1 && (
          <button type="button" className="ilb-nav ilb-prev" onClick={() => go(-1)} aria-label={t('common.previous')}>‹</button>
        )}
        <img className="ilb-img" src={images[i]} alt="" />
        {n > 1 && (
          <button type="button" className="ilb-nav ilb-next" onClick={() => go(1)} aria-label={t('common.next')}>›</button>
        )}
      </div>
      {n > 1 && <div className="ilb-count">{i + 1} / {n}</div>}
    </Modal>
  );
}
