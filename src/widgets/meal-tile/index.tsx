import { useEffect, useRef, useState } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import Ionicons from '@expo/vector-icons/Ionicons'
import type { GroupMemberProfile } from '@/entities/group'
import { hhmmFromDate } from '@/entities/post'
import type { BoardPost } from '@/entities/post/model'
import { summarizeReactions, myReactionEmoji, REACTION_EMOJIS } from '@/entities/reaction'
import { PressableScale } from '@/shared/ui/press'


/**
 * 리액션 칩은 24pt라 그대로면 옆 칩·남의 기록을 잘못 누르기 쉽다.
 * 위아래로만 넓혀 40pt 과녁을 만든다 — 칩 사이(4pt)로 넓히면 이웃 칩과 겹친다.
 */
const CHIP_HIT_SLOP = { top: 8, bottom: 8, left: 2, right: 2 }

/**
 * 타일 위에서 시작한 터치가 "탭"이었는지 "스와이프"였는지 가르는 일은
 * `PressableScale`의 `swipeSafe`가 맡는다.
 *
 * 타일이 화면 대부분을 덮기 때문에, 날짜·끼니를 넘기려는 스와이프도 타일 안에서
 * 시작하고 끝난다. RN의 Pressable은 요소 안에 머무는 한 손가락이 얼마나 움직였든
 * onPress를 쏘기 때문에, 그대로 두면 스와이프 한 번에 상세가 열려버린다
 * (실제로 시뮬레이터에서 재현됐다). 판정 기준은 보드 제스처와 같은 `decideAxis`다.
 */

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

  return (
    <PressableScale
      onPress={onOpen}
      swipeSafe
      // 상세로 넘어가는 건 화면 이동이다 — 햅틱을 주지 않는다.
      hapticKind={null}
      accessibilityRole="button"
      accessibilityLabel={`${isMe ? '나' : member.nickname}의 기록 자세히 보기, ${time}`}
      style={{ flex: 1 }}
      className="flex-1 overflow-hidden rounded-lg bg-board-tile"
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
    </PressableScale>
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
          <PressableScale
            onPress={() => setExpanded(false)}
            hapticKind={null}
            swipeSafe
            accessibilityRole="button"
            accessibilityLabel="리액션 접기"
            hitSlop={CHIP_HIT_SLOP}
            className="h-6 items-center justify-center rounded-full bg-black/45 px-2"
          >
            <Ionicons name="chevron-back" size={12} color="#fff" />
          </PressableScale>
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
      <PressableScale
        onPress={() => setExpanded(true)}
        // 팔레트를 펼치는 건 아직 아무것도 바꾸지 않았다 — 햅틱은 실제 토글에서만.
        hapticKind={null}
        swipeSafe
        accessibilityRole="button"
        accessibilityLabel="리액션 남기기"
        hitSlop={CHIP_HIT_SLOP}
        className="h-6 min-w-6 items-center justify-center rounded-full bg-black/45 px-2"
      >
        <Ionicons name="add" size={13} color="#fff" />
      </PressableScale>
    </View>
  )
}

/**
 * 카운트가 바뀌는 순간 칩이 한 번 톡 튄다.
 *
 * 리액션은 낙관적 업데이트라 탭과 동시에 숫자가 바뀌는데, 숫자만 조용히 갈리면
 * "눌렸나?"가 남는다. 아주 짧은 스케일 펄스로 변화가 일어난 지점을 눈에 찍어 준다.
 * 첫 렌더에서는 튀지 않는다 — 스와이프로 날짜를 넘길 때마다 온 화면이 들썩인다.
 */
function useCountPop(count: number) {
  const scale = useState(() => new Animated.Value(1))[0]
  const prev = useRef(count)

  useEffect(() => {
    if (prev.current === count) return
    prev.current = count
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.18, duration: 90, useNativeDriver: true }),
      Animated.spring(scale, {
        toValue: 1,
        speed: 20,
        bounciness: 10,
        useNativeDriver: true,
      }),
    ]).start()
  }, [count, scale])

  return scale
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
  const pop = useCountPop(count)

  return (
    <Animated.View style={{ transform: [{ scale: pop }] }}>
      <PressableScale
        onPress={onPress}
        // 리액션 토글은 "내가 뭔가를 바꿨다"에 해당한다 — 짧은 light 햅틱.
        hapticKind="light"
        // 칩 위에서 시작한 스와이프로 남의 기록에 리액션이 달리면 안 된다.
        swipeSafe
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={`${emoji} 리액션${active ? ' 해제' : ''}${count > 0 ? `, ${count}개` : ''}`}
        hitSlop={CHIP_HIT_SLOP}
        className={`h-6 flex-row items-center gap-0.5 rounded-full px-2 ${
          active ? 'bg-primary' : 'bg-black/45'
        }`}
      >
        <Text className="text-[11px]">{emoji}</Text>
        {count > 0 && <Text className="text-[10px] font-bold text-white">{count}</Text>}
      </PressableScale>
    </Animated.View>
  )
}

type EmptyProps = {
  member: GroupMemberProfile
  isMe: boolean
  /**
   * 이 칸에 지금 올릴 수 있는가 — 보고 있는 날짜가 오늘일 때만 true.
   *
   * 업로드는 now-only다(`recordedAtFromTime`이 날짜를 오늘로 고정한다). 과거 날짜를
   * 보다가 내 빈 칸을 눌러 업로드로 넘어가면 "그 날"이 아니라 오늘에 기록이 붙는다.
   * 백필을 지원하기 전까지는 과거 날짜에서 올리기를 제안하지 않는 게 맞다.
   */
  canUpload: boolean
  onUpload: () => void
}

/**
 * 아직 안 올린 칸.
 *
 * 내 칸이라도 **하단 촬영 버튼과 경쟁하지 않게** 무게를 낮췄다. 예전에는 채워진
 * 주황 원 + 「지금 올리기」로 하단 FAB과 똑같은 크기의 1차 액션이 한 화면에 둘이었고,
 * 특히 1인 그룹에서는 화면 절반이 같은 버튼 두 개였다. 하단 FAB이 "언제든 기록"이라는
 * 상시 진입점을 맡고(내 칸이 이미 찼을 때도 유일한 경로다), 이 칸은 "여기가 비었다"를
 * 알리면서 탭도 받는 **보조 지름길**로 둔다.
 */
export function EmptyTile({ member, isMe, canUpload, onUpload }: EmptyProps) {
  if (isMe && canUpload) {
    return (
      <PressableScale
        onPress={onUpload}
        swipeSafe
        // 업로드 화면으로 넘어가는 이동이다 — 햅틱은 주지 않는다.
        hapticKind={null}
        accessibilityRole="button"
        accessibilityLabel="내 끼니 올리기"
        style={{ flex: 1 }}
        className="flex-1 items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-dashed border-primary/45 bg-primary/10"
      >
        <Ionicons name="camera-outline" size={22} color="#FF8C46" />
        <Text className="text-[11px] font-semibold text-primary-300">
          탭해서 올리기
        </Text>
      </PressableScale>
    )
  }

  return (
    <View className="flex-1 items-center justify-center gap-1 rounded-lg border-[1.5px] border-dashed border-white/15 bg-white/5">
      <Text className="text-sm font-semibold text-white/55">
        {isMe ? '나' : member.nickname}
      </Text>
      <Text className="text-xs text-white/40">아직이에요</Text>
    </View>
  )
}
