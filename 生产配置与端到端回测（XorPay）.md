# 生产配置与端到端回测（XorPay）

## Core Features

- 配置生产环境变量并部署

- 创建订单→扫码→回调入账→余额与交易状态核对

- 收集失败日志进行定位修复

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

严格按 README 的回测步骤执行；若异常，快速收集关键字段与错误文本进行定位。

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

[/] 生产配置与回测
