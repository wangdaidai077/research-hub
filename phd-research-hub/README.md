# Research Hub · 博士研究项目管理系统

一个只属于你自己的、部署在云端的博士研究管理网站：项目组合、任务、等待事项、周计划、研究管线、想法池全部打通，数据存放在你自己的 Supabase 数据库中，可以在 MacBook、学校电脑和手机上随时访问。

**技术栈**：Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · Radix UI（shadcn 风格组件）· Lucide 图标 · Recharts · Supabase（PostgreSQL + Auth + Storage + Realtime + RLS）· Vercel

---

## 目录

1. [功能一览](#功能一览)
2. [部署步骤（从零开始，约 30 分钟）](#部署步骤)
3. [本地运行](#本地运行)
4. [数据如何存储、同步与备份](#数据存储同步与备份)
5. [安全模型](#安全模型)
6. [以后如何更新网站](#更新网站)
7. [项目结构](#项目结构)
8. [常见问题](#常见问题)

---

## 功能一览

| 模块 | 内容 |
|---|---|
| **Dashboard 首页** | 项目总数 / 活跃 / 等待外部 / 14 天内截止 / 本周到期 / 近 30 天完成；今日焦点；本周两大优先级与交付物；即将到来的截止日（含跟进日期）；研究管线概览；最近活动；可排序筛选的项目卡片（封面、图标、阶段、状态、下一步、截止日、估计进度、最后活动） |
| **Projects 项目** | 表格 / 状态看板（拖拽）/ 卡片三种视图；创建、编辑、归档、删除；研究阶段与活动状态**相互独立**且均可自定义；详情页包含 概览、任务、里程碑、依赖、笔记与链接、时间线、进度历史 |
| **Tasks 任务** | 统一任务库：状态、优先级、截止日、计划工作日、预估/实际工时、认知负荷（深度 / 中等 / 轻量）、里程碑、子任务、任务依赖（自动检测循环）、重复任务；按项目、截止、优先级、认知负荷筛选；按重要性或截止日排序；看板拖拽 |
| **Waiting 等待追踪** | 等待谁/什么、发起日期、预计回复、下次跟进、参考编号；本周需跟进、逾期跟进、近期已解决；一键“已跟进”（自动顺延 7 天）；“解决”后关联任务自动回到可执行状态；**等待中的事项永不计为逾期** |
| **Planner 周计划** | 最多两个周优先项目、交付物清单、可用研究工时 vs 计划工时、周一至周日拖拽排程、未完成任务一键顺延（更新原任务，绝不复制）；今日焦点按认知负荷分组；周回顾五问并保存 |
| **Pipeline 研究管线** | 想法 → 设计 → 数据收集 → 分析 → 写作 → 投稿 → 审稿 → 发表；看板（拖拽改阶段）与表格（投稿日期、期刊、最近决定、修改截止）；阶段分布图并提示“前端堆积”失衡 |
| **Ideas 想法池** | 快速记录（任意页面按 `I`）；文献、数据来源、理论意义、可行性、标签；归档、关联现有项目、一键升级为正式项目 |
| **Calendar 日历** | 月视图，图层可开关：计划工作、任务截止、里程碑、跟进、项目目标日；拖拽改期 |
| **个性化** | 浅色/深色/跟随系统；4 套学术风格主题（Graphite / Paper / Nordic / Library）；自定义强调色；仪表板背景图片（亮度、可见度、模糊、可读性遮罩）或纯色；项目封面（可上下调整位置）；项目图标（emoji 或上传图片）；头像、工作区标题与副标题 —— 全部保存在云端，跨设备一致 |
| **数据** | JSON 完整备份（保留所有 ID 与关联）、合并或替换导入（事务性、防重复）、项目/任务 CSV 导出；保存中/已保存/离线/错误状态指示；网络失败的修改会保留并自动重试 |

快捷键：`⌘K` / `Ctrl K` 或 `/` 搜索 · `N` 新任务 · `I` 记录想法

---

## 部署步骤

> 下面每一步都只需要浏览器。你需要三个免费账号：**GitHub**、**Supabase**、**Vercel**（建议都用同一个邮箱，Vercel 可直接用 GitHub 登录）。

### 第 1 步：创建 Supabase 项目

1. 打开 <https://supabase.com> → **Start your project** → 登录。
2. **New project**：
   - Name：`research-hub`
   - Database Password：点 *Generate*，并保存到密码管理器
   - Region：选离你近的（德州可选 `East US (North Virginia)` 或 `Central US`）
3. 等待约 1–2 分钟，项目创建完成。

### 第 2 步：建立数据库结构（含 RLS 与图片存储）

1. 左侧菜单 **SQL Editor** → **New query**。
2. 打开本项目的 `supabase/migrations/0001_init.sql`，**全部复制**粘贴进去 → 点 **Run**。应显示 *Success*。
3. 再新建一个查询，粘贴 `supabase/migrations/0002_storage.sql` → **Run**。
4. 检查：左侧 **Table Editor** 应能看到 `projects`、`tasks`、`milestones`、`waiting_items`、`ideas`、`weekly_plans`、`activity_log`、`task_dependencies`、`user_settings`，每张表名旁都有 **RLS enabled** 标记；**Storage** 中应有一个 **Private** 的 `user-media` 桶。

### 第 3 步：配置登录（只允许你自己）

1. **Authentication → Sign In / Providers**（旧版界面叫 *Providers*）：
   - 确认 **Email** 已启用。
   - 关闭 **Allow new users to sign up**（禁止公开注册）。
2. **Authentication → Users → Add user → Create new user**：
   - 填你的邮箱（如 `ziyaowang@my.unt.edu`）和一个强密码
   - 勾选 **Auto Confirm User**
3. **Authentication → URL Configuration**（部署到 Vercel 后再回来填，见第 7 步）。

### 第 4 步：取得连接信息

**Project Settings → API**（或 *Data API* / *API Keys*），复制：

- **Project URL** → 形如 `https://abcdxyz.supabase.co`
- **anon / public key**（publishable key）

> ⚠️ 只使用 *anon/public* key。**永远不要**把 `service_role` / secret key 放进网站或 GitHub。本应用完全不需要它。

### 第 5 步：把代码放到 GitHub

方式 A（网页，最简单）：

1. 在 <https://github.com/new> 创建一个 **Private** 仓库，如 `research-hub`。
2. 解压本项目 zip，在仓库页面点 **uploading an existing file**，把解压后的**所有文件和文件夹**拖进去（不要包含 `node_modules`、`.next`）→ **Commit**。

方式 B（命令行）：

```bash
cd phd-research-hub
git init && git add . && git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<你的用户名>/research-hub.git
git push -u origin main
```

### 第 6 步：在 Vercel 部署

1. 打开 <https://vercel.com> → 用 GitHub 登录 → **Add New… → Project** → 选择 `research-hub` 仓库 → **Import**。
2. Framework 会自动识别为 **Next.js**，不用改。
3. 展开 **Environment Variables**，添加三项：

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | 第 4 步的 Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 第 4 步的 anon public key |
   | `ALLOWED_EMAILS` | 你的登录邮箱（多个用英文逗号分隔） |

4. 点 **Deploy**，约 1–2 分钟后得到网址，例如 `https://research-hub-xxxx.vercel.app`。
   - 想要更好记的网址：项目 **Settings → Domains** 可改成 `xxx.vercel.app` 的其他可用名称，或绑定自己的域名。

### 第 7 步：把网址告诉 Supabase（用于邮件登录链接和重置密码）

回到 Supabase **Authentication → URL Configuration**：

- **Site URL**：`https://你的网址.vercel.app`
- **Redirect URLs** 添加：`https://你的网址.vercel.app/auth/callback`
  （本地开发还可加 `http://localhost:3000/auth/callback`）

### 第 8 步：登录并验证云同步

1. 打开你的网址 → 用第 3 步的邮箱密码登录。
2. 首页点 **Load sample projects**（或直接新建项目）。
3. 新建一个任务 → 侧边栏底部显示 **Saved**。
4. 在**另一台设备或无痕窗口**登录同一网址 → 能看到同样的任务。
5. 在手机上把任务勾选完成 → 电脑端切回该页面（或刷新）即显示已完成；同时打开的页面会通过 Realtime 自动更新。
6. 用无痕窗口不登录直接访问 `/projects` → 会被重定向到登录页。

完成以上即满足全部验收标准。

---

## 本地运行

需要 Node.js 18.18+（推荐 20 或 22）。

```bash
npm install
cp .env.example .env.local        # 填入 Supabase URL 与 anon key
npm run dev                       # 打开 http://localhost:3000
```

**不连数据库先体验**：不填 Supabase 变量（或设 `NEXT_PUBLIC_DEMO_MODE=true`）即进入演示模式，数据只存在当前浏览器，界面会明确标注“Demo mode”。线上环境请勿开启。

```bash
npm run typecheck   # 类型检查
npm run build       # 生产构建
```

---

## 数据存储、同步与备份

**在哪里**：所有项目、任务、里程碑、等待事项、想法、周计划与回顾、笔记、链接、进度历史、偏好设置都保存在你 Supabase 项目的 PostgreSQL 中；上传的图片保存在私有存储桶 `user-media/<你的用户ID>/…`。浏览器只做两件事：显示数据、在网络中断时暂存尚未发送成功的修改。

**如何同步**：
- 每次修改先立即显示在界面上，同时进入一个**持久化的发送队列**依次写入数据库。
- 请求失败时不会丢弃：修改会保存在本机并以递增间隔自动重试；侧边栏显示 *Offline* 或 *Not saved*，可手动 **Retry**；如有未保存修改，关闭页面时浏览器会提示。
- 其他设备在页面重新获得焦点时重新拉取数据；同时打开的页面通过 Supabase Realtime 自动刷新。

**三种“备份”的区别**：

| | 是什么 | 用途 |
|---|---|---|
| 云端持久化 | 实时数据库本身 | 日常使用、跨设备 |
| 数据库备份 | Supabase 对整个数据库的定期快照（付费方案每日自动；免费方案可在 *Database → Backups* 查看可用选项） | 灾难恢复 |
| 手动导出 | **Settings → Data** 中的 JSON 完整备份与 CSV | 你自己保管的文件；迁移、归档、长期保存 |

**导入**：
- *Merge*：只添加 ID 尚不存在的记录 → 同一个备份导入两次也不会产生重复。
- *Replace*：在一个数据库事务内删除现有记录并精确恢复备份（失败则什么都不改变）。
- 所有关联（任务↔项目、子任务、里程碑、依赖、等待事项）通过原始 ID 原样恢复。
- 图片文件不包含在 JSON 备份中（备份里只有路径）。

建议：每月在 Settings 中导出一次 JSON，存到 OneDrive / Google Drive。

---

## 安全模型

- 所有数据表启用并强制 **Row Level Security**：每一行都有 `user_id`，策略仅允许 `user_id = auth.uid()` 的用户读写。即使有人拿到公开的 anon key，也读不到你的任何数据。
- 存储桶为**私有**，策略限制只能访问以自己用户 ID 开头的文件夹；图片通过 6 小时有效的签名链接显示。上传前在浏览器端校验格式（JPG/PNG/WebP）和大小（≤15 MB），并自动缩放、压缩为 WebP（存储上限 5 MB）。
- 关闭公开注册 + `ALLOWED_EMAILS` 白名单双重限制；不在白名单的账号登录后会被立即登出。
- 网站只使用 anon key；`service_role` key 从不出现在代码中。
- 所有页面（除登录与回调）由 Next.js middleware 保护；页面设置了 `noindex`，不会被搜索引擎收录。

---

## 更新网站

修改代码后：

```bash
git add . && git commit -m "描述你的修改" && git push
```

Vercel 会自动重新构建并在 1–2 分钟后上线（网页上传方式：在 GitHub 网页编辑/上传文件并 Commit 也一样会触发）。如果修改涉及数据库结构，把新的 SQL 文件放入 `supabase/migrations/` 并在 Supabase SQL Editor 中运行。

---

## 项目结构

```
supabase/migrations/      0001_init.sql（表、索引、RLS、导入函数、Realtime）· 0002_storage.sql（私有图片桶与策略）
src/middleware.ts         路由保护与白名单
src/app/login, auth/      登录、邮件链接回调、设置新密码
src/app/(app)/            需登录的页面：dashboard, today, planner, projects, projects/[id], tasks, pipeline, calendar, waiting, ideas, settings
src/components/           应用外壳、对话框（任务/项目/里程碑/等待/想法）、看板、图片上传、UI 组件
src/lib/types.ts          数据模型
src/lib/store.ts          客户端单一数据源 + 持久化同步队列
src/lib/backend/          存储边界：SupabaseBackend（生产）与 DemoBackend（本地试用）
src/lib/actions.ts        领域操作（完成任务、重复任务、解决等待、升级想法、顺延…）
src/lib/selectors.ts      所有统计与进度计算（无任何硬编码数字）
src/lib/backup.ts         JSON/CSV 导出与导入校验
src/lib/images.ts         图片校验、压缩、签名链接缓存
```

**进度计算**：手动估计优先；否则按 任务完成率 40% + 里程碑完成率 60% 加权；若尚无任务和里程碑，则按研究阶段给出粗略估计（界面以较浅颜色标明“Phase estimate”）。界面始终把“估计进度”和“已完成里程碑数”分开显示。

**扩展性**：UI 只依赖 `Backend` 接口（`src/lib/backend/types.ts`），以后换数据库或增加离线能力只需实现该接口。

---

## 常见问题

**登录后又跳回登录页？** 检查 Vercel 环境变量是否正确，以及 `ALLOWED_EMAILS` 是否包含你的邮箱（大小写不敏感）。修改环境变量后需在 Vercel 点 **Redeploy**。

**收不到重置密码邮件？** Supabase 免费版自带邮件服务有频率限制（每小时数封）；也可在 Supabase *Authentication → Users* 中直接为用户设置新密码。确认第 7 步的 Redirect URL 已添加。

**侧边栏显示 “Could not connect to your database”？** 确认两个 migration 都已运行；Supabase 免费项目闲置 7 天会暂停，在 Supabase 控制台点 *Restore* 即可（数据不会丢）。

**图片上传失败？** 确认已运行 `0002_storage.sql`；仅支持 JPG / PNG / WebP。
