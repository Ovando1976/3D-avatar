# Automation Worker

The automation worker executes background workloads that are too heavy or asynchronous for interactive requests. It will subscribe to a job queue, spin up GPU-enabled tasks, and interact with shared storage for assets and outputs.

Focus areas:
- Render and baking pipelines for avatar previews and production frames.
- AI inference calls for pose generation, mesh clean-up, and texture synthesis.
- Asset validation routines (naming conventions, topology checks) triggered on upload.
- Observability, retries, and dead-letter strategies for resilient processing.
