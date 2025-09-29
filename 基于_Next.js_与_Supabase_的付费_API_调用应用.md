# 基于 Next.js 与 Supabase 的付费 API 调用应用

## Core Features

- 用户注册登录与权限管理

- 充值下单与支付回调入账

- 按调用次数与单价自动扣费

- API 使用日志与统计报表

- 邀请注册奖励与防滥用

- 审计与安全访问控制

- 文档收尾与类型修复

- Turbopack 警告处理

## Tech Stack

{
  "Web": {
    "arch": "react",
    "component": null
  },
  "iOS": null,
  "Android": null
}

## Design

移除 next.config.js 的 webpack alias，依赖 tsconfig paths 支持 @/*，以完全使用 Turbopack。

## Plan

Note: 

- [ ] is holding
- [/] is doing
- [X] is done

---

[X] 类型兼容性修复（PageProps/searchParams Promise）

[X] Turbopack 警告处理（移除 webpack alias 或改用 webpack 开发）
