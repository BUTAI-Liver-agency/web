import { useState, type ReactNode } from 'react'
import { supabase } from '../data/supabase'
import { useCurrentUser } from './useCurrentUser'

export function AuthGate({ children }: { children: ReactNode }) {
  const { userId, loading } = useCurrentUser()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (loading) return <p style={{ padding: 24 }}>読み込み中...</p>
  if (userId) return <>{children}</>

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) setError('メールアドレスまたはパスワードが正しくありません')
  }

  return (
    <form onSubmit={signIn} style={{ padding: 24, maxWidth: 360 }}>
      <h1>スカウト管理</h1>
      <label>
        メールアドレス
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: '100%' }}
        />
      </label>
      <label>
        パスワード
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ width: '100%' }}
        />
      </label>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <button type="submit">ログイン</button>
    </form>
  )
}
