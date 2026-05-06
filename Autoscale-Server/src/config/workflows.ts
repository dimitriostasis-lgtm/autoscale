import path from "node:path";

import type { StoreData } from "../types/domain.js";

export interface WorkerWorkflowConfig {
  id: string;
  name: string;
  path: string;
}

const WORKFLOWS_BY_MODEL_KEY: Record<string, WorkerWorkflowConfig> = {
  "emily-rhodes": {
    id: "emily-rhodes-mcp-v9",
    name: "Emily MCP Workflow",
    path: path.resolve(process.cwd(), "workflows/emily-rhodes/emily_mcp_workflow.json"),
  },
  "ava-sterling": {
    id: "emily-rhodes-mcp-v9",
    name: "Emily MCP Workflow",
    path: path.resolve(process.cwd(), "workflows/emily-rhodes/emily_mcp_workflow.json"),
  },
};

export function resolveWorkerWorkflow(model: StoreData["influencerModels"][number] | undefined): WorkerWorkflowConfig | null {
  if (!model) {
    return null;
  }

  const keyCandidates = [
    model.id,
    model.slug,
    model.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  ];

  for (const key of keyCandidates) {
    const workflow = WORKFLOWS_BY_MODEL_KEY[key];
    if (workflow) {
      return workflow;
    }
  }

  return null;
}
