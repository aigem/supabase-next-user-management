
本仓库在 Supabase 官方用户管理示例基础上，按需求增加了以下模块，遵循 KISS 原则，小步实现、可直接本地运行与演示：

### 新增功能概览
- 余额账户与扣费闭环
  - 数据表：billing_accounts、usage_logs、payment_transactions、invite_relations、audit_logs
  - 原子扣费 RPC：public.charge_usage，校验余额→扣减→写 usage_logs→写审计日志
- 支付（XorPay 支付宝）闭环
  - /api/payments/create 创建 pending 交易
  - /api/payments/webhook 验签后入账（increment_user_balance）
- 邀请与奖励
  - /api/invites/register 绑定邀请关系（唯一约束）
  - /api/invites/reward 幂等发放奖励并入账
- 报表
  - /api/usage/report 支持时间范围查询与 CSV 导出
  - 前端页面 /usage 展示概览、分组与明细
- 页面导航与演示
  - Dashboard（/）：余额与最近使用
  - 充值页（/recharge）：使用支付宝（XorPay）扫码支付并回调入账
  - 报表页（/usage）：只读报表与导出
  - 邀请页（/invites）：绑定与奖励发放演示
  - 控制台（/console）：参数表单与扣费联动（不接入真实模型）
  - 账户与安全（/security）：会话与审计事件只读摘要
  - 账户中心（/account）：资料编辑、近期账务

### 关键路由与文件
- API
  - app/api/billing/deduct/route.ts：内部验签，调用 charge_usage 原子扣费
  - app/api/billing/summary/route.ts：余额、使用、交易与邀请摘要
  - app/api/payments/create/route.ts：创建交易
  - app/api/payments/webhook/route.ts：XorPay 表单验签（MD5）→更新交易→入账
  - app/api/invites/register/route.ts：绑定邀请
  - app/api/invites/reward/route.ts：发放奖励（内部验签）
  - app/api/usage/report/route.ts：报表与 CSV
- 数据库迁移
  - supabase/migrations/20250201000000_billing_and_usage.sql：账务/使用/邀请/审计表与函数
  - supabase/migrations/20250201010000_charge_usage.sql：原子扣费函数（charge_usage）

### 环境变量
请参考 .env.example（已提供可用于开发的默认值）：
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- NEXT_SITE_URL 或 NEXT_PUBLIC_SITE_URL（用于页面回调与生成邀请链接）
- XORPAY_AID（XorPay 后台的 aid）
- XORPAY_APP_SECRET（XorPay app secret，用于签名）
- XORPAY_NOTIFY_URL（回调地址，指向 https://你的域名/api/payments/webhook）
- INTERNAL_API_KEY（内部 API 验签，示例：dev_internal_key）
- SUPABASE_SERVICE_ROLE_KEY（仅服务端使用，勿暴露到客户端）

### 本地运行步骤
1. 安装依赖
   - npm i 或 pnpm i
2. 配置环境变量
   - 复制 .env.example 为 .env，必要时调整 NEXT_SITE_URL/NEXT_PUBLIC_SITE_URL 为 http://localhost:3000
3. 初始化数据库
   - 使用 Supabase 本地/远程项目，确保执行 migrations 目录下的 SQL（参考 Supabase CLI db push）
4. 启动开发
   - npm run dev
5. 演示流程
   - 注册/登录 → /recharge 充值（Mock）→ 余额更新
   - /console 参数表单扣费 → 使用日志与余额联动
   - /usage 查看报表与 CSV 导出
   - /invites 绑定与奖励发放演示（需 INTERNAL_API_KEY）

### 安全与最佳实践
- 内部接口需携带 x-internal-token（INTERNAL_API_KEY），仅用于服务器侧调用，避免在浏览器暴露
- Webhook 使用 XorPay 表单通知 + MD5 验签（md5(aoid + order_id + pay_price + pay_time + app_secret)）
- 所有数据访问遵循 Row Level Security（用户仅能读取自身数据）
- service_role 仅在服务端环境使用（utils/supabase/service-role.ts）

### 后续接入建议
- 真实支付网关（如 Stripe/微信/支付宝）：替换 create 与 webhook 的 provider 逻辑与验签
- 更丰富的报表与图表展示
- API 模型接入（图像/视频生成）并结合扣费联动与排队机制

以上为项目功能补充与使用说明。保持 KISS 原则，已尽量以最少改动打通主要闭环，便于后续扩展与部署。

### XorPay 回测步骤（支付宝）
- 环境准备
  - 在部署环境设置 XORPAY_AID、XORPAY_APP_SECRET、XORPAY_NOTIFY_URL（https://你的域名/api/payments/webhook）
  - 确认 .env 中 NEXT_PUBLIC_SITE_URL 指向生产域名
- 创建充值订单
  - 登录后访问 /recharge
  - 输入金额（示例：50.00），点击“使用支付宝支付”
  - 页面状态切换为 pending 并展示二维码（或 H5 跳转链接）
- 扫码支付
  - 使用手机支付宝扫描二维码完成支付
  - 支付成功后，XorPay 会按文档以 application/x-www-form-urlencoded POST 通知到 XORPAY_NOTIFY_URL
- 入账与状态
  - 刷新 /recharge 页面，状态应从 pending 变为 ok
  - 余额增加相应金额；/（Dashboard）与 /account 可查看更新
  - 检查 payment_transactions：status 从 pending → succeeded，metadata 中应包含 xorpay_aoid、transaction_id 等
- 常见错误排查
  - 通知未达：检查 XORPAY_NOTIFY_URL 是否正确、是否可公网访问（防火墙/反向代理）
  - 验签失败：核对 XORPAY_APP_SECRET 与签名字段（aoid、order_id、pay_price、pay_time）
  - 订单不匹配：确保 order_id 使用系统内部 transaction.id，一致贯穿创建与通知
- 建议
  - 将回测日志（时间戳、transaction.id、支付金额、通知 payload）记录到工单，便于追踪与回归