# esm-clinomix-app

OpenMRS O3 microfrontend for **ClinomX** — a FHIR R4-native questionnaire and response management module built on top of the OpenMRS platform.

---

## Contents

- [Overview](#overview)
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
- [Tests](#tests)

---

## Overview

`esm-clinomix-app` provides two primary features:

| Feature | Description |
|---|---|
| **Questionnaire management** | Create, edit, version, import/export, and delete FHIR `Questionnaire` resources |
| **Questionnaire Response management** | Fill in, save, view, import/export, and delete FHIR `QuestionnaireResponse` resources linked to OpenMRS patients |

All data is modelled as [FHIR R4](https://hl7.org/fhir/R4/) resources. The backend stores the full FHIR JSON as a blob and exposes it through a custom OpenMRS REST endpoint (`/ws/rest/v1/questionnaire` and `/ws/rest/v1/questionnaireresponse`).

---

## Architecture

```
Browser (SystemJS)
       │
       ▼
esm-clinomix-app  ──── @openmrs/esm-framework  (auth, fetch, config, routing)
       │
       ├── questionnaire/          FHIR Questionnaire CRUD + versioning
       ├── questionnaire-response/ FHIR QuestionnaireResponse CRUD + export
       └── study/                  Research study grouping (links questionnaires)

       │ REST calls
       ▼
OpenMRS backend  /ws/rest/v1/questionnaire
                 /ws/rest/v1/questionnaireresponse
                 /ws/rest/v1/patient   (patient search)
```

The app is a standard O3 microfrontend: it is registered via `routes.json` and loaded by the `@openmrs/esm-app-shell` as a SystemJS module.

---

## Source structure

```
src/
├── config-schema.ts                  Module configuration schema and types
├── index.ts                          Module entry point — registers routes & extensions
├── root.component.tsx                React Router root with all page routes
├── dashboard.meta.ts                 Dashboard link metadata
├── declarations.d.ts                 Global type declarations (SVG, CSS modules, etc.)
│
├── questionnaire/                    Questionnaire feature module
│   ├── questionnaire.resource.ts     Hooks + FHIR types + localStorage helpers
│   ├── questionnaire.resource.test.ts
│   ├── questionnaire-list.component.tsx    Paginated list with search, create, delete
│   ├── questionnaire-list.component.test.tsx
│   ├── fhir-xml.parser.ts            Import: XML → FhirQuestionnaire converter
│   ├── form/
│   │   ├── questionnaire-form.component.tsx   Create/edit form with version control
│   │   └── questionnaire-item-card.component.tsx
│   └── view/
│       └── questionnaire-view.component.tsx   Read-only JSON viewer + history panel
│
├── questionnaire-response/           QuestionnaireResponse feature module
│   ├── questionnaire-response.resource.ts    Hooks + FHIR types + localStorage helpers
│   ├── questionnaire-response.resource.test.ts
│   ├── questionnaire-response.component.tsx      Response fill-in form
│   ├── questionnaire-response-item.component.tsx Renders a single item/answer group
│   ├── questionnaire-response-list.component.tsx Paginated list per questionnaire
│   ├── questionnaire-response-view.component.tsx Read-only response viewer
│   └── questionnaire-response-export.ts          CSV/JSON export utilities
│
├── study/                            Study/trial grouping (links Qs to cohorts)
│   ├── study.resource.ts
│   ├── study-list.component.tsx
│   ├── form/
│   │   └── study-form.component.tsx
│   └── view/
│       └── study-view.component.tsx
│
├── header/
│   └── clinomix-header.component.tsx  Page header with branding
├── resources/
│   └── resources.component.tsx        Static resources / help page
└── createDashboardLink.tsx            Generic dashboard extension factory
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

Configuration is managed through the OpenMRS config system. Values can be overridden in the admin UI at **System Administration → Advanced Settings → Module: esm-clinomix-app**.

| Key | Type | Default | Description |
|---|---|---|---|
| `devMode` | Boolean | `false` | When `true`, all data is persisted to `localStorage` instead of the backend API. Intended for local UI development without a running backend. |

---

## devMode vs production mode

Every resource hook in the app supports two execution paths, selected by `useConfig<Config>().devMode`:

```
devMode = true                      devMode = false
──────────────────────────────      ──────────────────────────────────────
Read  → localStorage                Read  → GET /ws/rest/v1/questionnaire
Write → localStorage                Write → POST /ws/rest/v1/questionnaire
Delete→ localStorage                Delete→ DELETE /ws/rest/v1/questionnaire/:id
```

**localStorage keys:**

| Key | Contents |
|---|---|
| `clinomix:questionnaires` | `FhirQuestionnaire[]` — current questionnaire list |
| `clinomix:questionnaire-history` | `Record<id, FhirQuestionnaire[]>` — version snapshots |
| `clinomix:responses` | `FhirQuestionnaireResponse[]` — all responses |

Seed data (three sample questionnaires) is written to `clinomix:questionnaires` on first load when the key is absent.

---

## Import alias `@/`

The `@/` alias maps to `src/` and is configured in three places:

| Tool | Config file | Entry |
|---|---|---|
| TypeScript | `tsconfig.json` | `"paths": { "@/*": ["src/*"] }` |
| Webpack | `webpack.config.js` | `resolve.alias['@'] = path.resolve(__dirname, 'src')` |
| Jest | `jest.config.js` | `moduleNameMapper['^@/(.*)$'] = '<rootDir>/src/$1'` |

**Convention:** use `@/` only for imports that cross feature-folder boundaries (e.g., `questionnaire-response/` importing from `questionnaire/`). Imports within the same folder use relative paths.

```ts
// Within questionnaire-response/ — cross-folder import uses @/
import type { FhirQuestionnaire } from '@/questionnaire/questionnaire.resource';

// Within questionnaire/ — same-folder import stays relative
import { bumpVersion } from './questionnaire.resource';
```

---

## Running locally

```bash
# From the frontend/ monorepo root:
yarn install

# Start the clinomix app against a local OpenMRS backend (port 8080):
cd packages/esm-clinomix-app
yarn start
# Opens http://localhost:8081/openmrs/spa/

# Or run the full stack with Docker (from the repository root):
docker compose -f docker-compose.fullstack.yml up
```

The `yarn start` command uses `openmrs develop`, which hot-reloads changes and proxies `/openmrs/` to the backend defined in `package.json#scripts.start`.

---

## Tests

Tests use **Jest 29** with **@testing-library/react** and **@swc/jest** (no Babel).

```bash
# Run all tests:
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
