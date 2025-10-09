# Engineering Proposal: 3D Avatar Project Scaffolding

## 1. Objectives
- Establish production-ready repository scaffolding that accelerates delivery of roadmap differentiators.
- Provide shared patterns for front-end, back-end, and infrastructure teams to collaborate with minimal friction.
- Bake in quality, security, and observability guardrails from day one so future features inherit a stable foundation.

## 2. Guiding Principles from Audit Findings
- **Start with a modular monorepo** to organise client, server, and shared packages—addressing the current absence of structure called out in the audit.
- **Bias toward web-native tech** (React, WebGPU, WebAssembly) to realise the browser-first vision and avoid native install friction.
- **Design for extensibility** through clearly defined APIs and plugin boundaries, enabling marketplace growth without rewrites.
- **Instrument everything** with automated testing, linting, and deployment pipelines to prevent regressions once collaboration and AI features arrive.

## 3. Proposed Repository Layout
```
/
├── apps/
│   ├── studio/                 # Web editor (React + Vite + WebGPU abstraction)
│   ├── api-gateway/            # Node.js GraphQL/REST gateway exposing domain services
│   └── automation-worker/      # Queue-driven worker (Rust or Node) for heavy jobs (renders, AI tasks)
├── packages/
│   ├── design-system/          # Shared UI components, theming, tutorial widgets
│   ├── avatar-engine/          # Three.js/WebGPU engine, scene graph utilities, plugin hooks
│   ├── collaboration-sdk/      # CRDT sync layer, real-time transport utilities
│   └── ai-clients/             # API clients for pose generation, mesh generation, inference wrappers
├── infra/
│   ├── terraform/              # Cloud infra as code (networking, managed databases, GPU nodes)
│   └── k8s/                    # Kubernetes manifests / Helm charts for services
├── tools/
│   ├── scripts/                # CLI scaffolding, codegen, asset validation utilities
│   └── github-actions/         # Shared workflows (lint, build, deploy)
└── docs/
    └── decision-records/       # Architecture decision logs, spike outcomes
```

The repository now contains stub directories with documentation readmes for each of the above areas so teams can begin dropping
in source code, infrastructure definitions, and decision records without further scaffolding work.

## 4. Technology Stack
| Layer | Recommendation | Rationale |
| --- | --- | --- |
| Front-end | React + Vite + TypeScript, Zustand for state, Three.js with WebGPU renderer | Fast iteration, strong ecosystem, matches web-first goal. |
| Rendering Core | Custom renderer abstraction supporting WebGPU primary / WebGL2 fallback | Enables experimentation while maintaining compatibility. |
| Back-end | Node.js (TypeScript) with Fastify/GraphQL, PostgreSQL + Redis, gRPC for internal services | Familiar for web teams, performant enough for MVP, extendable for microservices later. |
| Realtime | WebSocket gateway using Colyseus or custom Yjs provider | Supports collaborative editing needs. |
| AI Integrations | gRPC/REST clients to hosted inference (OpenAI, Stability, NVIDIA), optional on-prem containers | Aligns with audit call for AI service boundaries. |
| Worker Jobs | Temporal.io or BullMQ for orchestration, containerised GPU workloads | Handles rendering, AI, and baking tasks reliably. |
| DevOps | Nx or Turborepo for task orchestration, pnpm for package management | Optimises monorepo builds and caching. |
| Observability | OpenTelemetry, Grafana Cloud, Sentry | Ensures early monitoring for complex workflows. |

## 5. Development Environment Plan
- **Bootstrap script** (`pnpm dlx create-3d-avatar`) to install dependencies, generate `.env` templates, and seed demo assets.
- **Containerised services** using `docker-compose` for local Postgres, Redis, and MinIO (asset storage).
- **Storybook** integrated with design system for rapid iteration on tutorial UI components.
- **Playwright + Vitest** for end-to-end and unit testing baked into CI.
- **Pre-commit hooks** (lint-staged, commitlint) enforcing code style and semantic commit messages.

## 6. Incremental Delivery Phases
1. **Foundation (Weeks 1-3)**
   - Scaffold monorepo with pnpm + Turborepo, configure lint/test/build pipelines.
   - Implement authentication skeleton (Auth0/Cognito) and basic user session context.
   - Deliver placeholder studio app with scene viewport + plugin panel layout.
2. **Enablement (Weeks 4-6)**
   - Integrate CRDT collaboration SDK in beta, implement presence indicators.
   - Build AI service proxy with feature flags for pose suggestion MVP.
   - Stand up asset storage service and worker queue for offline processing.
3. **Acceleration (Weeks 7-10)**
   - Harden plugin sandbox (WebAssembly) with permission manifest.
   - Add WebGPU renderer prototype with metrics logging and fallback detection.
   - Finalise CI/CD to staging + nightly test suites (render regression, visual diffing).

## 7. Governance & Documentation
- Maintain Architecture Decision Records (ADRs) for major stack choices.
- Host weekly tech reviews with tiger team to adapt scaffolding backlog.
- Use shared dashboards to track DORA metrics, test pass rates, and pilot feedback ingestion.

## 8. Risks & Mitigations
| Risk | Impact | Mitigation |
| --- | --- | --- |
| WebGPU immaturity on some devices | Rendering failures for pilot creators | Implement WebGL2 fallback path and device capability detection early. |
| Plugin sandbox security vulnerabilities | Potential data leakage or service disruption | Enforce strict WASM capability-based security model, run fuzz testing in CI. |
| Monorepo build complexity | Slow developer feedback loops | Use remote caching (Nx Cloud) and incremental builds, document best practices. |
| Cross-team coordination overhead | Delayed P0 quick wins | Tiger team RACI, shared OKRs, weekly demos to maintain alignment. |

## 9. Next Steps
- Finalise technology selections with architecture review board by end of Week 2.
- Break proposal into epics/tasks in Jira, aligned with quick-win deliverables.
- Kick off scaffolding sprint with tiger team once resources confirmed.
