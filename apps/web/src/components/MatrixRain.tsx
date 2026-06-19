import { useEffect, useRef } from 'react';
import { useTheme } from '../lib/prefs';

// Matrix-style digital rain for the auth pages — warm brand colors (orange
// glyphs, bright sparkle heads) on near-black. Canvas-based, ~18fps (light on
// CPU), DPR-aware, and calm/static when prefers-reduced-motion is set.
const GLYPHS =
  'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモ0123456789ABCDEFGHJKLMNPRSTUVWXYZ<>/*+=';

export function MatrixRain() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const { resolved } = useTheme();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cv: HTMLCanvasElement = el; // non-null bindings for the closures below
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const g: CanvasRenderingContext2D = ctx;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dark = resolved === 'dark';
    const bg = dark ? '#0c0c0f' : '#ffffff';
    const fade = dark ? 'rgba(12, 12, 15, 0.16)' : 'rgba(255, 255, 255, 0.10)';
    const trail = dark ? '#ff8a3d' : '#ff9a55';
    const head = dark ? '#ffd0b0' : '#ea580c';
    const fontSize = 16;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let cols = 0;
    let drops: number[] = [];

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      cv.width = Math.floor(width * dpr);
      cv.height = Math.floor(height * dpr);
      cv.style.width = `${width}px`;
      cv.style.height = `${height}px`;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(width / fontSize);
      drops = Array.from({ length: cols }, () =>
        Math.floor((Math.random() * -height) / fontSize),
      );
      g.fillStyle = bg;
      g.fillRect(0, 0, width, height);
    }
    resize();
    window.addEventListener('resize', resize);

    function draw() {
      // Trailing fade matches the active theme backdrop.
      g.fillStyle = fade;
      g.fillRect(0, 0, width, height);
      g.font = `${fontSize}px "Courier New", monospace`;
      for (let i = 0; i < cols; i++) {
        const ch = GLYPHS[(Math.random() * GLYPHS.length) | 0];
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        // Soft orange trail; brighter head for depth.
        g.fillStyle = Math.random() > 0.9 ? head : trail;
        g.fillText(ch, x, y);
        if (y > height && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 1;
      }
    }

    let raf = 0;
    if (reduce) {
      // calm static image: a few passes to fill, then stop
      for (let i = 0; i < 24; i++) draw();
    } else {
      let last = 0;
      const loop = (t: number) => {
        raf = requestAnimationFrame(loop);
        if (t - last < 55) return; // ~18fps
        last = t;
        draw();
      };
      raf = requestAnimationFrame(loop);
    }

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
    };
  }, [resolved]);

  return <canvas ref={ref} className="matrix-rain" aria-hidden="true" />;
}
