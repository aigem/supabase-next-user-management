# UI重构进行中（首页完成，统一账户/充值/报表/邀请样式）

## Core Features

- 统一页面：账户/充值/报表/邀请 的卡片化布局与按钮风格

- 保持功能不变，仅强化视觉与排版

- 为后续 shadcn 组件替换打好样式基础

## Tech Stack

{
  "Web": {
    "arch": "react",
    "component": "shadcn"
  }
}

## Design

固定导航，内容区域使用统一间距与卡片；浅色主、支持暗色。

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

[X] 数据库修复（迁移执行）

[X] 登录跳转到首页

[/] UI重构与首页电商化
