import { useEffect } from 'react'
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query'
import { supabase } from '@/shared/api/supabase'
import { queryKeys } from '@/shared/api/query-keys'
import { insertMessage, removeMessage } from './chat-rows'
import {
  deleteRoomMessage,
  fetchRoomMessage,
  fetchRoomMessages,
  fetchRoomUnread,
  markRoomRead,
  sendRoomMessage,
} from './model'
import { MESSAGE_PAGE_SIZE, type RoomMessage } from './types'

/**
 * 구독마다 채널 이름을 다르게 한다. supabase-js는 같은 이름이면 이미 구독한 채널을 돌려주고,
 * 거기에 `.on()`을 붙이면 throw한다 — 채팅 → 인용 기록(보드) → 말풍선으로 같은 방 채팅이
 * 스택에 두 번 쌓이면 앱이 죽었다.
 */
let channelSeq = 0

type Pages = InfiniteData<RoomMessage[], string | undefined>

function updatePages(qc: QueryClient, groupId: string, fn: (pages: RoomMessage[][]) => RoomMessage[][]) {
  qc.setQueryData<Pages>(queryKeys.messages(groupId), (old) =>
    old ? { ...old, pages: fn(old.pages) } : old,
  )
}

/** 방 채팅 메시지. 첫 페이지가 최신이고, 다음 페이지는 그보다 오래된 50개. */
export function useRoomMessages(groupId: string | null) {
  return useInfiniteQuery({
    queryKey: queryKeys.messages(groupId ?? ''),
    queryFn: ({ pageParam }) => fetchRoomMessages(groupId as string, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.length < MESSAGE_PAGE_SIZE ? undefined : last[last.length - 1].created_at,
    enabled: !!groupId,
    // 실시간 구독은 화면이 열려 있을 때만 받는다. 닫혀 있던 사이 온 메시지·지워진 기록을
    // 놓치지 않게, 전역 30초 staleTime을 쓰지 않고 들어올 때마다 다시 받는다.
    staleTime: 0,
  })
}

/**
 * 채팅 화면이 열려 있는 동안 새 메시지·지운 메시지를 실시간으로 받는다.
 *
 * Realtime 이벤트에는 인용 기록이 붙어 오지 않아 새 메시지는 한 번 더 읽는다.
 * 지우기 이벤트는 id만 오고 방 필터를 걸 수 없어서(삭제 행에는 PK만 남는다) 방 필터 없이
 * 받아 캐시에 있는 것만 뺀다.
 */
export function useRoomRealtime(groupId: string | null, onIncoming?: (message: RoomMessage) => void) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!groupId) return
    const channel = supabase
      .channel(`room-messages-${groupId}-${++channelSeq}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_messages', filter: `group_id=eq.${groupId}` },
        (payload) => {
          const id = (payload.new as { id?: string }).id
          if (!id) return
          void fetchRoomMessage(id)
            .then((message) => {
              if (!message) return
              updatePages(qc, groupId, (pages) => insertMessage(pages, message))
              onIncoming?.(message)
            })
            .catch(() => {})
        },
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'room_messages' }, (payload) => {
        const id = (payload.old as { id?: string }).id
        if (id) updatePages(qc, groupId, (pages) => removeMessage(pages, id))
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [groupId, qc, onIncoming])
}

/** 보내기. 채팅 화면과 사진 상세(답장)가 함께 쓴다. */
export function useSendMessage(groupId: string | null, userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { content: string; postId?: string | null; replyToId?: string | null }) =>
      sendRoomMessage({ groupId: groupId as string, userId, ...input }),
    onSuccess: (message) => {
      if (!groupId) return
      updatePages(qc, groupId, (pages) => insertMessage(pages, message))
    },
  })
}

export function useDeleteMessage(groupId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteRoomMessage,
    onSuccess: (_, id) => {
      if (groupId) updatePages(qc, groupId, (pages) => removeMessage(pages, id))
    },
  })
}

/** 읽음 처리 후 안 읽음 점을 다시 계산한다. */
export function useMarkRoomRead(groupId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => markRoomRead(groupId as string),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.roomUnreadAll }),
  })
}

/** 안 읽은 메시지가 있는 방 id 집합. 그룹 목록·방 화면 헤더의 점. */
export function useRoomUnread(groupIds: string[]) {
  const ids = [...groupIds].sort()
  return useQuery({
    queryKey: queryKeys.roomUnread(ids.join(',')),
    queryFn: () => fetchRoomUnread(ids),
    enabled: ids.length > 0,
    placeholderData: keepPreviousData,
  })
}

/** 채팅 푸시를 받았을 때 등 — 모든 안 읽음 점을 다시 계산한다. */
export function useInvalidateRoomUnread() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: queryKeys.roomUnreadAll })
}
