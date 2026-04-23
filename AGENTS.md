# Multi-Agent Parallel Development Rules

This repository uses a multi-agent parallel development model. All agents MUST follow these rules to avoid conflicts and enable clean collaboration.

## 1. Model Self-Identification

Each agent MUST know which model it is before starting work. Check using the method for your platform:

| Platform | How to check your model |
|----------|------------------------|
| **Claude Code** | Read `~/.claude/settings.json` — look for the `"model"` field. Or run `ccswitch` to see the current active model. |
| **Codex (OpenAI)** | Check `~/.codex/config` or the `OPENAI_MODEL` env var. Or run `codex --help` to see the default model flag. |
| **Kimi** | Check your CLI config or the model setting in your client. |
| **Minimax** | Check your CLI config or the model setting in your client. |

> **Rule**: If you cannot confirm your model identity, STOP and ask the user. Do not guess.

## 2. Worktree-Isolated Development

Every agent works in its own **git worktree** — never in the main working directory.

### Directory Layout

```
repo-compass/                  # main worktree (dev branch)
  .worktrees/
    phase2-codex/             # Codex agent worktree
    phase2-kimi/              # Kimi agent worktree
    phase2-minimax/           # Minimax agent worktree
    phase3-codex/             # next phase
    ...
```

### Creating a New Worktree

```bash
# From the main repo directory, on dev branch
git worktree add .worktrees/phase{N}-{model} -b phase{N}-{model}
```

Example:
```bash
git worktree add .worktrees/phase3-codex -b phase3-codex
```

### Rules

- Each agent ONLY modifies files in its own worktree directory.
- Do NOT switch branches in the main worktree.
- Do NOT run `git checkout` to jump between branches — that's what worktrees are for.

## 3. Branch Naming Convention

All feature branches for parallel agent work:

```
phase-{N}-{model}
```

Where:
- `{N}` = phase number (e.g., `2`, `3`, `4`)
- `{model}` = lowercase model identifier (e.g., `codex`, `kimi`, `minimax`, `claude`)

Examples:
- `phase2-codex`
- `phase2-kimi`
- `phase3-minimax`
- `phase4-claude`

## 4. Merge Strategy

1. Each agent completes work in its own worktree + branch.
2. When ready, the user (or a designated integration agent) merges all `phase-{N}-*` branches into `dev`.
3. Prefer **squash merge** or **rebase merge** (repository enforces linear history).
4. After merge, clean up the worktree:

```bash
git worktree remove .worktrees/phase{N}-{model}
git branch -d phase{N}-{model}
```

## 5. Conflict Avoidance

- Each phase's scope is planned in advance so agents work on non-overlapping files when possible.
- If two agents must touch the same file, coordinate through the user or a shared plan document.
- Shared contracts (`src/contracts/`) should be treated as read-only during a phase unless explicitly assigned.

## 6. Current Active Worktrees

Run `git worktree list` to see all active worktrees and their branches.
