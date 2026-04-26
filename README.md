# AutoScale

AutoScale is a private internal platform for managing agency-owned AI influencer creation, generation workspaces, account permissions, and model-isolated output galleries.

The current scaffold implements the core product shape requested in the brief:

- Login-first private access
- Role-based access control for `admin`, `manager`, and `user`
- Influencer-model selection before entering a workspace
- Airtable-style per-model workspace boards with add/delete rows and isolated tabs
- Shared generation settings and shared reference inputs above the grid
- Row-level prompt/reference editing with upload or gallery selection
- A separate visual gallery view for generated content
- A manager/admin access-management surface
- Server-side orchestration against the generation worker API

## Workspace structure

```text
AutoScale/
├── AutoScale-Client/     # React + Vite + Tailwind 4 frontend
└── Autoscale-Server/     # Express + Apollo GraphQL backend
```

## Important implementation notes

### 1. Worker bridge contract

The app wraps the worker contract server-side so browser clients only interact with AutoScale permissions, boards, uploads, and gallery data.

- Worker endpoint: `POST /api/v1/jobs`
- Result endpoint: `GET /api/v1/jobs/:jobId`
- Artifact endpoint: `GET /api/v1/jobs/:jobId/artifacts/:name`
- Max batch rows in the UI: `8`
- Shared global references are sent only on the first worker submission
- Each workspace row maps to one worker slot and one worker job submission

### 2. Persistence strategy in this scaffold

The backend is organized along the production architecture from the technical requirements, but the live server scaffold currently persists to a local JSON store at `Autoscale-Server/data/store.json` so the product flow is runnable without standing up PostgreSQL first.

To keep the production database model explicit, Prisma schema files are also included in `Autoscale-Server/prisma/schema/`.

### 3. Seed accounts

The server seeds these accounts on first boot:

- `admin@autoscale.internal / Admin!123`
- `manager@autoscale.internal / Manager!123`
- `user@autoscale.internal / User!123`

## Environment variables

### Server

See `Autoscale-Server/.env.example`.

Key values:

- `PORT`
- `CLIENT_URL`
- `JWT_SECRET`
- `STORAGE_ROOT`
- `DATA_STORE_PATH`

### Client

See `AutoScale-Client/.env.example`.

## Local setup

Run the server and client packages separately during local development.

### Server

```bash
cd Autoscale-Server
cp .env.example .env
npm install
npm run start:dev
```

### Client

```bash
cd AutoScale-Client
cp .env.example .env
npm install
npm run dev
```

## Next recommended steps

1. Install Node.js and run both packages to surface any dependency-level type issues that cannot be checked without `node_modules`.
2. Swap the JSON-backed persistence layer to the included Prisma/PostgreSQL schema once the database environment is ready.
3. Point the worker URL and API key values in `Autoscale-Server/.env` at the live worker instance and test a full end-to-end board run.