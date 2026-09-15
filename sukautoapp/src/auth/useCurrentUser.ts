import { useEffect, useState } from 'react'
import { supabase } from '../data/supabase'

export interface CurrentUser {
  userId: string | null
  email: string | null
  loading: boolean
}

export function useCurrentUser(): CurrentUser {
  const [user, setUser] = useState<CurrentUser>({ userId: null, email: null, loading: true })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser({
        userId: data.session?.user.id ?? null,
        email: data.session?.user.email ?? null,
        loading: false,
      })
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser({
        userId: session?.user.id ?? null,
        email: session?.user.email ?? null,
        loading: false,
      })
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  return user
}
