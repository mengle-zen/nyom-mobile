import { useCallback, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
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
import { MAX_MEMBERS } from '@/features/group'
import { useMyGroups, useGroupMembers, type GroupMemberProfile } from '@/entities/group'
import {
  laneMembers,
  postsByMember,
  dateHeading,
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
  type Axis,
} from '@/features/board-nav'
import { BoardHeader } from '@/widgets/board-header'
import { TimeLanes, TimeLanesSkeleton } from '@/widgets/time-lanes'
import { DayPicker } from '@/widgets/day-picker'
import { PostDetail } from '@/widgets/post-detail'
import { ErrorState } from '@/shared/ui/error-state'
import { EASE_OUT_BEZIER } from '@/shared/ui/motion'
import { PressableScale, haptic } from '@/shared/ui/press'

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

const clampOffset = (n: number) => Math.min(MAX_OFFSET, Math.max(0, n))

export default function BoardScreen() {
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const { profile } = useMyProfile()
  const userId = user?.id ?? ''

  const params = useLocalSearchParams()
  const groupIdParam = one(params.group)

  // 푸시 딥링크(?date=)는 "초기 날짜"만 정한다. 이후 스와이프·달력 조작을 URL이 되돌리면
  // 안 되므로 lazy initializer로 첫 렌더에서만 읽는다(웹과 같은 규칙). slot·tag가 실려 와도
  // 시간 띠는 끼니로 나누지 않아 무시한다.
  const [initialTarget] = useState(() =>
    deeplinkTarget({ date: one(params.date) }, new Date(), MAX_OFFSET),
  )
  const [dateOffset, setDateOffset] = useState(initialTarget.dateOffset)
  /** 알림·업로드로 연 날 — 지난날이어도 그날 가장 최근 사진으로 스크롤한다. */
  const [linkedOffset] = useState(() => (one(params.date) ? initialTarget.dateOffset : null))
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

  const lanes = useMemo(() => laneMembers(members, userId), [members, userId])
  const today = useMemo(() => new Date(), [])
  const selectedDate = useMemo(
    () => dateFromOffset(dateOffset, today),
    [dateOffset, today],
  )
  const heading = useMemo(() => dateHeading(dateOffset, today), [dateOffset, today])

  const changeDate = useCallback((next: number) => {
    setDateOffset(clampOffset(next))
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
  // 가로 = 날짜, 세로 = 시간 띠 스크롤(2026-10-27). 세로로 움직이면 팬을 포기해서
  // 띠의 ScrollView가 받는다. 끼니를 넘기던 세로 스와이프와 화면 끝 탭은 없앴다.
  // 5명 이상인 옛 방은 띠를 가로로 밀어 봐야 해서 날짜 스와이프를 끄고 화살표만 쓴다.
  //
  // 가로 방향은 **iOS 캘린더·사진과 같은 관례**를 따른다:
  //   오른쪽으로 밀기(translationX > 0) = 과거   — 왼쪽에 있던 어제를 끌어온다
  //   왼쪽으로 밀기 (translationX < 0) = 미래   — 오른쪽에 있던 오늘로 되돌린다
  // 하루하루가 왼쪽(과거) → 오른쪽(오늘)으로 놓인 한 줄이라고 보면, 드래그 중
  // 콘텐츠가 손가락을 그대로 따라가는 것(dragX = translationX)이 이 배치와 맞는다.
  // 손가락을 오른쪽으로 밀면 지금 화면이 오른쪽으로 비켜나며 왼쪽에서 과거가 들어온다.
  const [stageWidth, setStageWidth] = useState(0)
  const dragX = useState(() => new Animated.Value(0))[0]
  const contentOpacity = useState(() => new Animated.Value(1))[0]
  const axisRef = useRef<Axis | null>(null)

  const onStageLayout = useCallback((e: LayoutChangeEvent) => {
    setStageWidth(e.nativeEvent.layout.width)
  }, [])

  /** 날짜가 실제로 넘어간 순간의 짧은 밝기 딥 — 내용이 갈렸다는 걸 눈에 찍는다. */
  const flashContent = useCallback(() => {
    // `setValue`로 0.4를 밀어 넣지 않고 duration 0 timing으로 떨어뜨린다 —
    // 네이티브 드라이버에 올라간 노드에 setValue를 섞으면 경고가 난다.
    Animated.sequence([
      Animated.timing(contentOpacity, {
        toValue: 0.4,
        duration: 0,
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 200,
        easing: Easing.bezier(...EASE_OUT_BEZIER),
        useNativeDriver: true,
      }),
    ]).start()
  }, [contentOpacity])

  /**
   * 스와이프로 날짜를 넘길 때만 쓰는 커밋.
   *
   * 양 끝(오늘 / 13일 전)에서는 고무줄만 튕기고 아무 일도 일어나지 않는다 —
   * 그때 햅틱까지 주면 "넘어갔다"는 잘못된 신호가 된다. 화살표 버튼은 눌린 것이
   * 눈에 보이므로 햅틱 없이 `changeDate`를 그대로 쓴다.
   */
  const commitDateSwipe = useCallback(
    (next: number) => {
      const clamped = clampOffset(next)
      if (clamped === dateOffset) return
      void haptic('light')
      flashContent()
      setDateOffset(clamped)
    },
    [dateOffset, flashContent],
  )

  /*
    eslint-disable react-hooks/refs --
    제스처 콜백은 렌더가 아니라 터치 이벤트에서 실행되므로 "렌더 중 ref 접근"이 아니다.
    축 판정 결과를 state로 두면 onUpdate가 매 프레임 재렌더를 일으키고, 그 사이 값이
    한 프레임 뒤처져 드래그가 튄다. 제스처가 끝날 때까지 살아 있으면서 렌더를 유발하지
    않아야 하므로 ref가 여기서는 올바른 도구다.
  */
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .enabled(members.length <= MAX_MEMBERS)
        .activeOffsetX([-DRAG_THRESHOLD, DRAG_THRESHOLD])
        .failOffsetY([-DRAG_THRESHOLD, DRAG_THRESHOLD])
        .onBegin(() => {
          axisRef.current = null
        })
        .onUpdate((e) => {
          if (!axisRef.current) {
            axisRef.current = decideAxis(e.translationX, e.translationY, DRAG_THRESHOLD)
          }
          if (axisRef.current !== 'h') return
          // 양 끝에서는 고무줄 저항. 오늘(offset 0)에서 더 갈 곳은 미래 = 왼쪽 드래그,
          // 13일 전에서 더 갈 곳은 과거 = 오른쪽 드래그다.
          const atNewest = dateOffset === 0 && e.translationX < 0
          const atOldest = dateOffset === MAX_OFFSET && e.translationX > 0
          dragX.setValue(atNewest || atOldest ? e.translationX * 0.3 : e.translationX)
        })
        .onEnd((e) => {
          const axis = axisRef.current
          if (axis === 'h') {
            const w = stageWidth || 360
            if (e.translationX > w * COMMIT_RATIO) commitDateSwipe(dateOffset + 1)
            else if (e.translationX < -w * COMMIT_RATIO) commitDateSwipe(dateOffset - 1)
          }
        })
        .onFinalize(() => {
          axisRef.current = null
          Animated.spring(dragX, {
            toValue: 0,
            speed: 20,
            bounciness: 3,
            // 드래그 중에는 setValue로 직접 값을 밀어 넣는다. 같은 노드를 네이티브
            // 드라이버로 승격시키면 JS 쪽 갱신과 섞여 경고가 나므로 JS 드라이버로 둔다.
            // (불투명도는 별도 노드라 네이티브 드라이버를 쓸 수 있다.)
            useNativeDriver: false,
          }).start()
        }),
    [dateOffset, stageWidth, dragX, commitDateSwipe, members.length],
  )
  /* eslint-enable react-hooks/refs */

  // ── 상세 ──────────────────────────────────────────────────
  // 게시물 id만 들고 있고 본문은 매 렌더 캐시에서 다시 찾는다 —
  // 리액션 낙관적 업데이트가 상세 화면에도 그대로 반영되도록.
  //
  // 상세에서는 그 사람의 그날 사진 전체를 시각순으로 넘겨 보고, 누른 사진부터 연다
  // (예전엔 "같은 끼니"만 넘겼다 — 끼니 칸이 없어졌다).
  const detailPosts = useMemo<BoardPost[]>(() => {
    const opened = posts.find((p) => p.id === detailPostId)
    return opened ? postsByMember(posts, opened.user_id) : []
  }, [posts, detailPostId])
  const detailIndex = Math.max(0, detailPosts.findIndex((p) => p.id === detailPostId))
  const detailMember = useMemo<GroupMemberProfile | null>(
    () => members.find((m) => m.user_id === detailPosts[0]?.user_id) ?? null,
    [members, detailPosts],
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
        dateLabelText={heading.primary}
        dateCaption={heading.secondary}
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

      <GestureDetector gesture={pan}>
        {/* NativeWind가 Animated.View까지 감싸지는 않으므로 style로 직접 쓴다 */}
        <Animated.View
          onLayout={onStageLayout}
          style={{ flex: 1, transform: [{ translateX: dragX }] }}
        >
          <Animated.View style={{ flex: 1, opacity: contentOpacity }}>
            {groupHasNothing ? (
              <NoRecordEmpty onUpload={goUpload} />
            ) : postsLoading ? (
              <TimeLanesSkeleton memberCount={members.length} />
            ) : (
              <TimeLanes
                key={dateOffset}
                members={lanes}
                posts={posts}
                currentUserId={userId}
                now={dateOffset === 0 ? new Date() : null}
                startAtLatest={dateOffset === 0 || dateOffset === linkedOffset}
                onOpenPost={openPost}
              />
            )}
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      {/*
        하단 촬영 버튼은 **보드의 상시 진입점**이다. 내 칸이 이미 찼을 때도, 그룹에
        기록이 하나도 없을 때도, 과거 날짜를 보고 있을 때도 여기서만 기록을 시작할 수
        있다.
      */}
      <View
        className="items-center pt-1"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <PressableScale
          onPress={goUpload}
          hapticKind={null}
          accessibilityRole="button"
          accessibilityLabel="오늘의 한 끼 기록하기"
          accessibilityHint="사진을 찍어 오늘 날짜로 기록해요"
          className="size-16 items-center justify-center rounded-full bg-primary"
        >
          <Ionicons name="camera" size={30} color="#fff" />
        </PressableScale>
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

      {/* 열 때마다 새로 그려 누른 사진부터 보여 준다 */}
      <PostDetail
        key={detailPostId ?? 'closed'}
        posts={detailPosts}
        initialIndex={detailIndex}
        member={detailMember}
        isMe={detailPosts[0]?.user_id === userId}
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
        <Ionicons name="people-outline" size={44} color="rgba(255,255,255,0.45)" />
      </View>
      <Text className="text-2xl font-bold text-foreground">먼저 그룹을 만들어요</Text>
      <Text className="text-center text-sm leading-relaxed text-muted-foreground">
        친구들과 끼니를 공유할 그룹을 만들거나{'\n'}초대코드로 참여해 보세요
      </Text>
      <PressableScale
        onPress={() => router.replace(href('/groups'))}
        hapticKind={null}
        accessibilityRole="button"
        className="h-control justify-center rounded-full bg-primary px-6"
      >
        <Text className="text-sm font-bold text-primary-foreground">
          그룹 만들기 / 참여하기
        </Text>
      </PressableScale>
    </View>
  )
}

/** 그룹은 있지만 아직 아무도 한 끼도 올리지 않았을 때. */
function NoRecordEmpty({ onUpload }: { onUpload: () => void }) {
  return (
    <View className="flex-1 items-center justify-center gap-4 px-8">
      <Ionicons name="restaurant-outline" size={44} color="rgba(255,255,255,0.45)" />
      <Text className="text-lg font-bold text-white">아직 첫 끼니가 없어요</Text>
      <Text className="text-center text-sm leading-relaxed text-white/50">
        먼저 한 끼를 올리면{'\n'}친구들에게 알림이 가요
      </Text>
      <PressableScale
        onPress={onUpload}
        hapticKind={null}
        accessibilityRole="button"
        className="h-control justify-center rounded-full bg-primary px-6"
      >
        <Text className="text-sm font-bold text-primary-foreground">첫 끼니 올리기</Text>
      </PressableScale>
    </View>
  )
}
