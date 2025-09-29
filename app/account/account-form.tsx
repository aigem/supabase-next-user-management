'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { type User } from '@supabase/supabase-js'
import Avatar from './avatar'
import Button from "@/app/components/ui/Button";

type BillingSummary = {
  billing: {
    balance: number
    currency: string
    updated_at?: string
  } | null
  usageLogs: Array<{
    id: number
    operation: string
    units: number
    unit_price: number
    total_cost: number
    metadata: Record<string, unknown> | null
    created_at: string
  }>
  transactions: Array<{
    id: string
    provider: string
    provider_transaction_id: string | null
    amount: number
    status: string
    metadata: Record<string, unknown> | null
    created_at: string
    completed_at: string | null
  }>
  invites: Array<{
    inviter_id: string
    invitee_id: string
    reward_amount: number
    status: string
    created_at: string
    rewarded_at: string | null
  }>
  inviteLink: string | null
}

const formatCurrency = (value: number | null | undefined, currency = 'CNY') => {
  const amount = Number(value ?? 0)
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '--'
  return new Date(value).toLocaleString('zh-CN')
}

export default function AccountForm({ user }: { user: User | null }) {
    const supabase = createClient()
    const [loading, setLoading] = useState(true)
    const [fullname, setFullname] = useState<string | null>(null)
    const [username, setUsername] = useState<string | null>(null)
    const [website, setWebsite] = useState<string | null>(null)
    const [avatar_url, setAvatarUrl] = useState<string | null>(null)
    const [summary, setSummary] = useState<BillingSummary | null>(null)
    const [summaryLoading, setSummaryLoading] = useState(false)
    const [summaryError, setSummaryError] = useState<string | null>(null)
    const [topupAmount, setTopupAmount] = useState<string>('')
    const [paymentLoading, setPaymentLoading] = useState(false)
    const [paymentUrl, setPaymentUrl] = useState<string | null>(null)

    const getProfile = useCallback(async () => {
        try {
            setLoading(true)

            const { data, error, status } = await supabase
                .from('profiles')
                .select(`full_name, username, website, avatar_url`)
                .eq('id', user?.id)
                .single()

            if (error && status !== 406) {
                console.log(error)
                throw error
            }

            if (data) {
                setFullname(data.full_name)
                setUsername(data.username)
                setWebsite(data.website)
                setAvatarUrl(data.avatar_url)
            }
        } catch (error) {
            alert('Error loading user data!')
        } finally {
            setLoading(false)
        }
    }, [user, supabase])

    useEffect(() => {
        getProfile()
    }, [user, getProfile])

    const fetchSummary = useCallback(async () => {
        setSummaryLoading(true)
        setSummaryError(null)
        try {
            const response = await fetch('/api/billing/summary')
            const data = await response.json()
            if (!response.ok) {
                throw new Error(data?.error ?? '获取账单失败')
            }
            const nextSummary: BillingSummary = {
                billing: data.billing
                    ? {
                          balance: Number(data.billing.balance ?? 0),
                          currency: data.billing.currency ?? 'CNY',
                          updated_at: data.billing.updated_at ?? undefined,
                      }
                    : null,
                usageLogs: (data.usageLogs ?? []).map((log: Record<string, any>) => ({
                    id: Number(log.id),
                    operation: String(log.operation ?? ''),
                    units: Number(log.units ?? 0),
                    unit_price: Number(log.unit_price ?? 0),
                    total_cost: Number(log.total_cost ?? 0),
                    metadata: (log.metadata ?? null) as Record<string, unknown> | null,
                    created_at: String(log.created_at ?? ''),
                })),
                transactions: (data.transactions ?? []).map((item: Record<string, any>) => ({
                    id: String(item.id ?? ''),
                    provider: String(item.provider ?? ''),
                    provider_transaction_id: item.provider_transaction_id ?? null,
                    amount: Number(item.amount ?? 0),
                    status: String(item.status ?? ''),
                    metadata: (item.metadata ?? null) as Record<string, unknown> | null,
                    created_at: String(item.created_at ?? ''),
                    completed_at: item.completed_at ? String(item.completed_at) : null,
                })),
                invites: (data.invites ?? []).map((relation: Record<string, any>) => ({
                    inviter_id: String(relation.inviter_id ?? ''),
                    invitee_id: String(relation.invitee_id ?? ''),
                    reward_amount: Number(relation.reward_amount ?? 0),
                    status: String(relation.status ?? ''),
                    created_at: String(relation.created_at ?? ''),
                    rewarded_at: relation.rewarded_at ? String(relation.rewarded_at) : null,
                })),
                inviteLink: data.inviteLink ?? null,
            }
            setSummary(nextSummary)
        } catch (error) {
            setSummaryError(error instanceof Error ? error.message : '获取账单失败')
        } finally {
            setSummaryLoading(false)
        }
    }, [])

    useEffect(() => {
        if (user) {
            void fetchSummary()
        }
    }, [user, fetchSummary])

    const handleCreatePayment = useCallback(async () => {
        if (paymentLoading) return
        const amountNumber = Number(topupAmount)
        if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
            alert('请输入大于 0 的充值金额')
            return
        }

        try {
            setPaymentLoading(true)
            const response = await fetch('/api/payments/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ amount: amountNumber }),
            })
            const data = await response.json()
            if (!response.ok) {
                throw new Error(data?.error ?? '创建充值订单失败')
            }
            setPaymentUrl(data.paymentUrl ?? null)
            setTopupAmount('')
            void fetchSummary()
        } catch (error) {
            alert(error instanceof Error ? error.message : '创建充值订单失败')
        } finally {
            setPaymentLoading(false)
        }
    }, [paymentLoading, topupAmount, fetchSummary])

    async function updateProfile({
        username,
        website,
        avatar_url,
    }: {
        username: string | null
        fullname: string | null
        website: string | null
        avatar_url: string | null
    }) {
        try {
            setLoading(true)

            const { error } = await supabase.from('profiles').upsert({
                id: user?.id as string,
                full_name: fullname,
                username,
                website,
                avatar_url,
                updated_at: new Date().toISOString(),
            })
            if (error) throw error
            alert('Profile updated!')
        } catch (error) {
            alert('Error updating the data!')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="form-widget">
            <Avatar
                uid={user?.id ?? null}
                url={avatar_url}
                size={150}
                onUpload={(url) => {
                    setAvatarUrl(url)
                    updateProfile({ fullname, username, website, avatar_url: url })
                }}
            />
            <div>
                <label htmlFor="email">Email</label>
                <input id="email" type="text" value={user?.email} disabled />
            </div>
            <div>
                <label htmlFor="fullName">Full Name</label>
                <input
                    id="fullName"
                    type="text"
                    value={fullname || ''}
                    onChange={(e) => setFullname(e.target.value)}
                />
            </div>
            <div>
                <label htmlFor="username">Username</label>
                <input
                    id="username"
                    type="text"
                    value={username || ''}
                    onChange={(e) => setUsername(e.target.value)}
                />
            </div>
            <div>
                <label htmlFor="website">Website</label>
                <input
                    id="website"
                    type="url"
                    value={website || ''}
                    onChange={(e) => setWebsite(e.target.value)}
                />
            </div>

            <div>
                <Button
                    onClick={() => updateProfile({ fullname, username, website, avatar_url })}
                    disabled={loading}
                >
                    {loading ? 'Loading ...' : 'Update'}
                </Button>
            </div>

            <div>
                <form action="/auth/signout" method="post">
                    <Button type="submit">
                        Sign out
                    </Button>
                </form>
            </div>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="flex row" style={{ justifyContent: 'space-between' }}>
                    <h2 className="mainHeader" style={{ marginBottom: 0 }}>
                        账户余额
                    </h2>
                    <Button onClick={fetchSummary} disabled={summaryLoading}>
                        {summaryLoading ? '刷新中...' : '刷新' }
                    </Button>
                </div>
                {summaryError ? (
                    <p className="text-sm" style={{ color: '#ff6b6b' }}>{summaryError}</p>
                ) : null}
                <div>
                    <p className="text-sm">当前余额</p>
                    <p style={{ fontSize: '1.4rem', fontWeight: 600 }}>
                        {formatCurrency(summary?.billing?.balance ?? 0, summary?.billing?.currency)}
                    </p>
                    <p className="text-sm opacity-half">
                        最近更新时间：{formatDateTime(summary?.billing?.updated_at ?? null)}
                    </p>
                </div>
                <div className="flex column" style={{ gap: '8px' }}>
                    <p className="text-sm">充值金额（元）</p>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="100"
                        value={topupAmount}
                        onChange={(event) => setTopupAmount(event.target.value)}
                    />
                    <Button
                        type="button"
                        onClick={handleCreatePayment}
                        disabled={paymentLoading}
                    >
                        {paymentLoading ? '创建中...' : '发起充值'}
                    </Button>
                    {paymentUrl ? (
                        <a
                            className="text-sm"
                            href={paymentUrl}
                            target="_blank"
                            rel="noreferrer"
                        >
                            前往支付页面
                        </a>
                    ) : null}
                </div>
                {summary?.inviteLink ? (
                    <div className="flex column" style={{ gap: '4px' }}>
                        <p className="text-sm">邀请注册链接</p>
                        <input type="text" value={summary.inviteLink} readOnly />
                    </div>
                ) : null}
            </div>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h2 className="mainHeader" style={{ marginBottom: 0 }}>
                    最近调用记录
                </h2>
                {summary?.usageLogs?.length ? (
                    summary.usageLogs.map((log) => (
                        <div
                            key={log.id}
                            className="flex row"
                            style={{ justifyContent: 'space-between', alignItems: 'center' }}
                        >
                            <div className="flex column" style={{ gap: '4px' }}>
                                <span>{log.operation}</span>
                                <span className="text-sm opacity-half">
                                    {formatDateTime(log.created_at)} · {log.units} 次 · 单价 {formatCurrency(log.unit_price, summary?.billing?.currency)}
                                </span>
                            </div>
                            <span>{formatCurrency(log.total_cost, summary?.billing?.currency)}</span>
                        </div>
                    ))
                ) : (
                    <p className="text-sm opacity-half">暂无调用记录</p>
                )}
            </div>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h2 className="mainHeader" style={{ marginBottom: 0 }}>
                    最近充值流水
                </h2>
                {summary?.transactions?.length ? (
                    summary.transactions.map((item) => (
                        <div key={item.id} className="flex column" style={{ gap: '4px' }}>
                            <div className="flex row" style={{ justifyContent: 'space-between' }}>
                                <span>{item.provider}</span>
                                <span>{formatCurrency(item.amount, summary?.billing?.currency)}</span>
                            </div>
                            <div className="text-sm opacity-half">
                                状态：{item.status} · 创建：{formatDateTime(item.created_at)} · 完成：{formatDateTime(item.completed_at)}
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-sm opacity-half">暂无充值记录</p>
                )}
            </div>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h2 className="mainHeader" style={{ marginBottom: 0 }}>
                    邀请奖励
                </h2>
                {summary?.invites?.length ? (
                    summary.invites.map((relation) => (
                        <div key={`${relation.inviter_id}-${relation.invitee_id}`} className="flex column" style={{ gap: '4px' }}>
                            <span>
                                邀请人：{relation.inviter_id}
                            </span>
                            <span className="text-sm opacity-half">
                                被邀请：{relation.invitee_id} · 状态：{relation.status} · 奖励：{formatCurrency(relation.reward_amount, summary?.billing?.currency)} · {relation.rewarded_at ? `发放：${formatDateTime(relation.rewarded_at)}` : '待发放'}
                            </span>
                        </div>
                    ))
                ) : (
                    <p className="text-sm opacity-half">暂无邀请记录</p>
                )}
            </div>
        </div>
    )
}