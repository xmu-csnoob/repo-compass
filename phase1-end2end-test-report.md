# Phase 1 End-to-End Test Report: vue-demo

## 测试对象

- 仓库：[lzxb/vue-demo](https://github.com/lzxb/vue-demo)
- 运行 ID：`run-2026-04-22T00-30-37-998Z`
- 产物路径：`/private/tmp/vue-demo/work/runs/run-2026-04-22T00-30-37-998Z/`

## 一、Schema/结构合规性：PASS

| 检查项 | 结果 |
|--------|------|
| `schema_version` 存在 | ✅ `"1.0"` |
| 所有推断声明带 `reason` + `confidence` + `evidence` | ✅ |
| `confidence` 枚举值合法 (`high/medium/low`) | ✅ |
| `path.role` 枚举值合法 | ✅ |
| `key_paths.role` 枚举值合法 | ✅ |
| `entrypoints.kind` 枚举值合法 | ✅ |
| 所有路径 repo-relative | ✅ |
| Markdown 产物从 context-index.json 派生，未自行新增声明 | ✅ |
| HTML 报告与 Markdown/JSON 内容一致 | ✅ |
| Zod schema 验证通过 | ✅ |

**结论：** 格式契约全部满足。产物符合 Phase 1 JSON Schema 和 Markdown 派生规则。

---

## 二、语义质量：7 个关键问题

### P0 — 核心推断错误（严重影响产物价值）

#### 问题 1：`repo_shape: "service"` — 应为 `application`

vue-demo 是一个 **Vue SSR 应用**（Vue 2.7 + vue-router + vuex + Genesis SSR 框架），不是 service。Express 只是 SSR 的运行时载体，不是仓库的核心目的。

**证据：**
- `package.json` 中 `"vue": "^2.7.16"`, `"vue-router"`, `"vuex"`, `"@fmfe/genesis-core"`
- `genesis.ts` 创建 Express 应用用于 SSR（`new Genesis(options)` 基于 Express）
- `src/entry-client.ts`, `src/entry-server.ts` 是实际应用入口
- `src/components/`, `src/pages/` 包含 UI 业务代码
- 构建脚本分别生成客户端 bundle 和服务端 bundle

**根因：** `src/comprehend/index.ts` 在检测到 express 依赖后直接推断为 `service`，缺少"Express 是否只是 SSR/BFF 载体"的高层判断逻辑。

**影响：** ONBOARDING.md 开头就说 "service repository"，新手会完全误解仓库的核心目的和架构模式。

---

#### 问题 2：`framework_hints: ["express", "library"]` — 漏检 Vue

Package.json 中 Vue 依赖明确（`vue: ^2.7.16`）且 `.vue` 文件遍布 `src/`，但框架提示里没有 Vue。

**证据：**
- `src/app.vue`, `src/components/common-header.vue` 等 20+ Vue 单文件组件
- `package.json` 含 `vue`, `vue-router`, `vuex`, `vue-tsc`, `@fmfe/genesis-core`
- `src/entry-base.ts`: `import App from './app.vue'`

**根因：** `src/extract/` 的框架检测规则只覆盖了 react/next/nuxt/svelte 等子集，缺少 Vue 2.x 生态关键词。

**影响：** 框架提示是下游所有推断（repo_shape、entrypoint、safe-edit-zone、key_paths 优先级）的基础信号。漏检 Vue 导致连锁错误。

---

#### 问题 3：`entrypoints: [tsconfig.node.json]` — 完全错误

实际应用入口应为：

```
- genesis.ts                 → 服务端 Express + SSR 应用入口
- src/entry-client.ts        → 客户端应用初始化入口
- src/entry-server.ts        → 服务端渲染入口
```

而产物输出：
```json
"entrypoints": [
  {
    "path": "tsconfig.node.json",
    "kind": "app",
    "reason": "Script 'build:node' points to this path",
    "confidence": "medium"
  }
]
```

**根因：** `src/extract/` 从 npm script `build:node: genesis-tsc --project=./tsconfig.node.json` 中解析出 `--project` 参数，误认为它指向运行时入口。实际上 `--project` 指向 TypeScript 编译配置，不是应用代码入口。

**影响：** 
- First Read Path 建立在错误的入口基础上
- Critical Paths 无法追踪
- Safe Edit Zones 指向配置文件而非业务代码
- 产物对新手的导航价值归零

---

### P1 — 推断缺失/偏差

#### 问题 4：`safe_edit_zones: [tsconfig.node.json]` — 应指向 `src/`

新手应该在 `src/` 目录下安全编辑业务代码（组件、页面、路由、store），而非配置文件。

**根因：** safe-edit-zone 逻辑依赖 entrypoint 和 core modules 的推导。entrypoint 错 → safe-edit-zone 连锁错误。

**修复依赖：** 修复问题 3（entrypoint）后自动解决。

---

#### 问题 5：`defer_for_now: []` — 空数组，应推迟多个路径

vue-demo 中应推迟的路径：
- `.vscode/` — IDE 配置
- `Dockerfile`, `docker-build.sh` — 基础设施代码
- `.github/` — CI/CD 配置

这些文件对理解仓库的核心业务逻辑无帮助。

**根因：** `src/comprehend/` 的 defer 逻辑过于保守，仅在明确匹配 `vendor` 或 `generated` role 时才添加 defer。缺少对 infra/ci/ide config 目录的启发式检测。

---

#### 问题 6：`critical_paths` — 只有一步，无导航价值

```json
"critical_paths": [
  {
    "label": "app:tsconfig.node.json",
    "steps": ["tsconfig.node.json"]
  }
]
```

Critical path 应该追踪从入口到核心模块的依赖链，例如：

```
genesis.ts → src/entry-base.ts → src/router/index.ts (核心路由配置)
           ↓
         src/store/index.ts (核心状态管理)
```

单步 critical path 没有提供任何额外信息。

**根因：** entrypoint 错误 + 图中 `tsconfig.node.json` 没有 import 边，追踪立即终止。

---

### P2 — 优先级排序偏差

#### 问题 7：config-link 边导致 fan-in 膨胀

`tsconfig.json` 被赋予 `fan_in: 21`（几乎所有 .ts/.vue 文件都有 config-link 边指向它），因此在 key_paths 中排列为 role=core。

这是技术上合理的（所有源文件确实引用了 TS config），但从"帮助新手理解仓库核心逻辑"的角度，`tsconfig.json` 不应排在 `genesis.ts` 或 `src/router/index.ts` 等关键模块前面。

**建议：**
- 方案 A：fan-in 计算时对 config-link 边给予 0.3x 权重（配置边比 import 边重要性低）
- 方案 B：key_paths 排序时区分边类型，优先 import 边的 fan-in，次之 config-link 边的 fan-in
- 方案 C：config-link 边完全排除出 fan-in 计数，单独追踪为 `config_dependents` 字段

---

## 三、问题根因链

```
缺少 Vue 框架检测 (src/extract/)
    ↓
repo_shape 推断为 "service" 而非 "application"
    ↓
entrypoint 提取逻辑把 tsconfig.node.json 当成运行时入口
    ↓
safe-edit-zone, critical-path, first-read-path 全部基于错误的入口推导
    ↓
产物对新手的导航价值归零 (除了格式正确外)
```

---

## 四、测试结果总结

| 维度 | 评估 | 备注 |
|------|------|------|
| **格式合规性** | ✅ PASS | JSON Schema 验证通过，Markdown 派生规则正确 |
| **语义准确性** | ❌ FAIL | 3 个 P0 错误：repo_shape、framework_hints、entrypoints |
| **导航价值** | ❌ FAIL | First Read Path、Critical Paths、Safe Edit Zones 均基于错误的 entrypoint 推导 |
| **新手帮助** | ❌ FAIL | ONBOARDING.md 开头错误说明仓库类型，误导新手方向 |
| **JS/TS 生态覆盖** | ⚠️ PARTIAL | Express 检测正确，但 Vue 生态缺失 |

---

## 五、修复优先级

### 高优先级（P0 — 需要立即修复以达成 Phase 1 目标）

1. **完善框架检测** (`src/extract/frameworks.ts`)
   - 添加 Vue 2.x/3.x 检测（`vue` 依赖、`.vue` 文件扫描）
   - 添加 Nuxt、Vite、Webpack 框架检测
   - 预期修复：问题 2，连锁修复问题 1、3

2. **修正 entrypoint 提取逻辑** (`src/extract/entrypoints.ts`)
   - 不应把 `--project` 参数当 entrypoint
   - 应检测 `package.json` 的 `main` 和 `module` 字段
   - 应检测 `genesis.ts`, `index.ts`, `src/entry-*.ts`, `src/index.ts` 等命名模式
   - 应在 import graph 中查找 `createApp`, `createSSRApp` 等关键调用
   - 预期修复：问题 3，连锁修复问题 4、6

3. **增强 repo_shape 推断** (`src/comprehend/repo-shape.ts`)
   - 框架检测补全后，添加"Express + Vue"→ application 的推断规则
   - 区分"Express 作为核心应用"vs"Express 作为 SSR 或 API gateway"
   - 预期修复：问题 1

### 中优先级（P1 — 应该在 Phase 2 中修复）

4. **扩大 defer_for_now 覆盖** (`src/comprehend/defer-paths.ts`)
   - 对 `.vscode/`, `.github/`, `Dockerfile`, `docker-*.sh`, `.*rc` 文件自动 defer
   - 预期修复：问题 5

5. **降权 config-link 边的 fan-in** (`src/extract/graph.ts`, `src/comprehend/key-paths.ts`)
   - 方案 B：排序时对 config-link fan-in 给予 0.3x 权重
   - 预期修复：问题 7

---

## 六、对 Phase 1 设计的反馈

### 问题根源

框架检测缺失（漏掉 Vue）是主要根源，但也暴露了提取逻辑的过度依赖：

- `entrypoint` 提取从 npm scripts 反推，而不是从代码信号（`main` 字段、文件命名、关键函数调用）推导
- `safe-edit-zone` 由单一的 entrypoint 推导，缺少"哪些目录通常包含业务逻辑"的启发式规则

### 建议

**Phase 1 应补全框架检测**（至少 Vue + Nuxt + Svelte）后再发布，否则对 Vue 生态仓库的产物价值接近于零。

框架检测补全后，上述 P0 问题会自动解决。

---

## 七、修复预期效果

修复后 vue-demo 的产物应为：

```json
{
  "repo_shape": "application",
  "framework_hints": ["vue", "vue-router", "vuex", "express"],
  "entrypoints": [
    { "path": "genesis.ts", "kind": "app", "reason": "..." },
    { "path": "src/entry-client.ts", "kind": "app", "reason": "..." },
    { "path": "src/entry-server.ts", "kind": "app", "reason": "..." }
  ],
  "safe_edit_zones": ["src/"],
  "defer_for_now": [".vscode", ".github", "Dockerfile", "docker-build.sh"],
  "critical_paths": [
    {
      "label": "app:genesis.ts",
      "steps": ["genesis.ts", "src/entry-base.ts", "src/router/index.ts"]
    }
  ]
}
```

ONBOARDING.md 开头应改为：

```
## What This Repo Appears To Be
- `vue-demo` looks like an `application` repository (Vue SSR application).
- Framework hints: vue, vue-router, vuex, express
```

---

## 附录：测试环境

- 工具版本：repo-compass Phase 1 (commit 000aa0f)
- 测试日期：2026-04-22
- 测试仓库：https://github.com/lzxb/vue-demo.git
- 产物路径：`/private/tmp/vue-demo/work/runs/run-2026-04-22T00-30-37-998Z/`
