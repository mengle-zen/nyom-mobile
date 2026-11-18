import { AppState } from 'react-native'
import { focusManager, QueryClient } from '@tanstack/react-query'

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
