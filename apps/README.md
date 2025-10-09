# Apps

Application entry points that ship user-facing experiences and services. Each app is self-contained with its own runtime configuration, but shares tooling via the monorepo build system.

- [`studio/`](studio/): Browser-based editor experience powered by React, Vite, and WebGPU abstractions.
- [`api-gateway/`](api-gateway/): Node.js GraphQL/REST gateway that fronts domain services and real-time transports.
- [`automation-worker/`](automation-worker/): Queue-driven worker handling rendering, AI inference, and other heavy jobs.
