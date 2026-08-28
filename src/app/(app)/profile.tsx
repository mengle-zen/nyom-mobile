import { useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { toast } from 'sonner-native'

import { dedupeByBatch, mealTimeLabel, type MealSlotKey } from '@/entities/post'
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
import { notifyError } from '@/shared/lib/error'

/**
 * 상세 모달이 다루는 최소 형태.
 * 그리드(MyPost)와 돌아보기 타임라인(DayPost)이 같은 상세·편집을 쓰도록 공통분모만 받는다.
 */
type DetailPost = {
  id: string
  batch_id: string | null
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
export default function ProfileScreen() {
  const insets = useSafeAreaInsets()
  const { user, signOut } = useAuth()
  const userId = user?.id

  const { profile, loading: profileLoading, refetch: refetchProfile } = useMyProfile()
  const postsQuery = useMyPosts(userId)
  const { data: postCount } = useMyPostCount(userId)

  const [tab, setTab] = useState<'grid' | 'calendar'>('grid')
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
      <View className="h-14 flex-row items-center border-b border-border/50 px-4">
        <Text className="text-base font-semibold text-foreground">프로필</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="프로필 수정"
          disabled={profileLoading}
          onPress={() => setEditingProfile(true)}
          className="ml-auto size-9 items-center justify-center rounded-lg active:opacity-60"
        >
          <Ionicons name="pencil" size={16} color="#3A3329" />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        contentContainerClassName="gap-6 px-4 pt-8"
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

        {/* 통계 — 스트릭은 제품에서 제거됐다. 게시물 수만. */}
        <View className="items-center gap-0.5 rounded-2xl border border-border bg-card py-4">
          {postCount === undefined ? (
            <ActivityIndicator color="#FF7A2E" />
          ) : (
            <Text className="text-xl font-bold text-foreground">{postCount}</Text>
          )}
          <Text className="text-xs text-muted-foreground">게시물</Text>
        </View>

        {/* 탭 */}
        <View className="flex-row gap-1 self-start rounded-xl bg-muted p-1">
          {(
            [
              ['grid', '그리드'],
              ['calendar', '돌아보기'],
            ] as const
          ).map(([key, label]) => (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === key }}
              onPress={() => setTab(key)}
              className={`rounded-lg px-4 py-1.5 ${tab === key ? 'bg-card' : ''}`}
            >
              <Text
                className={`text-sm ${
                  tab === key
                    ? 'font-semibold text-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

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
          className="items-center rounded-xl border border-border py-3 active:opacity-70"
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
  if (loading) {
    return (
      <View className="py-10">
        <ActivityIndicator color="#FF7A2E" />
      </View>
    )
  }

  if (error) {
    return (
      <View className="items-center gap-3 py-10">
        <Text className="text-sm text-muted-foreground">
          기록을 불러오지 못했어요
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          className="rounded-xl border border-border px-4 py-2 active:opacity-70"
        >
          <Text className="text-sm font-medium text-foreground">다시 시도</Text>
        </Pressable>
      </View>
    )
  }

  if (posts.length === 0) {
    return (
      <View className="items-center justify-center gap-3 py-12">
        <Text className="text-5xl">🍽️</Text>
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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={label ? `${label} 기록 보기` : '기록 보기'}
                onPress={() => onSelect(post)}
                className="aspect-square overflow-hidden rounded-md bg-muted active:opacity-80"
              >
                {post.signedImageUrl && (
                  <Image
                    source={{ uri: post.signedImageUrl }}
                    contentFit="cover"
                    style={{ width: '100%', height: '100%' }}
                  />
                )}
                {!!label && (
                  <View className="absolute inset-x-0 bottom-0 bg-black/45 px-1 py-0.5">
                    <Text
                      numberOfLines={1}
                      className="text-[10px] font-semibold text-white"
                    >
                      {label}
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>
          )
        })}
      </View>

      {hasMore && (
        <Pressable
          accessibilityRole="button"
          onPress={onLoadMore}
          disabled={loadingMore}
          className={`items-center rounded-xl border border-border py-3 active:opacity-70 ${
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
      <Pressable
        accessibilityLabel="닫기"
        onPress={onClose}
        className="flex-1 items-center justify-center bg-black/60 px-6"
      >
        <Pressable
          // 카드 내부 탭이 배경(닫기)으로 새지 않게 흡수한다
          onPress={() => {}}
          className="w-full overflow-hidden rounded-2xl bg-card"
        >
          <View className="aspect-square w-full bg-muted">
            {post?.signedImageUrl && (
              <Image
                source={{ uri: post.signedImageUrl }}
                contentFit="cover"
                style={{ width: '100%', height: '100%' }}
                accessibilityLabel={post.caption ?? '기록 사진'}
              />
            )}
          </View>

          <View className="flex-row items-center gap-2 px-4 py-2.5">
            <Text className="text-xs font-medium text-muted-foreground">{label}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="기록 편집"
              onPress={() => post && onEdit(post)}
              className="ml-auto flex-row items-center gap-1.5 rounded-lg px-2 py-1 active:opacity-60"
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
        </Pressable>
      </Pressable>
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
      <View className="flex-1 items-center justify-center bg-black/60 px-6">
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
      </View>
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
          className="rounded-xl border border-border bg-background px-4 py-3 text-foreground"
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
          className={`flex-1 items-center rounded-xl border border-border py-3 active:opacity-70 ${
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
          className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-primary py-3 active:opacity-80 ${
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
