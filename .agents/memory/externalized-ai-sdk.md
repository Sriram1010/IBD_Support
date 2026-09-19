---
name: Externalized AI SDK runtime dependency
description: Why an AI provider SDK used through a workspace library may still need to be declared by the bundled API server.
---

When the API server build externalizes a provider SDK, declare that SDK as a direct runtime dependency of the API server even if a shared workspace integration package already depends on it.

**Why:** pnpm's strict package isolation means an externalized import must resolve from the server package at runtime. A transitive workspace dependency can typecheck and bundle successfully but still fail when the built server starts.

**How to apply:** After adding or changing an AI integration, inspect the server bundler's external patterns and restart the built workflow, not just TypeScript checks. If the SDK remains external, ensure the server package can resolve it directly.