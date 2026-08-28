import { useCallback, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Pressable,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native'
import { router, useLocalSearchParams, type Href } from 'expo-router'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'

import { useAuth } from '@/features/auth'
import { useMyProfile } from '@/features/profile'
import { useMyGroups, useGroupMembers, type GroupMemberProfile } from '@/entities/group'
import {
  MEAL_SLOTS,
  clampSlotIdx,
  slotProgress,
  dateLabel,
  dateFromOffset,
  offsetFromDate,
  deeplinkTarget,
} from '@/entities/post'
import type { BoardPost } from '@/entities/post/model'
import {
  useBoardPosts,
  useToggleReaction,
  useGroupRecordedDays,
} from '@/entities/post/queries'
import {
  decideAxis,
  DRAG_THRESHOLD,
  COMMIT_RATIO,
  VERTICAL_COMMIT,
  type Axis,
} from '@/features/board-nav'
import { BoardHeader } from '@/widgets/board-header'
import { SlotChips } from '@/widgets/slot-chips'
import { SlotBoard } from '@/widgets/slot-board'
import { DayPicker } from '@/widgets/day-picker'
import { PostDetail } from '@/widgets/post-detail'
import { ErrorState } from '@/shared/ui/error-state'

/** 최근 2주. 보드 화살표·스와이프·달력이 모두 이 범위를 공유한다. */
const MAX_OFFSET = 13

/**
 * upload·profile 라우트는 다른 작업으로 추가되는 중이라 typedRoutes 목록에
 * 아직 없을 수 있다. 경로가 생기면 이 헬퍼만 지우면 된다.
 */
function href(path: string): Href {
  return path as unknown as Href
}

/** useLocalSearchParams는 같은 키가 여러 번 오면 배열을 준다. 첫 값만 쓴다. */
function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default function BoardScreen() {
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const { profile } = useMyProfile()
  const userId = user?.id ?? ''

  const params = useLocalSearchParams()
  const groupIdParam = one(params.group)

  // 푸시 딥링크(?date=&slot=)는 "초기 위치"만 정한다. 이후 칩·스와이프·달력 조작을
  // URL이 되돌리면 안 되므로 lazy initializer로 첫 렌더에서만 읽는다(웹과 같은 규칙).
  const [initialTarget] = useState(() =>
    deeplinkTarget(
      { date: one(params.date), slot: one(params.slot) },
      new Date(),
      MAX_OFFSET,
    ),
  )
  const [dateOffset, setDateOffset] = useState(initialTarget.dateOffset)
  const [slotIdx, setSlotIdx] = useState(initialTarget.slotIdx)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [detailPostId, setDetailPostId] = useState<string | null>(null)

  const { data: groups, error: groupsError, isLoading: groupsLoading } = useMyGroups()
  const activeGroupId = useMemo(() => {
    if (!groups) return null
    return groups.find((g) => g.id === groupIdParam)?.id ?? groups[0]?.id ?? null
  }, [groups, groupIdParam])

  const { data: members = [], error: membersError } = useGroupMembers(activeGroupId)
  const {
    data: posts = [],
    error: postsError,
    isLoading: postsLoading,
  } = useBoardPosts(activeGroupId, dateOffset)
  const { data: recordedDays } = useGroupRecordedDays(activeGroupId)

  const react = useToggleReaction(activeGroupId, dateOffset, userId)
  const error = groupsError ?? membersError ?? postsError

  const slots = useMemo(() => slotProgress(members, posts), [members, posts])
  const today = useMemo(() => new Date(), [])
  const selectedDate = useMemo(
    () => dateFromOffset(dateOffset, today),
    [dateOffset, today],
  )
  const labelText = useMemo(() => dateLabel(dateOffset, today), [dateOffset, today])

  /**
   * 날짜를 옮겨도 **끼니는 그대로 둔다.**
   * 웹앱은 날짜가 바뀔 때마다 슬롯을 아침으로 리셋해서 "어제 저녁"을 보려면 조작이
   * 4번 필요했다(docs/UX_FINDINGS.md D항). 그 날 그 끼니가 비어 있으면 기존
   * 「아직이에요」 빈 상태가 그대로 답이 된다.
   */
  const changeDate = useCallback((next: number) => {
    setDateOffset(Math.min(MAX_OFFSET, Math.max(0, next)))
  }, [])

  const changeSlot = useCallback((next: number) => {
    setSlotIdx(clampSlotIdx(next))
  }, [])

  const goUpload = useCallback(() => {
    router.push(href(`/upload${activeGroupId ? `?group=${activeGroupId}` : ''}`))
  }, [activeGroupId])

  const handlePickDate = useCallback(
    (date: Date) => {
      const offset = offsetFromDate(date, new Date())
      if (offset < 0 || offset > MAX_OFFSET) return // 피커에서 이미 비활성
      changeDate(offset)
      setPickerOpen(false)
    },
    [changeDate],
  )

  // ── 제스처 ────────────────────────────────────────────────
  // 가로 = 날짜, 세로 = 끼니. 둘 다 "움직여야" 성립하는 스와이프라 사진 탭과 겹치지
  // 않는다. 웹앱의 보이지 않는 가장자리 탭은 옮기지 않았다 — 그게 바로 친구 사진을
  // 탭하면 끼니가 넘어가던 원인이었고(docs/UX_FINDINGS.md B항), 이제 끼니 이동은
  // 상단 칩이 눈에 보이게 담당한다.
  const [stageWidth, setStageWidth] = useState(0)
  const dragX = useRef(new Animated.Value(0)).current
  const axisRef = useRef<Axis | null>(null)

  const onStageLayout = useCallback((e: LayoutChangeEvent) => {
    setStageWidth(e.nativeEvent.layout.width)
  }, [])

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onBegin(() => {
          axisRef.current = null
        })
        .onUpdate((e) => {
          if (!axisRef.current) {
            axisRef.current = decideAxis(e.translationX, e.translationY, DRAG_THRESHOLD)
          }
          if (axisRef.current !== 'h') return
          // 양 끝(오늘 / 13일 전)에서는 고무줄 저항
          const atNewest = dateOffset === 0 && e.translationX > 0
          const atOldest = dateOffset === MAX_OFFSET && e.translationX < 0
          dragX.setValue(atNewest || atOldest ? e.translationX * 0.3 : e.translationX)
        })
        .onEnd((e) => {
          const axis = axisRef.current
          if (axis === 'h') {
            const w = stageWidth || 360
            if (e.translationX < -w * COMMIT_RATIO) changeDate(dateOffset + 1)
            else if (e.translationX > w * COMMIT_RATIO) changeDate(dateOffset - 1)
          } else if (axis === 'v') {
            // 위로 밀면 다음 끼니, 아래로 밀면 이전 끼니
            if (e.translationY < -VERTICAL_COMMIT) changeSlot(slotIdx + 1)
            else if (e.translationY > VERTICAL_COMMIT) changeSlot(slotIdx - 1)
          }
        })
        .onFinalize(() => {
          axisRef.current = null
          Animated.timing(dragX, {
            toValue: 0,
            duration: 200,
            // 드래그 중에는 setValue로 직접 값을 밀어 넣는다. 같은 노드를 네이티브
            // 드라이버로 승격시키면 JS 쪽 갱신과 섞여 경고가 나므로 JS 드라이버로 둔다.
            useNativeDriver: false,
          }).start()
        }),
    [dateOffset, slotIdx, stageWidth, dragX, changeDate, changeSlot],
  )

  // ── 상세 ──────────────────────────────────────────────────
  // 게시물 id만 들고 있고 본문은 매 렌더 캐시에서 다시 찾는다 —
  // 리액션 낙관적 업데이트가 상세 화면에도 그대로 반영되도록.
  const detailPost = useMemo<BoardPost | null>(
    () => posts.find((p) => p.id === detailPostId) ?? null,
    [posts, detailPostId],
  )
  const detailMember = useMemo<GroupMemberProfile | null>(
    () => members.find((m) => m.user_id === detailPost?.user_id) ?? null,
    [members, detailPost],
  )
  const openPost = useCallback((post: BoardPost) => setDetailPostId(post.id), [])

  // ── 렌더 ──────────────────────────────────────────────────
  if (error) {
    return (
      <View className="flex-1 bg-board-bg" style={{ paddingTop: insets.top }}>
        <ErrorState
          message="보드를 불러오지 못했어요"
          onRetry={() => router.replace(href('/groups'))}
        />
      </View>
    )
  }

  if (groupsLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-board-bg">
        <ActivityIndicator color="#FF7A2E" />
      </View>
    )
  }

  if (groups && groups.length === 0) {
    return <NoGroupEmpty />
  }

  const groupHasNothing =
    recordedDays !== undefined && recordedDays.size === 0 && posts.length === 0

  return (
    <View className="flex-1 bg-board-bg" style={{ paddingTop: insets.top }}>
      <BoardHeader
        dateLabelText={labelText}
        canGoOlder={dateOffset < MAX_OFFSET}
        canGoNewer={dateOffset > 0}
        onOlder={() => changeDate(dateOffset + 1)}
        onNewer={() => changeDate(dateOffset - 1)}
        onDatePress={() => setPickerOpen(true)}
        onBack={() => router.replace(href('/groups'))}
        onProfile={() => router.push(href('/profile'))}
        avatarInitial={profile?.nickname?.[0] ?? '나'}
        avatarUrl={profile?.avatar_url ?? null}
      />

      <SlotChips slots={slots} activeIdx={slotIdx} onSelect={changeSlot} />

      <GestureDetector gesture={pan}>
        {/* NativeWind가 Animated.View까지 감싸지는 않으므로 style로 직접 쓴다 */}
        <Animated.View
          onLayout={onStageLayout}
          style={{ flex: 1, transform: [{ translateX: dragX }] }}
        >
          {groupHasNothing ? (
            <NoRecordEmpty onUpload={goUpload} />
          ) : postsLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color="#FF7A2E" />
            </View>
          ) : (
            <SlotBoard
              slot={MEAL_SLOTS[slotIdx].key}
              members={members}
              posts={posts}
              currentUserId={userId}
              onReact={react}
              onUpload={goUpload}
              onOpenPost={openPost}
            />
          )}
        </Animated.View>
      </GestureDetector>

      <View
        className="items-center pt-1"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <Pressable
          onPress={goUpload}
          accessibilityRole="button"
          accessibilityLabel="오늘의 한 끼 기록하기"
          className="size-16 items-center justify-center rounded-full bg-primary active:opacity-85"
        >
          <Ionicons name="camera" size={30} color="#fff" />
        </Pressable>
      </View>

      <DayPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selected={selectedDate}
        onSelect={handlePickDate}
        markedDays={recordedDays}
        maxDate={today}
        minDate={dateFromOffset(MAX_OFFSET, today)}
      />

      <PostDetail
        post={detailPost}
        member={detailMember}
        isMe={detailPost?.user_id === userId}
        currentUserId={userId}
        onReact={react}
        onClose={() => setDetailPostId(null)}
      />
    </View>
  )
}

/** 아직 어느 그룹에도 속하지 않았을 때. */
function NoGroupEmpty() {
  return (
    <View className="flex-1 items-center justify-center gap-5 bg-background px-8">
      <View className="size-[120px] items-center justify-center rounded-full bg-primary-100">
        <Text className="text-5xl">👥</Text>
      </View>
      <Text className="text-2xl font-bold text-foreground">먼저 그룹을 만들어요</Text>
      <Text className="text-center text-sm leading-relaxed text-muted-foreground">
        친구들과 끼니를 공유할 그룹을 만들거나{'\n'}초대코드로 참여해 보세요
      </Text>
      <Pressable
        onPress={() => router.replace(href('/groups'))}
        accessibilityRole="button"
        className="rounded-full bg-primary px-6 py-3 active:opacity-85"
      >
        <Text className="text-sm font-bold text-primary-foreground">
          그룹 만들기 / 참여하기
        </Text>
      </Pressable>
    </View>
  )
}

/** 그룹은 있지만 아직 아무도 한 끼도 올리지 않았을 때. */
function NoRecordEmpty({ onUpload }: { onUpload: () => void }) {
  return (
    <View className="flex-1 items-center justify-center gap-4 px-8">
      <Text className="text-5xl">🍚</Text>
      <Text className="text-lg font-bold text-white">아직 첫 끼니가 없어요</Text>
      <Text className="text-center text-sm leading-relaxed text-white/50">
        먼저 한 끼를 올리면{'\n'}친구들에게 알림이 가요
      </Text>
      <Pressable
        onPress={onUpload}
        accessibilityRole="button"
        className="rounded-full bg-primary px-6 py-3 active:opacity-85"
      >
        <Text className="text-sm font-bold text-primary-foreground">첫 끼니 올리기</Text>
      </Pressable>
    </View>
  )
}
