// Pure logic for the Home "Get started" onboarding checklist. Kept separate from
// the Home component so the step + progress derivation is unit-tested without
// pulling react-router / i18n into the test.

export interface WorkspaceStats {
  keys: number;
  prompts: number;
  pipelines: number;
  projects: number;
}

export type GettingStartedKey = 'keys' | 'prompt' | 'pipeline' | 'project';

export interface GettingStartedStep {
  key: GettingStartedKey;
  to: string;
  done: boolean;
}

// The first-run order is keys -> prompt -> pipeline -> project, which doubles as
// the product's core mental model: each concept builds on the previous one, so
// walking the checklist top-to-bottom also teaches how the pieces relate.
export function gettingStartedSteps(stats: WorkspaceStats): GettingStartedStep[] {
  return [
    { key: 'keys', to: '/settings', done: stats.keys > 0 },
    { key: 'prompt', to: '/chats', done: stats.prompts > 0 },
    { key: 'pipeline', to: '/pipelines', done: stats.pipelines > 0 },
    { key: 'project', to: '/projects', done: stats.projects > 0 },
  ];
}

export interface GettingStartedProgress {
  done: number;
  total: number;
  complete: boolean;
  /** Index of the first incomplete step (the one to highlight), or -1 if done. */
  activeIndex: number;
  /** Completion ratio 0..1, for the progress bar width. */
  ratio: number;
}

export function gettingStartedProgress(steps: GettingStartedStep[]): GettingStartedProgress {
  const total = steps.length;
  const done = steps.filter((s) => s.done).length;
  return {
    done,
    total,
    complete: total > 0 && done === total,
    activeIndex: steps.findIndex((s) => !s.done),
    ratio: total === 0 ? 0 : done / total,
  };
}
