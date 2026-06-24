import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MemoryKind } from '@lyra/shared';

// Stub i18n — return the key so assertions match key names.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

// Stub api — never actually called during static render.
vi.mock('../lib/api', () => ({
  api: vi.fn().mockResolvedValue({}),
}));

// Stub Modal hooks that access browser APIs not present in node.
vi.mock('../lib/useEscapeKey', () => ({ useEscapeKey: () => undefined }));
vi.mock('../lib/useScrollLock', () => ({ useScrollLock: () => undefined }));
vi.mock('../lib/useViewportVars', () => ({ useViewportVars: () => undefined }));

// Stub MenuPicker hooks that use refs/events not available server-side.
vi.mock('../lib/useOutsideClick', () => ({ useOutsideClick: () => undefined }));

import { RememberModal } from './RememberModal';

describe('RememberModal', () => {
  it('renders the textarea prefilled with content', () => {
    const html = renderToStaticMarkup(
      <RememberModal
        wsId="ws-1"
        content="The user prefers dark mode"
        onClose={() => undefined}
      />,
    );

    expect(html).toContain('<textarea');
    expect(html).toContain('The user prefers dark mode');
  });

  it('renders a kind label from MemoryKind options', () => {
    const html = renderToStaticMarkup(
      <RememberModal
        wsId="ws-1"
        content="Prefer concise answers"
        onClose={() => undefined}
      />,
    );

    // The MenuPicker renders the current option label (Fact is default).
    // With t() returning the key, it renders "memory.kind.fact".
    expect(html).toContain(`memory.kind.${MemoryKind.Fact}`);
  });

  it('renders the save button', () => {
    const html = renderToStaticMarkup(
      <RememberModal
        wsId="ws-1"
        content="Some memory"
        onClose={() => undefined}
      />,
    );

    // The save button text is the i18n key "memory.save".
    expect(html).toContain('memory.save');
  });

  it('renders the modal title', () => {
    const html = renderToStaticMarkup(
      <RememberModal
        wsId="ws-1"
        content="Some memory"
        onClose={() => undefined}
      />,
    );

    expect(html).toContain('memory.title');
  });
});
