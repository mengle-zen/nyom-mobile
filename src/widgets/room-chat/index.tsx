import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router, useFocusEffect } from 'expo-router'
import {
  buildChatRows,
  quoteLabel,
  replyQuote,
  replyTargetName,
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
import { useReducedMotion } from '@/shared/ui/motion'
import { PressableScale } from '@/shared/ui/press'
import { Composer } from './composer'
import { LEFT_MEMBER_NAME, MessageRow } from './message-row'

type Props = {
  groupId: string
  userId: string
  members: GroupMemberProfile[]
  /** 입력줄 아래 홈 인디케이터 여백 */
  bottomInset: number
}

/** 맨 아래(최신)에서 이만큼 안이면 「맨 아래에 있다」로 본다 */
const AT_BOTTOM_PX = 48

/** 원래 메시지로 이동했을 때 테두리를 보이는 시간 */
const HIGHLIGHT_MS = 1200

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

  // 위로 올려 지난 대화를 읽는 중에 남의 새 메시지가 오면 입력줄 위에 「새 메시지 ↓」를 띄운다.
  // 맨 아래에 있으면 새 메시지가 바로 보이니 띄우지 않는다. 맨 아래로 내려오면 사라진다.
  const atBottom = useRef(true)
  const [unseen, setUnseen] = useState<RoomMessage | null>(null)
  const onListScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // 뒤집힌 목록이라 offset 0이 맨 아래(최신)다.
    atBottom.current = e.nativeEvent.contentOffset.y < AT_BOTTOM_PX
    if (atBottom.current) setUnseen(null)
  }, [])

  // useRoomRealtime의 effect 의존성이라 참조가 바뀌면 구독을 다시 맺는다 — 고정해 둔다.
  const onIncoming = useCallback(
    (message: RoomMessage) => {
      if (message.user_id === userId) return
      markRead()
      if (!atBottom.current) setUnseen(message)
    },
    [userId, markRead],
  )
  useRoomRealtime(groupId, onIncoming)

  const byId = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members])
  const nicknameOf = useCallback((id: string) => byId.get(id)?.nickname ?? null, [byId])

  const all = useMemo(() => messages.data?.pages.flat() ?? [], [messages.data])
  const rows = useMemo(() => buildChatRows(all, new Date()), [all])

  // 답장하려던 메시지가 그새 지워지면 목록에서 사라지고 답장도 풀린다.
  const [replyId, setReplyId] = useState<string | null>(null)
  const replyTarget = useMemo(() => all.find((m) => m.id === replyId) ?? null, [all, replyId])
  const replyingTo = useMemo(
    () =>
      replyTarget
        ? {
            id: replyTarget.id,
            title: replyTargetName(replyTarget, userId, nicknameOf),
            text: replyTarget.content,
          }
        : null,
    [replyTarget, userId, nicknameOf],
  )
  const startReply = useCallback((message: RoomMessage) => setReplyId(message.id), [])
  const cancelReply = useCallback(() => setReplyId(null), [])

  // 인용을 누르면 원래 메시지로 스크롤하고 잠깐 테두리. 아직 불러오지 않은 옛 메시지면 그대로 둔다.
  const reducedMotion = useReducedMotion()
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => clearTimeout(highlightTimer.current ?? undefined), [])
  const jumpTo = useCallback(
    (id: string) => {
      const index = rows.findIndex((r) => r.type === 'message' && r.message.id === id)
      if (index < 0) return
      listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: !reducedMotion })
      setHighlightId(id)
      clearTimeout(highlightTimer.current ?? undefined)
      highlightTimer.current = setTimeout(() => setHighlightId(null), HIGHLIGHT_MS)
    },
    [rows, reducedMotion],
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
      sendMessage({ content, replyToId: replyId }).then(
        () => {
          // 기다리는 사이 다른 메시지로 답장을 바꿨으면 그건 남긴다.
          setReplyId((cur) => (cur === replyId ? null : cur))
          listRef.current?.scrollToOffset({ offset: 0, animated: false })
        },
        (e: unknown) => {
          notifyError(e, '보내지 못했어요. 다시 보내 주세요')
          throw e
        },
      ),
    [sendMessage, replyId],
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
          reply={replyQuote(message, userId, nicknameOf)}
          highlighted={message.id === highlightId}
          onOpenPost={openPost}
          onDelete={deleteMessage}
          onReply={startReply}
          onJumpTo={jumpTo}
        />
      )
    },
    [byId, userId, nicknameOf, openPost, deleteMessage, highlightId, startReply, jumpTo],
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
        // 높이가 제각각이라 아직 그려지지 않은 줄로는 바로 못 간다. 근처로 옮긴 뒤 다시 시도한다.
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          listRef.current?.scrollToOffset({ offset: index * averageItemLength, animated: false })
          setTimeout(
            () => listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: !reducedMotion }),
            100,
          )
        }}
        onScroll={onListScroll}
        scrollEventThrottle={100}
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
      <View style={{ flex: 1 }}>
        {body}
        {unseen && (
          <View pointerEvents="box-none" className="absolute inset-x-0 bottom-3 items-center px-10">
            <PressableScale
              onPress={() => {
                setUnseen(null)
                listRef.current?.scrollToOffset({ offset: 0, animated: !reducedMotion })
              }}
              hapticKind={null}
              accessibilityRole="button"
              accessibilityLabel={`새 메시지, ${nicknameOf(unseen.user_id) ?? LEFT_MEMBER_NAME}: ${unseen.content}. 맨 아래로`}
              className="max-w-full flex-row items-center gap-1.5 rounded-full bg-primary py-2 pl-4 pr-3"
            >
              <Text numberOfLines={1} className="shrink text-[13px] font-bold text-white">
                {nicknameOf(unseen.user_id) ?? LEFT_MEMBER_NAME}: {unseen.content}
              </Text>
              <Ionicons name="arrow-down" size={15} color="#fff" />
            </PressableScale>
          </View>
        )}
      </View>
      <Composer
        onSend={onSend}
        sending={sending}
        bottomInset={bottomInset}
        replyingTo={replyingTo}
        onCancelReply={cancelReply}
      />
    </View>
  )
}
