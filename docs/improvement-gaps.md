# Improvement Focus Areas

This document captures the largest gaps between the current prototypes and a production-ready engine so the team can prioritize the next wave of work.

## Rendering System
- The micro-polygon renderer only performs geometric subdivision and heuristic cost estimation on the CPU; it never drives a GPU pipeline, manages shaders, or outputs frames, so we need a real render backend abstraction (e.g., Vulkan/DirectX) with command submission, shader compilation, and framegraph management. 
- Adaptive quality today just tweaks numeric thresholds. We still lack temporal reprojection, visibility buffers, surface caching, and instrumentation hooks to feed hardware counters back into quality decisions.
- There is no integration with material or lighting systems, so the renderer cannot evaluate BRDFs, shadow maps, or global illumination.

## Asset Streaming
- `StreamingTextureCache` only tracks metadata in-memory. We still need asynchronous IO, residency feedback from the GPU, virtual texture page tables, and compression/decompression stages to make the cache useful for high-resolution assets.
- Asset validation stops at size and priority fields. We should add format-specific validation (e.g., KTX2 headers, USD variant integrity) and schema evolution handling to harden ingest.

## Collaboration & Plugins
- `CollaborativeSession` keeps state in-process with no persistence, network transport, or causality tracking across servers. We need a realtime service (WebSocket/QUIC), presence replication, and CRDT/OT convergence testing under packet loss.
- Permission handling is hard-coded and cannot express project-specific rules or audit policies. A policy engine with project/asset scopes and external identity providers is required before production use.
- Plugins execute without sandboxing or resource quotas. We still need isolation (WebAssembly or process workers), permission prompts, and lifecycle telemetry.

## AI Copilots
- The material and animation copilots rely on keyword heuristics. We must integrate real ML models, support dataset management, and add safety review workflows before exposing them to creators.
- There is no feedback learning loop; suggestions are not ranked or updated based on user acceptance, so copilots cannot improve over time.

## Telemetry & Beta Operations
- `TelemetryDashboard` stores samples in-memory and sorts on every insert, which does not scale to multi-project beta programs. We need a durable pipeline (e.g., clickhouse or time-series DB), streaming aggregations, and alerting hooks.
- Insight calculations ignore platform metadata, scene context, and distribution across hardware tiers. Dashboards should support cohort analysis, percentile bands per platform, and anomaly detection with configurable thresholds.

## Tooling & Release Engineering
- The workspace ships TypeScript sources only; there is no automated packaging, native bridge, or CI pipeline configuration. We need build orchestration (Bazel/CMake), artifact signing, and per-platform test coverage before launch.
- Test coverage is limited to unit tests. We still need performance benchmarks, integration tests with representative scenes, and hardware-in-the-loop validation.

These gaps should guide the next planning cycle and help justify the investment required to move from prototypes to a competitive production engine.
