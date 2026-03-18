# ClinomX Frontend

OpenMRS O3 frontend for **ClinomX** — a FHIR R4-native questionnaire and response management system built on top of the OpenMRS platform.

---

## Contents

- [Overview](#overview)
- [Packages](#packages)
- [Architecture](#architecture)
- [Source structure](#source-structure)
- [Feature modules](#feature-modules)
  - [questionnaire/](#questionnaire)
  - [questionnaire-response/](#questionnaire-response)
  - [study/](#study)
- [Configuration](#configuration)
- [devMode vs production mode](#devmode-vs-production-mode)
- [Import alias `@/`](#import-alias-)
- [Running locally](#running-locally)
- [Building for production](#building-for-production)
- [Tests](#tests)

---

## Overview

The frontend is a Yarn monorepo of OpenMRS O3 microfrontends, served as a single-page application by the `@openmrs/esm-app-shell`.

It provides two primary features:

| Feature | Description |
|---|---|
| **Questionnaire management** | Create, edit, version, import/export, and delete FHIR `Questionnaire` resources |
| **Questionnaire Response management** | Fill in, save, view, import/export, and delete FHIR `QuestionnaireResponse` resources linked to OpenMRS patients |

All data is modelled as [FHIR R4](https://hl7.org/fhir/R4/) resources. The backend stores the full FHIR JSON as a blob and exposes it through custom OpenMRS REST endpoints.

---

## Packages

| Package | Description |
|---|---|
| [`esm-clinomix-app`](packages/esm-clinomix-app/) | ClinomX questionnaire and response management UI |
| [`esm-home-app`](packages/esm-home-app/) | Home page / landing screen |

---

## Architecture

```
Browser (SystemJS)
       │
       ▼
@openmrs/esm-app-shell   (pre-built, served from /openmrs/spa/)
       │
       ├── esm-home-app          Home page
       └── esm-clinomix-app      Questionnaire & Response UI
              │
              ├── questionnaire/          FHIR Questionnaire CRUD + versioning
              ├── questionnaire-response/ FHIR QuestionnaireResponse CRUD + export
              └── study/                  Research study grouping

              │ REST calls
              ▼
       OpenMRS backend  /ws/rest/v1/questionnaire
                        /ws/rest/v1/questionnaireresponse
                        /ws/rest/v1/patient   (patient search)
```

Each package is a standard O3 microfrontend registered via its `routes.json` and loaded by the app shell as a SystemJS module. Nginx serves the SPA static assets and proxies `/openmrs/` to the OpenMRS backend.

---

## Source structure

```
frontend/
├── Dockerfile                  Production image (nginx + pre-built SPA)
├── nginx.conf                  Nginx config — serves SPA, proxies /openmrs/
├── turbo.json                  Turbo build pipeline
├── package.json                Workspace root
│
└── packages/
    ├── esm-home-app/           Home page microfrontend
    └── esm-clinomix-app/       ClinomX microfrontend
        ├── jest.config.js
        ├── tsconfig.json
        ├── webpack.config.js
        └── src/
            ├── config-schema.ts                  Module config schema and types
            ├── index.ts                          Entry point — registers routes & extensions
            ├── root.component.tsx                React Router root with all page routes
            │
            ├── questionnaire/                    Questionnaire feature module
            │   ├── questionnaire.resource.ts     Hooks + FHIR types + localStorage helpers
            │   ├── questionnaire.resource.test.ts
            │   ├── questionnaire-list.component.tsx
            │   ├── questionnaire-list.component.test.tsx
            │   ├── fhir-xml.parser.ts            XML → FhirQuestionnaire converter
            │   ├── form/
            │   │   ├── questionnaire-form.component.tsx
            │   │   └── questionnaire-item-card.component.tsx
            │   └── view/
            │       └── questionnaire-view.component.tsx
            │
            ├── questionnaire-response/           QuestionnaireResponse feature module
            │   ├── questionnaire-response.resource.ts
            │   ├── questionnaire-response.resource.test.ts
            │   ├── questionnaire-response.component.tsx
            │   ├── questionnaire-response-item.component.tsx
            │   ├── questionnaire-response-list.component.tsx
            │   ├── questionnaire-response-view.component.tsx
            │   └── questionnaire-response-export.ts
            │
            └── study/                            Study/trial grouping
                ├── study.resource.ts
                ├── study-list.component.tsx
                ├── form/
                └── view/
```

---

## Feature modules

### questionnaire/

**FHIR type:** `Questionnaire` ([spec](https://hl7.org/fhir/R4/questionnaire.html))

#### Hooks (`questionnaire.resource.ts`)

| Hook | Description |
|---|---|
| `useQuestionnaires()` | Returns `{ questionnaires, total, isLoading, error, mutate }`. Reads from localStorage in devMode, calls `GET /ws/rest/v1/questionnaire?v=full` in production. |
| `useSaveQuestionnaire()` | Returns an async function `(form, options) => id`. Supports `isEditing`, `original`, and `versionChoice` (`overwrite` \| `patch` \| `minor` \| `major`). |
| `useDeleteQuestionnaire()` | Returns an async function `(id) => void`. |
| `useImportQuestionnaires()` | Returns an async function `(resources[]) => { added, updated }`. Merges by `id`. |
| `useVersionHistory(id)` | Returns `{ history, refresh }` — version snapshots archived before each non-overwrite save. |
| `useRestoreQuestionnaire()` | Returns an async function to restore a snapshot as the current version. |
| `useDeleteSnapshot()` | Returns an async function to remove a single version snapshot. |

#### Pure utilities

| Function | Description |
|---|---|
| `bumpVersion(current, type)` | Increments a semver string by `major`, `minor`, or `patch`. Returns `'1.0.0'` when `current` is undefined. |

#### Components

| Component | Description |
|---|---|
| `questionnaire-list` | Data table with search, pagination, toolbar (New / Import), per-row actions (View / Edit / Delete), and a delete confirmation modal. |
| `questionnaire-form` | JSON editor for Questionnaire fields with a version-bump selector when editing. |
| `questionnaire-view` | Read-only viewer; shows full FHIR JSON and a collapsible version history panel. |
| `fhir-xml.parser` | Converts FHIR XML text to a `FhirQuestionnaire` object — used by the Import toolbar action. |

---

### questionnaire-response/

**FHIR type:** `QuestionnaireResponse` ([spec](https://hl7.org/fhir/R4/questionnaireresponse.html))

#### Hooks (`questionnaire-response.resource.ts`)

| Hook | Description |
|---|---|
| `usePatientSearch(query)` | Returns `{ patients, isLoading }` — calls `GET /ws/rest/v1/patient?q=...` when query length >= 2. |
| `useResponses()` | Returns `{ responses, isLoading, error, mutate }`. Reads from localStorage in devMode, calls `GET /ws/rest/v1/questionnaireresponse?v=full` in production. |
| `useSaveResponse()` | Returns an async function `(response) => id`. Creates or updates based on presence of `response.id`. |
| `useDeleteResponse()` | Returns an async function `(id) => void`. |
| `useImportResponses()` | Returns an async function `(resources[]) => { added, updated }`. |

#### Components

| Component | Description |
|---|---|
| `questionnaire-response-list` | Lists all responses for a given questionnaire; toolbar with Fill In / Import / Export. |
| `questionnaire-response` | Patient selector + answer form rendered from the linked questionnaire's item tree. |
| `questionnaire-response-item` | Recursive renderer for a single FHIR `QuestionnaireResponse.item`. |
| `questionnaire-response-view` | Read-only display of a saved response. |
| `questionnaire-response-export` | Utility functions to export responses as JSON or CSV. |

---

### study/

Groups questionnaires into research studies or clinical trials. Each study links to one or more questionnaires and optionally to a patient cohort.

---

## Configuration

Configuration is managed through the OpenMRS config system and can be overridden in the admin UI at **System Administration → Advanced Settings → Module: esm-clinomix-app**.

| Key | Type | Default | Description |
|---|---|---|---|
| `devMode` | Boolean | `false` | When `true`, all data is persisted to `localStorage` instead of the backend API. Intended for local UI development without a running backend. |

---

## devMode vs production mode

Every resource hook supports two execution paths, selected by `useConfig<Config>().devMode`:

```
devMode = true                      devMode = false
──────────────────────────────      ──────────────────────────────────────
Read  → localStorage                Read  → GET /ws/rest/v1/questionnaire
Write → localStorage                Write → POST /ws/rest/v1/questionnaire
Delete→ localStorage                Delete→ DELETE /ws/rest/v1/questionnaire/:id
```

**localStorage keys used in devMode:**

| Key | Contents |
|---|---|
| `clinomix:questionnaires` | `FhirQuestionnaire[]` — current questionnaire list |
| `clinomix:questionnaire-history` | `Record<id, FhirQuestionnaire[]>` — version snapshots |
| `clinomix:responses` | `FhirQuestionnaireResponse[]` — all responses |

Seed data (three sample questionnaires) is written to `clinomix:questionnaires` on first load when the key is absent.

---

## Import alias `@/`

The `@/` alias maps to `src/` within `esm-clinomix-app` and is configured in three places:

| Tool | Config file | Entry |
|---|---|---|
| TypeScript | `tsconfig.json` | `"paths": { "@/*": ["src/*"] }` |
| Webpack | `webpack.config.js` | `resolve.alias['@'] = path.resolve(__dirname, 'src')` |
| Jest | `jest.config.js` | `moduleNameMapper['^@/(.*)$'] = '<rootDir>/src/$1'` |

**Convention:** use `@/` only for imports that cross feature-folder boundaries. Imports within the same folder use relative paths.

```ts
// questionnaire-response/ importing from questionnaire/ — use @/
import type { FhirQuestionnaire } from '@/questionnaire/questionnaire.resource';

// Within the same folder — stay relative
import { bumpVersion } from './questionnaire.resource';
```

---

## Running locally

```bash
# Install dependencies from the frontend/ root:
yarn install

# Start esm-clinomix-app against a local OpenMRS backend (port 8080):
cd packages/esm-clinomix-app
yarn start
# Opens http://localhost:8081/openmrs/spa/
```

The `yarn start` command uses `openmrs develop`, which hot-reloads changes and proxies `/openmrs/` to `http://localhost:8080`.

---

## Building for production

The production image is built and served with Docker. From the repository root:

```bash
# Frontend image only:
docker build -t clinomix-frontend .
```

The Dockerfile:
1. Installs dependencies and builds all packages with `yarn turbo run build`
2. Copies the pre-built `@openmrs/esm-app-shell/dist/` as the app shell
3. Generates `importmap.json` and `routes.registry.json` for the two packages
4. Serves everything with Nginx, proxying `/openmrs/` to the backend

---

## Tests

Tests use **Jest 29** with **@testing-library/react** and **@swc/jest** (no Babel).

```bash
# Run all tests from the frontend/ root:
yarn turbo run test

# Run tests for esm-clinomix-app only:
cd packages/esm-clinomix-app
yarn test

# Run with coverage:
yarn coverage

# Run a single file:
yarn test src/questionnaire/questionnaire.resource.test.ts
```

### Test files

| File | What it covers |
|---|---|
| `questionnaire/questionnaire.resource.test.ts` | `bumpVersion`, `useQuestionnaires` (devMode + production), `useDeleteQuestionnaire`, `useSaveQuestionnaire` (new, update, version archiving) |
| `questionnaire-response/questionnaire-response.resource.test.ts` | `usePatientSearch`, `useResponses`, `useSaveResponse`, `useDeleteResponse`, `useImportResponses` |
| `questionnaire/questionnaire-list.component.test.tsx` | Loading skeleton, error tile, table rendering, search filtering, toolbar buttons, delete modal |

### Key testing conventions

- **SWR is mocked** globally via `jest.mock('swr')` in resource test files; each test calls `mockUseSWR.mockReturnValue(...)` to control fetch state.
- **`@openmrs/esm-framework` is mocked** by the jest `moduleNameMapper` pointing to `@openmrs/esm-framework/mock`.
- **`devMode` is controlled** by `mockUseConfig.mockReturnValue({ devMode: true/false })` in `beforeEach`.
- **localStorage** is cleared with `localStorage.clear()` before each devMode test suite.
- **`jest.clearAllMocks()`** is called in `beforeEach` wherever mock call counts must be isolated across tests.
