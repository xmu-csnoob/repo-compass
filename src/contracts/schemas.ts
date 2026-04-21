import { z } from "zod";

import {
  AGENT_HINT_KINDS,
  CONFIDENCE_LEVELS,
  ENTRYPOINT_KINDS,
  GRAPH_EDGE_KINDS,
  GRAPH_NODE_KINDS,
  KEY_PATH_ROLES,
  MANIFEST_KINDS,
  PATH_ROLES,
  PRIORITY_SIGNALS,
  REPO_SHAPES,
} from "./enums.js";

const schemaVersion = z.literal("1.0");
const repoRelativePath = z.string().min(1);
const confidenceLevelSchema = z.enum(CONFIDENCE_LEVELS);
const evidenceSchema = z.array(z.string().min(1)).min(1);

export const repoInputSchema = z.object({
  schema_version: schemaVersion,
  run_id: z.string().min(1),
  repo_root: z.string().min(1),
  output_root: z.string().min(1),
  include: z.array(z.string()).default([]),
  exclude: z.array(z.string()).default([]),
  max_files: z.number().int().positive().default(50_000),
  options: z.object({
    follow_symlinks: z.boolean().default(false),
    detect_frameworks: z.boolean().default(true),
    extract_import_graph: z.boolean().default(true),
    emit_debug_artifacts: z.boolean().default(false),
    emit_agent_views: z.boolean().default(true),
  }),
});

export const manifestSchema = z.object({
  path: repoRelativePath,
  kind: z.enum(MANIFEST_KINDS),
});

export const structurePathSchema = z.object({
  path: repoRelativePath,
  kind: z.enum(["file", "directory"]),
  role: z.enum(PATH_ROLES),
  size: z.number().int().nonnegative(),
});

export const structureScanSchema = z.object({
  schema_version: schemaVersion,
  run_id: z.string().min(1),
  repo: z.object({
    root: z.string().min(1),
    file_count: z.number().int().nonnegative(),
    dir_count: z.number().int().nonnegative(),
  }),
  detected: z.object({
    languages: z.array(z.string().min(1)),
    ecosystems: z.array(z.string().min(1)),
    framework_hints: z.array(z.string().min(1)),
    manifests: z.array(manifestSchema),
  }),
  paths: z.array(structurePathSchema),
  excluded_paths: z.array(repoRelativePath),
});

export const commandSchema = z.object({
  source_path: repoRelativePath,
  name: z.string().min(1),
  command: z.string().min(1),
});

export const entrypointSchema = z.object({
  id: z.string().min(1),
  path: repoRelativePath,
  kind: z.enum(ENTRYPOINT_KINDS),
  summary: z.string().min(1).optional(),
  reason: z.string().min(1),
  confidence: confidenceLevelSchema,
  evidence: evidenceSchema,
});

export const graphEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  kind: z.enum(GRAPH_EDGE_KINDS),
});

export const priorityCandidateSchema = z.object({
  path: repoRelativePath,
  signal: z.enum(PRIORITY_SIGNALS),
  reason: z.string().min(1),
  confidence: confidenceLevelSchema,
  evidence: evidenceSchema,
});

export const deferCandidateSchema = z.object({
  path: repoRelativePath,
  reason: z.string().min(1),
  confidence: confidenceLevelSchema,
});

export const signalExtractionSchema = z.object({
  schema_version: schemaVersion,
  run_id: z.string().min(1),
  entrypoints: z.array(entrypointSchema.omit({ summary: true })),
  commands: z.array(commandSchema),
  edges: z.array(graphEdgeSchema),
  priority_candidates: z.array(priorityCandidateSchema),
  defer_candidates: z.array(deferCandidateSchema),
  warnings: z.array(z.string().min(1)),
});

export const repoMetadataSchema = z.object({
  name: z.string().min(1),
  root: z.string().min(1),
  repo_shape: z.enum(REPO_SHAPES),
  primary_languages: z.array(z.string().min(1)),
  detected_ecosystems: z.array(z.string().min(1)),
  framework_hints: z.array(z.string().min(1)),
});

export const metaSchema = z.object({
  run_id: z.string().min(1),
  snapshot_id: z.string().min(1),
  generated_at: z.string().datetime({ offset: true }),
  included_paths: z.array(repoRelativePath),
  excluded_paths: z.array(repoRelativePath),
});

export const graphNodeSchema = z.object({
  id: z.string().min(1),
  path: repoRelativePath,
  kind: z.enum(GRAPH_NODE_KINDS),
  role: z.enum(PATH_ROLES),
});

export const firstReadPathItemSchema = z.object({
  path: repoRelativePath,
  why_now: z.string().min(1),
  reason: z.string().min(1),
  confidence: confidenceLevelSchema,
  evidence: evidenceSchema.optional(),
});

export const keyPathSchema = z.object({
  path: repoRelativePath,
  kind: z.enum(["file", "directory"]),
  role: z.enum(KEY_PATH_ROLES),
  summary: z.string().min(1),
  priority: confidenceLevelSchema,
  reason: z.string().min(1),
  confidence: confidenceLevelSchema,
  evidence: evidenceSchema,
});

export const criticalPathSchema = z.object({
  name: z.string().min(1),
  steps: z.array(repoRelativePath).min(1),
  reason: z.string().min(1),
  confidence: confidenceLevelSchema,
  evidence: evidenceSchema.optional(),
});

export const deferForNowItemSchema = z.object({
  path: repoRelativePath,
  reason: z.string().min(1),
  confidence: confidenceLevelSchema,
  evidence: evidenceSchema.optional(),
});

export const agentHintSchema = z.object({
  kind: z.enum(AGENT_HINT_KINDS),
  text: z.string().min(1),
  reason: z.string().min(1),
  confidence: confidenceLevelSchema,
  evidence: evidenceSchema.optional(),
});

export const comprehensionSchema = z.object({
  schema_version: schemaVersion,
  run_id: z.string().min(1),
  repo: repoMetadataSchema,
  meta: metaSchema,
  artifacts: z.object({
    manifests: z.array(manifestSchema),
    commands: z.array(commandSchema),
  }),
  graph: z.object({
    nodes: z.array(graphNodeSchema),
    edges: z.array(graphEdgeSchema),
  }),
  entrypoints: z.array(entrypointSchema),
  first_read_path: z.array(firstReadPathItemSchema),
  key_paths: z.array(keyPathSchema),
  critical_paths: z.array(criticalPathSchema),
  defer_for_now: z.array(deferForNowItemSchema),
  agent_hints: z.array(agentHintSchema),
});

export const contextIndexSchema = comprehensionSchema.omit({ run_id: true });

export const contracts = {
  repoInputSchema,
  structureScanSchema,
  signalExtractionSchema,
  comprehensionSchema,
  contextIndexSchema,
} as const;
