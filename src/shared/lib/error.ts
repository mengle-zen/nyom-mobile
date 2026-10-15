import { toast } from 'sonner-native'
import { haptic } from '@/shared/ui/press'

/**
 * 에러를 사용자에게 toast로 알린다. `catch {}`로 삼키던 실패를 표준화하는 진입점.
 * 개발 편의를 위해 콘솔에도 원본 에러를 남긴다.
 *
 * 사용자가 누른 동작이 실패했다는 뜻이므로 실패 햅틱을 토스트와 같은 순간에 준다.
 * 사용자가 일으키지 않은 실패(화면 진입 시 조회 등)는 `{ haptic: false }`.
 */
export function notifyError(
  err: unknown,
  message: string,
  options: { haptic?: boolean } = {},
): void {
  console.error(err)
  if (options.haptic !== false) void haptic('error')
  toast.error(message)
}

/**
 * 다양한 에러 객체(Supabase PostgrestError / AuthError, fetch Response 등)에서
 * HTTP 상태 코드를 최대한 추론한다. 판별 불가 시 undefined.
 */
export function getErrorStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined
  const e = err as { status?: unknown; code?: unknown }

  if (typeof e.status === 'number') return e.status

  if (typeof e.code === 'string') {
    // PostgREST: JWT 만료/누락 → 인증 필요
    if (e.code === 'PGRST301' || e.code === 'PGRST302') return 401
    // Postgres: insufficient_privilege (RLS 거부)
    if (e.code === '42501') return 403
    const n = Number(e.code)
    if (!Number.isNaN(n) && n >= 400 && n < 600) return n
  }

  return undefined
}
