import AsyncStorage from '@react-native-async-storage/async-storage'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMyGroups } from '@/entities/group'
import { useAuth } from '@/features/auth'
import { queryKeys } from '@/shared/api/query-keys'
import { fetchInbox } from './api'
import { isUnread } from './lib/feed'

/** 알림 목록을 마지막으로 본 시각(ISO). 기기마다 따로 — 서버에 쌓지 않는다. */
const SEEN_KEY = 'nyom:inbox-seen-at'

/** 알림 목록. 그룹 목록의 종 점과 알림 화면이 같은 캐시를 쓴다. */
export function useInbox() {
  const { user } = useAuth()
  const { data: groups } = useMyGroups()
  const groupIds = (groups ?? []).map((g) => g.id).sort()
  return useQuery({
    queryKey: queryKeys.inbox(user?.id ?? '', groupIds.join(',')),
    queryFn: () => fetchInbox(user!.id, groupIds, new Date()),
    enabled: !!user && groups !== undefined,
  })
}

export function useInboxSeenAt() {
  return useQuery({
    queryKey: queryKeys.inboxSeenAt,
    queryFn: async () => (await AsyncStorage.getItem(SEEN_KEY).catch(() => null)) ?? null,
    staleTime: Infinity,
  })
}

/** 알림 목록을 봤다 — 지금 시각을 남겨 종의 빨간 점을 끈다. */
export function useMarkInboxSeen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString()
      await AsyncStorage.setItem(SEEN_KEY, now).catch(() => {})
      return now
    },
    onSuccess: (now) => qc.setQueryData(queryKeys.inboxSeenAt, now),
  })
}

/** 종에 빨간 점을 띄울까 — 마지막으로 본 뒤에 온 알림이 있다. */
export function useInboxHasUnread(): boolean {
  const { data } = useInbox()
  const { data: seenAt, isSuccess } = useInboxSeenAt()
  if (!data || !isSuccess) return false
  return data.items.some((item) => isUnread(item, seenAt ?? null))
}
