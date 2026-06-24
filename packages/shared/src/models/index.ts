import {
  Role,
  ProjectStatus,
  ProjectShare,
  RunStatus,
  StepStatus,
  StepMode,
  StepKey,
  PromptStatus,
  PromptType,
  MediaType,
  Provider,
  RequestType,
  RequestStatus,
  WorkspaceType,
  TaskStatus,
  TaskPriority,
  ChannelType,
  StepKind,
  ActionType,
  Corner,
  MonitorPlatform,
  CompetitorStatus,
  AdStatus,
  AdEventType,
  ProductStatus,
  MemoryKind,
} from '../enums';
import type { SubScores } from '../constants/research';

// A populated actor reference — what createdBy/updatedBy expand to in responses.
export interface UserRef {
  id: string;
  name: string;
}

// Standard audit envelope present on every persisted collection (transport form).
export interface Audited {
  active: boolean;
  createdBy: UserRef;
  updatedBy: UserRef;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  active: boolean;
  // False = a password signup that hasn't confirmed their email yet. Such users
  // can sign in but are limited (browse Home + Marketplace) until they verify;
  // the api blocks create/run actions. Google sign-ins are auto-verified (true).
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  // True when this user's email is on the server's SUPER_ADMIN_EMAILS allowlist.
  // Derived server-side and stamped onto the user the client receives; the web
  // uses it only to reveal the /admin surface — the api guard is the real gate.
  isAdmin?: boolean;
}

export interface Workspace extends Audited {
  id: string;
  name: string;
  type: WorkspaceType;
}

// A workspace plus the requesting user's role in it — what GET /workspaces returns.
export interface WorkspaceView extends Workspace {
  role: Role;
  canManageKeys: boolean;
}

export interface Membership extends Audited {
  id: string;
  workspaceId: string;
  userId: string;
  role: Role;
  canManageKeys: boolean;
}

// A member row for the workspace members list (membership joined with the user).
export interface MemberView {
  membershipId: string;
  workspaceId: string;
  userId: string;
  email: string;
  name: string;
  role: Role;
  canManageKeys: boolean;
  createdAt: string;
}

export interface Invite extends Audited {
  id: string;
  workspaceId: string;
  email: string;
  role: Role;
  status: 'pending' | 'accepted' | 'revoked' | 'declined';
  expiresAt: string;
}

// A pending invite addressed to the current user, enriched for the notification
// bell: the inviting workspace's name + who sent it. Server-built from Invite +
// the workspace + the inviter's UserRef.
export interface MyInvite {
  id: string;
  workspaceId: string;
  workspaceName: string;
  role: Role;
  invitedBy: UserRef;
  createdAt: string;
  expiresAt: string;
}

// Safe transport shape — never carries the encryptedKey.
export interface ApiKeyInfo extends Audited {
  id: string;
  workspaceId: string;
  provider: string;
  last4: string;
}

// A named value a project carries; fills {key} placeholders in step prompts at
// run time. e.g. { key: 'product', value: 'Cozy Plush Pet Sofa' }.
export interface ProjectVariable {
  key: string;
  value: string;
}

export interface Project extends Audited {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  variables: ProjectVariable[];
  status: ProjectStatus;
  shared: ProjectShare; // who a public project reaches
  sharedWith: UserRef[]; // expanded; ids are sent in UpdateProjectDto (when shared='people')
  // Connected-channel ids (from the workspace Connections pool) this project posts
  // to. Any number, any platform mix (a project may hold several YouTube channels).
  // A selection/default for Publish, not an enforced limit.
  channels: string[];
  taskCount?: number; // active tasks on the board — populated in the list view only
  // pipelines now live on a Task (the project is a board of tasks).
  brandKit?: ProjectBrandKit;
}

// Run activity rolled up for a task's board card — populated in the list view.
export interface TaskRunSummary {
  total: number;
  running: number;
  awaitingGate: number;
  done: number;
}

// A unit of work inside a project (the project board's card). Holds the
// pipelines that produce its output; carries a manual status + a single
// optional assignee. Runs scope to (taskId, pipelineId).
export interface Task extends Audited {
  id: string;
  workspaceId: string;
  projectId: string;
  name: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: UserRef; // expanded; assigneeId carried in the DTO (unused in personal workspaces)
  pipelines: string[]; // workspace-library pipeline ids
  tags: string[]; // workspace label names (colour resolved via labelColor)
  runs?: TaskRunSummary; // run activity for the card (list view only)
}

// Fan-out config on a step: map the step's prompt over a named run collection,
// one (parallel) provider call per item. `itemVar` is the token the item fills
// (default "item"); the item is also available as {input}. N is arbitrary — the
// engine maps over however many items the collection holds, capped only by the
// run-time concurrency limit.
export interface FanOutConfig {
  over: string; // name of the run collection to map over
  itemVar?: string; // token for the current item (default 'item')
}

export type ConditionOp = 'eq' | 'ne' | 'contains' | 'exists' | 'empty' | 'gt' | 'lt';

// A guard condition on a step: evaluated against the run's variables at run time.
// If it fails, the step is SKIPPED (no provider call) and the run continues. This
// is the linear, no-DAG form of branching — "run this step only when …".
export interface StepCondition {
  variable: string; // run-variable key to test (e.g. 'product', 'in_stock')
  op: ConditionOp;
  value?: string; // operand (omit for exists/empty)
}

export type ActionStep =
  | { type: ActionType.Brand; position: Corner; size: 'sm' | 'md' | 'lg' }
  | { type: ActionType.Crawl; source: 'input' | 'homepage'; quality?: string }
  | { type: ActionType.Publish; channelIds?: string[]; captionFrom?: string }
  | { type: ActionType.UnitEcon }
  | { type: ActionType.Evaluate }
  | { type: ActionType.SaveProduct; productName?: string }
  | { type: ActionType.Score }
  | { type: ActionType.DemandGate }
  | { type: ActionType.ResolveInputs }
  | { type: ActionType.Competition }
  | { type: ActionType.RiskScreen }
  | { type: ActionType.CustomerJob }
  | { type: ActionType.ReviewMining }
  | { type: ActionType.CreativePotential }
  | { type: ActionType.SupplyChain }
  | { type: ActionType.ValidationPlan };

export interface ProjectBrandKit {
  logoUrl?: string;
  accentColor?: string;
}

export interface Step {
  index: number;
  key?: StepKey; // fixed pipeline only; composable pipeline steps omit it
  name?: string; // composable pipeline step name
  promptId?: string; // composable: the library prompt this step ran
  provider?: Provider; // composable: per-step provider (else derived from key)
  mode: StepMode;
  status: StepStatus;
  model: string;
  prompt: string;
  sentPrompt?: string; // the resolved prompt actually sent (template + filled refs)
  fanOut?: FanOutConfig; // when set, the step maps over a run collection
  condition?: StepCondition; // guard — skip the step when it fails
  result?: string;
  assetIds?: string[];
  // Exact source asset(s) this step operates on (image actions). When set, the
  // run engine feeds these as input images instead of resolving {input}/{step:Name}.
  inputAssetIds?: string[];
  usage?: { tokens?: number; costUsd?: number };
  error?: string;
  startedAt?: string;
  finishedAt?: string;
  cached?: boolean;
  jobId?: string;       // async (video) provider job id, set when a long job is submitted
  progress?: number;    // 0–100, async generation progress (poller updates it)
  evidence?: EvidenceClaim[];
  sources?: SourceRow[];
  data?: Record<string, unknown>;
  kind?: StepKind;
  action?: ActionStep;
}

// A per-run 👍/👎 verdict on the run's overall output. One per run (last-writer-
// wins); `by` is the userId that set it. Seeds the AI builder's few-shot retrieval.
export interface RunRating {
  value: 'up' | 'down';
  by: string;
  at: string; // ISO timestamp
}

export interface Run extends Audited {
  id: string;
  projectId?: string; // absent for a builder "test run" (no project)
  taskId?: string; // the task this run belongs to (absent for a builder test run)
  productId?: string; // a research run targets a product (mutually exclusive with projectId/taskId)
  workspaceId: string;
  pipelineId?: string; // set when the run came from a composable pipeline
  pipelineName?: string;
  context?: { note?: string }; // the pipeline note — the first step's default input
  // Snapshot of token→value resolved into step prompts at run time: the project's
  // variables, pipeline custom vars, and system vars ({note}/{date}). Frozen at run
  // creation so later pipeline/project edits don't leak in.
  variables?: Record<string, string>;
  // Named lists a fan-out step maps over (frozen at creation). Arbitrary length.
  collections?: Record<string, string[]>;
  status: RunStatus;
  currentStep: number;
  steps: Step[];
  rating?: RunRating; // overall thumbs on this run's output (optional)
}

// Media attached to a prompt (sent alongside the prompt to the AI provider).
// `url` references a file stored by the api; `size` is the byte length.
export interface PromptMedia {
  type: MediaType;
  url: string;
  name?: string;
  mime?: string;
  size?: number;
}

// A saved answer kept under a prompt — the child in the prompt→results model.
// Gathered across any chats; `promptSnapshot` records the wording used to produce
// it so an edited prompt doesn't make old results misleading (our lazy stand-in
// for full versioning). `sourceConversationId` is provenance back to the chat.
export interface SavedResult {
  id: string;
  output: string;
  provider: Provider;
  model: string;
  promptSnapshot: string;
  rating?: number;
  note?: string;
  sourceConversationId?: string;
  assetUrl?: string;
  assetType?: 'image' | 'video' | 'audio';
  runId?: string;
  stepIndex?: number;
  createdBy: UserRef;
  savedAt: string;
}

// A reusable prompt in the workspace library.
export interface Prompt extends Audited {
  id: string;
  workspaceId: string;
  title: string;
  content: string;
  status: PromptStatus;
  type: PromptType; // text | image | audio | video (metadata: badge + filter)
  media: PromptMedia[];
  tags: string[];
  // Default provider + model for testing this prompt (pre-selected in the
  // playground). Optional — older prompts have none.
  provider?: Provider;
  model?: string;
  // Curated saved answers (children). The prompt is the durable parent; results
  // accumulate across chats. Empty for prompts that have never had a save.
  results: SavedResult[];
}

// A tag in the workspace vocabulary plus how many visible prompts carry it.
export interface TagCount {
  value: string;
  count: number;
}

// A prompt author in the visible prompt vocabulary plus prompt count.
export interface PromptAuthorCount {
  id: string;
  name: string;
  count: number;
}

// A prompt output-type in the visible vocabulary plus prompt count — drives the
// Prompts page type-pill row.
export interface PromptTypeCount {
  type: PromptType;
  count: number;
}

// Prompts list sort order.
export type PromptSort = 'updated' | 'az';

// A provider in the visible prompt vocabulary plus how many prompts use it.
// Drives the (stable, full-library) provider filter on the Prompts page.
export interface ProviderCount {
  provider: Provider;
  count: number;
}

// A workspace label: a reusable, colour-coded tag owned by the workspace.
// Prompts/pipelines reference labels by `name` (their `tags`); the colour is
// resolved from the workspace's labels (see labelColor()).
export interface LabelInfo {
  id: string;
  name: string;
  color: string;
}

// A page of results from a paginated list endpoint.
export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// ===== Chats (conversations) =====
// A chat is a Claude-style multi-turn conversation in the workspace. Every turn
// is a prompt→answer exchange stamped with the provider·model that produced it.
// Chats are the iteration workshop; good prompts get promoted to the library.
export type ChatRole = 'user' | 'assistant';

export interface ConversationMessage {
  id: string;
  role: ChatRole;
  content: string;
  media?: PromptMedia[];
  provider: Provider;
  model: string;
  usage?: { tokens?: number; costUsd?: number };
  error?: string;
  createdAt: string;
}

// The full conversation with its message thread (the detail view).
export interface Conversation extends Audited {
  id: string;
  workspaceId: string;
  title: string;
  provider: Provider;
  model: string;
  originPromptId?: string; // the library prompt this chat was opened from
  starred: boolean;
  messages: ConversationMessage[];
}

// A lightweight list item for the chat-history sidebar (no message bodies).
export interface ConversationSummary {
  id: string;
  title: string;
  provider: Provider;
  model: string;
  originPromptId?: string;
  starred: boolean;
  messageCount: number;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ===== Composable pipelines =====
// One node in a pipeline: a library prompt run on a chosen provider·model, in
// auto or gate (pause-for-approval) mode. Steps are inline in the pipeline.
export interface PipelineStep {
  id: string;
  name: string;
  promptId: string;
  provider: Provider;
  model: string;
  mode: StepMode;
  fanOut?: FanOutConfig; // map this step over a run collection (parallel, N items)
  condition?: StepCondition; // guard — skip this step when it fails
  kind?: StepKind;
  action?: ActionStep;
}

// A user-defined variable for a pipeline. Any step prompt can reference it as
// {key}; its value is entered when a run starts (prefilled from `default`), then
// resolved into the prompts at run time alongside project + system vars.
export interface PipelineVariable {
  key: string; // token name, e.g. "tone" → referenced as {tone}
  label?: string; // human label for the run-start form / composer chip
  default?: string; // prefilled value
}

// A reusable workspace-library pipeline: an ordered, linear chain of steps.
// Assigned to projects (many-to-many) and run in a project's context.
// Where a pipeline came from. `ai` records the goal + model that generated it —
// the seed for future "learn from good pipelines" retrieval. Manual pipelines
// omit it (treated as source: 'manual').
export interface PipelineOrigin {
  source: 'ai' | 'manual';
  goal?: string;
  model?: string;
}

export interface Pipeline extends Audited {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  tags: string[];
  steps: PipelineStep[];
  variables: PipelineVariable[];
  origin?: PipelineOrigin;
}

export interface Asset {
  id: string;
  runId: string;
  workspaceId: string;
  stepIndex: number;
  type: 'image' | 'video' | 'audio';
  url: string;
  thumbUrl?: string;
  meta?: Record<string, unknown>;
  approved?: boolean;
}

// ===== Built-in connectors (publish + media import) =====
// Lyra holds the UI + a thin proxy; the connector logic lives in a separate
// microservice (Postiz for publish, Cobalt for download). These are the shapes
// the proxy ↔ microservice contract exchanges.
export interface ConnectorInfo {
  id: string;
  label: string;
  platforms: string[];
}

export interface Channel {
  id: string;
  type: ChannelType; // how it publishes — Postiz pool vs GoLogin browser
  platform: string; // 'tiktok' | 'instagram' | 'youtube' | 'facebook' | ...
  displayName: string;
  // GoLogin-only config (present when type === 'gologin'): the logged-in profile to
  // drive, and an optional proxy label for reference. Postiz channels carry neither.
  profileId?: string;
  proxy?: string;
  // When the channel was added (GoLogin channels only; Postiz pool channels have none).
  createdAt?: string;
  // Activity rolled up from project posts targeting this channel.
  postCount?: number;
  lastPostAt?: string;
}

// One published-post outcome per target channel (partial failure tolerated).
export interface Receipt {
  platform: string;
  accountId: string;
  url?: string;
  postId?: string;
  status: 'ok' | 'failed';
  error?: string;
}

// Publish runs as a job; the UI polls jobs/:jobId until done/failed.
export interface PublishJob {
  jobId: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  receipts?: Receipt[];
}

// A recorded publish to a project's channels — the project's post history. Created
// when a project-scoped publish finishes; `targets` are the per-channel receipts and
// `status` is their roll-up (all ok / mixed / all failed).
export interface PublishedPost {
  id: string;
  workspaceId: string;
  projectId: string;
  caption: string;
  mediaUrls: string[];
  channelIds: string[]; // channels this post was published to (for per-channel stats)
  targets: Receipt[];
  status: 'ok' | 'partial' | 'failed';
  createdBy: UserRef;
  createdAt: string;
}

// A selectable download quality for a MediaItem, derived from yt-dlp's format
// list. `format` is the yt-dlp -f selector to pass back on download.
export interface MediaQuality {
  label: string; // "1080p", "720p", … or an audio label
  format: string; // yt-dlp -f selector, e.g. "bv*[height<=720]+ba/b[height<=720]"
  height?: number; // video height; omitted for audio-only
  approxBytes?: number; // best-effort size hint for the label
}

// One resolved media item from a download/resolve (carousels return many).
export interface MediaItem {
  index: number;
  type: 'video' | 'image' | 'audio';
  thumbUrl?: string;
  filename?: string;
  qualities?: MediaQuality[]; // present for videos; undefined for images/playlists
}

// A running/finished media-download job, polled by the web for live progress.
export interface DownloadJob {
  jobId: string;
  status: 'running' | 'done' | 'error';
  pct: number; // 0..100, latest yt-dlp progress (resets per file across video+audio)
  items?: { url: string; filename: string }[]; // present when status === 'done'
  error?: string; // present when status === 'error'
}

// Safe transport shape for a workspace's stored Crawler cookies.txt — reports only
// whether one is set (never the cookie contents, which are session secrets).
export interface CrawlerCookieInfo {
  present: boolean;
  updatedAt?: string;
}

// Safe transport shape for a stored connector credential (e.g. the Postiz API
// key) — reports only whether it's set + a last-4 hint, never the key itself.
export interface ConnectorCredentialInfo {
  connector: string; // e.g. 'postiz'
  connected: boolean;
  last4?: string;
}

// ===== Prompt marketplace =====
// A community prompt in the global, read-only marketplace catalog (imported from
// prompts.chat, CC0). NOT a workspace Prompt — a lightweight draft a user can
// browse and adopt into their own library.
export interface MarketplacePrompt {
  id: string;
  title: string;
  description?: string; // short summary (from the source), shown above the body
  content: string;
  type: 'text' | 'structured';
  forDevs: boolean;
  contributor?: string;
  source: string; // e.g. 'prompts.chat'
  category?: string; // source category (e.g. 'Marketing', 'Image Generation')
  variables: string[]; // placeholder names parsed from the body
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// A marketplace prompt plus why the AI filter ranked it for the user's request.
export interface RankedMarketplacePrompt {
  prompt: MarketplacePrompt;
  score: number; // 0-100 relevance
  reason: string; // one-line rationale
}

// Filter vocabularies for the marketplace browse filter (distinct categories +
// tags across the catalog), plus per-category counts + the catalog total that
// drive the category-pill row.
export interface MarketplaceFacets {
  categories: string[];
  tags: string[];
  total: number;
  categoryCounts: { name: string; count: number }[];
}

// Browse sort order. ("Most adopted" needs adoption tracking the catalog doesn't
// have yet, so it's intentionally absent.)
export type MarketplaceSort = 'az' | 'newest';

// ===== Super-admin panel =====
// Per-user usage counts (items the user created), shown in the admin user detail.
export interface AdminUserUsage {
  projects: number;
  pipelines: number;
  prompts: number;
  runs: number;
  chats: number;
}

// A user row in the admin Users list.
export interface AdminUserSummary {
  id: string;
  email: string;
  name: string;
  active: boolean;
  isAdmin: boolean;
  workspaceCount: number;
  createdAt: string;
}

// Full admin view of one user: workspaces + usage breakdown.
export interface AdminUserDetail extends AdminUserSummary {
  updatedAt: string;
  workspaces: { id: string; name: string; role: Role }[];
  usage: AdminUserUsage;
}

// Platform-wide counts + recent signups for the admin Overview dashboard.
export interface AdminOverview {
  users: number;
  workspaces: number;
  projects: number;
  pipelines: number;
  prompts: number;
  runs: number;
  chats: number;
  signups30d: number;
  recentSignups: AdminUserSummary[];
}

// A user's submission to the platform admins (provider request now, bug report
// later — same collection, keyed by `type`). Safe transport shape: `voteCount`
// is derived server-side from the voters list; the raw voter ids stay server-only.
// `createdBy` (from Audited) is the requester.
export interface UserRequest extends Audited {
  id: string;
  type: RequestType;
  subject: string; // provider name (or bug title)
  body: string; // optional details/note
  status: RequestStatus;
  adminNote?: string; // admin's reply / reason
  workspaceId?: string; // context it was sent from
  voteCount: number; // reserved for the upcoming request-voting board
}

export interface Competitor {
  id: string; workspaceId: string; brand: string; domain?: string; niche: string;
  status: CompetitorStatus; lastError?: string; lastCrawledAt?: string;
  createdAt: string; updatedAt: string;
}
export interface AdvertiserHandle {
  id: string; workspaceId: string; competitorId: string; platform: MonitorPlatform; advertiserId: string; resolvedAt: string;
}
export interface MonitorAd {
  id: string; workspaceId: string; competitorId: string; platform: MonitorPlatform; adId: string;
  creativeUrl?: string; copy?: string; format?: string; status: AdStatus;
  firstSeen: string; lastSeen: string; daysRunning: number;
}
export interface AdEvent {
  id: string; workspaceId: string; competitorId: string; platform: MonitorPlatform; adId: string; event: AdEventType; date: string;
}
export interface MonitorStats { newToday: number; stoppedToday: number; watching: number }
export interface CompetitorChangelog { competitorId: string; brand: string; newAds: MonitorAd[]; ongoing: MonitorAd[]; stopped: MonitorAd[] }

// ── Product research: evidence ledger (spec §1B) ───────────────────────────
export type ConfidenceKind = 'verified' | 'calculated' | 'estimate' | 'assumption';

export interface EvidenceClaim {
  id: string;
  statement: string;
  value?: number | string;
  kind: ConfidenceKind;
  sourceId: string;
  geography?: string;
  period?: string;
  demandSignal?: boolean;
  purchaseData?: boolean;     // direct sales signal (Amazon Movers, TikTok Shop) → grade A
  quote?: string;            // verbatim supporting span copied from the cited source
}

export interface SourceRow {
  id: string;
  name: string;
  url: string;
  accessDate: string;
  geography?: string;
  metric?: string;
  primary: boolean;
  reliabilityNote?: string;
  alive: boolean;
}

// ── Unit economics (spec §1D) ──────────────────────────────────────────────
export interface UnitEconInputs {
  aov: number;
  landedCost: number;
  paymentFeePct: number;
  fulfillment: number;
  shippingSubsidy: number;
  expectedReturnLossPct: number;
  warrantyReservePct: number;
  desiredPostAdCmPct: number;
}
export interface UnitEcon {
  cm1: number;
  cm1Pct: number;
  breakEvenRoas: number;
  maxCac: number;
  targetRoas: number;
}

// ── Competition scan (resolve-inputs + competition actions) ───────────────
export interface ResearchCompetitor { name: string; price?: string; offer?: string; reviews?: string; strengths?: string; }
export interface CompetitionData {
  competitors: ResearchCompetitor[];
  marketType: 'healthy' | 'dominated' | 'commodity' | 'emerging' | 'underserved';
}

export interface RiskFlags { unresolvedSafety: boolean; materialIpRisk: boolean; misleadingClaimsRequired: boolean; }
export interface Scenarios { low: UnitEcon; base: UnitEcon; high: UnitEcon; plus10Cac: UnitEcon; plus10Landed: UnitEcon; doubleReturns: UnitEcon; }

export interface CustomerJob { customer: string; job: string; problem: string; alternative: string; trigger: string; }
export interface ReviewMining { complaints: string[]; desiredFeatures: string[]; objections: string[]; }
export interface CreativeConcept { hook: string; angle: string; }
export interface SupplyChainInfo { suppliers: string[]; moq?: string; leadTime?: string; certs: string[]; notes: string[]; }

export interface ValidationPlan {
  offer: string;
  landingPageHypothesis: string;
  creatives: string[];
  channel: string;
  testBudget?: number;
  decisionRule: string;
}

// ── Scoring / grading / decision (spec §1E) ────────────────────────────────
export type ConfidenceGrade = 'A' | 'B' | 'C' | 'D';
export interface HardGates {
  unresolvedSafety: boolean;
  materialIpRisk: boolean;
  negativeUnitEcon: boolean;
  cpaExceedsMaxCac: boolean;
  singleSourceDemand: boolean;
  misleadingClaimsRequired: boolean;
}
export type Decision = 'TEST_NOW' | 'RESOLVE_GAPS' | 'LOW_COST_VALIDATION' | 'PARK' | 'REJECT';

// ── Product (project-owned durable opportunity; spec §4) ───────────────────
export interface ProductEconInputs {
  targetPrice?: number;
  testingBudget?: number;
  inventoryBudget?: number;
  minPreAdCmPct?: number;
  desiredPostAdCmPct?: number;
}
export interface ProductSource {
  platform?: string;
  url?: string;
}
// ── Storyboard (P3 artifact — per-task video creative plan) ──────────────────
export interface StoryboardFrame {
  index: number;
  narration: string;            // VO / on-screen text for this beat
  imagePrompt: string;          // prompt for the frame's visual
  mediaType: 'image' | 'video';
  assetId?: string;             // generated visual (Lyra Asset) — per-frame addressable (set in P4)
  durationSec: number;          // derived from narration audio / clip (estimated until P4)
  templateParams?: Record<string, unknown>;
}

export interface Storyboard {
  title: string;
  aspect: '9:16' | '1:1' | '16:9';
  template: string;             // brand template id, e.g. 'ugc-9x16'
  templateParams: Record<string, unknown>; // brand-kit-derived
  audio?: { voiceId?: string; speed?: number; bgmId?: string };
  frames: StoryboardFrame[];
  totalDurationSec?: number;
}

export interface Product {
  id: string;
  workspaceId: string;
  projectId?: string;            // legacy/back-compat only; pool products have none
  originatingProjectId?: string; // provenance: the project a product first came from
  poolProductId?: string;   // a project copy points to its pool product
  poolSnapshotAt?: string;  // ISO; when the copy's info/images were last snapshotted
  drift?: boolean;          // view-only: copy's frozen info differs from the pool product now
  name: string;
  description: string;
  source?: ProductSource;
  niche?: string;
  category?: string;
  status: ProductStatus;
  evidence: EvidenceClaim[];
  sources: SourceRow[];
  unitEcon?: UnitEcon;
  subScores?: SubScores;
  score?: number;
  grade?: ConfidenceGrade;
  decision?: Decision;
  hardGates?: HardGates;          // which dealbreaker gates were evaluated (explains the decision)
  unitEconInputs?: UnitEconInputs; // the cost inputs CM1 was computed from (explains the economics)
  assumptions?: string[];        // econ defaults the run had to assume (resolve-inputs)
  competition?: CompetitionData; // competitor scan + market type
  riskFlags?: RiskFlags;   // dealbreaker screen (drives the REJECT gates)
  riskNotes?: string[];    // why each risk flag was raised
  scenarios?: Scenarios;   // unit-econ sensitivities
  customerJob?: CustomerJob;
  reviewMining?: ReviewMining;
  creativeConcepts?: CreativeConcept[];
  supplyChain?: SupplyChainInfo;
  validationPlan?: ValidationPlan;
  econInputs?: ProductEconInputs;
  competitorIds: string[];
  outcome?: string;
  tags: string[];
  results?: SavedResult[];
  active: boolean;
  createdBy: UserRef;
  updatedBy: UserRef;
  createdAt: string;
  updatedAt: string;
  images?: string[];
  price?: number;
  compareAtPrice?: number;
  offer?: string;
}

export interface Memory {
  id: string;
  workspaceId: string;
  userId?: string;
  kind: MemoryKind;
  text: string;
  subjectType?: 'project' | 'product' | 'brand' | 'pipeline' | 'global';
  subjectId?: string;
  relatedIds?: string[];
  dedupeKey?: string;
  confidence: number;
  provenance: 'explicit' | 'inferred';
  source?: { conversationId?: string; runId?: string };
  supersedes?: string;
  active: boolean;
  createdBy: UserRef;
  updatedBy: UserRef;
  createdAt: string;
  updatedAt: string;
}
