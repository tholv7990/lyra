# Lyra manual QA run

Date: 2026-06-18  
Environment: local app at `http://localhost:5173`  
Tester: Codex via in-app browser  
Checklist source: `docs/qa-application-test-checklist-2026-06-18.md`

## Summary

- Result: PASS for executed manual UI checks.
- Executed checks: 23
- Passed: 23
- Failed: 0
- Blocked/not run: destructive flows, multi-account permission flows, provider
  spend/streaming sends, key mutation, password reset email delivery, and deploy
  infrastructure checks.

Automated baseline already run separately:

```powershell
pnpm.cmd turbo run test
pnpm.cmd turbo run lint type-check test build
```

Both passed earlier in this session.

## Passed checks

| Area | Result | Evidence |
|---|---:|---|
| Home route | PASS | `/` rendered with Home breadcrumb, active Home nav, no horizontal overflow. |
| Chats route | PASS | `/chats` rendered chat list/composer content with active Chats nav. |
| Prompts route | PASS | `/prompts` rendered prompt rows and actions. |
| Pipelines route | PASS | `/pipelines` rendered pipeline rows and actions. |
| Projects route | PASS | `/projects` rendered project rows and actions. |
| Settings route | PASS | `/settings` rendered preferences/provider keys/models content. |
| Settings sections | PASS | Preferences, Provider keys, and Models sections visible. |
| Sidebar navigation | PASS | Home, Chats, Prompts, Pipelines, Projects, Members soon, and Settings visible. |
| Preferences controls | PASS | Language, System, Light, and Dark controls visible. |
| Prompts list controls | PASS | Filter, add, rows, detail eye, open-in-chat, label, and delete actions visible. |
| Pipelines list controls | PASS | Filter, Build with AI, add, rows, open, label, and delete actions visible. |
| Projects list controls | PASS | Filter, add, rows, open, and delete actions visible. |
| Projects inline name edit | PASS | Temporary name edit persisted after reload. |
| Projects inline description edit | PASS | Temporary description edit persisted after blur and reload. |
| Projects cleanup | PASS | Temporary inline edits restored to original values after test. |
| Project row actions | PASS | Pencil/edit icon absent; open/delete actions remain. |
| New project validation | PASS | `/projects/new` create action disabled with empty required fields. |
| New prompt validation | PASS | `/prompts/new` create action disabled with empty required fields. |
| New pipeline validation | PASS | `/pipelines/new` create action disabled with empty required fields. |
| Prompt details modal | PASS | Prompt eye opened full prompt modal with editable textarea. |
| Project detail | PASS | Project detail opened and showed editable summary, variables, and pipelines. |
| Pipeline builder | PASS | Existing pipeline opened with Start/End flow canvas and controls. |
| Mobile layout | PASS | `/chats`, `/prompts`, `/pipelines`, `/projects`, and `/settings` fit at `390x844` with no horizontal overflow. |

## Notes

- One first attempt at combined project description testing reloaded before the
  textarea blur completed. A focused retest with an explicit blur confirmed the
  description save works and the value was cleaned up afterward.
- The manual pass intentionally avoided deleting real records, mutating provider
  keys, sending provider chat messages, running paid/provider-backed pipelines,
  and changing account password/session state.

## Not run yet

- Signup/login/logout/password reset end-to-end using a fresh test account.
- Workspace switcher with multiple workspaces.
- Multi-user permission checks for owner/member/non-owner behavior.
- Provider key create/update/delete permission checks.
- Real chat send and SSE stream with provider response.
- Save as prompt from a live assistant message.
- Prompt/pipeline/project delete confirmation and deletion.
- Full pipeline run, gate approval, stop/reset, asset download, and zip download.
- File upload/download.
- Deployment/production health, Mongo indexes, and migration checks.
