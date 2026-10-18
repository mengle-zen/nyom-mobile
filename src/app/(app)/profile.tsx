import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { toast } from 'sonner-native'

import { useQueryClient } from '@tanstack/react-query'

import {
  dedupeByBatch,
  mealTimeLabel,
  postImageSource,
  type MealSlotKey,
} from '@/entities/post'
import { useMyRecordedDays } from '@/entities/post/queries'
import { useMyGroups } from '@/entities/group'
import { useAuth } from '@/features/auth'
import { LookbackCalendar } from '@/features/calendar'
import { NotificationSettingsSection } from '@/features/notifications'
import { PostEditSheet, type EditablePost } from '@/features/post-edit'
import {
  changeMyAvatar,
  updateMyProfile,
  useMyPostCount,
  useMyPosts,
  useMyProfile,
  validateNickname,
  type MyPost,
} from '@/features/profile'
import { queryKeys } from '@/shared/api/query-keys'
import { notifyError } from '@/shared/lib/error'
import { haptic, PressableScale } from '@/shared/ui/press'
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
  meal_slot: MealSlotKey | null
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
  const { user, signOut } = useAuth()
  const userId = user?.id

  const queryClient = useQueryClient()

  const { profile, loading: profileLoading, refetch: refetchProfile } = useMyProfile()
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
  const [editingProfile, setEditingProfile] = useState(false)
  const [detail, setDetail] = useState<DetailPost | null>(null)
  /** 사후 편집 대상. 상세에서 넘어온다(두 모달이 겹치지 않게 교체). */
  const [editingPost, setEditingPost] = useState<EditablePost | null>(null)

  // 같은 촬영(batch)이 여러 그룹에 올라갔어도 그리드엔 1번만
  const posts = dedupeByBatch(postsQuery.data?.pages.flat() ?? [])

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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="프로필 수정"
          disabled={profileLoading}
          onPress={() => setEditingProfile(true)}
          className="ml-auto size-icon items-center justify-center rounded-lg active:opacity-60"
        >
          <Ionicons name="pencil" size={16} color="#3A3329" />
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
            posts={posts}
            loading={postsQuery.isLoading}
            error={(postsQuery.error as Error) ?? null}
            onRetry={() => void postsQuery.refetch()}
            onSelect={setDetail}
            hasMore={postsQuery.hasNextPage}
            loadingMore={postsQuery.isFetchingNextPage}
            onLoadMore={() => void postsQuery.fetchNextPage()}
          />
        ) : (
          <LookbackCalendar onSelectPost={setDetail} />
        )}

        <NotificationSettingsSection />

        <Pressable
          accessibilityRole="button"
          onPress={() => void signOut()}
          className="h-control items-center justify-center rounded-xl border border-border active:opacity-70"
        >
          <Text className="font-medium text-foreground">로그아웃</Text>
        </Pressable>
      </ScrollView>

      <EditProfileModal
        open={editingProfile}
        currentNickname={profile?.nickname ?? ''}
        currentAvatarUrl={profile?.avatar_url ?? null}
        userId={userId}
        onClose={() => setEditingProfile(false)}
        onSaved={() => void refetchProfile()}
      />

      <PostDetailModal
        post={detail}
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
  posts,
  loading,
  error,
  onRetry,
  onSelect,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  posts: MyPost[]
  loading: boolean
  error: Error | null
  onRetry: () => void
  onSelect: (post: MyPost) => void
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

  if (posts.length === 0) {
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
        {posts.map((post) => {
          // 끼니 · 시각 칩 — 웹 그리드에도 있는 오버레이. 사진만으론 언제 먹은 건지
          // 알 수 없어서 회고에서 이 한 줄이 가장 많은 정보를 준다.
          const label = mealTimeLabel(post.recorded_at, post.meal_slot)
          return (
            <View key={post.id} style={{ width: '33.3333%' }} className="p-0.5">
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={label ? `${label} 기록 보기` : '기록 보기'}
                // 상세를 여는 건 보기일 뿐 — 햅틱 없음.
                hapticKind={null}
                onPress={() => onSelect(post)}
                className="aspect-square overflow-hidden rounded-md bg-muted"
              >
                {post.signedImageUrl && (
                  <Image
                    source={postImageSource(post)}
                    contentFit="cover"
                    style={{ width: '100%', height: '100%' }}
                  />
                )}
                {!!label && (
                  <View className="absolute inset-x-0 bottom-0 bg-black/45 px-1 py-0.5">
                    <Text
                      numberOfLines={1}
                      className="text-[11px] font-semibold text-white"
                    >
                      {label}
                    </Text>
                  </View>
                )}
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

function PostDetailModal({
  post,
  onClose,
  onEdit,
}: {
  post: DetailPost | null
  onClose: () => void
  onEdit: (post: DetailPost) => void
}) {
  const label = post ? mealTimeLabel(post.recorded_at, post.meal_slot) : ''

  return (
    <Modal
      visible={post !== null}
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
          <View className="aspect-square w-full bg-muted">
            {post?.signedImageUrl && (
              <Image
                source={postImageSource(post)}
                contentFit="cover"
                style={{ width: '100%', height: '100%' }}
                accessibilityLabel={post.caption ?? '기록 사진'}
              />
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

function EditProfileModal({
  open,
  currentNickname,
  currentAvatarUrl,
  userId,
  onClose,
  onSaved,
}: {
  open: boolean
  currentNickname: string
  currentAvatarUrl: string | null
  userId: string | undefined
  onClose: () => void
  onSaved: () => void
}) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      {/* 가운데 카드라 키보드가 올라오면 저장 버튼이 가려진다(작은 화면) — 위로 밀어 올린다. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 items-center justify-center bg-black/60 px-6"
      >
        <View className="w-full gap-4 rounded-2xl bg-card p-5">
          <View className="gap-1">
            <Text className="text-base font-semibold text-foreground">프로필 수정</Text>
            <Text className="text-sm text-muted-foreground">
              프로필 사진과 닉네임을 변경할 수 있어요.
            </Text>
          </View>
          {/* 열릴 때만 마운트 → 매번 현재 값으로 초기화 (effect 불필요) */}
          {open && (
            <EditProfileForm
              currentNickname={currentNickname}
              currentAvatarUrl={currentAvatarUrl}
              userId={userId}
              onClose={onClose}
              onSaved={onSaved}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function EditProfileForm({
  currentNickname,
  currentAvatarUrl,
  userId,
  onClose,
  onSaved,
}: {
  currentNickname: string
  currentAvatarUrl: string | null
  userId: string | undefined
  onClose: () => void
  onSaved: () => void
}) {
  const [value, setValue] = useState(currentNickname)
  /** 아직 올리지 않은 아바타의 로컬 URI. 저장을 누를 때 올린다. */
  const [draftAvatar, setDraftAvatar] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const nicknameChanged = value.trim() !== currentNickname.trim()
  const changed = nicknameChanged || draftAvatar !== null
  const shownAvatar = draftAvatar ?? currentAvatarUrl

  const handlePickAvatar = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!perm.granted) {
        toast.error('사진 접근을 허용해 주세요')
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      })
      if (result.canceled || !result.assets[0]) return
      setDraftAvatar(result.assets[0].uri)
    } catch (e) {
      notifyError(e, '사진을 불러오지 못했어요')
    }
  }

  const handleSave = async () => {
    if (!userId || saving || !changed) return
    const message = validateNickname(value)
    if (message) {
      setValidationError(message)
      return
    }
    try {
      setSaving(true)
      if (nicknameChanged) {
        await updateMyProfile(userId, { nickname: value.trim() })
      }
      // 아바타는 스토리지 업로드 + avatar_url 갱신 + 옛 파일 정리가 한 묶음이다.
      if (draftAvatar) {
        await changeMyAvatar(userId, draftAvatar)
      }
      void haptic('success')
      toast.success('프로필을 수정했어요')
      onSaved()
      onClose()
    } catch (err) {
      notifyError(err, '프로필 수정에 실패했어요')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* 아바타 */}
      <View className="items-center">
        <View>
          <View className="size-20 items-center justify-center overflow-hidden rounded-full bg-primary-100">
            {shownAvatar ? (
              <Image
                source={{ uri: shownAvatar }}
                contentFit="cover"
                style={{ width: '100%', height: '100%' }}
                accessibilityLabel="프로필 사진"
              />
            ) : (
              <Ionicons name="person" size={32} color="#C24F0E" />
            )}
          </View>
          {/* NativeWind가 함수형 style을 버리므로 정적 style만 쓴다. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="프로필 사진 변경"
            disabled={saving}
            onPress={() => void handlePickAvatar()}
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 30,
              height: 30,
              borderRadius: 15,
              borderWidth: 3,
              borderColor: '#FFFCF8',
              backgroundColor: '#FF7A2E',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: saving ? 0.5 : 1,
            }}
          >
            <Ionicons name="camera" size={13} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <View className="gap-2">
        <TextInput
          value={value}
          onChangeText={(next) => {
            setValue(next)
            if (validationError) setValidationError(null)
          }}
          placeholder="닉네임"
          placeholderTextColor="#A89A82"
          accessibilityLabel="닉네임"
          maxLength={12}
          editable={!saving}
          className="h-field rounded-xl border border-border bg-background px-4 text-foreground"
        />
        {validationError && (
          <Text className="text-sm text-destructive">{validationError}</Text>
        )}
      </View>

      <View className="flex-row gap-2">
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          disabled={saving}
          className={`h-control flex-1 items-center justify-center rounded-xl border border-border active:opacity-70 ${
            saving ? 'opacity-50' : ''
          }`}
        >
          <Text className="font-medium text-foreground">취소</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="저장"
          onPress={() => void handleSave()}
          disabled={saving || !value.trim() || !changed}
          className={`h-control flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-primary active:opacity-80 ${
            saving || !value.trim() || !changed ? 'opacity-40' : ''
          }`}
        >
          {saving && <ActivityIndicator color="#fff" size="small" />}
          <Text className="font-bold text-primary-foreground">저장</Text>
        </Pressable>
      </View>
    </>
  )
}
