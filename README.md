# 3D Avatar Roadmap

This document outlines opportunities to evolve the 3D Avatar application into a platform that can eventually surpass Blender for key creator workflows. See [`docs/implementation-plan.md`](docs/implementation-plan.md) for the detailed execution plan, audit findings, and prioritised backlog, and [`docs/engineering-scaffolding-proposal.md`](docs/engineering-scaffolding-proposal.md) for the engineering scaffolding blueprint that operationalises the audit recommendations.

## Repository Structure

Initial scaffolding has been added to reflect the proposed monorepo layout and provide landing zones for upcoming workstreams:

- `apps/` — Application entry points including the web studio, API gateway, and automation worker.
- `packages/` — Shared libraries such as the design system, avatar engine, collaboration SDK, and AI clients.
- `infra/` — Infrastructure-as-code assets split between Terraform modules and Kubernetes manifests.
- `tools/` — Developer tooling, automation scripts, and shared CI/CD workflows.
- `docs/decision-records/` — Architecture decision records and spike summaries.

### Getting Started

The monorepo is configured as an npm workspace. After installing dependencies with `npm install`, you can explore the live scaffolding:

- `npm run dev` – Boots the studio, API gateway, and automation worker simultaneously for a full-stack local environment.
- `npm run dev --workspace @3d-avatar/studio` – Launches the Vite-powered web studio that composes the design system and avatar engine preview.
- `npm run dev --workspace @3d-avatar/api-gateway` – Starts the API gateway with REST and GraphQL endpoints backed by shared packages.
- `npm run dev --workspace @3d-avatar/automation-worker` – Runs the queue-driven worker that simulates render and AI pose jobs.
- `npm run lint` – Executes the shared ESLint configuration across every workspace to surface regressions early.

Each package exposes build and lint scripts so individual teams can iterate independently while still sharing code across the
workspace.

### Session persistence during development

The API gateway now snapshots collaboration sessions to disk so that pose history and participant rosters survive restarts. The
development orchestrator (`npm run dev`) sets `SESSION_STORE_PATH=data/dev-sessions.json` automatically, but you can override the
path when running the gateway directly:

```
SESSION_STORE_PATH=/tmp/avatar-sessions.json npm run dev --workspace @3d-avatar/api-gateway
```

The generated `data/` directory is ignored by Git, keeping local session history out of commits.

## Vision

Deliver a creator-friendly environment that prioritises approachability, intelligent automation, and connected experiences so newcomers become productive immediately while experts benefit from streamlined, AI-assisted workflows.

## Key Differentiators to Pursue

1. **Onboarding & Guidance**
   - Interactive, task-based tutorials generated from user goals.
   - Contextual UI tips that learn from common mistakes and proactively surface corrections.
   - Progressive disclosure that keeps the interface minimal until advanced tools are needed.

2. **AI-Assisted Creation**
   - Natural-language prompts that generate base meshes, rigs, and animation blocking for avatars.
   - Pose and facial expression libraries enhanced with generative AI for rapid iteration.
   - Automated clean-up tools (retopology, weight painting, UV unwrapping) driven by machine learning.

3. **Real-Time Collaboration**
   - Multiplayer editing sessions with per-user cursors, annotations, and voice chat.
   - Version history with granular diffing of mesh, material, and animation changes.
   - Shared asset workspaces with role-based permissions for teams and communities.

4. **Cross-Platform Accessibility**
   - Browser-first experience powered by WebGPU for high-fidelity rendering without installs.
   - Cloud-backed compute for heavy operations (bakes, simulations) so creators can work on lightweight devices.
   - Companion mobile app for reviewing, annotating, and approving assets on the go.

5. **Immersive XR Workflows**
   - Native VR sculpting and layout tools with haptic feedback support.
   - AR preview pipeline that places avatars in real-world environments for client reviews.
   - Mixed-reality capture that translates real performances into avatar animations in real time.

6. **Integrated Marketplace & Ecosystem**
   - Curated store for avatar parts, materials, motion clips, and procedural effects with revenue sharing.
   - One-click import/export bridges to major engines (Unity, Unreal, Roblox, Omniverse) and social platforms.
   - Open plugin API so the community can extend tools, shaders, and automation scripts.

7. **Production-Ready Pipeline**
   - Automated QA checks for topology, naming conventions, and rigging standards.
   - Render farm orchestration with physically based and stylised pipelines, including NPR shaders.
   - Built-in analytics on avatar performance metrics (poly budget, memory, animation complexity).

## Next Steps Overview

1. **Complete the Codebase Audit:** Inventory existing assets and architecture, filling gaps documented in the [implementation plan](docs/implementation-plan.md#1-codebase-audit-summary).
2. **Deliver Quick Wins:** Execute the P0 initiatives (guided onboarding tutorial, AI pose suggestions) outlined in the [backlog](docs/implementation-plan.md#2-quick-win-backlog) to demonstrate early differentiation.
3. **Launch Pilot Creator Program:** Follow the structured engagement approach in the [pilot plan](docs/implementation-plan.md#3-pilot-creator-program) to collect targeted feedback.
4. **Invest in Technical Foundations:** Begin the foundational workstreams in the [technical roadmap](docs/implementation-plan.md#4-technical-foundations-roadmap) to enable extensibility, collaboration, and performance.

By focusing on intuitive experiences, intelligent assistance, and networked collaboration, this roadmap positions the 3D Avatar app to outpace Blender in creator velocity and accessibility while the new implementation plan ensures concrete execution steps.
