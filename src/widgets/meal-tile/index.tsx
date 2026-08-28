import { useCallback, useRef, useState } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native'
import { Image } from 'expo-image'
import Ionicons from '@expo/vector-icons/Ionicons'
import type { GroupMemberProfile } from '@/entities/group'
import { hhmmFromDate } from '@/entities/post'
import type { BoardPost } from '@/entities/post/model'
import { summarizeReactions, myReactionEmoji, REACTION_EMOJIS } from '@/entities/reaction'
import { decideAxis, DRAG_THRESHOLD } from '@/features/board-nav'

/**
 * 타일 위에서 시작한 터치가 "탭"이었는지 "스와이프"였는지 가른다.
 *
 * 타일이 화면 대부분을 덮기 때문에, 날짜·끼니를 넘기려는 스와이프도 타일 안에서
 * 시작하고 끝난다. RN의 Pressable은 요소 안에 머무는 한 손가락이 얼마나 움직였든
 * onPress를 쏘기 때문에, 그대로 두면 스와이프 한 번에 상세가 열려버린다
 * (실제로 시뮬레이터에서 재현됐다). 판정 기준은 보드 제스처와 같은
 * `decideAxis`를 그대로 쓴다 — 축이 잡혔다면 그건 스와이프다.
 */
function useTapOnly(onTap: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null)

  const onPressIn = useCallback((e: GestureResponderEvent) => {
    start.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY }
  }, [])

  const onPress = useCallback(
    (e: GestureResponderEvent) => {
      const from = start.current
      start.current = null
      if (from) {
        const dx = e.nativeEvent.pageX - from.x
        const dy = e.nativeEvent.pageY - from.y
        if (decideAxis(dx, dy, DRAG_THRESHOLD) !== null) return // 스와이프였다
      }
      onTap()
    },
    [onTap],
  )

  return { onPressIn, onPress }
}

type FilledProps = {
  member: GroupMemberProfile
  post: BoardPost
  isMe: boolean
  /** 같은 멤버·같은 끼니의 추가 기록 수 */
  extraCount: number
  currentUserId: string
  onReact: (postId: string, emoji: string) => void
  /** 사진 탭 → 상세 보기 */
  onOpen: () => void
}

/**
 * 올린 사람의 타일.
 *
 * 타일 전체가 "상세 보기" 버튼이다. 웹앱에서는 사진이 아무 핸들러 없는 div라
 * 탭하면 화면 우측 30% 가장자리 탭으로 먹혀 **끼니가 넘어갔고**, 정작 사진을 크게 보는
 * 기능은 없었다(docs/UX_FINDINGS.md B항). 여기서는 탭 = 상세이고, 끼니 이동은
 * 상단 칩과 세로 스와이프만 담당하므로 둘이 겹치지 않는다.
 */
export function FilledTile({
  member,
  post,
  isMe,
  extraCount,
  currentUserId,
  onReact,
  onOpen,
}: FilledProps) {
  const [imgFailed, setImgFailed] = useState(false)
  const time = hhmmFromDate(new Date(post.recorded_at))
  const tap = useTapOnly(onOpen)

  return (
    <Pressable
      {...tap}
      accessibilityRole="button"
      accessibilityLabel={`${isMe ? '나' : member.nickname}의 기록 자세히 보기, ${time}`}
      className="flex-1 overflow-hidden rounded-lg bg-board-tile active:opacity-90"
    >
      {post.signedImageUrl && !imgFailed && (
        <Image
          source={{ uri: post.signedImageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={120}
          onError={() => setImgFailed(true)}
        />
      )}

      {/* 위·아래 가독성 그라데이션 대용 — expo-linear-gradient가 없어 반투명 판으로 대신한다 */}
      <View pointerEvents="none" className="absolute inset-x-0 top-0 h-10 bg-black/35" />
      <View pointerEvents="none" className="absolute inset-x-0 bottom-0 h-24 bg-black/45" />

      <View className="absolute left-1.5 top-1.5 rounded-full bg-black/40 px-2 py-0.5">
        <Text className="text-[11px] font-bold text-white">
          {isMe ? '나' : member.nickname}
        </Text>
      </View>
      {extraCount > 0 && (
        <View className="absolute right-1.5 top-1.5 rounded-full bg-black/45 px-1.5 py-0.5">
          <Text className="text-[10px] font-bold text-white">+{extraCount}</Text>
        </View>
      )}

      <View className="absolute inset-x-1.5 bottom-1.5 gap-1">
        <View className="flex-row items-center gap-1">
          <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.85)" />
          <Text className="text-[11px] font-semibold text-white">{time}</Text>
          {post.caption ? (
            <Text numberOfLines={1} className="flex-1 text-[11px] text-white/90">
              · {post.caption}
            </Text>
          ) : null}
        </View>
        <ReactionBar
          postId={post.id}
          reactions={post.reactions}
          currentUserId={currentUserId}
          onReact={onReact}
        />
      </View>
    </Pressable>
  )
}

type ReactionBarProps = {
  postId: string
  reactions: BoardPost['reactions']
  currentUserId: string
  onReact: (postId: string, emoji: string) => void
  /** 상세 화면에서는 처음부터 팔레트를 펼쳐 둔다 */
  alwaysExpanded?: boolean
}

/**
 * 달린 리액션만 보여주고, 「+」를 눌러야 팔레트가 펼쳐진다.
 *
 * 웹앱은 카운트 0인 이모지 4개를 항상 렌더해 타일 하단 1/4을 빈 칩이 먹었고,
 * 1인 1리액션인데 4개가 나열돼 여러 개 고를 수 있는 것처럼 보였다
 * (docs/UX_FINDINGS.md F항).
 */
export function ReactionBar({
  postId,
  reactions,
  currentUserId,
  onReact,
  alwaysExpanded = false,
}: ReactionBarProps) {
  const [expanded, setExpanded] = useState(false)
  const open = alwaysExpanded || expanded
  const counts = summarizeReactions(reactions, currentUserId)
  const mine = myReactionEmoji(reactions, currentUserId)

  const react = (emoji: string) => {
    onReact(postId, emoji)
    setExpanded(false)
  }

  if (open) {
    return (
      <View className="flex-row flex-wrap items-center gap-1">
        {REACTION_EMOJIS.map((emoji) => {
          const n = counts.find((c) => c.emoji === emoji)?.count ?? 0
          return (
            <Chip
              key={emoji}
              emoji={emoji}
              count={n}
              active={mine === emoji}
              onPress={() => react(emoji)}
            />
          )
        })}
        {!alwaysExpanded && (
          <Pressable
            onPress={() => setExpanded(false)}
            accessibilityRole="button"
            accessibilityLabel="리액션 접기"
            hitSlop={4}
            className="h-6 items-center justify-center rounded-full bg-black/45 px-2 active:opacity-70"
          >
            <Ionicons name="chevron-back" size={12} color="#fff" />
          </Pressable>
        )}
      </View>
    )
  }

  return (
    <View className="flex-row items-center gap-1">
      {counts.map((c) => (
        <Chip
          key={c.emoji}
          emoji={c.emoji}
          count={c.count}
          active={c.mine}
          onPress={() => react(c.emoji)}
        />
      ))}
      <Pressable
        onPress={() => setExpanded(true)}
        accessibilityRole="button"
        accessibilityLabel="리액션 남기기"
        hitSlop={4}
        className="h-6 min-w-6 items-center justify-center rounded-full bg-black/45 px-2 active:opacity-70"
      >
        <Ionicons name="add" size={13} color="#fff" />
      </Pressable>
    </View>
  )
}

function Chip({
  emoji,
  count,
  active,
  onPress,
}: {
  emoji: string
  count: number
  active: boolean
  onPress: () => void
}) {
  // 칩 위에서 시작한 스와이프로 남의 기록에 리액션이 달리면 안 된다.
  const tap = useTapOnly(onPress)

  return (
    <Pressable
      {...tap}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${emoji} 리액션${active ? ' 해제' : ''}${count > 0 ? `, ${count}개` : ''}`}
      hitSlop={4}
      className={`h-6 flex-row items-center gap-0.5 rounded-full px-2 active:opacity-70 ${
        active ? 'bg-primary' : 'bg-black/45'
      }`}
    >
      <Text className="text-[11px]">{emoji}</Text>
      {count > 0 && (
        <Text className="text-[10px] font-bold text-white">{count}</Text>
      )}
    </Pressable>
  )
}

type EmptyProps = {
  member: GroupMemberProfile
  isMe: boolean
  onUpload: () => void
}

/** 아직 안 올린 칸. 내 칸이면 바로 올릴 수 있는 버튼, 친구 칸이면 「아직이에요」. */
export function EmptyTile({ member, isMe, onUpload }: EmptyProps) {
  const tap = useTapOnly(onUpload)

  if (isMe) {
    return (
      <Pressable
        {...tap}
        accessibilityRole="button"
        accessibilityLabel="지금 올리기"
        className="flex-1 items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-dashed border-primary/60 bg-primary/10 active:opacity-80"
      >
        <View className="size-9 items-center justify-center rounded-full bg-primary">
          <Ionicons name="camera" size={18} color="#fff" />
        </View>
        <Text className="text-xs font-bold text-primary">지금 올리기</Text>
      </Pressable>
    )
  }

  return (
    <View className="flex-1 items-center justify-center gap-1 rounded-lg border-[1.5px] border-dashed border-white/15 bg-white/5">
      <Text className="text-[11px] font-semibold text-white/40">{member.nickname}</Text>
      <Text className="text-[10px] text-white/25">아직이에요</Text>
    </View>
  )
}
