# API Gateway

The API Gateway exposes the platform's domain capabilities via GraphQL and REST interfaces. It will aggregate requests across services, enforce authentication/authorization policies, and manage protocol translation for realtime transports.

Key responsibilities:
- Provide a unified schema for studio clients and third-party integrations.
- Coordinate realtime collaboration sessions via WebSocket or WebRTC signaling.
- Act as the entry point for AI-assisted operations and job orchestration APIs.
- Apply rate limiting, logging, and tracing to surface operational insights.
