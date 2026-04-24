# Phase 3 产品分析：架构层面的系统性改进

## 概述

基于用户反馈（`user_review.txt`）对 repo-compass 的产物质量评估，本文档从架构设计层面分析当前系统的根本薄弱点，提出 **8 个系统性改进方向**。这些不是单点的代码修复，而是需要管线多个阶段协同演进的架构升级。

**关键架构决策**：涉及语义识别（项目功能、API 语义、领域实体、请求处理链）必须走 **LLM** 路径。非 LLM 方式（正则/AST）只作为不保证质量的 fallback。这个决策贯穿所有改进方向的设计。

---

## 用户反馈核心问题汇总

用户评分 **6/10**，具体痛点：

| 问题类别 | 表现 | 严重程度 |
|---------|------|---------|
| **关键信息缺失** | FastAPI 启动命令错误、缺少 API 路由、缺少测试命令推断、缺少依赖摘要 | 🔴 严重 |
| **噪音信息过多** | 空 `__init__.py` 被大量提升、`first_read_path` 太长（6 条）、`critical_paths` 为空 | 🟡 中等 |
| **分类精度差** | 两个明显的 service 项目都被判为 mixed | 🟡 中等 |
| **信息重复冗余** | 同一信息在 5 个产物间重复 5 次，只是格式不同 | 🟢 低 |

---

## 6 个架构层面的改进方向

### 1. 缺少"语义理解"层 —— 管线只看结构，不懂语义

**现状分析**

管线流程: Scan → Extract → Comprehend → Render

实际上 Comprehend 做的事更像是"结构化汇总"而非"理解"。虽然管线能识别出哪些是 entrypoint、哪些是依赖，但永远无法回答"这个项目是做什么的"。

**用户痛点**

> 看完所有产物后，我只知道这是一个 Flask/FastAPI 项目，但不知道它做了什么（一个 CRUD items 服务）

**架构问题**

设计原则声称"prefer deterministic static signals first; LLM is optional"。这个原则本身是对的，但被理解成了"optional = absent"。结果是管线永远停留在"what files exist"的层面，无法进阶到"what does the system do"。

**核心判断：语义识别必须走 LLM**

涉及到语义理解（项目功能、API 语义、领域实体、请求处理链），**不要尝试非 LLM 的方式**。即使做正则/AST 解析，也只做不保证质量的 fallback：

- 正则匹配 `@app.get("/items")` 能拿到路由，但拿不到"items"是领域实体这个语义
- AST 能识别 `class Item(BaseModel)`，但不知道这是"item 管理系统的核心领域对象"
- 只有 LLM 能从代码结构和命名中推断出真正的语义含义

**改进方向：引入 LLM Signal Enrichment 层**

在 Extract 和 Comprehend 之间增加 **LLM Signal Enrichment**：

```
Scan → Extract → [并行]
                  ├─→ Ecosystem Lexicon 查询 → 确定性信号
                  └─→ LLM Signal Enrichment → 语义信号
                        ↑
                        输入：Extract 产出的结构化摘要（2000-4000 tokens）
                  ↓
              Comprehend（融合确定性 + 语义信号）
                  ↓
              Render
```

**LLM 的输入**：已经过管线筛选的少量关键内容，而非整个仓库：

```typescript
interface LLMContextPayload {
  repo_shape: "service" | "application" | "library" | "tool";
  framework_hints: string[];
  key_files: {
    path: string;
    role: "entrypoint" | "router" | "model" | "config";
    content_snippet: string;  // 前 50 行或关键段落
  }[];
  manifest_summary: {
    dependencies: string[];
    scripts?: Record<string, string>;
  };
  import_graph: {
    central_nodes: string[];
    entry_to_core_paths: string[][];
  };
}
```

**LLM 的输出**：结构化语义信号，通过 Zod schema 严格约束：

```typescript
const llmSignalSchema = z.object({
  schema_version: z.literal("2.0"),
  signals: z.array(z.object({
    type: z.enum([
      "function_summary",      // "这是一个 CRUD items API 服务"
      "api_surface",           // [{ method: "GET", path: "/items", description: "..." }]
      "domain_entities",       // [{ name: "Item", fields: [...], description: "..." }]
      "request_paths",         // [["main.py", "routers/items.py", "models/item.py"]]
      "test_strategy",         // "使用 pytest，conftest.py 中定义了共享 fixture"
      "deployment_model",      // "ASGI 应用，通过 uvicorn 运行"
    ]),
    content: z.string().max(200),
    confidence: z.enum(["high", "medium", "low"]),
    evidence: z.array(z.string()),  // 必须引用证据
    source_files: z.array(z.string()),
  })).max(6),  // 信号数量上限，防止过度生成
  uncertainties: z.array(z.string()).max(3),
});
```

**调用参数**：确定性最大化

```typescript
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 2000,
  temperature: 0.0,  // 零温度，最大化确定性
  response_format: { type: "json_object" },  // 强制 JSON
  system: SYSTEM_PROMPT,  // 严格约束 prompt
  messages: [{ role: "user", content: renderPrompt(payload) }],
});
```

**Prompt 核心策略**：把开放题变成填空题

```
你正在分析一个仓库的结构化摘要。请根据以下信息，提取语义信号。

[结构化 payload]

规则：
1. 只输出 schema 中定义的字段，不要添加额外内容
2. 每个 signal 必须有 evidence（引用具体文件名和代码片段）
3. 如果不确定，使用 low confidence，并在 uncertainties 中说明
4. 不要编造未在 payload 中出现的信息
5. function_summary 限制在 2 句话以内
```

**与非 LLM 方式的协作关系**：

| 信号类型 | 主路径 | Fallback | 融合策略 |
|---------|--------|---------|---------|
| 框架检测 | Ecosystem Lexicon（确定性） | LLM 辅助确认 | 确定性优先 |
| 启动命令 | Lexicon 模板填充 | LLM 理解代码微调 | Lexicon 为主 |
| **功能摘要** | **LLM 推断** | 无 | **LLM 独占** |
| **API 路由语义** | **LLM 提取** | 正则匹配装饰器（不保证质量） | **LLM 优先** |
| **领域实体** | **LLM 识别** | AST 类名提取（不保证质量） | **LLM 优先** |
| **请求处理链** | **LLM 推断** | Import graph BFS（结构路径） | **LLM 优先** |
| **项目描述** | **LLM 总结** | README 首段提取 | **LLM 优先** |

**Fallback 机制**：LLM 失败时管线不退化

```typescript
async function enrichWithLLM(
  payload: LLMContextPayload,
  options: { enabled: boolean; timeout_ms: number }
): Promise<LLMSignalResult> {
  if (!options.enabled) {
    return { 
      signals: [], 
      uncertainties: ["LLM enrichment disabled"] 
    };
  }
  
  try {
    const result = await Promise.race([
      callLLM(payload),
      sleep(options.timeout_ms).then(() => {
        throw new Error("LLM timeout");
      }),
    ]);
    return llmSignalSchema.parse(result);
  } catch (error) {
    // 失败不回退到空，而是标记 degraded 继续运行
    return {
      signals: [],
      uncertainties: [`LLM enrichment failed: ${error.message}`],
      _degraded: true,
    };
  }
}
```

**成本和可关闭性**：

| 考量 | 评估 |
|------|------|
| token 成本 | 每次 2000-4000 input + 1000 output，约 $0.01-0.03 |
| 延迟 | 500ms-2s，对 CLI 工具可接受 |
| 确定性 | temperature=0 + JSON mode + schema validation，稳定性 >95% |
| 可关闭 | `options.llm_enrichment: boolean`，纯离线环境可禁用 |
| 可缓存 | 基于文件 hash 缓存，重复分析零成本 |

**非 LLM 提取的角色**：

正则/AST 提取不是不做，而是作为：
- **LLM 的输入补充**：给 LLM 提供已经提取的结构化信息，降低 LLM 的理解负担
- **Fallback**：当 LLM 不可用时，提供不保证质量的低置信度信号
- **验证基准**：LLM 的 api_surface 如果和正则提取的路由列表差异过大，可触发告警

**关键设计原则**：LLM 只处理**已经筛选过的少量关键内容**，不遍历整个仓库。输入给 LLM 的是管线前几个阶段产出的结构化摘要，LLM 输出的是**高价值的语义推断**。

---

### 2. 框架知识散落在各阶段，缺少统一的"框架模型"

**现状分析**

框架相关逻辑分布在三个阶段，彼此独立维护：

| 阶段 | 框架逻辑 | 具体位置 |
|------|---------|---------|
| **Scan** | 框架检测 | `detectFrameworkHints()` → `["fastapi", "pytest", ...]` |
| **Extract** | entrypoint 检测 | 硬编码 common paths + 内容匹配 |
| **Comprehend** | 命令推断 | `buildAgentHints()` 中 ad-hoc 的框架 → 命令映射 |

每个阶段各自维护一套框架规则，完全没有共享知识模型。

**用户痛点**

- FastAPI 启动命令错误：生成 `python app/main.py`，应为 `uvicorn app.main:app`
- pytest 未检测：虽然有 `conftest.py`，但没有推断出 pytest 是测试命令
- templates/static 角色未识别：Flask 标准约定完全被忽视
- __init__.py 被过度提升：空的 Python 包文件被视为 entrypoint

**架构问题**

`framework_hints` 是一个 `string[]`——纯标签，没有携带框架语义。检测到 `fastapi` 之后，这个信息就变成了一个**哑标签**在管线里流动。后续每个阶段都必须自己重新推断"fastapi 意味着什么"。

这导致：
- 启动命令逻辑散落在 Comprehend 中，与框架检测逻辑脱离
- 新框架支持需要改动三个不同的代码位置
- 框架相关的 bug（如启动命令错误）无法统一修复

**改进方向**

引入 **Framework Profile** 概念——当检测到某个框架后，生成一个结构化对象：

```typescript
interface FrameworkProfile {
  // 框架标识
  id: string;                          // "fastapi" | "flask" | "express" | ...
  ecosystem: string;                   // "python" | "node"
  
  // 启动命令模板
  run_command: {
    template: string;                  // "uvicorn {module}:{app_var}"
    detection_signals: string[];       // ["fastapi", "uvicorn>=0.23.0"]
    required_deps: string[];           // ["uvicorn"]
  };
  
  // 测试命令
  test_command: {
    template: string;                  // "pytest"
    detection_signals: string[];       // ["pytest", "conftest.py", "test_*.py"]
    required_deps: string[];           // ["pytest"]
  };
  
  // 约定目录映射
  conventional_dirs: Record<string, PathRole>;
  // Example: { "templates/": "template", "static/": "asset", "migrations/": "build" }
  
  // entrypoint 检测规则
  entrypoint_rules: {
    common_paths: string[];            // ["app/main.py", "app.py", "main.py"]
    content_pattern?: RegExp;          // 查找 FastAPI() 实例化
    kind: "server" | "app" | "cli";
  };
  
  // structural 文件处理
  structural_files: {
    __init__py: {
      default_role: "boilerplate";
      promote_if: "has_exports_or_docstring";  // 仅当有实质内容时提升优先级
    };
  };
}
```

这个 profile 在 Scan 阶段生成，随 `StructureScan` 向下传递，后续阶段全部消费它：

```
Scan: detectFrameworkHints() 
  → generate FrameworkProfile[] 
  → attach to StructureScan

Extract: consume profile for entrypoint detection + command inference
Comprehend: consume profile for hint generation
Render: consume profile for artifact context
```

**效果**：
- 新增框架支持只需添加一个 profile 定义，无需改动三个阶段代码
- 框架 bug（启动命令、路由提取、测试框架检测）有统一的修复点
- 框架知识可复用（多个项目的 FastAPI 检测不需要重复编码）

#### 深层问题：生态知识散落导致的维护成本

**当前耦合现状分析**

代码审计结果显示，生态/框架知识的耦合程度：
- **28 个框架名字** 通过字符串字面量散落在 Scan、Extract、Comprehend 三个阶段
- **250-400 行代码** 分布在 5-6 个业务逻辑文件中，不存在任何扩展点
- **2 个生态** (Node + Python) 的约定硬编码在 `ignore.ts`、`enums.ts`、`classify/rules.ts` 等多处
- **0 个配置机制** 可以声明新生态的约定（manifest 模式、ignore 规则、entrypoint 约定等）

新增一个生态（Ruby/Go/Rust）的改动范围：
| 文件 | 改动 | LOC |
|------|------|-----|
| src/scan/index.ts | 语言检测、框架检测、忽略模式 | 80-100 |
| src/extract/index.ts | 入口约定、命令推断、优先级信号 | 50-70 |
| src/comprehend/index.ts | agent hints、repo_shape 判断 | 60-80 |
| src/classify/rules.ts | 目录命名约定 | 15-20 |
| src/shared/ignore.ts | ignore 模式 | 15-20 |
| 其他 | 枚举扩展、测试更新 | 30-60 |

**根本原因**："数据（生态知识）混在过程（管线逻辑）里"

同一段知识（如"FastAPI 项目的典型结构"）被重复表达三次：
```
Scan:      if file == "app/main.py" → hints.add("fastapi")
Extract:   if hint === "fastapi" && path == "app/main.py" → entrypoint
Comprehend: if hints.includes("fastapi") → "use uvicorn main:app"
```

**改进方向深化：引入 Ecosystem Lexicon（生态词典）**

建立一个统一的、类型化的生态知识层，分离"数据"和"过程"：

```
当前架构：
  Scan logic [knows fastapi, flask, django...]
  Extract logic [knows fastapi, flask, django...]
  Comprehend logic [knows fastapi, flask, django...]

改进后：
  Scan logic ─┐
  Extract logic├──→ Ecosystem Lexicon [FastAPI, Flask, Django profiles...]
  Comprehend logic ┘
```

Lexicon 是一个**两层结构**（非配置文件，而是代码中的类型化常量）：

```typescript
// 第一层：生态级别 (Ecosystem Profile)
interface EcosystemProfile {
  id: string;                      // "python" | "node" | "go" | "rust"
  
  // 语言和文件约定
  source_extensions: string[];     // [".py", ".pyi"]
  ignore_patterns: string[];       // ["__pycache__/", ".venv/"]
  build_dirs: string[];            // ["dist/", "__pycache__/"]
  
  // manifest 约定（指向 ManifestDef 列表）
  manifests: ManifestDef[];
  ecosystem_signal: string;        // "pyproject", "setup-py", ...
  
  // 框架列表（指向本生态的所有框架）
  frameworks: FrameworkProfile[];
}

// 第二层：框架级别 (Framework Profile，上面已定义)
// FrameworkProfile 包含 detection、entrypoints、commands 等
```

**目录结构**：
```
src/
  ecosystems/
    index.ts              ← 注册所有 profiles，导出单一查询接口
    ecosystem-profile.ts  ← 类型定义和 Zod schema
    
    python/
      index.ts            ← Python EcosystemProfile (with frameworks)
      frameworks/
        fastapi.ts        ← FastAPI FrameworkProfile
        flask.ts
        django.ts
        pytest.ts
    
    node/
      index.ts            ← Node EcosystemProfile (with frameworks)
      frameworks/
        express.ts
        nextjs.ts
        react.ts
    
    go/                   ← (未来支持)
      index.ts
      frameworks/
        echo.ts, gin.ts
    
    rust/                 ← (未来支持)
      index.ts
      frameworks/
        actix.ts, rocket.ts
```

**消费接口**（管线通用）：
```typescript
// src/ecosystems/index.ts 导出的统一接口
interface EcosystemRegistry {
  // 查询 API
  getEcosystem(id: string): EcosystemProfile | undefined;
  getFramework(id: string): FrameworkProfile | undefined;
  findFrameworksBySignal(signal: string): FrameworkProfile[];
  
  // 迭代 API
  allEcosystems(): EcosystemProfile[];
  allFrameworks(): FrameworkProfile[];
}

// 在 Scan 阶段消费
const registry = getEcosystemRegistry();
for (const eco of registry.allEcosystems()) {
  // 使用 eco.ignore_patterns、eco.source_extensions 等
}

// 在 Extract 阶段消费
const framework = registry.getFramework("fastapi");
const entrypointRules = framework.entrypoint_rules;  // 统一的规则

// 在 Comprehend 阶段消费
const commands = framework.commands;  // 统一的命令模板
```

**优势**：
- **新增生态只需添加一个 Profile 文件** (`src/ecosystems/go/index.ts`)，无需改动管线代码
- **框架 bug 修复集中化**：修改 `src/ecosystems/python/frameworks/fastapi.ts` 一处，三个阶段自动同步
- **知识重复消除**：FastAPI 的典型结构只定义一次，被 Scan、Extract、Comprehend 共享消费
- **可测试性提升**：每个 Profile 可独立单元测试，无需跑完整管线
- **枚举扩展集中**：添加 Rust 时，只需修改 `src/ecosystems/enums.ts` 和 profile 定义，管线代码零改动

---

### 3. 置信度系统没有发挥过滤作用 —— 有标注但无决策

**现状分析**

架构设计了 `confidence: high|medium|low` 和 `evidence` 字段：
- 每个推断都携带置信度标注
- Contracts 文档明确说"low-confidence items should remain suppressible in default user views"

但实际效果是**置信度只是装饰品**，没有参与到实际的过滤和排序。

**用户痛点**

- 空的 `__init__.py` 被标为 entrypoint 且出现在 `first_read_path` 中
- `why_now` 说"This is likely the first runtime hop"——对 structural file 这个描述是误导的
- `first_read_path` 有 6 条（应该更短、更精）
- `critical_paths` 为空（应该有最短的有意义路径）

**架构问题**

置信度是一个**标注层**，但缺少一个**决策层**：
- 置信度被记录在每个信号上
- 但没有任何阶段在**消费**这些置信度来做**实际的过滤和排序**

`first_read_path` 的构建逻辑是"manifests + top N key_paths"——纯机械拼接，不管 confidence 到底是 high 还是 low。

**改进方向**

在 Comprehend 阶段引入显式的 **Signal Triage** 步骤：

```typescript
interface SignalTriagePolicy {
  // 显式的 promotion/suppression 规则
  promotionRules: {
    // 仅 high confidence + 有实质内容的 __init__.py 才能提升
    pythonPackageFile: {
      min_confidence: "high";
      require_exports: true;  // 有 __all__, re-export, 或类/函数定义
    };
    
    entrypoint: {
      min_confidence: "high";
      // medium confidence entrypoint 放入 key_paths，不放 first_read_path
    };
  };
  
  suppressionRules: {
    empty_structural_file: true;  // 空的 __init__.py 不应出现在任何 path 列表
    low_confidence_paths: {
      first_read_path: true;       // first_read_path 只要 high/medium confidence
      key_paths: true;             // key_paths 至少要 medium
    };
  };
  
  // 数量预算
  budgets: {
    first_read_path: {
      max_items: 4;
      overflow_strategy: "demote_to_key_paths";
      sort_by: ["confidence", "evidence_count"];
    };
    key_paths: {
      max_items: 10;
      sort_by: ["confidence", "path_depth"];
    };
    entrypoints: {
      max_items: 5;
      min_confidence_threshold: "medium";
      overflow_strategy: "suppress";
    };
  };
  
  // why_now 生成规则（不同信号类型用不同文案）
  why_now_templates: {
    manifest: "Start here to understand workspace shape, scripts, and dependencies.",
    entrypoint: "Primary entry point for the application.",
    structural_file: "Package structure (should be skipped on first read).",
    priority_candidate: "Central file for repo comprehension.",
  };
}
```

**效果**：
- `confidence` 从"装饰品"变成"实际的过滤器"
- `first_read_path` 自动保持简短（4 条），超出的自动降级
- 空 `__init__.py` 自动被压制
- 多个管线阶段可复用同一套 triage 策略

---

### 4. `repo_shape` 决策树是单维的，缺少 Python 生态的建模

**现状分析**

当前 repo_shape 判断逻辑是一个 if/else 优先级链（在 Comprehend 阶段）：

```
if (nextjs|react|vite|vue hint) → "application"
else if (express hint AND server entrypoint AND !app hint) → "service"
else if (node-cli hint AND cli entrypoint) → "tool"
else if (library hint AND library entrypoint) → "library"
else → "mixed"
```

**用户痛点**

Flask 和 FastAPI 项目都被判为 `mixed`。用户评价：这两个"显然是 service"，不是 mixed。

**架构问题**

决策树几乎完全围绕 Node.js 生态建模：
- 只有 Express 能命中 `service`
- Python 的 FastAPI/Flask/Django 完全**没有进入决策路径**

这不是"加几个条件"能修的。问题在于当前模型的**维度缺失**：

| 维度 | 现有逻辑 | 缺失 |
|------|---------|------|
| 框架 hint | ✅ nextjs, express, ... | ❌ fastapi, flask, django |
| entrypoint kind | ✅ app, cli, server, ... | ✅ 有 |
| 路由/视图存在 | ❌ | ❌ 缺失 |
| 库发布配置 | ❌ | ❌ 缺失（setup.py packages） |
| 前端资源 | ❌ | ❌ 缺失（templates, static） |
| CLI 脚本定义 | ❌ | ❌ 缺失（console_scripts） |

**改进方向**

将 repo_shape 从"if/else 链"重构为**加权投票模型**：

```typescript
interface RepoShapeSignal {
  shape: "application" | "library" | "service" | "tool" | "mixed";
  weight: number;
  reason: string;
  evidence: string[];
}

// 信号列表定义
const repoShapeSignals = {
  application: [
    { signal: "has_frontend_framework", weight: 10 },      // nextjs, react, vue, vite
    { signal: "has_app_entrypoint", weight: 5 },           // entrypoint.kind === "app"
    { signal: "has_templates", weight: 8 },                // templates/ 目录存在
    { signal: "has_static_assets", weight: 8 },            // static/ 目录存在
  ],
  
  service: [
    { signal: "has_web_framework", weight: 10 },           // express, fastapi, flask, django
    { signal: "has_routes", weight: 8 },                   // @app.get(), @route() 装饰器
    { signal: "has_server_entrypoint", weight: 8 },        // entrypoint.kind === "server"
    { signal: "has_asgi_wsgi_dep", weight: 7 },            // uvicorn, gunicorn, daphne
    { signal: "has_db_dependency", weight: 5 },            // sqlalchemy, psycopg2, pymongo
  ],
  
  library: [
    { signal: "has_setup_packages", weight: 10 },          // setup.py 中有 packages= 配置
    { signal: "has_library_entrypoint", weight: 8 },       // entrypoint.kind === "library"
    { signal: "no_web_framework", weight: 7 },             // 明确不含 web framework
    { signal: "has_source_root_pkg", weight: 6 },          // src/__init__.py 或 lib/__init__.py
  ],
  
  tool: [
    { signal: "has_cli_entrypoint", weight: 10 },          // entrypoint.kind === "cli"
    { signal: "has_console_scripts", weight: 8 },          // [project.scripts] 或 bin 字段
    { signal: "no_web_framework", weight: 7 },             // 明确不含 web framework
  ],
};

// 计分逻辑
function determineRepoShape(signals: StructuralSignals): RepoShapeResult {
  const scores = new Map<string, number>();
  
  for (const [shape, signalList] of Object.entries(repoShapeSignals)) {
    let score = 0;
    for (const { signal, weight } of signalList) {
      if (signals.has(signal)) {
        score += weight;
      }
    }
    scores.set(shape, score);
  }
  
  // 最高票者胜出
  const [winner, winScore] = Array.from(scores.entries())
    .sort(([, a], [, b]) => b - a)[0];
  const runnerUp = Array.from(scores.entries())
    .sort(([, a], [, b]) => b - a)[1];
  
  // 得票接近 (< 10 分差) → mixed
  if (winScore - runnerUp[1] < 10) {
    return { shape: "mixed", confidence: "low" };
  }
  
  return { shape: winner as RepoShape, confidence: "high" };
}
```

**优势**：
- FastAPI/Flask/Django 项目能正确识别为 service
- Rust/Go/Java 等新生态支持只需追加信号定义，不需要修改决策逻辑
- 分数接近的项目被正确判为 mixed，而不是武断选择
- 每个信号都有权重，易于调优

---

### 5. 五个产物是"同一内容的五种格式"，而非"面向不同受众的五种视角"

**现状分析**

五个产物的设计初衷是"面向不同消费者"，但实际效果是同一信息重复 5 次。

| 产物 | 消费者 | 现状 | 问题 |
|------|--------|------|------|
| context-index.json | agents | canonical | 信息量有限 |
| ONBOARDING.md | 人类 | JSON 的格式转换 | 无差异化 |
| repo.map.md | 浏览器 | JSON 的格式转换 | 无差异化 |
| agent-start.md | 小 LLM | JSON 的格式转换 + token budget | 只是压缩 |
| index.html | 浏览器 | JSON 的 HTML 渲染 | 无差异化 |

**用户痛点**

> 不同产物面向不同消费者的设计意图是好的，但内容几乎完全相同，差异只是格式

**架构问题**

Render 阶段的契约是"rendered from context-index.json only, never rebuild logic independently"。这个规则本身是对的（防止渲染器产生独立推断），但副作用是：**所有产物都只能是 JSON 的子集投影**。

问题根源不在渲染层，而在于 **Comprehension 模型本身信息量不足**：
- 没有项目功能摘要
- 没有 API surface（路由列表）
- 没有依赖摘要
- 没有关键数据流路径

当信息源就这么贫乏时，五种格式自然就变成五次重复。

**改进方向**

这需要与"改进方向 1"（功能信号提取）配合完成。当 Comprehension 模型包含了功能、API、依赖等语义信号后，渲染层才能做真正的差异化：

```
Context-Index.json (canonical):
  ├─ repo metadata
  ├─ entrypoints (unchanged)
  ├─ key_paths (unchanged)
  ├─ framework_profiles (new)  ← 包含框架语义
  ├─ api_surface (new)         ← 路由列表
  ├─ entities (new)            ← 模型/Schema 定义
  ├─ dependencies (new)        ← 核心依赖摘要
  └─ request_paths (new)       ← 关键数据流

Agent-Start.md (derived):
  Pure structured facts, no prose
  ├─ Setup: [npm install | pip install]
  ├─ Run: uvicorn app.main:app
  ├─ Test: pytest
  ├─ Entrypoints: [app/main.py]
  ├─ API Surface: [GET /items, POST /items]
  └─ Request Path: main.py → routers/items.py → models/item.py

ONBOARDING.md (derived):
  Narrative + structure
  ├─ What: "This is a CRUD API service for managing items"
  ├─ Quick Start: [setup, run, test commands]
  ├─ Architecture: [entrypoints, request path, key modules]
  ├─ API: [endpoint list with brief description]
  └─ Dependencies: [core dependencies and their purpose]

repo.map.md (derived):
  Navigation-focused
  ├─ File tree with role annotations
  ├─ Critical paths highlighted
  ├─ API routes section
  └─ Configuration files section
```

---

### 6. "降噪"是事后打补丁，缺少正向的"信号预算"机制

**现状分析**

管线的逻辑是"先尽量多检测，再通过 defer/suppress 去噪"。但 suppress 逻辑只在 intent-map（example-fixtures、test-infrastructure）上生效，对其他低价值信号没有系统性控制。

**用户痛点**

- `first_read_path` 有 6 条（推荐 3-4）
- `critical_paths` 为空（应该至少有单跳路径）
- 空的 `__init__.py` 占用位置
- 整体信噪比低

**架构问题**

管线缺少**信号预算（signal budget）** 概念。当前只有 agent-start.md 有 2000 token 的预算约束和 overflow trim policy，但核心数据模型没有数量约束。结果是：

- `first_read_path` 可以无限增长
- `key_paths` 可以无限增长
- `entrypoints` 可以无限增长
- 每个 path 被包含的决策是独立的，没有全局预算考虑

**改进方向**

在 Comprehend 阶段引入显式的 **Signal Budget** 约束：

```typescript
interface SignalBudget {
  // 各字段的数量预算和超出策略
  
  first_read_path: {
    max_items: 4;
    priority: ["high_confidence", "core_signal"];
    overflow_strategy: "demote_to_key_paths";
  };
  
  key_paths: {
    max_items: 10;
    priority: ["high_confidence", "evidence_count", "path_depth"];
    overflow_strategy: "drop";
  };
  
  entrypoints: {
    max_items: 5;
    min_confidence: "medium";
    priority: ["high_confidence", "kind"];
    overflow_strategy: "suppress_low_confidence";
  };
  
  critical_paths: {
    min_items: 1;  // 至少一条，即使很短
    max_items: 3;
    generation_strategy: "bfs_from_entrypoints";
    fallback: "entrypoint -> first_import (single hop)";
  };
  
  defer_for_now: {
    max_items: 20;  // suppress 列表应该有限，太多就丧失抑制作用
    priority: ["high_confidence_suppression"];
  };
}

// 预算是可配置的参数，不同规模项目不同预算
interface RepoInput {
  options: {
    signal_budgets?: Partial<SignalBudget>;  // 用户可覆盖默认预算
    // ... 其他选项
  };
}
```

**应用流程**：

```
Extract → SignalExtraction (各信号无预算限制，尽量多)
  ↓
Comprehend:
  1. Build graph and determine repo_shape
  2. Build all candidates for key_paths, entrypoints, etc.
  3. Apply SignalBudget constraints (trim by priority, overflow strategy)
  4. Generate first_read_path, critical_paths with budget awareness
  ↓
Output: Comprehension (所有列表都满足预算约束)
```

**效果**：
- `first_read_path` 自动保持在 4 条以内
- `critical_paths` 至少产出一条有意义的路径
- 预算可调整，适应不同规模的项目（微型项目 `max_items: 2`，大型项目 `max_items: 10`）
- 降噪不再是"事后打补丁"，而是"正向的设计约束"

---

## 改进的优先级和依赖关系

| 优先级 | 改进方向 | 影响范围 | 关键思路 | 依赖关系 |
|--------|---------|---------|---------|---------|
| **P0** | **Ecosystem Lexicon** | Scan + Extract + Comprehend | 统一框架知识，分离数据与过程；250+ LOC 从 6 个文件集中到 `src/ecosystems/` | 独立 |
| **P0** | **Signal Triage + Budget** | Comprehend | 置信度从装饰→过滤，数量可控，降噪自动化 | 独立 |
| **P0** | **LLM Signal Enrichment** | Extract + Comprehend | LLM 处理语义（功能/API/实体），非 LLM 只做 fallback；temperature=0 + JSON mode + Zod schema 约束 | 独立 |
| **P1** | **repo_shape 投票模型** | Comprehend | 支持多生态，得分接近判 mixed；消费 P0 的 Lexicon 框架信息 | 依赖 P0 |
| **P2** | **产物差异化** | Render | 不同受众不同内容（agent-start 纯 facts，ONBOARDING 加 narrative） | 依赖 P0 + P1 |

---

## 核心改进主线

**当前管线的强弱点**：
- ✅ **擅长**：列举（inventory）— 哪些文件、哪些框架、哪些命令
- ❌ **薄弱**：理解（comprehension）— 项目做了什么、如何运行、核心流程

虽然 Comprehend 阶段名义上叫"理解"，但实际做的只是"结构化汇总"。

**改进后的目标**：
- 通过 **Ecosystem Lexicon**（Framework Profile 的扩展）分离"生态知识"和"管线逻辑"，将 250-400 LOC 改动从散落的 6 个文件集中到 `src/ecosystems/` 一个目录，使得新增生态支持无需改动核心管线代码
- 通过 **Signal Triage + Budget** 让信噪比清晰可控，置信度从装饰品变成实际的过滤器
- 通过 **LLM Signal Enrichment** 让输出能回答"项目做了什么"，补齐当前缺失的语义理解层。**涉及语义识别的信号（功能摘要、API 语义、领域实体、请求处理链）全部由 LLM 产生，非 LLM 方式只作为不保证质量的 fallback**
- 通过这三个基础，让后续的 repo_shape、产物差异化等都能精准实施，同时为未来的生态扩展（Ruby、Go、Rust 等）奠定可扩展的架构基础

---

## 实施建议

### P0 两大改进（可并行推进）

1. **Ecosystem Lexicon（生态词典）**
   - 创建 `src/ecosystems/` 目录，将 Framework Profile 扩展为两层结构（Ecosystem + Framework）
   - 将 250-400 LOC 散落在 6 个文件中的生态知识，集中到 `src/ecosystems/` 下的 profile 定义
   - 改动管线代码：删除 Scan/Extract/Comprehend 中的硬编码框架逻辑，改为消费 Lexicon 提供的统一接口
   - 效果：新增生态（Ruby/Go）只需添加一个 profile 文件，无需改动管线代码

2. **Signal Triage + Budget**
   - 在 Comprehend 阶段实现显式的 SignalTriagePolicy 和 SignalBudget
   - 管线内置的过滤规则，而非事后打补丁
   - 效果：自动化降噪，置信度成为实际的过滤器

### P0 第三项改进：LLM Signal Enrichment（独立，与前两项并行设计）

3. **LLM Signal Enrichment**
   - 设计 LLM harness：结构化输入（2000-4000 tokens）、Zod schema 输出约束、temperature=0、JSON mode
   - LLM 输入来源：Ecosystem Lexicon 识别的关键文件 + Extract 产出的结构化摘要
   - LLM 输出语义信号：function_summary、api_surface、domain_entities、request_paths、test_strategy、deployment_model
   - 非 LLM 提取（正则/AST）只做不保证质量的 fallback，以及作为 LLM 的输入补充
   - 集成 fallback 机制：LLM 失败时标记 degraded，管线继续运行
   - 效果：管线从"列举工具"升级为"理解引擎"

### P1 改进（依赖 P0）

4. **repo_shape 投票模型**
   - 改进决策树为加权投票模型
   - 消费 Ecosystem Lexicon 中的 `shape_signals`，支持多生态投票
   - 效果：FastAPI/Flask 项目正确识别为 service，而不是 mixed

### P2 改进（依赖 P0 + P1）

5. **产物差异化**
   - 当 Comprehension 模型同时包含确定性信号（P0 Lexicon）和语义信号（P0 LLM）后，才能做真正的产物差异化
   - agent-start.md：纯 structured facts（LLM 的 api_surface、request_paths、commands）
   - ONBOARDING.md：加入 narrative（LLM 的 function_summary、domain_entities）
   - repo.map.md：导航聚焦（import graph + LLM 的 request_paths）

### 测试和验证策略

每个改进都应配备：
- **单元测试**：Profile 本身的定义和 Zod 验证
- **集成测试**：新增 fixture 项目覆盖新逻辑（Ruby/Go 项目，各种规模的项目用于 Signal Budget 测试）
- **回归测试**：确保现有 13+ fixture 项目的输出仍然正确

关键里程碑：
- **P0 完成后**：
  - 系统可以无缝扩展到新生态（Lexicon），架构基础稳固
  - 信噪比可控（Signal Triage），first_read_path 不超过 4 条
  - 管线具备语义理解能力（LLM Enrichment），能回答"项目做什么"
- **P1 完成后**：repo_shape 分类精度大幅提升，多生态项目正确识别
- **P2 完成后**：产物内容丰富度与差异化达到预期，agent-start 和 ONBOARDING 面向不同受众提供不同内容
