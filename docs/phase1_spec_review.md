# Phase 1 Specification Review

Date: 2026-04-21

## Executive Summary

Current Phase 1 specification has **strong engineering rigor** but **weak user-facing product strategy**. To achieve the stated goal of "getting a better GitHub repo with more stars," technical excellence alone is insufficient. This review identifies the core gaps and proposes targeted adjustments.

---

## 1. Overall Assessment

### What's Good

- Clear pipeline architecture (5-stage linear flow)
- Rigorous data contracts with schema versioning
- Explicit separation of concerns (codebase vs. collaboration scaffolds)
- Thoughtful confidence/reason tracking per claim
- Frozen enums prevent drift

### Critical Gaps

- **No technology stack decided** — foundational decision deferred
- **No competitive positioning** — what problem are we solving vs. existing tools?
- **Output format is text-only** — not compelling for stars on GitHub
- **Collaboration scaffold is premature** — Phase 1 doesn't need parallel coordination
- **Agent integration story is incomplete** — how will agents actually consume the output?

---

## 2. Competitive Analysis: The Missing Gap

### Current Market Landscape

| Tool | Approach | Status | Threat Level |
|------|----------|--------|--------------|
| **repomix / repopack** | Bundle entire repo into one file for LLM | Mature, popular | High |
| **gitingest** | Same idea, web-based | Mature | High |
| **repo-visualizer** | GitHub Action generating SVG tree | Stable | Medium |
| **code2prompt** | Repo → optimized LLM context | Active | High |
| **aider /map** | Simple tree-based repo map | Integrated in aider | Medium |
| **DeepWiki (Cognition)** | Auto-generate wiki for GitHub repos | Beta/Active | **Critical** |
| **CodeSee** | Visual code understanding + navigation | Commercial | Medium |
| **readme-ai** | AI-generated README files | Active | Low |
| **Sourcegraph** | Code navigation + semantic search | Enterprise | Low (different use case) |

### The Positioning Question

**Critical gap: DeepWiki is already doing "understand repo + generate docs."**

Current spec doesn't answer: Why should someone use repo-compass instead of:
- repomix + Claude (for LLM context)?
- DeepWiki (for auto-generated navigation)?
- Sourcegraph (for code understanding)?

### Recommended Differentiation

repo-compass should position as:

> **Deterministic, confidence-scored repo navigation for humans and agents**
>
> Not "dump everything" (repomix), not "AI-narrated wiki" (DeepWiki), but "understand structure → guide with priorities → preserve reasoning."
> 
> - Confidence per claim (not black-box AI)
> - Reasons preserved (explainable)
> - Optimized for first-time readers AND coding agents
> - Reproducible from static analysis (no LLM required)

### Key Differentiators vs. DeepWiki

| Aspect | repo-compass | DeepWiki |
|--------|--------------|----------|
| **Approach** | Deterministic static analysis | AI-narrated understanding |
| **Confidence** | Explicit per-claim | Implicit (black box) |
| **Reproducibility** | Deterministic (same input → same output) | Non-deterministic (LLM-dependent) |
| **Agent Integration** | Native (MCP, CLAUDE.md, .cursorrules) | Not designed for agents |
| **Cost** | Free, no API calls | Requires LLM API |
| **Customization** | Transparent rules, easy to audit | Opaque |

**Positioning angle:** "The open-source, deterministic alternative to DeepWiki. For teams that want explainability and reproducibility."

---

## 3. Output Format: Markdown Is Not Enough

### Current Plan

Three markdown/JSON files:
- `ONBOARDING.md`
- `repo.map.md`
- `context-index.json`

### The Problem

GitHub projects that get stars have **visually impressive demo artifacts**. Examples:
- webpack-bundle-analyzer: interactive treemap
- Lighthouse: gorgeous HTML report
- dependency-cruiser: colored graph visualization
- code2prompt: usage screenshot showing before/after

### Recommendation: Add Interactive HTML Report

**Primary output should be an interactive HTML dashboard:**

Features:
- File dependency graph (force-directed or hierarchical)
- First-read path highlighted with navigation
- Entrypoints with confidence indicators
- Critical paths colored differently
- Defer-for-now zones collapsed by default
- Searchable, collapsible tree navigation

Implementation:
- `npx repo-compass` auto-opens report in browser
- Falls back to CLI if headless
- Self-contained HTML (inline CSS + JS)
- Responsive design

**Why this matters:**
- First screenshot in README becomes the report
- Viral potential on Twitter ("look at this neat visualization of [popular-repo]")
- Marketing advantage: users share the report, which links back to repo-compass
- Differentiates from text-only competitors

---

## 4. Architecture: Simplify Phase 1

### Problem: Over-Engineering for Parallelism

Current design includes "collaboration scaffold" for parallel workers:
- `work/claims/` — parallel task coordination
- `work/logs/` — distributed logging
- `work/scratch/` — shared scratch space
- `status.json` — stage coordination

**Phase 1 is a single CLI run.** These add complexity but zero user value.

### Recommendation

**Reduce Phase 1 to:**

```
work/runs/<run-id>/
  input.json              [debug only, behind --debug flag]
  context-index.json      [canonical output]
  outputs/
    index.html            [primary output]
    ONBOARDING.md         [optional, --markdown mode]
    repo.map.md           [optional, --markdown mode]
```

**Defer to Phase 2:**
- `work/claims/`, `work/logs/`, `work/scratch/`
- Parallel orchestration
- Distributed coordination

**Rationale:**
- Simpler to implement and document
- Smaller mental model for users
- Faster iteration on core product
- Middleware files (scan.json, signals.json, comprehension.json) become internal Python/TS objects, not persisted

---

## 5. Technology Stack Decision: Recommend TypeScript

### Current State

Spec is technology-agnostic. Must be decided **before** implementation starts.

### Analysis

| Tech | Pros | Cons | Verdict |
|------|------|------|---------|
| **TypeScript/Node** | `npx` zero-install; web dashboard natural; largest npm ecosystem | node_modules bloat; ts-node startup slow; version fragility | ⚠️ Good for UI |
| **Python** | Better AST parsing (tree-sitter); AI/ML ecosystem; `uv` solves distribution; faster startup | Slightly higher friction than `npx` (but `uvx` is close) | ✅ Also viable |
| **Rust** | Performance; portable binary; deterministic | Slow compile; small audience; learning curve; web UI awkward | ❌ Overkill for Phase 1 |
| **Go** | Portable binary; fast; good stdlib | Web dashboard awkward; smaller dev audience than TS/Python | ❌ Not ideal for UI |

### Recommendation: TypeScript (Node.js) or Python

**Either is defensible.** Choose based on:

- **TypeScript if:** you want fastest time-to-interactive-dashboard, largest contributor base, zero-friction `npx` UX
- **Python if:** you want better AST parsing for multi-language support, faster startup, stronger AI/ML ecosystem integration

**Decision criteria:**
1. Do you plan to do semantic analysis (AST-based) or just structural? (Python wins)
2. Do you want interactive HTML dashboard as core feature? (TypeScript wins)
3. Will you integrate with LLM APIs later? (Python wins)
4. Is `npx` zero-install critical for adoption? (TypeScript wins)

**Recommendation:** **TypeScript for Phase 1** (faster to market, better UI), **Python for Phase 2** (if semantic analysis becomes critical).

### Implementation Implications

- Use `ts-node` or `tsx` for CLI runtime
- Use React + TypeScript for dashboard components
- Build with `esbuild` for speed
- Single `index.html` output: bundled CSS/JS, no separate assets
- ESM modules throughout

---

## 6. Agent Integration: Complete the Story

### Current Gap

Spec says "for agents, lower understanding cost" but doesn't specify *how*.

### Current Plan

- `context-index.json` canonical structure
- Implies agents will integrate with it, but:
  - No schema documentation for agent consumption
  - No examples of agent integration
  - No mention of CLAUDE.md / .cursorrules / copilot-instructions.md generation

### Recommendation: Add MCP Server + Agent Output Modes

**Critical addition: MCP (Model Context Protocol) server**

repo-compass should expose a native MCP server so Claude/Cursor/Windsurf can query it directly:

```bash
# In .claude/mcp.json or similar
{
  "mcpServers": {
    "repo-compass": {
      "command": "npx",
      "args": ["repo-compass", "mcp"]
    }
  }
}
```

**MCP resources:**
- `repo://entrypoints` — list of entry points with confidence
- `repo://first-read-path` — recommended reading order
- `repo://key-paths` — important files/directories
- `repo://critical-paths` — workflows and critical sequences
- `repo://defer-for-now` — areas to skip initially

**Why this matters:**
- Agents can query repo context on-demand, not just at startup
- Reduces token waste (only fetch what's needed)
- Native integration with Claude/Cursor/Windsurf
- More powerful than static `.cursorrules` files

**Secondary: Dual-mode output for static files**

```bash
# Mode 1: Interactive HTML (default)
npx repo-compass
# → opens index.html with dashboard

# Mode 2: Agent-optimized formats
npx repo-compass --output-claude
# → generates .claude/repo-compass.md

npx repo-compass --output-cursor
# → generates .cursor/repo-compass.md

npx repo-compass --output-copilot
# → generates .github/copilot-instructions.md
```

**Priority:** MCP server (P0) > static file generation (P1)

---

## 7. Product Strategy: How to Get Stars

### The Reality

Technical excellence ≠ GitHub stars. Dev tools that get traction combine:

1. **Killer first experience** (10 seconds to wow)
2. **Screenshot/GIF that speaks for itself**
3. **Zero-friction setup** (`npx` or `curl`)
4. **Community sharing hooks**
5. **Solving a real, acute pain point** (not just nice-to-have)

### Critical Success Factor: Solve a Real Problem

**Question:** What is the acute pain point repo-compass solves?

Current positioning ("reduce first-entry reading cost") is too vague. Compare:

- **repomix:** "I need to give Claude my entire repo context" (acute: token limits)
- **DeepWiki:** "I need auto-generated docs for my repo" (acute: documentation debt)
- **repo-compass:** ??? (unclear)

**Suggested acute pain point:**

> "When I onboard a new agent (Claude, Cursor, etc.) to my codebase, it wastes 50% of its first session understanding the structure. repo-compass gives agents a deterministic, confidence-scored map so they start productive immediately."

This is more specific and measurable than "reduce reading cost."

### Recommended Go-to-Market Plan

#### Phase 1: MVP (Weeks 1-3)

- Implement static analysis engine (scan + extract)
- Build interactive HTML dashboard (D3 visualization)
- Add MCP server for agent integration
- Add static file generation (.cursorrules, CLAUDE.md)

**Realistic timeline:** 3-4 weeks for one person, not 2.

#### Phase 2: Showcase & Launch (Week 4-5)

Run repo-compass on 5-10 popular open-source projects:
- react
- next.js
- fastapi
- kubernetes
- deno

Save outputs as `/examples/<repo-name>/`:
- Screenshot of HTML dashboard
- Generated ONBOARDING.md
- Generated context-index.json

#### Phase 3: Community Seeding (Week 6+)

- Post on:
  - ProductHunt (with live demo link)
  - Twitter (showcase: "I ran repo-compass on [popular repo], here's what it found")
  - Dev.to (technical deep-dive on confidence scoring)
  - HN (positioning: "Deterministic repo navigation for coding agents")
- Create GitHub Action (auto-generate map in PRs?)
- Encourage early adopters to put "Made with repo-compass" badge in their generated files

#### README structure:

1. Hero image: screenshot of dashboard on a popular repo
2. "Why?" section: positioning vs. repomix/DeepWiki/Sourcegraph
3. Quick start: `npx repo-compass`
4. Feature list: HTML dashboard, MCP server, agent modes, confidence tracking
5. Showcase: gallery of example reports
6. Comparison table vs. competitors

### Additional Considerations

**Open source license:** MIT (most permissive, highest adoption) or Apache 2.0 (if you want patent protection). Avoid AGPL (scares enterprise users).

---

## 8. Missing Considerations

### Performance Targets

**Not discussed in original spec:** How fast should analysis be?

- 100 files: should complete in < 1 second
- 1,000 files: should complete in < 5 seconds
- 10,000 files: should complete in < 30 seconds

**Implication:** If targets are aggressive, need parallel file scanning and caching. If relaxed, can be simpler sequential implementation.

**Recommendation:** Set explicit SLO in Phase 1 spec.

### Incremental Analysis

**Not discussed:** What happens when repo changes?

Options:
1. **Full re-scan every time** (simple, but slow for large repos)
2. **Incremental updates** (cache previous results, only re-scan changed files)
3. **Hybrid** (full scan on first run, incremental on subsequent runs)

**Recommendation:** Phase 1 does full re-scan (simpler). Phase 2 adds incremental mode.

### Caching Strategy

Should repo-compass cache analysis results? Where?

- `.repo-compass/cache/` in the repo? (pollutes repo)
- `~/.cache/repo-compass/` globally? (privacy concern)
- No caching? (simplest, but slower)

**Recommendation:** No caching in Phase 1. Add in Phase 2 if performance becomes issue.

---

## 9. Documentation Issues

### Issue 1: Incomplete Manifest Enumeration

Current `manifests.kind`:
```
"package|pyproject|cargo|go|other"
```

**Missing:**
- `composer.json` (PHP)
- `Gemfile` (Ruby)
- `build.gradle` / `pom.xml` (Java/Kotlin/Maven)
- `setup.py` (legacy Python)
- `Makefile` (C/C++)
- `CMakeLists.txt` (CMake)
- `gradle-wrapper.properties` (Gradle)

**Action:** Expand enum in `docs/contracts.md` §2.

### Issue 2: ONBOARDING vs. repo.map Overlap

Both include:
- entrypoints
- defer-for-now
- likely entrypoint

**Need clearer separation:**

| Aspect | ONBOARDING.md | repo.map.md |
|--------|---------------|------------|
| **Audience** | New contributor ready to edit | Reader exploring unfamiliar code |
| **Tone** | Action-oriented ("do this first") | Navigation-oriented ("here's the layout") |
| **Entrypoints** | "Start here to add features" | "These are the entry points to understand" |
| **Defer** | "These can wait for your first PR" | "These areas are complex, understand core first" |

**Action:** Clarify in `docs/artifact-spec.md`.

### Issue 3: No Framework Priority List

Spec says: "framework-specific extraction is allowed only when deterministic"

**Missing:** Which frameworks to prioritize in Phase 1?

**Suggestion:**

```
High Priority (Phase 1):
  - Next.js / React
  - FastAPI / Django (Python)
  - Express / Node.js
  - Spring Boot (Java)

Phase 2:
  - Ruby on Rails
  - NestJS
  - Laravel
  - etc.
```

**Action:** Add to `docs/phase1-foundation.md` §3.

### Issue 4: Confidence Scoring Needs Nuance

Current: `high|medium|low`

**Problem:** In practice, "medium" becomes a dumping ground for anything uncertain.

**Options:**

A. **Stay with 3-level** but add guidelines:
   - High: directly observable from filesystem (manifest exists, entrypoint found by pattern matching)
   - Medium: inferred from structure (large fan-in file, but unconfirmed importance)
   - Low: speculative (detected pattern suggests, but could be wrong)

B. **Use numeric 0-1 internally**, render as 3-level for humans

**Recommendation:** Option A with detailed guidelines in `docs/contracts.md`.

---

## 10. Revised Priority List

| Priority | Item | Rationale |
|----------|------|-----------|
| **P0** | Clarify acute pain point & positioning vs. DeepWiki | Blocks all marketing and product decisions |
| **P0** | Decide on TypeScript/Node or Python stack | Blocks all architecture decisions |
| **P0** | Design interactive HTML dashboard mockup | Primary differentiator for stars |
| **P0** | Design MCP server spec for agent integration | Unique value vs. competitors |
| **P1** | Simplify Phase 1 scope (remove collaboration scaffold) | Unblocks faster MVP shipping |
| **P1** | Set performance targets (SLO for analysis time) | Informs architecture decisions |
| **P1** | Expand manifests enum; clarify ONBOARDING vs. repo.map | Completeness of contracts |
| **P1** | Define framework priority list (Phase 1 vs. Phase 2) | Scope clarity |
| **P2** | Add confidence scoring guidelines | Documentation quality |
| **P2** | Create showcase examples (5-10 popular repos) | Marketing launch readiness |
| **P2** | Design incremental analysis strategy | Phase 2 feature |

---

## 11. Key Decisions Needed Before Implementation

Before starting code, answer:

1. **Positioning**: What is the acute pain point? (vs. DeepWiki, repomix, etc.)
2. **Technology**: TypeScript/Node.js or Python? (Both viable; choose based on UI vs. AST priorities)
3. **Primary Output**: HTML dashboard design spec (wireframe + interaction model)
4. **Agent Integration**: Will Phase 1 include MCP server? (Recommend: yes, as P0)
5. **Performance SLO**: How fast should analysis complete? (100 files in 1s? 10k files in 30s?)
6. **MVP Feature Scope**: Which stages (A-E) are in Phase 1? (Recommend: all 5, but simplified)
7. **Framework Support**: Which frameworks in Phase 1? (Recommend: JavaScript/Python/Java only)
8. **Open Source License**: MIT or Apache 2.0? (Recommend: MIT for adoption)

---

## 12. Conclusion

The current Phase 1 specification is **engineering-sound but product-incomplete**. Critical gaps:

1. **Competitive positioning is unclear** — DeepWiki is already in this space; need explicit differentiation
2. **Agent integration underspecified** — MCP server should be P0, not afterthought
3. **Technology stack undecided** — TypeScript and Python are both viable; choose based on priorities
4. **Performance targets missing** — affects architecture decisions
5. **Timeline is optimistic** — 4 weeks is aggressive for one person; 6-8 weeks is more realistic

### Recommended Next Steps

1. **Week 1:** Finalize positioning, tech stack, and MCP spec
2. **Week 2:** Design HTML dashboard mockup and MCP server interface
3. **Week 3-5:** Implement MVP (scan + extract + render)
4. **Week 6:** Create showcase examples
5. **Week 7:** Launch and community seeding

With these adjustments, repo-compass can meaningfully differentiate from competitors and achieve traction on GitHub.
