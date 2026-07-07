# Changelog

## v1.0.1 - 2026-07-02

- Adds update notifications backed by GitHub Releases.
- Adds a tested update service with semver comparison, GitHub Release asset selection, and fallback handling for API rate limits.
- Adds main-process automatic update checks and system notifications that open the Release download page on click.
- Documents that update installation remains user-driven and can be disabled in settings.

## v1.0.0 - 2026-07-02

- Initial GitHub release for Focus Pet.
- Includes the Electron desktop pet, task management, focus status detection, review, optional screen monitor, local social chat, WebRTC signaling, and the generated full-body pet animation/GIF asset set.
- Adds low-memory runtime architecture: optional social, diagnostics, screen monitor, LLM self-check, chat WebSocket, and GIF preview resources load on demand.
- Provides macOS downloadable release artifacts as DMG and ZIP.
