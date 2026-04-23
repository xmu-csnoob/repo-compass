import type { z } from "zod";

import {
  agentHintSchema,
  commandSchema,
  comprehensionSchema,
  contextIndexSchema,
  criticalPathSchema,
  deferCandidateSchema,
  deferForNowItemSchema,
  directoryIntentEntrySchema,
  directoryIntentSchema,
  entrypointSchema,
  firstReadPathItemSchema,
  graphEdgeSchema,
  graphNodeSchema,
  intentMapSchema,
  keyPathSchema,
  manifestSchema,
  metaSchema,
  repoMetadataSchema,
  priorityCandidateSchema,
  repoInputSchema,
  signalExtractionSchema,
  structurePathSchema,
  structureScanSchema,
} from "./schemas.js";

export type RepoInput = z.infer<typeof repoInputSchema>;
export type Manifest = z.infer<typeof manifestSchema>;
export type StructurePath = z.infer<typeof structurePathSchema>;
export type StructureScan = z.infer<typeof structureScanSchema>;
export type Command = z.infer<typeof commandSchema>;
export type Entrypoint = z.infer<typeof entrypointSchema>;
export type GraphNode = z.infer<typeof graphNodeSchema>;
export type GraphEdge = z.infer<typeof graphEdgeSchema>;
export type PriorityCandidate = z.infer<typeof priorityCandidateSchema>;
export type DeferCandidate = z.infer<typeof deferCandidateSchema>;
export type SignalExtraction = z.infer<typeof signalExtractionSchema>;
export type RepoMetadata = z.infer<typeof repoMetadataSchema>;
export type Meta = z.infer<typeof metaSchema>;
export type FirstReadPathItem = z.infer<typeof firstReadPathItemSchema>;
export type KeyPath = z.infer<typeof keyPathSchema>;
export type CriticalPath = z.infer<typeof criticalPathSchema>;
export type DeferForNowItem = z.infer<typeof deferForNowItemSchema>;
export type AgentHint = z.infer<typeof agentHintSchema>;
export type Comprehension = z.infer<typeof comprehensionSchema>;
export type ContextIndex = z.infer<typeof contextIndexSchema>;
export type DirectoryIntent = z.infer<typeof directoryIntentSchema>;
export type DirectoryIntentEntry = z.infer<typeof directoryIntentEntrySchema>;
export type IntentMap = z.infer<typeof intentMapSchema>;
export type DirectoryDepth = 1 | 2;
export type DirectoryClassifierMethod = "static" | "llm";

export interface DirectoryEvidence {
  path: string;
  depth: DirectoryDepth;
  children: string[];
  manifest_hints: string[];
  parent_intent?: DirectoryIntent;
}

export interface DirectoryClassifier {
  readonly method: DirectoryClassifierMethod;
  classify(dir: DirectoryEvidence): Promise<DirectoryIntentEntry>;
}
