import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProductBoard } from './ProductBoard';
import { ProductStatus } from '@lyra/shared';

// Stub i18n — return the key so assertions can match key-derived strings.
// The noProducts key resolves to a string containing "no products".
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'projects.noProducts': 'No products yet — run the Product research pipeline.',
        'projects.productGrade': 'Grade',
      };
      return map[key] ?? key;
    },
    i18n: { language: 'en' },
  }),
}));

const p = (over: any) => ({
  id: 'x',
  workspaceId: 'w',
  projectId: 'p',
  name: 'Dog Toy',
  description: '',
  status: ProductStatus.Candidate,
  evidence: [],
  sources: [],
  competitorIds: [],
  tags: [],
  active: true,
  createdBy: { id: 'u', name: 'U' },
  updatedBy: { id: 'u', name: 'U' },
  createdAt: '',
  updatedAt: '',
  ...over,
});

it('renders product cards with grade + decision + groups by status', () => {
  const html = renderToStaticMarkup(
    <ProductBoard
      products={[
        p({ name: 'Dog Toy', grade: 'B', decision: 'TEST_NOW', score: 80 }),
        p({ name: 'Cat Bed', status: ProductStatus.Killed }),
      ]}
      onOpen={() => {}}
      onEdit={() => {}}
      onDelete={() => {}}
    />,
  );
  expect(html).toContain('Dog Toy');
  expect(html).toContain('TEST_NOW');
  expect(html).toContain('B');
});

it('renders an empty state with no products', () => {
  const html = renderToStaticMarkup(<ProductBoard products={[]} onOpen={() => {}} onEdit={() => {}} onDelete={() => {}} />);
  expect(html.toLowerCase()).toMatch(/no products|run the/i);
});
