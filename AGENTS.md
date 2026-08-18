# Repository Instructions for Coding Agents

Read `START-HERE.md` before bootstrapping a project. This file contains repository-wide working rules. Keep detailed facts in their owning documents.

## Source of Truth

- Product goals, scope, users, journeys, and business rules: `PROJECT.md`
- System boundaries, stack, runtime, integrations, and environments: `ARCHITECTURE.md`
- Database schema, relations, constraints, indexes, and migrations: `docs/data-model.md`
- HTTP APIs, events, background jobs, webhooks, and external contracts: `docs/api-contracts.md`
- Authentication, authorization, secrets, threats, and data protection: `docs/security.md`
- Routes, UI flows, states, visual system, responsive behavior, and accessibility: `DESIGN.md`
- Feature behavior and acceptance criteria: applicable files in `docs/features/`
- Test commands and quality gates: `docs/testing.md`
- Deployment, rollback, backup, monitoring, and operations: `docs/deployment.md`
- Durable decisions and trade-offs: `docs/decisions.md`
- Active substantial work: `docs/execution-plan.md`
- Current implementation state: `docs/status.md`

Executable schemas, migrations, generated contracts, infrastructure code, tests, and application code describe the current implementation. The documents above describe intended behavior. When they conflict, report the conflict and update the correct source deliberately. Never silently choose whichever version is more convenient.

## Verified Commands

Replace placeholders only after running the command successfully in the intended environment.

| Purpose | Command | Verified on |
|---|---|---|
| Install dependencies | `[command]` | `[date/environment]` |
| Start development | `[command]` | `[date/environment]` |
| Lint | `[command]` | `[date/environment]` |
| Typecheck | `[command]` | `[date/environment]` |
| Unit tests | `[command]` | `[date/environment]` |
| Integration tests | `[command]` | `[date/environment]` |
| End-to-end tests | `[command]` | `[date/environment]` |
| Build production artifact | `[command]` | `[date/environment]` |
| Apply local migrations | `[command]` | `[date/environment]` |
| Seed local data | `[command]` | `[date/environment]` |

## Working Rules

1. Inspect relevant code, configuration, schema, tests, and docs before changing behavior.
2. Label material facts as Confirmed, Inferred, Proposed, or Unknown during planning.
3. Never invent roles, permissions, fields, statuses, endpoints, business rules, environment variables, credentials, or deployment facts.
4. Use low-risk reversible defaults only when allowed by `START-HERE.md`, and record them as Proposed.
5. Make the smallest coherent change. Do not mix unrelated refactors into feature work or bug fixes.
6. Follow established repository patterns unless an explicit decision changes them.
7. Validate untrusted input at every system boundary. Keep internal contracts typed where the stack supports it.
8. Enforce authorization server-side and at the data boundary where applicable. Hidden UI is not access control.
9. Do not weaken validation, authorization, schema constraints, or tests merely to make a change pass.
10. Do not add or upgrade production dependencies without documenting purpose, risk, maintenance impact, and alternatives considered.
11. Never expose secrets or real personal data in source, logs, fixtures, screenshots, prompts, or documentation.
12. Update the owning document whenever behavior, schema, public contracts, security, architecture, or deployment changes.
13. Prefer executable enforcement through types, constraints, tests, lint, policy checks, and CI over prose-only rules.
14. Report every validation command actually run and its result. Never claim an unrun check passed.

## Planning Threshold

Use `docs/execution-plan.md` when work:

- spans more than one subsystem;
- changes database schema or persisted meaning;
- changes public APIs, events, jobs, permissions, or external integrations;
- requires migration, rollout sequencing, feature flags, or rollback planning;
- materially changes security, performance, reliability, or deployment;
- cannot be completed safely as one small, reviewable change.

## Definition of Done

A change is complete only when all applicable conditions are satisfied:

- acceptance criteria are met with evidence;
- required lint, typecheck, tests, and production build pass;
- validation, authorization, boundary, loading, empty, error, retry, and destructive cases are handled;
- schema changes include safe migrations, constraints, indexes, data preservation, and rollout notes;
- API and event changes preserve or explicitly migrate compatibility;
- logs contain useful diagnostic context without secrets or sensitive data;
- deployment, configuration, and operational documentation remain accurate;
- no dead code, debug artifacts, unrelated edits, or undocumented dependencies remain;
- `docs/status.md` and the active execution plan reflect reality.
