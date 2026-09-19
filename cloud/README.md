# SQE 账号版

账号版使用独立 Cloudflare Worker 与 D1 数据库。原 GitHub Pages 构建继续使用浏览器本地记录；两者不会自动共享数据。

## 用户使用

- 管理员首次开通后，可以创建学员账号、停用或启用账号、重设密码。
- 学员第一次使用管理员提供的密码时必须改密。停用账号不删除学习记录；重设密码使旧登录失效。
- 登录后的做题记录、词卡、教材批注、书签和已同步阅读位置写入账号数据库。
- “账号与备份”可下载备份、合并恢复。恢复保留目标账号已有记录，不覆盖现有数据。
- “清空做题记录”须在界面连续确认两次，仅删除当前账号的练习和作答；错题本及统计随之归零，词卡、教材和笔记保留。
- 原本机版的“备份本机做题记录”可导出旧做题记录，再在账号版导入。该旧版迁移只包含做题记录，其他本机材料仍需另行保管。
- JSON 备份不包含 PDF 文件。云端导入 PDF 需要另行配置私有 R2 `BUCKET`；未配置时文件上传不可用。恢复的 PDF 元数据不能让其他账号读取原账号文件。

## 本地开发与检查

使用项目锁定的 Node、pnpm 和 Wrangler 版本。`wrangler.cloud.jsonc` 只供本机验证，默认 D1 标识是占位值，不能直接用作生产配置。

```sh
pnpm install --frozen-lockfile
pnpm run cloud:migrations
pnpm exec wrangler d1 migrations apply sqe-practice-cloud --local --config wrangler.cloud.jsonc
pnpm run build:cloud
pnpm run dev:cloud
```

在被 Git 忽略的 `.dev.vars` 中配置随机 `BETTER_AUTH_SECRET` 和 `BOOTSTRAP_TOKEN`，均至少 32 字符，并限制文件访问权限。开发地址必须使用 `http://localhost:8788`，以匹配来源校验。

隔离验证入口：

```sh
pnpm exec tsc --noEmit --incremental false
node scripts/check-cloud-backup.cjs
node scripts/check-cloud-reading-position.cjs
node scripts/check-legacy-study-backup.cjs
node scripts/check-cloud-account-concurrency.cjs
node scripts/check-cloud-account-isolation.cjs
node scripts/check-cloud-setup-link.cjs
node scripts/check-cloud-account.mjs
```

账号集成检查只能访问本机测试服务，使用 `.cloud/` 下的随机测试凭据，不连接生产数据。备份检查验证事务回滚、重复导入、跨账号碰撞和未知题保留／报告。

## 部署约束

生产配置必须指定正确的账号、D1 ID 和 HTTPS `APP_ORIGIN`，移除 `LOCAL_DEV`，保持 `assets.run_worker_first: true`。所有学习 API 与教材文件都经过会话验证。不得公开 Better Auth 原始 handler，也不得改成信任浏览器传来的平台用户身份头。

创建新数据库后先应用 `cloud/migrations`。已经应用的迁移不可改写；结构变化应追加迁移。发布前构建并进行 Wrangler dry run，再使用受保护的 secrets 文件上传密钥，不能把密钥写入配置、命令参数或 Git。

首次部署以初始化口令保护管理员开通。开通完成后初始化接口永久关闭；可删除远端 `BOOTSTRAP_TOKEN`。任何初始化链接都应私下保管，不发送给学员。

Cloudflare 免费套餐能否支持账号登录必须以实际线上验证为准。本机耗时不是线上 CPU 用量，不应降低密码哈希强度来勉强适配套餐。尚未验证的付费需求应在购买前交由账号所有者决定。

## 数据恢复边界

- D1 Time Travel 是 Cloudflare 的数据库恢复能力，保留期取决于套餐；应用定时任务只清理限流记录，不代表另有独立数据库备份。
- 用户下载的 JSON 是另一份可保管的学习数据副本。管理员仍应定期导出数据库，并将备份放在独立位置，实际验证恢复。
- 本机尚未成功同步的阅读页码不会进入云端导出文件；界面会展示同步状态。
- 删除浏览器数据后，重新登录可读取已成功保存的云端数据。离线或保存失败时，不能承诺未提交的数据已经进入云端。
- 正式对外提供教材和题目之前，应确认相应内容的使用许可。

官方资料：[Wrangler](https://developers.cloudflare.com/workers/wrangler/)、[Workers 限制](https://developers.cloudflare.com/workers/platform/limits/)、[D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)。
