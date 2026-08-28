import { QueryClient } from '@tanstack/react-query'

/**
 * 앱 전역 QueryClient.
 * - staleTime 30s: 짧은 창에서 재방문 시 재요청을 줄인다(보드 스와이프 왕복 등).
 * - refetchOnWindowFocus off: 모바일 웹에서 포커스 전환 잦아 과도한 refetch 방지.
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
