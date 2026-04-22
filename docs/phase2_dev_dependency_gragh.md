# Phase 2 Execution Plan — Three-Session View

This document is the execution-side dependency graph for Phase 2. It is derived
from:

- `docs/phase2-kanban.md`
- `docs/phase2-foundation.md`
- `docs/phase2-contracts.md`
- `docs/phase2-test-strategy.md`

It is not the source of truth for scope. Its job is to make implementation
order, parallel windows, and gate conditions explicit enough that engineering
work does not drift.

## 图例
- 🔵 Codex session
- 🟡 Kimi session (Claude Code)
- 🟠 Minimax session (OpenCode)
- ⚡ 并行窗口
- 🚪 门控点（必须等待）
- ✅ 可提前准备，不等上游代码完成

---

## 全局原则

- 先冻结 contract，再并行实现。
- Python 质量门通过前，不进入 freshness 实装。
- `agent-start.md` 的 overflow trimming 是独立实现对象，不与主 renderer 混写。
- Minimax 只能做 fixture、snapshot harness、报告骨架，不定义预期输出。
- 任何新增测试 gate 都必须能在 kanban 中找到直接对应的实现任务。

---

## Wave 0 — 合约冻结（串行，只有 Codex）

**无并行。Codex 先动，其他两个 session 等待。**

```
🔵 Codex
  Epic 0: Contract & Fixture Freeze
    0.1  Freeze Phase 2 canonical schema extensions
    0.2  Freeze Python scope and failure boundaries
    0.3  Freeze agent-start.md contract
    0.4  Freeze verification targets

🟡 Kimi     → 等待 0.1 + 0.2
🟠 Minimax  → 等待 0.4（fixture 验收标准确认后才能建 fixture 仓库）
```

**Wave 0 出口门控：**
- 0.1 完成 → 解锁 Kimi Epic 1 + Epic 2
- 0.2 完成 → 解锁 Kimi Epic 1
- 0.3 完成 → 解锁 Kimi Epic 4
- 0.4 完成 → 解锁 Minimax fixture 准备

**Wave 0 可提前准备：**
- ✅ Kimi 可预读 `Phase 1` 的 scan/extract/comprehend 实现，准备 Python 扩展点清单
- ✅ Minimax 可搜集候选 Python fixture repo 类型，但不能先写 golden expectation

---

## Wave 1 — Python Scan & Extraction（M1）

**⚡ 第一个并行窗口：Kimi 主线 + Minimax 准备 fixture**

```
🟡 Kimi（串行）
  Epic 1: Python Repo Input & Structure Scan
    1.1  Extend Stage A repo input for Phase 2
    1.2  Implement Python manifest detection
    1.3  Extend path classification for Python repos
    1.4  Implement Python noise suppression rules
    1.5  Build scan-level Python reproducibility metadata
    ↓ 1.2 + 1.3 + 1.4 完成后
  Epic 2: Python Signal Extraction
    2.1  Implement Python entrypoint detection
    2.2  Extract Python commands and bootstrap actions
    2.3  Extend lightweight graph edges
    2.4  Compute Phase 2 priority candidates
    2.5  Compute Python defer candidates
    2.6  Emit validated Phase 2 signals.json

🟠 Minimax（与 Kimi 并行）
  依赖 Epic 0 的 0.4 完成，与 Kimi 的 Epic 1/2 同步进行
  Epic 6 前置：Build Python fixture repos（6.1 子任务拆出提前做）
    - Python CLI fixture repo
    - Python library fixture repo
    - Python web/service fixture repo（FastAPI / Flask / Django 各一个）
    - Noisy Python fixture repo
    - Mixed Python + JS/TS fixture repo
  注意：Minimax 只建仓库，不定义预期输出。预期输出由 Codex 在 Wave 3 审批。

🔵 Codex
  → 等待 Epic 2 完成（2.1 + 2.3 + 2.4 + 2.5）后启动 Epic 3
  → 可在此窗口做 Epic 3 的结构设计和接口定义（不需要等实现）
```

**Wave 1 出口门控：**
- Epic 1 + Epic 2 全部完成 → 解锁 Codex Epic 3
- Minimax fixture 仓库就绪 → Codex Wave 3 可直接用于 Epic 6

**Wave 1 关键风险：**
- Python noise suppression 如果没在 `1.4` 收敛，`2.4` 和 `3.3` 的 ranking 会整体漂移
- `2.3` 的 `module-link` 如果定义过宽，会直接污染 `critical_paths`

---

## Wave 2 — Canonical Metadata Builder（M2）

**无并行。Codex 独占。Kimi 和 Minimax 等待或做内部准备。**

```
🔵 Codex
  Epic 3: Canonical Metadata Builder
    3.1  Extend graph layer for Phase 2
    3.2  Extend top-level repo metadata
    3.3  Derive Phase 2 views from the graph
    3.4  Add freshness metadata container
    3.5  Enforce inference boundary
    3.6  Emit validated Phase 2 context-index.json

🟡 Kimi
  → 等待 3.3 + 3.4 + 3.6 完成后启动 Epic 4
  → 可在此窗口阅读 Epic 4 的接口规范，准备 renderer 实现

🟠 Minimax
  → fixture 仓库已就绪，等待 Codex 在 Wave 3 审批 golden snapshot
```

**Wave 2 出口门控：**
- 3.3 + 3.4 + 3.6 完成 → 解锁 Kimi Epic 4
- 3.6 + 1.1 完成 → Codex Epic 5 前置条件满足（还差 4.3）

**Wave 2 关键风险：**
- `3.3` 和 `3.5` 如果没有把 Python 低置信推断压住，后续 renderer 做得再对也只是稳定输出错误内容
- freshness metadata container (`3.4`) 只能加容器和语义，不能偷跑 freshness 实装

---

## Wave 3 — Renderers & CLI（M3）

**⚡ 最大并行窗口：Kimi 和 Codex 双线并行**

```
🟡 Kimi（先行）
  Epic 4 前段：
    4.1  Update repo.map.md renderer
    4.2  Update ONBOARDING.md renderer
    4.3  Implement agent-start.md renderer（主体逻辑）

    ↓ 4.3 完成 → 触发并行

  Epic 4 后段（与 Codex Epic 5 并行进行）：
    4.4  Implement agent-start.md overflow trimming
           - Section-aware budget measurement
           - Overflow trimming order as specified
           - Preserve warnings while trimming
           - Keep trimming logic isolated for direct tests
    4.5  Integrate output writing

🔵 Codex（等 4.3 完成后启动）
  Epic 5: CLI & Pipeline Integration
    5.1  Update CLI for Phase 2 output path
    5.2  Integrate Phase 2 pipeline defaults
    5.3  Add CLI-facing freshness mode wiring

🟠 Minimax
  → 等待 Codex 在此阶段审批 fixture golden snapshots
  → 可开始 Epic 6 的 snapshot harness 脚手架（不依赖 runner 完成）
```

**Wave 3 出口门控：**
- 4.4 overflow trimming 完成 → Epic 6 的 overflow 测试才能跑
- Epic 4 + Epic 5 全部完成 → 解锁 Codex Epic 6

**Wave 3 关键风险：**
- 如果 `4.4` 不是隔离实现，`6.4` 的 trimming order tests 会变成脆弱的黑盒补丁测试
- 如果 `5.3` 把 freshness mode 暴露得过早，用户会误以为 freshness 已可用

---

## Wave 4 — Quality Gates & E2E Report（M4）

**无并行。Codex 主导，Minimax 辅助。**

```
🔵 Codex
  Epic 6: Test Matrix & Quality Gates
    6.1  Build Python fixture suite（使用 Minimax 已建好的 fixture 仓库）
    6.2  Add contract and compatibility tests
    6.3  Add comprehension and ranking tests
    6.4  Add renderer and startup contract tests
           - agent-start.md snapshots
           - overflow trimming order tests
           - freshness rendering tests
    6.5  Produce Phase 2 end-to-end report
           phase2-python-end2end-test-report.md

🟠 Minimax（辅助）
  → 在 Codex 指定 golden snapshot 后，补充 snapshot harness 机械覆盖
  → 不得定义预期输出，只负责执行已由 Codex 审批的测试

🟡 Kimi
  → 等待 6.5 的 ship/no-ship 推荐
```

**Wave 4 出口门控：**
- 6.5 E2E report 推荐 ship → 解锁 Kimi Epic 7
- 6.5 E2E report 推荐 no-ship → 回到对应 Epic 修复，不进入 Wave 5

**Wave 4 关键风险：**
- unit tests 通过不代表 Python quality gate 通过
- `phase2-python-end2end-test-report.md` 是 ship gate，不是交付后补文档

---

## Wave 5 — Freshness System（M5）

**Kimi 独立窗口，Codex 审核。**

```
🟡 Kimi
  Epic 7: Freshness System
    7.1  Implement freshness state model（fresh / stale / degraded / unknown）
    7.2  Implement watch-mode regeneration
    7.3  Implement CI regeneration path
    7.4  Add freshness verification

🔵 Codex
  → Review gate：验收 7.1—7.4

🟠 Minimax
  → 无任务
```

---

## 并行窗口汇总

| 窗口 | Milestone | 谁并行 | 触发条件 | 说明 |
|------|-----------|--------|----------|------|
| ⚡ W1 | M1 | Kimi 主线 + Minimax fixture 准备 | 0.4 完成 | 低风险并行，Minimax 只建仓库 |
| ⚡ W3a | M3 | Kimi 4.4/4.5 + Codex Epic 5 | 4.3 完成 | 最高价值并行，可压缩 1 个交付周期 |

---

## 测试与实现对应关系

这部分用于避免“实现任务”和“验收任务”脱钩。

| 实现任务 | 直接验收项 |
|----------|------------|
| `1.2` Python manifest detection | `6.2` schema / manifest coverage tests |
| `1.4` Python noise suppression | `6.3` anti-noise ranking tests |
| `2.1` Python entrypoint detection | `6.3` entrypoint credibility tests |
| `2.3` module-link edges | `6.3` critical path / ranking tests |
| `3.4` freshness metadata container | `6.2` freshness enum coverage |
| `3.5` degraded trust boundary | `6.4` freshness rendering tests |
| `4.3` agent-start main renderer | `6.4` startup snapshots |
| `4.4` overflow trimming | `6.4` trimming order tests |
| `5.3` CLI freshness mode wiring | `7.4` watch / CI / trust signaling tests |
| `7.1` freshness state model | `7.4` state coverage tests |
| `7.2` watch mode | `7.4` watch-mode tests |
| `7.3` CI mode | `7.4` CI-mode tests |

---

## 最小开工顺序

如果只按“最窄关键路径”开工，建议顺序是：

1. `0.1` + `0.2` + `0.3`
2. `1.2` + `1.3` + `1.4`
3. `2.1` + `2.3` + `2.4`
4. `3.3` + `3.5`
5. `4.3` + `4.4`
6. `6.3` + `6.4` + `6.5`
7. `7.1` + `7.2` + `7.3` + `7.4`

如果资源允许并行，优先利用 W1 和 W3a，不要试图提前启动 Wave 5。

---

## 关键路径（最窄的交付通道）

```
Epic 0
  → Epic 1 → Epic 2
    → Epic 3
      → Epic 4 前段（到 4.3）
        → [并行] Epic 4 后段 + Epic 5
          → Epic 6（到 6.5）
            → Epic 7
```

**每一步都是串行门控，没有捷径。压缩时间的唯一手段是充分利用 W1 和 W3a 两个并行窗口。**
