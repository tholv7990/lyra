import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ActionType, Provider, StepStatus, StepMode } from '@lyra/shared';
import { RunTimeline } from './RunTimeline';

// Stub i18n — return the key suffix so assertions can match on phase label strings.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, _opts?: unknown) => {
      const map: Record<string, string> = {
        'run.phaseFind': 'Find candidates',
        'run.phaseFindSub': 'harvest + ground the evidence',
        'run.phaseValidate': 'Validate demand',
        'run.phaseValidateSub': '≥3 independent demand signals',
        'run.phaseEconomics': 'Economics & risk',
        'run.phaseEconomicsSub': 'score the factors + unit economics',
        'run.phaseDecide': 'Score & decide',
        'run.phaseDecideSub': 'weighted score → grade → decision → save',
      };
      return map[key] ?? key;
    },
    i18n: { language: 'en' },
  }),
}));

// Stub react-router-dom Link (used inside RunTimeline for settings link)
vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: unknown; to: string }) =>
    `<a href="${to}">${children}</a>`,
}));

const step = (over: any) => ({
  index: 0,
  name: 'S',
  mode: StepMode.Auto,
  status: StepStatus.Idle,
  model: '',
  prompt: '',
  ...over,
});
const baseRun = (steps: any[]) =>
  ({ id: 'r', status: 'idle', currentStep: 0, steps, variables: {}, context: {} }) as any;
const props = {
  busy: false,
  hasKey: () => true,
  onRunStep: () => {},
  onApprove: () => {},
  onSavePrompt: () => {},
};

const researchRun = baseRun([
  step({ index: 0, name: 'Research', provider: Provider.Research }),
  step({ index: 1, name: 'Demand gate', action: { type: ActionType.DemandGate } }),
  step({ index: 2, name: 'Score', action: { type: ActionType.Score } }),
  step({ index: 3, name: 'Unit economics', action: { type: ActionType.UnitEcon } }),
  step({ index: 4, name: 'Evaluate', action: { type: ActionType.Evaluate } }),
  step({ index: 5, name: 'Save', action: { type: ActionType.SaveProduct }, mode: StepMode.Gate }),
]);
const genericRun = baseRun([
  step({ index: 0, name: 'Hook', provider: Provider.OpenAI }),
  step({ index: 1, name: 'Brand', action: { type: ActionType.Brand } }),
]);

describe('RunTimeline 4-phase view', () => {
  it('renders 4 phase headers in order for a research run', () => {
    const html = renderToStaticMarkup(<RunTimeline run={researchRun} {...props} />);
    expect(html).toContain('Find candidates');
    expect(html).toContain('Validate demand');
    expect(html).toContain('Economics &amp; risk');
    expect(html).toContain('Score &amp; decide');
    expect(html.indexOf('Find candidates')).toBeLessThan(html.indexOf('Validate demand'));
  });
  it('renders no phase headers for a generic run', () => {
    const html = renderToStaticMarkup(<RunTimeline run={genericRun} {...props} />);
    expect(html).not.toContain('Find candidates');
    expect(html).toContain('Hook');
  });
});
