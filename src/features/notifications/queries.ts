import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner-native'
import { queryKeys } from '@/shared/api/query-keys'
import { fetchNotificationSettings, updateNotificationSettings } from './api'
import {
  toNotificationSettings,
  toSettingsColumns,
  type NotificationSettings,
} from './lib/settings'

/**
 * 내 알림 설정. 행이 없는 사용자도 기본값(전부 수신)으로 보이도록
 * select에서 `toNotificationSettings`를 통과시킨다.
 */
export function useNotificationSettings(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.notificationSettings(userId ?? ''),
    queryFn: () => fetchNotificationSettings(userId as string),
    select: toNotificationSettings,
    enabled: !!userId,
  })
}

/**
 * 알림 설정 저장 mutation(낙관적 업데이트).
 * onMutate에서 캐시를 즉시 새 값으로 바꾸고, 실패하면 이전 값으로 롤백 + 토스트.
 *
 * 성공 시 invalidate는 하지 않는다 — 저장한 값이 곧 서버 값이라 재조회할 게 없고,
 * 연속 토글에서 스위치가 깜빡이는 것을 피한다.
 */
export function useSaveNotificationSettings(userId: string | undefined) {
  const qc = useQueryClient()
  const key = queryKeys.notificationSettings(userId ?? '')

  return useMutation({
    mutationFn: (next: NotificationSettings) =>
      updateNotificationSettings(userId as string, next),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData(key)
      // 캐시에는 raw row가 들어 있고 select가 변환한다. 낙관값도 같은 row 형태여야
      // select를 통과해 화면과 일치한다.
      qc.setQueryData(key, {
        user_id: userId,
        ...toSettingsColumns(next),
        updated_at: new Date().toISOString(),
      })
      return { prev }
    },
    onError: (_err, _next, ctx) => {
      if (ctx) qc.setQueryData(key, ctx.prev)
      toast.error('알림 설정을 저장하지 못했어요')
    },
  })
}
