export default {
  greeting: 'Good to see you, {{name}}',
  workspaceMeta: "{{name}} · {{type}} workspace · you're {{role}}",
  noWorkspace: 'No workspace selected.',
  soon: 'Soon',
  chatsTitle: 'Chats',
  chatsBody:
    'Where you craft prompts. Chat multi-turn with any provider·model, compare answers, and save the keepers to your library. Every turn is kept automatically.',
  chatsCta: 'Start chatting',
  promptsTitle: 'Prompts',
  promptsBody:
    'Your library of reusable, on-brand prompts with media, tags, and {placeholders}. Open one back in a chat to iterate, or wire it into a pipeline step.',
  promptsCta: 'Open prompts',
  pipelinesTitle: 'Pipelines',
  pipelinesBody:
    'Compose linear flows of steps — each binds a prompt to a provider·model with gate or auto mode. Assign to a project and run; the flow lights up step by step.',
  pipelinesCta: 'Open pipelines',
  projectsTitle: 'Projects',
  projectsBody:
    'A project per brand, product, or store. It supplies the run context ({product}, {niche}, {homepage}) and is where you assign pipelines and launch runs.',
  projectsCta: 'Open projects',
  keysTitle: 'Provider keys',
  keysBody:
    "Bring your own provider keys per workspace, encrypted at rest. A step is runnable only once its provider's key is set — no keys ever leave the server.",
  keysCta: 'Manage keys',
  membersTitle: 'Members',
  membersBody:
    'Invite teammates by email and manage their roles. Use the workspace menu (top-left) to switch or create workspaces.',

  // ===== Get-started onboarding checklist =====
  gsTitle: 'Get started',
  gsSubtitle: 'Four steps to your first AI run.',
  gsProgress: '{{done}} of {{total}}',
  gsDismiss: 'Dismiss',
  gsStepDone: 'Done',
  gsKeysTitle: 'Add a provider key',
  gsKeysBody:
    'Connect OpenAI, Anthropic, or another provider so steps can run. Keys are encrypted and never leave the server.',
  gsKeysCta: 'Add key',
  gsPromptTitle: 'Craft a prompt',
  gsPromptBody: 'Chat with any model, then save the best result to your prompt library.',
  gsPromptCta: 'Open Chats',
  gsPipelineTitle: 'Build a pipeline',
  gsPipelineBody:
    'Chain prompts into a flow — each step picks a model and runs automatically or waits for your approval.',
  gsPipelineCta: 'Build pipeline',
  gsProjectTitle: 'Create a project and run',
  gsProjectBody: 'A project holds your brand context. Assign a pipeline and launch your first run.',
  gsProjectCta: 'New project',
} as const;
