# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (backend), AsyncStorage (mobile)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── mgi-dairy/          # MGI Dairy - Expo mobile app (IBD tracker)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts
├── pnpm-workspace.yaml     # pnpm workspace
├── tsconfig.base.json      # Shared TS options
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array

## Packages

### `artifacts/mgi-dairy` (`@workspace/mgi-dairy`)

MGI Dairy — Expo React Native mobile app for IBD (Inflammatory Bowel Disease) tracking.

**Features:**
- **Diary Tab**: Meal log (table with time, food, photo columns), water intake (ml/gal toggle, voice + manual input, progress bar), sleep log (bedtime/wake time, total hours)
- **Calendar Tab**: Monthly calendar view with day-by-day data summaries (meals, water, sleep, symptoms)
- **Triggers Tab**: Log and track IBD triggers by category (Food, Stress, Medication, etc.) with severity and associated symptoms
- **MGI Tab**: Modified Global Index score tracker — logs pain, urgency, bloating, fatigue, Bristol stool scale; 7-day history bar chart

**Storage**: All data stored locally via AsyncStorage — no backend needed.

**Architecture:**
- `context/AppContext.tsx` — React context providing all data + CRUD operations, persisted to AsyncStorage
- `constants/colors.ts` — Light/dark mode color theme (white and light grey base)
- `hooks/useDateString.ts` — Date utilities, water unit parsing, sleep hour calculation
- `app/(tabs)/index.tsx` — Diary screen
- `app/(tabs)/calendar.tsx` — Calendar screen
- `app/(tabs)/triggers.tsx` — Triggers screen
- `app/(tabs)/mgi.tsx` — MGI Score screen
- `app/image-viewer.tsx` — Full-screen image viewer

**Permissions configured** (iOS Info.plist + Android manifest):
- Camera
- Microphone
- Photo Library (read + write)

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/`.

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL.

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec + Orval codegen config.
