import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth'
import { queryKeys } from '@/shared/api/query-keys'
import {
  fetchMyProfile,
  fetchMyPostsPage,
  fetchMyPostCount,
  MY_POSTS_PAGE_SIZE,
} from './api'
import type { Profile } from '@/types/database'

export type UseMyProfileResult = {
  profile: Profile | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/** 현재 로그인된 유저의 profile row (useQuery 기반) */
export function useMyProfile(): UseMyProfileResult {
  const { user } = useAuth()
  const userId = user?.id
  const query = useQuery({
    queryKey: queryKeys.profile(userId ?? ''),
    queryFn: () => fetchMyProfile(userId as string),
    enabled: !!userId,
  })
  return {
    profile: query.data ?? null,
    loading: query.isLoading,
    error: (query.error as Error) ?? null,
    refetch: () => query.refetch().then(() => undefined),
  }
}

/** 내 게시물 그리드 (페이지네이션) */
export function useMyPosts(userId: string | undefined) {
  return useInfiniteQuery({
    queryKey: queryKeys.myPosts(userId ?? ''),
    queryFn: ({ pageParam }) => fetchMyPostsPage(userId as string, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === MY_POSTS_PAGE_SIZE ? allPages.length : undefined,
    enabled: !!userId,
  })
}

/** 내 게시물 총 개수 (통계용) */
export function useMyPostCount(userId: string | undefined) {
  return useQuery({
    queryKey: [...queryKeys.myPosts(userId ?? ''), 'count'],
    queryFn: () => fetchMyPostCount(),
    enabled: !!userId,
  })
}
