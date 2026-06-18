import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { Provider } from '@lyra/shared';
import { StepTestModal } from './StepTestModal';

describe('StepTestModal', () => {
  test('prefills the chat composer with the selected step prompt', () => {
    const html = renderToStaticMarkup(
      <StepTestModal
        wsId="workspace-1"
        title="Find stores"
        initialPrompt="Find 10 stores that sell pet toys"
        initialMedia={[]}
        provider={Provider.Anthropic}
        model="claude-sonnet-4"
        catalog={{
          [Provider.OpenAI]: [],
          [Provider.DeepSeek]: [],
          [Provider.Anthropic]: [],
          [Provider.Image]: [],
          [Provider.Video]: [],
          [Provider.Crawl]: [],
        }}
        onClose={() => undefined}
      />,
    );

    expect(html).toContain('Test Find stores');
    expect(html).toContain('Find 10 stores that sell pet toys');
  });
});
