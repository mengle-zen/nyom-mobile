import { memo } from 'react'
import { Alert, Text, View, type AccessibilityActionEvent } from 'react-native'
import { Image } from 'expo-image'
import { hhmmFromDate, postImageSource } from '@/entities/post'
import type { QuotedPost, RoomMessage } from '@/entities/message'
import { PressableScale, haptic } from '@/shared/ui/press'

/** 방을 나간 사람. 메시지는 남아 있지만 멤버 목록에서 이름을 찾을 수 없다. */
export const LEFT_MEMBER_NAME = '나간 친구'

const AVATAR = 32
const THUMB = 34

type Props = {
  message: RoomMessage
  showAuthor: boolean
  isMine: boolean
  authorName: string
  avatarUrl: string | null
  /** 「수진의 12:31 기록」·「지운 기록」. 답장이 아니면 null */
  quote: string | null
  onOpenPost: (post: QuotedPost) => void
  onDelete: (id: string) => void
}

/** 「12:31」 → 「12시 31분」. 스크린 리더가 시각으로 읽게 한다. */
function spokenTime(text: string): string {
  return text.replace(/(\d{1,2}):(\d{2})/g, (_, h: string, m: string) => `${Number(h)}시 ${Number(m)}분`)
}

/**
 * 채팅 한 줄 — 내 것은 오른쪽 오렌지, 다른 사람은 왼쪽 아바타+이름.
 *
 * 스크린 리더에는 줄 전체를 한 덩어리로 읽힌다(「수진, 수진의 12시 31분 기록에 답장, 을지로 은주정」).
 * 그래서 인용 카드 열기·지우기는 손으로는 각 부분을 눌러서, 스크린 리더로는 줄의 동작으로 한다.
 */
export const MessageRow = memo(function MessageRow({
  message,
  showAuthor,
  isMine,
  authorName,
  avatarUrl,
  quote,
  onOpenPost,
  onDelete,
}: Props) {
  const time = hhmmFromDate(new Date(message.created_at))
  const post = message.post

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
    message.content,
    spokenTime(time),
  ]
    .filter(Boolean)
    .join(', ')

  const actions = [
    ...(post ? [{ name: 'activate', label: '기록 보기' }] : []),
    ...(isMine ? [{ name: 'longpress', label: '지우기' }] : []),
  ]
  const onAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'activate' && post) onOpenPost(post)
    if (e.nativeEvent.actionName === 'longpress' && isMine) confirmDelete()
  }

  const bubble = (
    <View
      className={`rounded-2xl px-3.5 py-2 ${isMine ? 'bg-primary' : 'bg-board-surface'}`}
    >
      <Text className={`text-[15px] leading-snug ${isMine ? 'text-white' : 'text-white/90'}`}>
        {message.content}
      </Text>
    </View>
  )

  return (
    <View
      accessible
      accessibilityLabel={a11yLabel}
      accessibilityHint={isMine ? '길게 눌러 지우기' : undefined}
      accessibilityActions={actions.length > 0 ? actions : undefined}
      onAccessibilityAction={onAction}
      className={`flex-row px-4 ${showAuthor ? 'mt-3' : 'mt-1'} ${isMine ? 'justify-end' : ''}`}
    >
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
    </View>
  )
})

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
