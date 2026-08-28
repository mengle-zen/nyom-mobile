import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export type AuthContextValue = {
  session: Session | null
  user: User | null
  loading: boolean
  signInWithKakao: () => Promise<void>
  /** 개발용 이메일 로그인. 두 env가 모두 있을 때만 로그인 화면에 버튼이 뜬다. */
  signInWithTestAccount: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth는 AuthProvider 안에서만 쓸 수 있습니다')
  return ctx
}
