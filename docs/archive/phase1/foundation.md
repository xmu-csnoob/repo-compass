# Phase 1 Foundation

## 1. Project Definition

`repo-compass` is a TypeScript developer tool that generates deterministic repo
context for unfamiliar JavaScript and TypeScript codebases.

Phase 1 product shape:

- one canonical metadata artifact: `context-index.json`
- one human view derived from it: `ONBOARDING.md` and `repo.map.md`
- one agent view derived from it: static agent-facing files first; MCP later

Phase 1 target outputs:

- `context-index.json`
- `ONBOARDING.md`
- `repo.map.md`

Phase 1 design principles:

- `context-index.json` is the single source of truth
- prefer deterministic structural signals over narration
- only publish claims that are directly observed or conservatively derivable from static evidence
- optimize for first-session usefulness, especially for coding agents
- derived views may summarize, but must not invent new claims
- low-confidence inference should be suppressed from the default agent path

## 2. Value Boundary

Phase 1 should answer these questions quickly:

- where should a new human or agent start reading
- which files and directories matter first
- what are the likely entrypoints and source areas
- what can be deferred on a first pass
- what minimal setup context matters before safe edits begin

This tool is not:

- a generic repo summarizer
- a full architecture reconstruction system
- a reliable repo-intent classifier
- a runtime tracing platform
- a correctness oracle for dynamic systems
- a cross-repository dependency analysis tool
- an LLM-first narration layer

Phase 1 success condition:

- reduce first-session wrong turns for coding agents
- reduce first-entry reading cost for humans
- produce stable metadata from mostly static analysis
- make later renderers and integrations depend on one canonical model

## 3. Product Positioning

Phase 1 positioning:

> Deterministic, confidence-scored repo navigation for humans and agents.

repo-compass should not compete as a "dump the whole repo into prompt context"
tool. It should help a user or agent start productively from a stable map of the
repo.

Acute pain point:

> When a coding agent enters a new repository, it wastes a large part of the
> first session reconstructing structure, entrypoints, and safe starting points.
> repo-compass provides a deterministic repo map so the first session starts
> closer to productive work.

## 4. Phase 1 Scope

### In Scope

- single repository input at one filesystem snapshot
- JavaScript and TypeScript repositories only
- lightweight repository scan with ignore rules
- file and directory classification
- ecosystem and manifest detection for JS/TS repos
- structural entrypoint detection
- import or reference graph extraction where cheap and reliable
- deterministic summaries backed by evidence
- prioritization of key paths for first read
- detection of defer-for-now areas
- coarse structural classification only when supported by strong static signals
- generation of canonical metadata and markdown views
- generation of static agent-facing derived files after metadata exists

### Out of Scope

- runtime instrumentation
- cross-repository understanding
- Python, Java, or general multi-language deep support
- monorepo-wide partitioning and coordination
- incremental analysis and caching as shipped features
- mandatory MCP support in Phase 1
- automatic browser opening as the default CLI behavior
- heavy LLM narration over raw source
- architecture-intent inference such as deciding the repo's true product purpose

### Framework Priority

Priority frameworks for Phase 1:

- Next.js
- React application repos
- Vite application repos
- Node.js CLI tools
- Express services

Non-priority frameworks may still receive generic structural analysis, but
Phase 1 does not promise framework-specific semantic extraction for them.

## 5. Technology Decision

Phase 1 implementation stack is TypeScript and Node.js.

Rationale:

- `npx` distribution fits the intended first-use experience
- the Phase 1 priority is canonical metadata plus derived views, not heavy AST
  reconstruction
- TypeScript keeps the analysis layer and future rendering layer in one language
- agent-facing static outputs and later MCP wrapping can share one schema and one
  implementation stack

Constraints:

- analysis logic must not depend on `ts-node` or `tsx` at runtime
- shipped CLI should run from built JavaScript
- analysis and rendering should remain separate modules
- do not plan for a Phase 2 language rewrite of the core metadata engine

## 6. Performance and Evolution Constraints

Phase 1 should declare explicit performance targets even if the first
implementation only approximately meets them.

Target SLOs:

- 100 files: under 1 second on a typical local machine
- 1,000 files: under 5 seconds
- 10,000 files: under 30 seconds

These targets assume Phase 1 analysis remains mostly structural:

- filesystem scan
- manifest and config detection
- cheap import and reference extraction
- deterministic heuristics over the resulting graph

Phase 1 explicitly does not ship incremental analysis or persistent caching, but
the design should acknowledge the trade-off:

- first release uses full re-scan on each run
- later versions may add incremental analysis if SLO pressure justifies it
- later versions may add caching only if it does not compromise reproducibility

## 7. Release and Distribution Notes

Open-source license target for Phase 1:

- MIT

This is an adoption choice, not a core architectural dependency.

## 8. Metadata-First Architecture

Phase 1 should be a pipeline, not an agent swarm.

End-to-end flow:

1. repo input
2. structure scan
3. signal extraction
4. comprehension build
5. artifact rendering

### 8.1 Pipeline Stages

#### Stage A: Repo Input

Responsibilities:

- resolve repo root
- load ignore rules
- capture snapshot metadata
- normalize user options

Output:

- normalized repo input record

#### Stage B: Structure Scan

Responsibilities:

- enumerate files and directories
- classify paths by role
- detect manifests and ecosystem hints
- apply include and exclude rules

Output:

- structure scan result

#### Stage C: Signal Extraction

Responsibilities:

- detect likely entrypoints
- extract scripts, commands, and bootstrap files
- build lightweight edges between important nodes
- identify central paths and high fan-in files
- mark defer candidates

Output:

- signal extraction result

#### Stage D: Comprehension Build

Responsibilities:

- construct the canonical graph-backed metadata model
- derive first-read and key-path views from the graph
- attach evidence, reasons, and confidence to inferred claims
- generate deterministic summaries without introducing unsupported claims
- keep `repo_shape`, `critical_paths`, and edit guidance conservative and structural rather than semantic

Output:

- comprehension representation

#### Stage E: Artifact Rendering

Responsibilities:

- publish `context-index.json` as canonical output
- derive `repo.map.md` for navigation
- derive `ONBOARDING.md` for action-start guidance
- support later static agent outputs from the same metadata

Output:

- stable Phase 1 artifacts

## 9. Metadata Contract Shape

Phase 1 canonical metadata should use two layers:

- graph layer
- derived views

### 9.1 Graph Layer

The graph layer should capture durable structure:

- nodes for files, directories, manifests, configs, tests, and logical
  entrypoint candidates
- edges for containment, imports, references, and config relationships
- facts that come directly from the filesystem or deterministic parsing

### 9.2 Derived Views

Derived views should stay lightweight and task-oriented:

- `entrypoints`
- `first_read_path`
- `key_paths`
- `critical_paths`
- `defer_for_now`
- `agent_hints`

Rule:

- derived views must reference facts or graph entities; they must not become a
  second source of truth

## 10. Inference Boundary

Phase 1 should use a middle-strength inference policy:

- allow direct structural facts
- allow conservative heuristics such as naming patterns, manifest scripts,
  import fan-in, adjacency to tests, and framework conventions
- do not emit speculative business-logic claims

Information classes:

- `facts`: directly observed
- `inferences`: derived by deterministic rules with evidence
- `summaries`: short descriptions generated from facts and inferences only

Rules:

- summaries cannot introduce new unsupported conclusions
- low-confidence content should be omitted from default agent-facing views
- medium-confidence content is acceptable only when paired with short reasons

## 11. Runtime and Output Scope

Phase 1 should keep run persistence minimal.

Recommended run layout:

- `work/runs/<run-id>/input.json`
- `work/runs/<run-id>/context-index.json`
- `work/runs/<run-id>/outputs/ONBOARDING.md`
- `work/runs/<run-id>/outputs/repo.map.md`
- `work/runs/<run-id>/outputs/agent-context.md` when agent views are enabled

Optional debug-only internals:

- `work/runs/<run-id>/scan.json`
- `work/runs/<run-id>/signals.json`
- `work/runs/<run-id>/comprehension.json`

Phase 1 does not require:

- `work/logs/`
- `work/claims/`
- `work/scratch/`
- `status.json`

## 12. Opinionated Decisions

- `context-index.json` is the canonical artifact
- markdown outputs are derived views, not independent truth
- static agent-facing outputs come before MCP in Phase 1
- HTML reporting is a stretch goal for Phase 1, not a blocker for the initial
  release
- every inferred claim needs evidence, reason, and confidence
- framework-specific extraction is allowed only when deterministic and scoped to
  the Phase 1 JS/TS target
