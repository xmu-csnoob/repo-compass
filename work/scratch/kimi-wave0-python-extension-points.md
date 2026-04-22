# Kimi Wave 0 准备文档 — Python 扩展点清单

> 本清单基于 Phase 1 的 scan / extract / comprehend 实现预读，
> 为 Wave 1（Epic 1 + Epic 2）的 Python 支持提供精确的扩展点位置。

---

## 1. 合约层扩展（必须先等 Codex Wave 0 冻结）

| 扩展点 | 当前文件 | 当前状态 | Phase 2 动作 |
|--------|----------|----------|--------------|
| `MANIFEST_KINDS` | `src/contracts/enums.ts:12-20` | 已有 `pyproject`, `setup-py`, `setup-cfg`, `requirements` | 确认是否需要新增 `poetry-lock`, `pipfile`, `pipfile-lock` |
| `GRAPH_EDGE_KINDS` | `src/contracts/enums.ts:59-68` | 已有 `module-link` | 确认 Python import 边是否复用 `module-link` 或新增 `python-import` |
| `PRIORITY_SIGNALS` | `src/contracts/enums.ts:70-78` | 7 个信号 | 确认是否需要 Python 专属信号（如 `python-package-root`） |
| `PATH_ROLES` | `src/contracts/enums.ts:1-10` | 8 个 role | 确认是否需要 `venv` / `__pycache__` 等 role |
| `structureScanSchema` | `src/contracts/schemas.ts:60-76` | `detected.languages` 为 `string[]` | 无改动，Python 作为语言字符串加入即可 |
| `signalExtractionSchema` | `src/contracts/schemas.ts:115-124` | 通用结构 | 无改动，Python 信号复用同一 schema |
| `comprehensionSchema` | `src/contracts/schemas.ts:192-218` | 通用结构 | 无改动 |

**关键判断：** 合约层大部分已为 Python 预留枚举值，Wave 0 只需确认是否新增 `poetry-lock` / `pipfile` 等 manifest kind。

---

## 2. Scan 层扩展点（Epic 1）

### 2.1 语言检测 — `detectLanguages()`
- **位置：** `src/scan/index.ts:122-142`
- **当前：** 仅检测 TS/JS/JSON/Markdown
- **扩展：** 增加 `.py`, `.pyi`, `.pyx`, `.pyd` 检测，返回 `"Python"`
- **代码量：** 约 5 行

### 2.2 Manifest 检测 — `collectManifests()`
- **位置：** `src/scan/index.ts:222-243`
- **当前：** 仅检测 `package.json` 和 lockfile
- **扩展：** 增加以下文件检测：
  - `pyproject.toml` → `kind: "pyproject"`
  - `setup.py` → `kind: "setup-py"`
  - `setup.cfg` → `kind: "setup-cfg"`
  - `requirements.txt` / `requirements*.txt` → `kind: "requirements"`
  - `Pipfile` → 新增 kind（需合约确认）
  - `poetry.lock` → 新增 kind（需合约确认）
- **代码量：** 约 15-20 行

### 2.3 路径分类 — `classifyPathRole()`
- **位置：** `src/scan/index.ts:45-120`
- **当前：** 基于 JS/TS 约定（`src/`, `app/`, `__tests__/`, `.test.` 等）
- **扩展：**
  - Python 测试路径：`/tests/`, `/test_*.py`, `*_test.py`
  - Python 源码路径：`*.py`, `*.pyi`
  - Python 包目录：含 `__init__.py` 的目录
  - 虚拟环境目录：`venv/`, `.venv/`, `env/`, `.env/`（应标记为 `vendor` 或新增 `venv` role）
  - 缓存目录：`__pycache__/`, `.pytest_cache/`, `.mypy_cache/`（应标记为 `build` 或 `generated`）
- **代码量：** 约 30-40 行

### 2.4 框架检测 — `detectFrameworkHints()`
- **位置：** `src/scan/index.ts:144-203`
- **当前：** 检测 nextjs / vite / react / vue / express / node-cli / library
- **扩展：** 新增 Python 框架检测（读取 `pyproject.toml` / `requirements.txt`）：
  - `fastapi` → 检测 `fastapi` 依赖
  - `flask` → 检测 `flask` 依赖
  - `django` → 检测 `django` 依赖
  - `pytest` → 检测 `pytest` 依赖（测试框架 hint）
  - `poetry` → 检测 `poetry.lock` 或 `[tool.poetry]`
  - `python-cli` → 检测 `[project.scripts]` 或 `console_scripts`
- **代码量：** 约 40-50 行（含 manifest 内容读取）

### 2.5 Ecosystem 检测
- **位置：** `src/scan/index.ts:289`
- **当前：** `manifests.some(m => m.kind === "package-json") ? ["node"] : []`
- **扩展：** 增加 Python ecosystem 检测：
  ```ts
  const ecosystems: string[] = [];
  if (manifests.some(m => m.kind === "package-json")) ecosystems.push("node");
  if (manifests.some(m => ["pyproject", "setup-py", "setup-cfg", "requirements"].includes(m.kind))) {
    ecosystems.push("python");
  }
  ```
- **代码量：** 约 5 行

### 2.6 Noise 抑制规则（Epic 1.4）
- **位置：** `src/shared/ignore.ts:6-15`（DEFAULT_IGNORE_RULES）
- **当前：** 忽略 `.git/`, `node_modules/`, `.next/` 等
- **扩展：** 增加 Python 专属默认忽略：
  ```
  "__pycache__/",
  ".venv/",
  "venv/",
  ".pytest_cache/",
  ".mypy_cache/",
  "*.egg-info/",
  ".tox/",
  "dist/",      // 已存在
  "build/",     // 需新增
  ```
- **代码量：** 约 8-10 行

---

## 3. Extract 层扩展点（Epic 2）

### 3.1 Python Entrypoint 检测
- **位置：** `src/extract/index.ts:44-56`（COMMON_ENTRYPOINTS）
- **当前：** 仅列出 JS/TS 常见入口文件
- **扩展：** 新增 Python 常见入口：
  ```ts
  const PYTHON_COMMON_ENTRYPOINTS = [
    "src/__main__.py",
    "src/main.py",
    "src/app.py",
    "src/cli.py",
    "src/server.py",
    "app.py",
    "main.py",
    "manage.py",        // Django
    "wsgi.py",          // Django/WSGI
    "asgi.py",          // Django/ASGI
    "__init__.py",      // package root
  ] as const;
  ```
- **代码量：** 约 15 行

### 3.2 Python Import 图边提取
- **位置：** `src/extract/index.ts:124-149`（`extractRelativeImports()`）
- **当前：** 仅提取 JS/TS 的 import/require/reference
- **扩展：** 新增 Python import 提取：
  - `import x.y.z` → module-link
  - `from x.y import z` → module-link
  - `__import__('x')` → module-link（动态，低置信）
- **实现方式：** 复用 `GRAPH_EDGE_KINDS` 中的 `module-link`，或新增 `python-import`
- **代码量：** 约 30-40 行（正则提取）

### 3.3 Python Import 路径解析
- **位置：** `src/extract/index.ts:100-118`（`resolveRelativeImport()`）
- **当前：** 仅解析 JS/TS 的相对导入（含 extension resolution）
- **扩展：** 新增 Python 模块路径解析：
  - `import a.b.c` → 解析为 `a/b/c.py` 或 `a/b/c/__init__.py`
  - 相对导入：`from . import x` → 同级目录的 `x.py` 或 `x/__init__.py`
  - 需考虑 `PYTHONPATH` 和包根（含 `__init__.py` 的目录）
- **代码量：** 约 40-60 行（较复杂，需处理包边界）

### 3.4 Python Manifest 解析
- **位置：** `src/extract/index.ts:219-311`（package.json 解析循环）
- **当前：** 读取 `package.json` 提取 scripts / bin / main
- **扩展：** 新增 Python manifest 解析：
  - `pyproject.toml`：解析 `[project.scripts]`（CLI entrypoints）、`[project.entry-points]`
  - `setup.py` / `setup.cfg`：解析 `console_scripts`
  - `requirements.txt`：仅作为 manifest 存在，不提取命令
- **代码量：** 约 50-80 行（含 TOML 解析，可能需要新增依赖如 `@iarna/toml`）

### 3.5 Python 命令提取
- **位置：** `src/extract/index.ts:237-256`（scripts 提取）
- **当前：** 从 `package.json` 的 `scripts` 字段提取命令
- **扩展：** Python 项目通常没有统一脚本定义，但可从以下提取：
  - `pyproject.toml` 的 `[tool.poetry.scripts]`
  - `Makefile` 中的目标（可选，可能超出范围）
  - `tox.ini` 的 `[testenv]` 命令（可选）
- **建议：** Phase 2 先实现 manifest 中的 scripts，不扩展 Makefile/tox

### 3.6 Entrypoint Kind 推断
- **位置：** `src/extract/index.ts:77-98`（`inferEntrypointKind()`）
- **当前：** 基于文件名和命令推断 app/cli/server/library/test-harness/build
- **扩展：** 新增 Python 专属推断规则：
  - `manage.py`, `wsgi.py`, `asgi.py` → `server`
  - `__main__.py`, `cli.py`, `[project.scripts]` 指向 → `cli`
  - `app.py` + FastAPI/Flask hint → `server`
  - `src/__init__.py`（包根）→ `library`
  - `test_*.py`, `*_test.py` → `test-harness`
- **代码量：** 约 20-30 行

### 3.7 Priority Candidate 生成
- **位置：** `src/extract/index.ts:507-527`（framework-specific candidates）
- **当前：** nextjs / express 的 framework-core / workflow-core
- **扩展：** 新增 Python 框架核心路径：
  - FastAPI：`src/main.py` 或 `app.py` → `workflow-core`
  - Flask：`app.py` 或 `application.py` → `workflow-core`
  - Django：`manage.py` → `workflow-core`
- **代码量：** 约 15-20 行

---

## 4. Comprehend 层扩展点（Epic 3，Codex 负责）

Comprehend 层目前**无语言专属逻辑**，全部为通用图构建和推导：

| 模块 | 是否需改动 | 说明 |
|------|-----------|------|
| `buildComprehension()` | 否 | 通用图构建，Python 节点/边复用同一逻辑 |
| `repo_shape` 推导 | 可能 | 需确认 Python `library` / `service` / `tool` 的 hint 映射 |
| `agent_hints` 生成 | 是 | 需新增 Python 专属 hint（见 4.1） |
| `entrypointSummary()` | 否 | 通用 kind 已有 summary |

### 4.1 Agent Hints 扩展
- **位置：** `src/comprehend/index.ts:283-342`
- **当前：** 仅生成 Node/npm 相关 hint
- **扩展：** 新增 Python 专属 hint：
  - `setup`: "Run `pip install -e .` or `poetry install` before editing."
  - `run`: "Use `python -m <module>` or `uvicorn main:app` to start."
  - `test`: "Use `pytest` or `python -m pytest` to run tests."
  - `safe-edit-zone`: 优先推荐含 `__init__.py` 的 source 目录
- **代码量：** 约 30-40 行

---

## 5. 依赖与工具链评估

| 需求 | 当前依赖 | Phase 2 动作 |
|------|----------|--------------|
| TOML 解析 | 无 | 需新增 `@iarna/toml` 或 `smol-toml`（用于 `pyproject.toml`） |
| Python 语法解析 | 无 | 不需要完整 AST，正则提取 import 即可 |
| 路径解析 | `node:path` | 复用 `path.posix`，Python 包路径逻辑手写 |
| 文件读取 | `node:fs/promises` | 复用 |

---

## 6. 扩展点汇总（按 Epic 分组）

### Epic 1: Python Repo Input & Structure Scan

| 子任务 | 扩展点文件 | 函数/位置 | 预估代码量 |
|--------|-----------|-----------|-----------|
| 1.2 Python manifest 检测 | `src/scan/index.ts` | `collectManifests()` | 15-20 行 |
| 1.3 路径分类扩展 | `src/scan/index.ts` | `classifyPathRole()` | 30-40 行 |
| 1.4 Noise 抑制 | `src/shared/ignore.ts` | `DEFAULT_IGNORE_RULES` | 8-10 行 |
| 1.4 语言检测 | `src/scan/index.ts` | `detectLanguages()` | 5 行 |
| 1.4 框架检测 | `src/scan/index.ts` | `detectFrameworkHints()` | 40-50 行 |
| 1.5 Ecosystem 元数据 | `src/scan/index.ts` | `scanRepository()` 内 | 5 行 |

### Epic 2: Python Signal Extraction

| 子任务 | 扩展点文件 | 函数/位置 | 预估代码量 |
|--------|-----------|-----------|-----------|
| 2.1 Entrypoint 检测 | `src/extract/index.ts` | `COMMON_ENTRYPOINTS` + 循环 | 15 行 |
| 2.1 Entrypoint kind | `src/extract/index.ts` | `inferEntrypointKind()` | 20-30 行 |
| 2.2 命令提取 | `src/extract/index.ts` | manifest 解析循环 | 50-80 行 |
| 2.3 图边扩展 | `src/extract/index.ts` | `extractRelativeImports()` + 新增 | 30-40 行 |
| 2.3 模块路径解析 | `src/extract/index.ts` | 新增 `resolvePythonImport()` | 40-60 行 |
| 2.4 Priority 候选 | `src/extract/index.ts` | framework hints 循环 | 15-20 行 |
| 2.5 Defer 候选 | `src/extract/index.ts` | 现有 defer 逻辑自动覆盖（vendor/build role） | 0 行 |

### Epic 4: Renderer（后续）

| 子任务 | 扩展点文件 | 说明 |
|--------|-----------|------|
| 4.1 repo.map.md | `src/render/index.ts` | 通用渲染，无 Python 专属逻辑 |
| 4.2 ONBOARDING.md | `src/render/index.ts` | 通用渲染，agent_hints 已包含 Python 信息 |
| 4.3 agent-start.md | `src/render/index.ts` | 通用渲染，依赖 comprehend 输出 |

---

## 7. 风险与建议

1. **TOML 依赖：** `pyproject.toml` 解析需要 TOML parser。建议选用零依赖的 `smol-toml`（体积小，ESM 友好）。
2. **Python 包路径解析复杂度：** Python 的 `import a.b.c` 解析涉及包边界（`__init__.py`），比 JS/TS 的相对导入复杂。建议 Wave 1 先实现简单情况（同级/子目录），复杂路径（如 namespace package）标记为 low confidence。
3. **Noise 抑制边界：** `.venv/` 和 `venv/` 可能在项目内被提交（虽然不应该），建议只作为默认 ignore，允许 `.gitignore` 覆盖。
4. **合约冻结依赖：** 所有扩展点都依赖 Codex 在 Wave 0 冻结 `MANIFEST_KINDS` 和 `GRAPH_EDGE_KINDS`。Kimi 应在 Wave 0 结束前提交扩展点清单供 Codex 审核。

---

## 8. 最小可运行扩展（MVP）

如果资源受限，以下是最小 Python 支持所需：

1. **Scan：** manifest 检测（pyproject.toml / requirements.txt）+ 语言检测（.py）+ 路径分类（source/tests）+ noise 抑制（__pycache__ / .venv）
2. **Extract：** 常见 entrypoint 检测（`__main__.py`, `main.py`, `app.py`, `manage.py`）+ 简单 import 提取（`import x` / `from x import y`）+ pyproject.toml scripts 解析
3. **Comprehend：** Python agent hints（pip install / pytest / python -m）

以上可在不新增 TOML 依赖的情况下先跑通（如果暂时不解析 `pyproject.toml` 内容，仅将其作为 manifest 存在）。

---

*文档生成时间：2026-04-22*
*基于 commit：当前工作目录 HEAD*
