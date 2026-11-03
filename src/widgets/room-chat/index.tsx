import { useCallback, useMemo, useRef, type ReactNode } from 'react'
import { ActivityIndicator, FlatList, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import {
  buildChatRows,
  quoteLabel,
  useDeleteMessage,
  useMarkRoomRead,
  useRoomMessages,
  useRoomRealtime,
  useSendMessage,
  type ChatRow,
  type QuotedPost,
  type RoomMessage,
} from '@/entities/message'
import { localDayKey } from '@/entities/post'
import type { GroupMemberProfile } from '@/entities/group'
import { setActiveChatGroup } from '@/features/notifications'
import { boardHref } from '@/shared/lib/board-href'
import { notifyError } from '@/shared/lib/error'
import { ErrorState } from '@/shared/ui/error-state'
import { Composer } from './composer'
import { LEFT_MEMBER_NAME, MessageRow } from './message-row'

type Props = {
  groupId: string
  userId: string
  members: GroupMemberProfile[]
  /** 입력줄 아래 홈 인디케이터 여백 */
  bottomInset: number
}

/**
 * 방 채팅 — 메시지 목록 + 입력줄.
 *
 * 목록은 뒤집힌(inverted) FlatList라 배열 앞쪽(최신)이 화면 아래이고,
 * 위로 올려 끝에 닿으면 더 오래된 50개를 불러온다.
 */
export function RoomChat({ groupId, userId, members, bottomInset }: Props) {
  const listRef = useRef<FlatList<ChatRow>>(null)
  const messages = useRoomMessages(groupId)
  const { mutateAsync: sendMessage, isPending: sending } = useSendMessage(groupId, userId)
  const { mutate: removeMessage } = useDeleteMessage(groupId)
  const { mutate: markRead } = useMarkRoomRead(groupId)

  // 이 방을 보고 있는 동안은 같은 방 채팅 푸시를 배너로 띄우지 않는다.
  useFocusEffect(
    useCallback(() => {
      setActiveChatGroup(groupId)
      markRead()
      return () => setActiveChatGroup(null)
    }, [groupId, markRead]),
  )

  // useRoomRealtime의 effect 의존성이라 참조가 바뀌면 구독을 다시 맺는다 — 고정해 둔다.
  const onIncoming = useCallback(
    (message: RoomMessage) => {
      if (message.user_id !== userId) markRead()
    },
    [userId, markRead],
  )
  useRoomRealtime(groupId, onIncoming)

  const byId = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members])
  const nicknameOf = useCallback((id: string) => byId.get(id)?.nickname ?? null, [byId])

  const rows = useMemo(
    () => buildChatRows(messages.data?.pages.flat() ?? [], new Date()),
    [messages.data],
  )

  const openPost = useCallback(
    (post: QuotedPost) => {
      // 보드는 올린 날(created_at) 기준으로 묶는다.
      router.push(boardHref(groupId, { date: localDayKey(new Date(post.created_at)), post: post.id }))
    },
    [groupId],
  )

  const deleteMessage = useCallback(
    (id: string) => {
      removeMessage(id, { onError: (e) => notifyError(e, '지우지 못했어요. 다시 해 주세요') })
    },
    [removeMessage],
  )

  const onSend = useCallback(
    (content: string) =>
      sendMessage({ content }).then(
        () => listRef.current?.scrollToOffset({ offset: 0, animated: false }),
        (e: unknown) => {
          notifyError(e, '보내지 못했어요. 다시 보내 주세요')
          throw e
        },
      ),
    [sendMessage],
  )

  const renderItem = useCallback(
    ({ item }: { item: ChatRow }) => {
      if (item.type === 'day') {
        return (
          <View className="mb-1 mt-5 items-center">
            <Text className="rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-white/50">
              {item.label}
            </Text>
          </View>
        )
      }
      const { message } = item
      const author = byId.get(message.user_id)
      return (
        <MessageRow
          message={message}
          showAuthor={item.showAuthor}
          isMine={message.user_id === userId}
          authorName={author?.nickname ?? LEFT_MEMBER_NAME}
          avatarUrl={author?.avatar_url ?? null}
          quote={quoteLabel(message, userId, nicknameOf)}
          onOpenPost={openPost}
          onDelete={deleteMessage}
        />
      )
    },
    [byId, userId, nicknameOf, openPost, deleteMessage],
  )

  let body: ReactNode
  if (messages.isLoading) {
    body = (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#FF7A2E" />
      </View>
    )
  } else if (messages.error) {
    body = <ErrorState message="대화를 불러오지 못했어요" onRetry={() => void messages.refetch()} />
  } else if (rows.length === 0) {
    // 빈 상태는 뒤집힌 목록 밖에 그린다(ListEmptyComponent는 함께 뒤집힌다).
    body = (
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-center text-sm text-white/45">
          아직 대화가 없어요. 먼저 말을 걸어 보세요
        </Text>
      </View>
    )
  } else {
    body = (
      <FlatList
        ref={listRef}
        inverted
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={renderItem}
        onEndReached={() => {
          if (messages.hasNextPage && !messages.isFetchingNextPage) void messages.fetchNextPage()
        }}
        onEndReachedThreshold={0.3}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ paddingVertical: 12 }}
        ListFooterComponent={
          messages.isFetchingNextPage ? (
            <View className="py-3">
              <ActivityIndicator color="#FF7A2E" />
            </View>
          ) : null
        }
      />
    )
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>{body}</View>
      <Composer onSend={onSend} sending={sending} bottomInset={bottomInset} />
    </View>
  )
}
