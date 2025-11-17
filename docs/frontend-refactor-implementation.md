# 前端重构实施说明

## 1. 概述

本文档记录 2025 年前端重构落地的关键技术细节、目录结构、运行脚本与版本切换策略，供研发、运维及测试团队查阅。对应 PR/分支：`refactor-frontend`。

## 2. 技术栈与核心依赖

| 模块 | 版本 | 说明 |
| ---- | ---- | ---- |
| React | 18.3 | 组件化视图层，支持 Hooks | 
| Vite | 5.4 | 构建与本地开发服务器，输出到 `public/new/` |
| TypeScript | 5.9 | 类型安全，`frontend/tsconfig.json` 配置严格模式 |
| Zustand | 4.5 | 轻量状态管理，拆分 station/event/alert 三个 store |
| Vitest | 3.2 | 单元测试框架（Worker 项目与前端项目分别配置） |
| CSS Modules | - | 组件私有样式，关键测试节点暴露 `data-testid` |

## 3. 项目结构（节选）

```
gaotu-electric-bike-charging-pile/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── station/Socket.tsx             # 插座卡片
│   │   │   ├── event/EventList.tsx            # 状态事件列表
│   │   │   └── alert/*                        # 提醒配置/日志/统计
│   │   ├── stores/                            # Zustand stores
│   │   │   ├── stationStore.ts
│   │   │   ├── eventStore.ts
│   │   │   └── alertStore.ts
│   │   ├── services/                          # API 请求封装
│   │   ├── hooks/                             # 通用逻辑 usePolling/useDuration
│   │   ├── views/{StatusView,AlertView}.tsx   # 两大主页面
│   │   └── App.tsx / main.tsx
│   ├── index.html
│   └── vite.config.ts                         # base='/new/'，输出 ../public/new
├── public/
│   ├── index.html                             # 旧版
│   └── new/                                   # Vite 构建产物
├── worker.ts                                  # 前端切换逻辑 + API
├── wrangler.toml                              # USE_NEW_FRONTEND feature flag
└── package.json                               # workspace 脚本
```

## 4. 本地开发

1. 安装依赖：`pnpm install`
2. 启动开发模式：`pnpm dev`
   - 等价于并行运行 `pnpm --filter frontend dev` (Vite 5173) 与 `pnpm dev:worker` (Wrangler 8788)
   - Vite 代理 `/detail`、`/events`、`/api/*` 到 Worker，参见 `frontend/vite.config.ts`
3. 访问入口：
   - 旧版：`http://localhost:8788/?version=old`
   - 新版：`http://localhost:8788/?version=new` 或 `http://localhost:5173/`

## 5. 构建与部署

- 构建新前端：`pnpm --filter frontend build`
  - 输出 `public/new/index.html` 与 hashed 资源，`base: '/new/'` 确保 Worker 正确定位静态资源
- 部署：`pnpm run deploy`
  1. 调用上述 build
  2. `wrangler deploy` 上传 Worker + `public/` 目录
- 预览环境：`pnpm run deploy:preview`

## 6. 版本切换策略

配置位置：`wrangler.toml`

```toml
[vars]
USE_NEW_FRONTEND = "false"        # 默认线上仍指向 public/index.html

[env.preview.vars]
USE_NEW_FRONTEND = "true"         # 预览环境默认新前端
```

Worker 行为（`worker.ts:43` 起）：

1. 读取 `USE_NEW_FRONTEND` 决定默认版本
2. URL 查询参数覆盖：`?version=new` / `?version=old`
3. `/` 与 `/index.html` 根据上述结果返回 `/index.html` 或 `/new/index.html`
4. `/new/**` 静态资源统一交给 `serveStaticAsset`，避免 404

> 注：方案不再包含灰度百分比，切换通过环境变量或查询参数进行。

### 回滚 / 切换示例

```bash
# 线上切换到新前端
wrangler deploy --env production --var USE_NEW_FRONTEND:true

# 回滚到旧版
wrangler deploy --env production --var USE_NEW_FRONTEND:false
```

## 7. 测试说明

| 命令 | 作用 |
| ---- | ---- |
| `pnpm test` | Worker 侧 Vitest（`status-tracker.test.ts` 等） |
| `pnpm --filter frontend test` | 新前端 Vitest（示例位于 `frontend/src/__tests__/unit`） |
| `pnpm --filter frontend build` | 触发 TypeScript 检查 (`tsc --noEmit`) + 生产构建 |

测试中的已知日志：`status-tracker.test.ts` 涉及故意构造的无效 JSON，用于验证容错；日志为预期行为。

## 8. 运行时注意事项

- 若需在同一环境下同时访问新旧版本，使用查询参数即可，不会污染全局状态
- 新前端所有可点击元素提供 `data-testid`（例如 `socket-1-1`），兼容后续 E2E 脚本迁移
- 当修改 `frontend/` 代码后，务必重新执行 `pnpm --filter frontend build`，否则 `public/new/` 不会更新
- `pnpm dev` 场景下，Vite 走 5173，Worker 走 8788，如需模拟 Worker 静态资源可直接访问 `http://localhost:8788/?version=new`

## 9. 常见问题排查

1. **前端 404**：确认 `public/new/` 是否存在最新构建、Worker 日志是否记录 `静态资源加载失败`
2. **接口跨域**：Vite 代理配置是否生效（`frontend/vite.config.ts`），或 Worker 是否开启 `Access-Control-Allow-Origin: *`
3. **切换失败**：检查 `USE_NEW_FRONTEND` 环境变量，或 URL 是否带多个 `version` 参数
4. **测试无法找到元素**：改用 `data-testid` 选择器，旧版仍需依赖 `.station/.socket` 类名

---

如需进一步扩展（深色模式、性能优化、E2E 对比测试等），建议在本文件基础上追加章节或维护单独的路线图文档。
