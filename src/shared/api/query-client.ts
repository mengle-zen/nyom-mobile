import { AppState } from 'react-native'
import { focusManager, QueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

/**
 * 앱 전역 QueryClient.
 * - staleTime 30s: 짧은 창에서 재방문 시 재요청을 줄인다(보드 스와이프 왕복 등).
 * - refetchOnWindowFocus off: 모바일 웹에서 포커스 전환 잦아 과도한 refetch 방지.
 *   앱으로 돌아올 때 다시 받아야 하는 쿼리(채팅 등)만 각자 켠다 — 아래 focusManager 참고.
 * - retry 1: 일시 오류만 한 번 재시도.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

// RN에는 창 포커스가 없어 TanStack이 앱 복귀를 모른다. AppState를 포커스로 알려 준다.
// 백그라운드 동안 실시간 구독은 멈춰 그사이 온 채팅을 놓친다 — 돌아오면 다시 받아야 한다.
AppState.addEventListener('change', (state) => {
  focusManager.setFocused(state === 'active')
})

// 로그인 토큰이 새로 생기면 실패한 채 멈춘 조회를 다시 받는다(2026-11-19).
// 앱으로 돌아온 직후 토큰 갱신이 한 번 끊기면 1분쯤 토큰 없이 요청이 나가 전부 401로 거절됐고,
// 토큰이 다시 생긴 뒤에도 보드가 「불러오지 못했어요」에 멈춰 있었다.
// 콜백 안에서 곧바로 Supabase를 부르지 않는다 — auth 콜백 안의 호출은 갱신과 맞물려 멈출 수 있다.
supabase.auth.onAuthStateChange((event) => {
  if (event !== 'TOKEN_REFRESHED' && event !== 'SIGNED_IN') return
  setTimeout(() => {
    void queryClient.refetchQueries({ type: 'active', predicate: (q) => q.state.status === 'error' })
  }, 0)
})
