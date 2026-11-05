import { memo, useCallback, useMemo } from 'react'
import { Alert, Text, View, type AccessibilityActionEvent } from 'react-native'
import { Image } from 'expo-image'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { hhmmFromDate, postImageSource } from '@/entities/post'
import type { QuotedPost, RoomMessage } from '@/entities/message'
import { DURATION_MOVE, EASE_OUT } from '@/shared/ui/motion'
import { PressableScale, haptic } from '@/shared/ui/press'

/** 방을 나간 사람. 메시지는 남아 있지만 멤버 목록에서 이름을 찾을 수 없다. */
export const LEFT_MEMBER_NAME = '나간 친구'

const AVATAR = 32
const THUMB = 34
/** 이만큼 왼쪽으로 밀면 답장. 넘는 순간 진동이 온다. */
const REPLY_THRESHOLD = 56
/** 말풍선이 따라오는 최대 거리. 끝으로 갈수록 덜 따라온다. */
const REPLY_LIMIT = 80
const REPLY_ICON = 30

type Props = {
  message: RoomMessage
  showAuthor: boolean
  isMine: boolean
  authorName: string
  avatarUrl: string | null
  /** 「수진의 12:31 기록」·「지운 기록」. 답장이 아니면 null */
  quote: string | null
  /** 말풍선 안 「수진에게 답장 / 원문」. 메시지 답장이 아니면 null */
  reply: { title: string | null; text: string } | null
  /** 원문으로 이동해 잠깐 강조하는 중 */
  highlighted: boolean
  onOpenPost: (post: QuotedPost) => void
  onDelete: (id: string) => void
  onReply: (message: RoomMessage) => void
  onJumpTo: (id: string) => void
}

/** 「12:31」 → 「12시 31분」. 스크린 리더가 시각으로 읽게 한다. */
function spokenTime(text: string): string {
  return text.replace(/(\d{1,2}):(\d{2})/g, (_, h: string, m: string) => `${Number(h)}시 ${Number(m)}분`)
}

/**
 * 채팅 한 줄 — 내 것은 오른쪽 오렌지, 다른 사람은 왼쪽 아바타+이름.
 *
 * 스크린 리더에는 줄 전체를 한 덩어리로 읽힌다(「수진, 수진의 12시 31분 기록에 답장, 을지로 은주정」).
 * 그래서 인용 열기·지우기·답장은 손으로는 각 부분을 누르거나 밀어서, 스크린 리더로는 줄의 동작으로 한다.
 *
 * 줄을 왼쪽으로 밀면 답장한다(카카오톡처럼). 오른쪽·세로 움직임은 실패시켜 목록 스크롤과
 * iOS 뒤로 가기 스와이프를 막지 않는다.
 */
export const MessageRow = memo(function MessageRow({
  message,
  showAuthor,
  isMine,
  authorName,
  avatarUrl,
  quote,
  reply,
  highlighted,
  onOpenPost,
  onDelete,
  onReply,
  onJumpTo,
}: Props) {
  const time = hhmmFromDate(new Date(message.created_at))
  const post = message.post
  const repliedId = message.reply_to?.id ?? null

  // 워크릿이 메시지 객체를 통째로 복사하지 않게 함수로 넘긴다.
  const replyToThis = useCallback(() => onReply(message), [onReply, message])
  const dx = useSharedValue(0)
  const armed = useSharedValue(false)
  const swipe = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX(-14)
        .failOffsetX(14)
        .failOffsetY([-12, 12])
        .onUpdate((e) => {
          const pull = Math.min(0, e.translationX)
          dx.set(-REPLY_LIMIT * (1 - Math.exp(pull / REPLY_LIMIT)))
          const hit = -dx.get() >= REPLY_THRESHOLD
          if (hit !== armed.get()) {
            armed.set(hit)
            if (hit) scheduleOnRN(haptic, 'light')
          }
        })
        .onEnd(() => {
          if (armed.get()) scheduleOnRN(replyToThis)
        })
        .onFinalize(() => {
          armed.set(false)
          dx.set(withTiming(0, { duration: DURATION_MOVE, easing: EASE_OUT }))
        }),
    [dx, armed, replyToThis],
  )
  const slideStyle = useAnimatedStyle(() => ({ transform: [{ translateX: dx.get() }] }))
  const iconStyle = useAnimatedStyle(() => {
    const p = Math.min(1, -dx.get() / REPLY_THRESHOLD)
    return { opacity: p, transform: [{ scale: 0.6 + 0.4 * p }] }
  })
  const iconFillStyle = useAnimatedStyle(() => ({
    backgroundColor: -dx.get() >= REPLY_THRESHOLD ? '#FF7A2E' : 'rgba(255,255,255,0.1)',
  }))

  const confirmDelete = () => {
    void haptic('medium')
    Alert.alert('메시지를 지울까요?', '지우면 모두에게서 사라져요', [
      { text: '취소', style: 'cancel' },
      { text: '지우기', style: 'destructive', onPress: () => onDelete(message.id) },
    ])
  }

  const a11yLabel = [
    isMine ? '나' : authorName,
    quote ? `${spokenTime(quote)}에 답장` : null,
    reply ? [reply.title, reply.text].filter(Boolean).join(': ') : null,
    message.content,
    spokenTime(time),
  ]
    .filter(Boolean)
    .join(', ')

  const actions = [
    { name: 'reply', label: '답장' },
    ...(post ? [{ name: 'activate', label: '기록 보기' }] : []),
    ...(!post && repliedId ? [{ name: 'activate', label: '원래 메시지 보기' }] : []),
    ...(isMine ? [{ name: 'longpress', label: '지우기' }] : []),
  ]
  const onAction = (e: AccessibilityActionEvent) => {
    const name = e.nativeEvent.actionName
    if (name === 'reply') onReply(message)
    if (name === 'activate' && post) onOpenPost(post)
    else if (name === 'activate' && repliedId) onJumpTo(repliedId)
    if (name === 'longpress' && isMine) confirmDelete()
  }

  const bubble = (
    <View
      className={`rounded-2xl px-3.5 py-2 ${isMine ? 'bg-primary' : 'bg-board-surface'}`}
    >
      {reply && (
        <ReplyQuote reply={reply} isMine={isMine} onPress={repliedId ? () => onJumpTo(repliedId) : null} />
      )}
      <Text className={`text-[15px] leading-snug ${isMine ? 'text-white' : 'text-white/90'}`}>
        {message.content}
      </Text>
      {highlighted && (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: -3, left: -3, right: -3, bottom: -3 }}
          className="rounded-[19px] border-2 border-primary-200"
        />
      )}
    </View>
  )

  return (
    <GestureDetector gesture={swipe}>
      <View
        accessible
        accessibilityLabel={a11yLabel}
        accessibilityHint={isMine ? '왼쪽으로 밀어 답장, 길게 눌러 지우기' : '왼쪽으로 밀어 답장'}
        accessibilityActions={actions}
        onAccessibilityAction={onAction}
        className={`px-4 ${showAuthor ? 'mt-3' : 'mt-1'}`}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            { position: 'absolute', right: 16, top: '50%', marginTop: -REPLY_ICON / 2 },
            iconStyle,
          ]}
        >
          <Animated.View
            style={[{ width: REPLY_ICON, height: REPLY_ICON, borderRadius: REPLY_ICON / 2 }, iconFillStyle]}
            className="items-center justify-center"
          >
            <Ionicons name="arrow-undo" size={15} color="#fff" />
          </Animated.View>
        </Animated.View>
        <Animated.View style={slideStyle} className={`flex-row ${isMine ? 'justify-end' : ''}`}>
          {!isMine && (
            <View style={{ width: AVATAR }} className="mr-2">
              {showAuthor && <Avatar name={authorName} url={avatarUrl} />}
            </View>
          )}

          <View style={{ maxWidth: '78%' }} className={isMine ? 'items-end' : 'items-start'}>
            {!isMine && showAuthor && (
              <Text className="mb-1 text-xs font-semibold text-white/55">{authorName}</Text>
            )}

            {quote && <QuoteCard post={post} label={quote} onPress={onOpenPost} />}

            <View className={`flex-row items-end gap-1.5 ${isMine ? 'flex-row-reverse' : ''}`}>
              {/* 시각이 줄어들지 않게 말풍선 쪽만 줄바꿈으로 늘린다. */}
              <View className="shrink">
                {isMine ? (
                  <PressableScale onLongPress={confirmDelete} hapticKind={null}>
                    {bubble}
                  </PressableScale>
                ) : (
                  bubble
                )}
              </View>
              <Text className="text-[10px] text-white/35">{time}</Text>
            </View>
          </View>
        </Animated.View>
      </View>
    </GestureDetector>
  )
})

/**
 * 말풍선 안 위쪽의 메시지 답장 인용 — 「수진에게 답장 / 원문 한 줄」, 아래 구분선.
 * 누르면 원래 메시지로 간다. 원문이 지워졌으면 「지운 메시지」만, 누를 수 없다.
 */
function ReplyQuote({
  reply,
  isMine,
  onPress,
}: {
  reply: { title: string | null; text: string }
  isMine: boolean
  onPress: (() => void) | null
}) {
  const body = (
    <View className={`mb-1.5 border-b pb-1.5 ${isMine ? 'border-white/35' : 'border-white/15'}`}>
      {reply.title && (
        <Text numberOfLines={1} className={`text-xs font-bold ${isMine ? 'text-white' : 'text-white/75'}`}>
          {reply.title}
        </Text>
      )}
      <Text numberOfLines={1} className={`text-[13px] ${isMine ? 'text-white/85' : 'text-white/60'}`}>
        {reply.text}
      </Text>
    </View>
  )
  if (!onPress) return body
  return (
    <PressableScale onPress={onPress} hapticKind={null} swipeSafe>
      {body}
    </PressableScale>
  )
}

/** 답장이 가리키는 기록. 지운 기록이면 썸네일 없이 문구만, 누를 수 없다. */
function QuoteCard({
  post,
  label,
  onPress,
}: {
  post: QuotedPost | null
  label: string
  onPress: (post: QuotedPost) => void
}) {
  if (!post) {
    return (
      <View className="mb-1 rounded-xl bg-white/5 px-3 py-2">
        <Text numberOfLines={2} className="text-xs text-white/40">
          {label}
        </Text>
      </View>
    )
  }
  const source = postImageSource(post)
  return (
    <PressableScale
      onPress={() => onPress(post)}
      hapticKind={null}
      swipeSafe
      style={{ marginBottom: 4 }}
      className="flex-row items-center gap-2 rounded-xl bg-board-tile py-1.5 pl-1.5 pr-3"
    >
      <View
        style={{ width: THUMB, height: THUMB }}
        className="overflow-hidden rounded-md bg-white/10"
      >
        {source && (
          <Image source={source} style={{ width: THUMB, height: THUMB }} contentFit="cover" />
        )}
      </View>
      <Text numberOfLines={2} className="shrink text-xs font-semibold text-white/70">
        {label}
      </Text>
    </PressableScale>
  )
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  return (
    <View
      style={{ width: AVATAR, height: AVATAR }}
      className="items-center justify-center overflow-hidden rounded-full bg-white/15"
    >
      {url ? (
        <Image source={{ uri: url }} style={{ width: AVATAR, height: AVATAR }} contentFit="cover" />
      ) : (
        <Text className="text-xs font-bold text-white/80">{name.slice(0, 1)}</Text>
      )}
    </View>
  )
}
