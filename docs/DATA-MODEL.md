# Lyra — Data model (design context)

> The entities and **fields** behind Lyra's screens, for mocking up realistic
> data. Transport shapes from `packages/shared/src/models` + enums from
> `packages/shared/src/enums` (source of truth). Server-only fields
> (`passwordHash`, `encryptedKey`, `tokenHash`) are intentionally absent. All
> `id`s are strings; dates are ISO strings.

## Enum value sets

| Enum | Values |
|---|---|
| **Role** | `owner` · `member` · `viewer` (read-only) |
| **WorkspaceType** | `personal` · `team` |
| **ProjectStatus** | `draft` · `public` |
| **ProjectShare** | `all` (whole workspace) · `people` (chosen `sharedWith`) |
| **TaskStatus** | `new` · `in_progress` · `on_hold` · `complete` |
| **TaskPriority** | `none` · `urgent` · `high` · `medium` · `low` |
| **PromptStatus** | `draft` · `public` |
| **PromptType** | `text` · `image` · `audio` · `video` |
| **Provider** | `openai` · `anthropic` · `deepseek` · `image` · `video` · `crawl` |
| **StepMode** | `auto` · `gate` (pause for approval) |
| **StepStatus** | `idle` · `queued` · `running` · `waiting` · `skipped` · `done` · `error` |
| **RunStatus** | `idle` · `running` · `awaiting_gate` · `done` · `error` |
| **MediaType** | `image` · `audio` · `video` · `file` |
| **RequestType** | `provider` · `bug` · `team-upgrade` |

Every persisted entity also carries an **audit envelope**: `active`,
`createdBy {id,name}`, `updatedBy {id,name}`, `createdAt`, `updatedAt`.

## Entities & fields

### User
`id` · `email` · `name` · `active` · `emailVerified` · `isAdmin?` · `createdAt` · `updatedAt`

### Workspace
`id` · `name` · `type` (WorkspaceType). List view adds `role`, `canManageKeys`.

### Membership / MemberView
`workspaceId` · `userId` · `email` · `name` · `role` (Role) · `canManageKeys`

### Invite / MyInvite
`workspaceId` · `workspaceName` · `email` · `role` · `status` (`pending|accepted|revoked|declined`) · `invitedBy {id,name}` · `expiresAt`

### ApiKeyInfo (safe — never the key)
`workspaceId` · `provider` · `last4`

### Project
`id` · `workspaceId` · `name` · `description` · `variables: [{key,value}]` ·
`status` (ProjectStatus) · `shared` (ProjectShare) · `sharedWith: UserRef[]`
→ a project is a **board of Tasks**; context variables (e.g. `product`, `niche`,
`homepage`) fill `{key}` placeholders at run time.

### Task (the board card)
`id` · `workspaceId` · `projectId` · `name` · `description` ·
`status` (TaskStatus) · `priority` (TaskPriority) · `assignee?: UserRef` ·
`pipelines: string[]` (library pipeline ids) · `tags: string[]` (label names)

### Prompt (library)
`id` · `workspaceId` · `title` · `content` (with `{variables}`) ·
`status` (PromptStatus) · `type` (PromptType) · `media: PromptMedia[]` ·
`tags: string[]` · `provider?` · `model?` · `results: SavedResult[]`
- **SavedResult**: `output` · `provider` · `model` · `promptSnapshot` · `rating?` ·
  `note?` · `sourceConversationId?` · `createdBy` · `savedAt`
- **PromptMedia**: `type` (MediaType) · `url` · `name?` · `mime?` · `size?`

### Pipeline (library, linear chain)
`id` · `workspaceId` · `name` · `description` · `tags: string[]` ·
`steps: PipelineStep[]` · `variables: PipelineVariable[]` · `origin? {source: ai|manual, goal?, model?}`
- **PipelineStep**: `id` · `name` · `promptId` · `provider` · `model` ·
  `mode` (StepMode) · `fanOut? {over, itemVar?}` · `condition? {variable, op, value?}`
- **PipelineVariable**: `key` (e.g. `tone` → `{tone}`) · `label?` · `default?`

### Run (one execution)
`id` · `workspaceId` · `projectId?` · `taskId?` · `pipelineId?` · `pipelineName?` ·
`context? {note?}` · `variables: Record<string,string>` (frozen) ·
`collections: Record<string,string[]>` (frozen) · `status` (RunStatus) ·
`currentStep` · `steps: Step[]` · `rating? {value: up|down, by, at}`
- **Step**: `index` · `name?` · `promptId?` · `provider?` · `mode` · `status` ·
  `model` · `prompt` · `sentPrompt?` · `result?` · `assetIds?` ·
  `usage? {tokens?, costUsd?}` · `error?` · `startedAt?` · `finishedAt?`

### Asset (render output)
`id` · `runId` · `workspaceId` · `stepIndex` · `type` (`image|video|audio`) ·
`url` · `thumbUrl?` · `approved?`

### Conversation (chat) + ConversationMessage
Conversation: `id` · `workspaceId` · `title` · `provider` · `model` ·
`originPromptId?` · `starred` · `messages: ConversationMessage[]`
- **Message**: `role` (`user|assistant`) · `content` · `media?` · `provider` ·
  `model` · `usage?` · `error?` · `createdAt`

### MarketplacePrompt (global, read-only)
`id` · `title` · `description?` · `content` · `type` (`text|structured`) ·
`forDevs` · `contributor?` · `source` · `category?` · `variables: string[]` · `tags: string[]`

### Connectors (publish + media import)
- **Channel**: `id` · `platform` (`tiktok|instagram|youtube|facebook|…`) · `displayName`
- **PublishJob**: `jobId` · `status` (`queued|running|done|failed`) · `receipts?`
- **DownloadJob**: `jobId` · `status` (`running|done|error`) · `pct` · `items?` · `error?`

### Admin (super-admin)
- **AdminOverview**: `users` · `workspaces` · `projects` · `pipelines` · `prompts` ·
  `runs` · `chats` · `signups30d` · `recentSignups[]`
- **AdminUserDetail**: user + `workspaces[]` + `usage {projects,pipelines,prompts,runs,chats}`

## Relationships (at a glance)

```
Workspace ─┬─ Membership ── User
           ├─ ApiKey (per provider)
           ├─ Prompt (library) ── SavedResult ◄── Conversation
           ├─ Pipeline ── PipelineStep ──▶ Prompt
           └─ Project ── Task ──▶ Pipeline(s)
                                   │
                                   └─ Run ── Step ── Asset
```

- A **Task** assigns one or more library **Pipelines**; running one creates a
  **Run** scoped to `(taskId, pipelineId)`.
- A **PipelineStep** references a library **Prompt** by `promptId`, run on a
  per-step `provider·model`.
- **Variables** resolve at run time from: project `variables` + pipeline
  `variables` + system vars (`{note}`, `{date}`) + prior step outputs
  (`{input}`, `{step:Name}`).
