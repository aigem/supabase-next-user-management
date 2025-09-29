'use client'

import { useFormState } from 'react-dom'
import { login, signup } from './actions'

export default function LoginPage() {
  const [loginState, loginAction] = useFormState(login, { ok: false, error: null })
  const [signupState, signupAction] = useFormState(signup, { ok: false, error: null })

  return (
    <div className="mx-auto max-w-sm p-4">
      <h1 className="mb-4 text-lg font-semibold">登录</h1>
      <form action={loginAction} method="post" className="flex flex-col gap-2">
        <label htmlFor="email" className="text-sm">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded border px-3 py-2 outline-none focus:ring"
        />
        <label htmlFor="password" className="text-sm">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded border px-3 py-2 outline-none focus:ring"
        />
        {loginState.error && (
          <p className="text-sm text-red-600">{loginState.error}</p>
        )}
        {loginState.ok === true && (
          <p className="text-sm text-gray-600">登录成功，正在跳转…</p>
        )}
        <button type="submit" className="rounded bg-black px-3 py-2 text-white hover:bg-gray-800">
          Log in
        </button>
      </form>

      <h2 className="mb-2 mt-6 text-lg font-semibold">注册</h2>
      <form action={signupAction} method="post" className="flex flex-col gap-2">
        <label htmlFor="signup-email" className="text-sm">Email</label>
        <input
          id="signup-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded border px-3 py-2 outline-none focus:ring"
        />
        <label htmlFor="signup-password" className="text-sm">Password</label>
        <input
          id="signup-password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          className="rounded border px-3 py-2 outline-none focus:ring"
        />
        {signupState.error && (
          <p className="text-sm text-red-600">{signupState.error}</p>
        )}
        {signupState.ok === true && (
          <p className="text-sm text-gray-600">注册成功，正在跳转…</p>
        )}
        <button type="submit" className="rounded bg-black px-3 py-2 text-white hover:bg-gray-800">
          Sign up
        </button>
      </form>
    </div>
  )
}