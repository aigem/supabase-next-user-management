# 支付流程核查：移除残留 mock 状态分支与文档同步

## Core Features

- Webhook 错误处理统一 400（移除 PAYMENT_WEBHOOK_SECRET 分支）

- README 导航文案改为 XorPay 支付宝扫码支付

## Tech Stack

{
  "Web": {
    "arch": "react",
    "component": "shadcn"
  },
  "iOS": null,
  "Android": null
}

## Design

仅进行小范围、精确修正，保持现有 XorPay 实现与文档一致。

## Plan

Note: 

- [ ] is holding
- [/] is doing
- [X] is done

---

[X] 需求确认

[X] 后端XorPay接入

[X] 充值页交互与UI

[X] 移除mock与统一验签

[X] README与部署文档同步

[ ] 生产配置与回测
