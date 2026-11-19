import { useCallback, useState } from 'react'
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'

import { useQueryClient } from '@tanstack/react-query'

import {
  dedupeByBatch,
  postTimeLabel,
  postImageSource,
} from '@/entities/post'
import { useMyRecordedDays } from '@/entities/post/queries'
import { useMyGroups } from '@/entities/group'
import { useAuth } from '@/features/auth'
import { LookbackCalendar } from '@/features/calendar'
import { PostEditSheet, type EditablePost } from '@/features/post-edit'
import {
  groupByDay,
  longDayLabel,
  shortDayLabel,
  useMyPostCount,
  useMyPosts,
  useMyProfile,
  type DayGroup,
  type MyPost,
} from '@/features/profile'
import { queryKeys } from '@/shared/api/query-keys'
import { PressableScale } from '@/shared/ui/press'
import { SegmentedControl, type Segment } from '@/shared/ui/segmented-control'
import { Skeleton } from '@/shared/ui/skeleton'

/**
 * 하단 탭바가 콘텐츠 위에 떠 있다((app)/_layout의 h-16 + 하단 safe area).
 * 스크롤 끝을 이만큼 띄워야 마지막 카드가 탭바 뒤로 잘려 들어가지 않는다.
 */
const TAB_BAR_HEIGHT = 64

/**
 * 상세 모달이 다루는 최소 형태.
 * 그리드(MyPost)와 돌아보기 타임라인(DayPost)이 같은 상세·편집을 쓰도록 공통분모만 받는다.
 */
type DetailPost = {
  id: string
  batch_id: string | null
  /** 저장 경로 — 사진 캐시 키로 쓴다(`postImageSource`) */
  image_url: string
  signedImageUrl: string | null
  caption: string | null
  recorded_at: string
  meal_tag: string | null
}

/** 상세에 여는 묶음 — 그리드는 하루치, 돌아보기 타임라인은 한 장. */
type DetailGroup = {
  /** 모달을 열 때마다 처음 장부터 — 열린 묶음이 바뀌면 새로 그린다 */
  key: string
  /** 그리드에서 열면 그날 날짜. 한 장만 열면 없다 */
  title: string | null
  posts: DetailPost[]
}

/**
 * 프로필 — 내 기록 회고와 계정 설정.
 *
 * 웹 ProfilePage를 옮기되 두 가지가 다르다.
 *  - 통계에서 스트릭은 제품에서 제거됐다. 게시물 수만 둔다.
 *  - 상세에서 **끼니(슬롯)를 바꿀 수 있다**. 웹은 시각만 바꿀 수 있어 잘못 분류된
 *    기록을 영영 못 고쳤다(docs/UX_FINDINGS.md C항).
 */
type ProfileTab = 'grid' | 'calendar'

const PROFILE_TABS: Segment<ProfileTab>[] = [
  { key: 'grid', label: '그리드' },
  { key: 'calendar', label: '돌아보기' },
]

export default function ProfileScreen() {
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const userId = user?.id

  const queryClient = useQueryClient()

  const { profile, refetch: refetchProfile } = useMyProfile()
  const postsQuery = useMyPosts(userId)
  const { data: postCount } = useMyPostCount(userId)

  // 통계 — 스트릭은 제품에서 제거됐다. 백엔드를 건드리지 않고 이미 있는 쿼리만
  // 조합한다: 이번 달 기록일은 돌아보기 캘린더의 기록일 집합, 그룹 수는 내 그룹 목록.
  const now = new Date()
  const monthDaysQuery = useMyRecordedDays(userId, now.getFullYear(), now.getMonth())
  const groupsQuery = useMyGroups()

  const [refreshing, setRefreshing] = useState(false)
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([
        refetchProfile(),
        // myPosts 프리픽스 하나로 그리드 · 개수 · 월 기록일 · 일 타임라인이 함께 갱신된다
        queryClient.invalidateQueries({ queryKey: queryKeys.myPosts(userId ?? '') }),
        queryClient.invalidateQueries({ queryKey: queryKeys.groups.mine }),
      ])
    } finally {
      setRefreshing(false)
    }
  }, [queryClient, refetchProfile, userId])

  const [tab, setTab] = useState<ProfileTab>('grid')
  const [detail, setDetail] = useState<DetailGroup | null>(null)
  /** 사후 편집 대상. 상세에서 넘어온다(두 모달이 겹치지 않게 교체). */
  const [editingPost, setEditingPost] = useState<EditablePost | null>(null)

  // 같은 촬영(batch)이 여러 그룹에 올라갔어도 그리드엔 1번만. 한 칸 = 하루(2026-11-19).
  // 페이지 경계에 걸린 날은 다음 페이지를 불러오면 같은 칸에 마저 채워진다.
  const days = groupByDay(dedupeByBatch(postsQuery.data?.pages.flat() ?? []))

  const nickname =
    profile?.nickname ??
    (user?.user_metadata?.nickname as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    '사용자'
  const avatarUrl =
    profile?.avatar_url ?? (user?.user_metadata?.avatar_url as string | undefined)

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="h-header flex-row items-center border-b border-border/50 px-4">
        <Text className="text-base font-semibold text-foreground">프로필</Text>
        {/* 프로필 수정·알림 설정·로그아웃은 설정으로 모았다(2026-11-05). */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="설정"
          onPress={() => router.push('/(app)/settings' as never)}
          hitSlop={6}
          className="ml-auto size-icon items-center justify-center rounded-lg active:opacity-60"
        >
          <Ionicons name="settings-outline" size={20} color="#3A3329" />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        // 탭바(+ 하단 safe area)만큼 더 띄운다 — 안 그러면 그리드 마지막 줄과
        // 돌아보기 타임라인이 탭바 뒤로 잘려 들어간다.
        contentContainerStyle={{
          paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 16,
        }}
        contentContainerClassName="gap-6 px-4 pt-8"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
            tintColor="#FF7A2E"
            colors={['#FF7A2E']}
          />
        }
      >
        {/* 프로필 */}
        <View className="items-center gap-3">
          <View className="size-20 items-center justify-center overflow-hidden rounded-full bg-primary-100">
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                contentFit="cover"
                style={{ width: '100%', height: '100%' }}
                accessibilityLabel="프로필 사진"
              />
            ) : (
              <Ionicons name="person" size={32} color="#C24F0E" />
            )}
          </View>
          <Text className="text-lg font-semibold text-foreground">{nickname}</Text>
        </View>

        {/* 통계 — 지표 하나에 화면 폭을 다 쓰면 빈약해 보인다. 스트릭은 제품에서 제거됐다. */}
        <View className="flex-row items-stretch rounded-2xl border border-border bg-card py-4">
          <StatTile label="기록" value={postCount} />
          <StatDivider />
          <StatTile label="이번 달" value={monthDaysQuery.data?.size} unit="일" />
          <StatDivider />
          <StatTile label="그룹" value={groupsQuery.data?.length} />
        </View>

        {/* 탭 — 보드 끼니 칩과 같은 미끄러지는 인디케이터 */}
        <SegmentedControl segments={PROFILE_TABS} value={tab} onChange={setTab} />

        {tab === 'grid' ? (
          <MyPostsGrid
            days={days}
            loading={postsQuery.isLoading}
            error={(postsQuery.error as Error) ?? null}
            onRetry={() => void postsQuery.refetch()}
            onSelect={(day) =>
              setDetail({ key: day.key, title: longDayLabel(day.key), posts: day.posts })
            }
            hasMore={postsQuery.hasNextPage}
            loadingMore={postsQuery.isFetchingNextPage}
            onLoadMore={() => void postsQuery.fetchNextPage()}
          />
        ) : (
          <LookbackCalendar
            onSelectPost={(post) => setDetail({ key: post.id, title: null, posts: [post] })}
          />
        )}
      </ScrollView>

      <PostDetailModal
        key={detail?.key ?? 'closed'}
        group={detail}
        onClose={() => setDetail(null)}
        onEdit={(post) => {
          setDetail(null)
          setEditingPost({ id: post.id, batch_id: post.batch_id })
        }}
      />

      <PostEditSheet post={editingPost} onClose={() => setEditingPost(null)} />
    </View>
  )
}

/**
 * 통계 한 칸. 값이 아직 없으면 스피너 대신 숫자 자리를 뼈대로 잡는다 —
 * 세 칸의 높이가 로딩 중에도 흔들리지 않는다.
 */
function StatTile({
  label,
  value,
  unit,
}: {
  label: string
  value: number | undefined
  unit?: string
}) {
  return (
    <View className="flex-1 items-center gap-1">
      {value === undefined ? (
        <Skeleton style={{ width: 28, height: 22, borderRadius: 6 }} />
      ) : (
        <View className="flex-row items-baseline gap-0.5">
          <Text className="text-xl font-bold text-foreground">{value}</Text>
          {!!unit && (
            <Text className="text-xs font-medium text-muted-foreground">{unit}</Text>
          )}
        </View>
      )}
      <Text className="text-xs text-muted-foreground">{label}</Text>
    </View>
  )
}

function StatDivider() {
  return <View className="my-1 w-px bg-border" />
}

/** 그리드 로딩 뼈대 — 도착할 정사각 썸네일 자리를 미리 그린다. */
function GridSkeleton() {
  return (
    <View className="-m-0.5 flex-row flex-wrap">
      {Array.from({ length: 9 }, (_, i) => (
        <View key={i} style={{ width: '33.3333%' }} className="p-0.5">
          <View className="aspect-square">
            <Skeleton style={{ width: '100%', height: '100%', borderRadius: 10 }} />
          </View>
        </View>
      ))}
    </View>
  )
}

function MyPostsGrid({
  days,
  loading,
  error,
  onRetry,
  onSelect,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  days: DayGroup<MyPost>[]
  loading: boolean
  error: Error | null
  onRetry: () => void
  onSelect: (day: DayGroup<MyPost>) => void
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
}) {
  if (loading) return <GridSkeleton />

  if (error) {
    return (
      <View className="items-center gap-3 py-10">
        <Text className="text-sm text-muted-foreground">
          기록을 불러오지 못했어요
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          className="h-control-sm justify-center rounded-xl border border-border px-4 active:opacity-70"
        >
          <Text className="text-sm font-medium text-foreground">다시 시도</Text>
        </Pressable>
      </View>
    )
  }

  if (days.length === 0) {
    return (
      <View className="items-center justify-center gap-3 py-12">
        <Ionicons name="restaurant-outline" size={44} color="#A89A82" />
        <Text className="font-medium text-foreground">아직 기록이 없어요</Text>
        <Text className="text-sm text-muted-foreground">첫 끼니를 기록해봐요</Text>
      </View>
    )
  }

  return (
    <View className="gap-3">
      <View className="-m-0.5 flex-row flex-wrap">
        {days.map((day) => {
          // 한 칸 = 하루. 그날 첫 끼니가 대표 사진, 여러 장이면 방 화면 묶음 칸과 같은 장 수 배지.
          // 아래 띠는 시각 대신 날짜 — 회고에서 「언제」가 가장 먼저 궁금하다.
          const cover = day.posts[0]
          const count = day.posts.length
          const label = shortDayLabel(day.key)
          return (
            <View key={day.key} style={{ width: '33.3333%' }} className="p-0.5">
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`${longDayLabel(day.key)} 기록 ${count}장 보기`}
                // 상세를 여는 건 보기일 뿐 — 햅틱 없음.
                hapticKind={null}
                onPress={() => onSelect(day)}
                className="aspect-square overflow-hidden rounded-md bg-muted"
              >
                {cover.signedImageUrl && (
                  <Image
                    source={postImageSource(cover)}
                    contentFit="cover"
                    style={{ width: '100%', height: '100%' }}
                  />
                )}
                {count > 1 && (
                  <View className="absolute right-1 top-1 flex-row items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5">
                    <Ionicons name="copy-outline" size={11} color="#fff" />
                    <Text className="text-[11px] font-extrabold text-white">{count}</Text>
                  </View>
                )}
                <View className="absolute inset-x-0 bottom-0 bg-black/45 px-1 py-0.5">
                  <Text numberOfLines={1} className="text-[11px] font-semibold text-white">
                    {label}
                  </Text>
                </View>
              </PressableScale>
            </View>
          )
        })}
      </View>

      {hasMore && (
        <Pressable
          accessibilityRole="button"
          onPress={onLoadMore}
          disabled={loadingMore}
          className={`h-control items-center justify-center rounded-xl border border-border active:opacity-70 ${
            loadingMore ? 'opacity-50' : ''
          }`}
        >
          <Text className="font-medium text-foreground">
            {loadingMore ? '불러오는 중…' : '더 보기'}
          </Text>
        </Pressable>
      )}
    </View>
  )
}

/**
 * 상세 카드 — 그리드에서 열면 그날 사진을 밀어서 넘겨 보고(2026-11-19), 돌아보기 타임라인에서
 * 열면 한 장. 시각·메모·「기록 편집」은 보고 있는 장을 따른다. 열 때마다 key로 새로 그려
 * 첫 장부터 시작한다.
 */
function PostDetailModal({
  group,
  onClose,
  onEdit,
}: {
  group: DetailGroup | null
  onClose: () => void
  onEdit: (post: DetailPost) => void
}) {
  /** 사진 칸 폭 — 한 장씩 넘기는 단위. 카드가 그려진 뒤에 안다. */
  const [pageW, setPageW] = useState(0)
  const [index, setIndex] = useState(0)
  const posts = group?.posts ?? []
  const post = posts[Math.min(index, posts.length - 1)] ?? null
  const time = post ? postTimeLabel(post.recorded_at, post.meal_tag) : ''
  const label = group?.title ? `${group.title} · ${time}` : time

  return (
    <Modal
      visible={group !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center bg-black/60 px-6">
        {/*
          배경 탭으로 닫기. 카드를 감싸지 않고 형제로 깐다 — 감싸면 스크린 리더가
          카드 전체를 "닫기" 하나로 읽어 안의 「기록 편집」에 닿지 못한다.
          스크린 리더 사용자는 카드의 닫기 버튼을 쓴다.
        */}
        <Pressable
          accessible={false}
          importantForAccessibility="no"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View className="w-full overflow-hidden rounded-2xl bg-card">
          <View
            className="aspect-square w-full bg-muted"
            onLayout={(e) => setPageW(e.nativeEvent.layout.width)}
          >
            {pageW > 0 && (
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                // 한 장뿐이면 넘길 게 없다 — 끝에서 튕기는 것도 막는다.
                scrollEnabled={posts.length > 1}
                onMomentumScrollEnd={(e) =>
                  setIndex(Math.round(e.nativeEvent.contentOffset.x / pageW))
                }
              >
                {posts.map((p, i) => (
                  <View
                    key={p.id}
                    style={{ width: pageW, height: pageW }}
                    accessible={posts.length > 1}
                    accessibilityLabel={`사진 ${posts.length}장 중 ${i + 1}번째`}
                  >
                    {p.signedImageUrl && (
                      <Image
                        source={postImageSource(p)}
                        contentFit="cover"
                        style={{ width: '100%', height: '100%' }}
                        accessibilityLabel={p.caption ?? '기록 사진'}
                      />
                    )}
                  </View>
                ))}
              </ScrollView>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="닫기"
              onPress={onClose}
              hitSlop={6}
              className="absolute right-3 top-3 size-8 items-center justify-center rounded-full bg-black/45 active:opacity-70"
            >
              <Ionicons name="close" size={18} color="#fff" />
            </Pressable>
            {posts.length > 1 && (
              <View
                pointerEvents="none"
                className="absolute inset-x-0 bottom-2.5 flex-row justify-center gap-1.5"
              >
                {posts.map((p, i) => (
                  <View
                    key={p.id}
                    className={`size-1.5 rounded-full ${i === index ? 'bg-white' : 'bg-white/50'}`}
                  />
                ))}
              </View>
            )}
          </View>

          <View className="flex-row items-center gap-2 px-4 py-2.5">
            <Text className="text-xs font-medium text-muted-foreground">{label}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="기록 편집"
              onPress={() => post && onEdit(post)}
              className="ml-auto min-h-11 flex-row items-center gap-1.5 rounded-lg px-2 active:opacity-60"
            >
              <Ionicons name="options-outline" size={16} color="#736756" />
              <Text className="text-xs font-medium text-muted-foreground">
                기록 편집
              </Text>
            </Pressable>
          </View>

          {!!post?.caption && (
            <Text className="px-4 pb-3 text-sm text-foreground">{post.caption}</Text>
          )}
        </View>
      </View>
    </Modal>
  )
}
