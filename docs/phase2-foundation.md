# Phase 2 Foundation

## 1. Project Definition

`repo-compass` Phase 2 extends the shipped Phase 1 metadata pipeline into a
deterministic repo comprehension tool that works credibly on common Python
repositories while remaining useful to coding agents at session start.

Phase 2 product shape:

- one canonical metadata artifact: `context-index.json`
- two human views derived from it: `ONBOARDING.md` and `repo.map.md`
- one fixed-size agent startup view derived from it: `agent-start.md`
- one freshness path that keeps artifacts current only after quality gates pass

Phase 2 target outputs:

- `context-index.json`
- `ONBOARDING.md`
- `repo.map.md`
- `agent-start.md`

Phase 2 design principles:

- `context-index.json` remains the single source of truth
- prefer structural signals that generalize across languages over ecosystem-only
  recognition
- Python support should solve common repo cases well before chasing edge cases
- derived views may compress, but must not invent new claims
- low-confidence inference should stay suppressible on the default agent path
- freshness is a product requirement, but only after output quality is trusted

## 2. Value Boundary

Phase 2 should answer these questions better than Phase 1:

- where should a human or agent start in an unfamiliar Python repository
- which files are structurally central versus incidental noise
- what are the likely entrypoints, commands, and first-read paths
- what uncertainty or degraded confidence should an agent know before editing
- whether the artifact is fresh enough to trust without a full fallback scan

This tool is not:

- a Python language server replacement
- a runtime debugger or tracing system
- a full semantic architecture reconstruction engine
- a cross-repository dependency topology tool
- an LLM-first code explanation product
- a guarantee that unusual repos will always yield strong inferred intent

Phase 2 success condition:

- reduce first-session wrong turns for agents in common Python repos
- preserve deterministic output expectations from Phase 1
- produce a startup artifact small enough for routine agent loading
- establish explicit stale and freshness semantics without compromising trust

## 3. Product Positioning

Phase 2 positioning:

> Deterministic repo startup context for humans and agents, expanded from JS/TS
> into common Python repositories.

repo-compass should not become a giant ecosystem-specific rule dump. The Phase
2 product move is to keep the same canonical metadata architecture while
shifting more of the ranking logic onto language-agnostic structural signals and
adding only the minimum Python-specific rules needed for credible usefulness.

Acute pain point:

> Phase 1 can orient users in many JS/TS repos, but it does not yet provide the
> same credible first-pass guidance in Python repos, which represent a large
> share of interesting open-source infrastructure and AI tooling.

## 4. Phase 2 Scope

### In Scope

- Python as the first non-JS/TS language target
- cross-language structural signals that generalize beyond framework names
- common Python packaging and manifest detection
- common Python entrypoint detection
- higher-quality key-path and first-read ranking
- compatibility-safe extension of canonical metadata
- a fixed-format `agent-start.md` startup contract with explicit length budget
- Python-oriented noise suppression for low-signal paths
- larger and more realistic Python fixture coverage
- Python end-to-end evaluation as a phase gate
- design for freshness via watch mode and CI regeneration

### Out of Scope

- language rewrite of the core engine
- broad multi-language expansion beyond Python in the first Phase 2 slice
- deep semantic AST reconstruction across Python frameworks
- notebook-first repository understanding as a primary product target
- runtime tracing or execution sampling
- mandatory cloud service dependencies
- freshness implementation before Python quality gates pass

### Python In Scope

- packaging and dependency signals from `pyproject.toml`, `setup.py`,
  `setup.cfg`, and `requirements*.txt`
- common Python source layouts such as flat top-level modules, `src/` layouts,
  and package directories with `__init__.py`
- entry signals from `__main__.py`, common CLI bootstrap files, and common
  service startup files
- P0-level framework hints for `FastAPI`, `Flask`, and `Django`
- suppression rules for virtualenvs, caches, generated outputs, migrations,
  build directories, and other low-signal paths

### Python Out Of Scope

- full Python packaging taxonomy coverage
- exhaustive framework-specific semantic extraction
- correctness guarantees for metaprogramming-heavy or highly dynamic repos
- complete handling of every monorepo Python packaging variant
- broad support for notebooks as the primary comprehension surface

### Python Quality Bar

Phase 2 should not define success as "supports Python". It should define success
as:

- Python repo P0 failures do not exceed the severity of the major Phase 1 Vue
  miss
- common Python repos produce useful entrypoints, key paths, and first-read
  paths
- noisy Python glue such as `__init__.py` does not dominate ranking output

## 5. Technology Decision

Phase 2 implementation stack remains TypeScript and Node.js.

Rationale:

- preserves continuity with the shipped Phase 1 implementation
- keeps contracts, renderers, CLI, and future integrations in one stack
- avoids speculative rewrite cost before product value is proven in Python

Constraints:

- Python support must not require embedding a Python runtime
- analysis logic must remain deterministic from repository contents alone
- new metadata fields should be additive wherever possible
- freshness logic must not silently degrade canonical full-scan behavior

## 6. Performance and Evolution Constraints

Phase 2 should still declare explicit performance targets even if Python
support arrives before every optimization.

Target SLOs:

- common Python repo full scan: within the same order of magnitude as Phase 1
  JS/TS scans of similar size
- `agent-start.md` render: bounded and small enough for routine startup use
- watch/CI freshness path: added only after full-scan quality is trusted

These targets assume Phase 2 still prioritizes structural analysis:

- manifest and config detection
- path classification
- import/reference extraction where cheap and reliable
- deterministic ranking heuristics over the resulting graph

Phase 2 acknowledges the trade-off:

- first deliver Python quality
- then freeze the startup contract
- then add freshness mechanisms

## 7. Release and Distribution Notes

Open-source license target remains:

- MIT

Phase 2 release notes should explicitly communicate:

- Python support boundaries
- known degraded cases
- startup contract size and intended use
- freshness support status and trust semantics

## 8. Metadata-First Architecture

Phase 2 should remain a pipeline, not an agent swarm.

End-to-end flow:

1. repo input
2. structure scan
3. signal extraction
4. comprehension build
5. artifact rendering
6. optional freshness update after quality gates

### 8.1 Pipeline Stages

#### Stage A: Repo Input

Responsibilities:

- resolve repo root
- load ignore rules
- capture snapshot metadata
- detect requested freshness mode without requiring it
- normalize user options

Output:

- normalized repo input record

#### Stage B: Structure Scan

Responsibilities:

- enumerate files and directories
- classify paths by role
- detect Python manifests, dependency files, and ecosystem hints
- suppress obviously low-signal paths
- apply include and exclude rules

Output:

- structure scan result

#### Stage C: Signal Extraction

Responsibilities:

- detect likely Python and JS/TS entrypoints
- extract commands, bootstrap files, and lightweight edges
- build language-agnostic centrality and adjacency signals
- identify central paths and defer candidates
- avoid promoting low-signal Python glue by default

Output:

- signal extraction result

#### Stage D: Comprehension Build

Responsibilities:

- construct the canonical graph-backed metadata model
- derive first-read and key-path views from graph and manifest evidence
- attach evidence, reasons, and confidence to inferred claims
- express uncertainty explicitly when the signal is weak
- keep repo-shape and startup guidance conservative and structural

Output:

- comprehension representation

#### Stage E: Artifact Rendering

Responsibilities:

- publish `context-index.json` as canonical output
- derive `repo.map.md` for navigation
- derive `ONBOARDING.md` for action-start guidance
- derive `agent-start.md` as a fixed-budget startup contract

Output:

- stable Phase 2 artifacts

#### Stage F: Freshness Update

Responsibilities:

- update outputs via watch mode or CI regeneration
- publish freshness metadata and stale warnings
- never hide degraded confidence when freshness is uncertain

Output:

- refreshed outputs after canonical rebuild

## 9. Metadata Contract Shape

Phase 2 canonical metadata should still use two layers:

- graph layer
- derived views

### 9.1 Graph Layer

The graph layer should capture durable cross-language structure:

- manifests and dependency anchors
- source and test nodes
- import/reference relationships where cheap and reliable
- route or service adjacency when structurally obvious
- low-noise containment relationships

### 9.2 Derived Views

The derived view layer should remain task-oriented:

- `entrypoints`
- `first_read_path`
- `key_paths`
- `critical_paths`
- `defer_for_now`
- `agent_hints`
- `warnings`
- `freshness`

Derived views should be conservative:

- prefer omission over weak claims
- preserve confidence and reasons for inferred items
- keep `agent-start.md` small enough to function as session startup context

## 10. Phase 2 Completion Logic

Phase 2 design should be considered implementation-ready only when:

- Python scope is frozen clearly enough that engineering work does not drift
- the `agent-start.md` contract is fixed enough for deterministic rendering
- the canonical metadata extensions are specified additively
- the Python quality bar is measurable
- freshness sequencing is explicit rather than assumed
