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
- `REMOTE_ASSET_RESOLVER_BIN` / `YTDLP_BIN` for server-side platform media resolving
- `REMOTE_ASSET_MAX_BYTES`
- `REMOTE_ASSET_TIMEOUT_MS`

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

## Higgsfield MCP worker

The server is configured for the local Higgsfield MCP worker bridge on `http://127.0.0.1:8190`.

- Emily Rhodes is mapped to `Autoscale-Server/workflows/emily-rhodes/emily_mcp_workflow.json`.
- Workspace runs send `workflow_id`, `workflow_name`, `workflow_path`, `board_run_id`, `row_id`, and `row_index` to the worker.
- Platform admins can connect a separate Higgsfield MCP login per AI influencer from Admin Access → Higgsfield MCP. The worker stores those OAuth tokens separately and generation jobs use the token matching `influencer_model_id`.
- Website model aliases use the curated MCP ids: `nb_pro` → `nano_banana_2`, `nb2` → `nano_banana_flash`, `sd_4_5` → `seedream_v4_5`, `gpt_2` → `gpt_image_2`, `flux_2` → `flux_2`, `kling_o1` → `kling_omni_image`, `flux_kontext` → `flux_kontext`, `z_image` → `z_image`, `sd_2_0` / `sd_2_0_fast` → `seedance_2_0`, and `kling_3_0` → `kling3_0`.
- The website cost estimator now uses Higgsfield credit units directly, including resolution and quality tiers where the model exposes those controls. Confirmed transaction-log rates are marked in the Admin Access → Higgsfield MCP cost map; inferred tiers should be rechecked after the first live transaction for that exact tier.
- Rows can run prompt-only by default for MCP-backed image/video models. Set `HIGGSFIELD_REQUIRE_REFERENCE_IMAGES=true` only for older worker stacks that require a row reference.
- Board runs are queued by lane so one image tab, one video tab, and one audio tab can run at a time.

Dry-run worker:

```bash
cd ../MCPNODE
HIGGSFIELD_MCP_WORKER_DRY_RUN=true HIGGSFIELD_WORKER_API_KEY=local-dev \
  /Users/dimitriostasis/Documents/ComfyUILaptop/.venv/bin/python autoscale_mcp_worker.py --port 8190
```
