import { useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { mealTimeLabel, postImageSource } from '@/entities/post'
import type { BoardPost } from '@/entities/post/model'
import type { GroupMemberProfile } from '@/entities/group'
import { ReactionBar } from '@/widgets/meal-tile'

type Props = {
  /**
   * 같은 사람·같은 끼니의 기록, 첫 장부터 순서대로(보드 타일이 보여 준 장이 첫 장).
   * 비어 있으면 닫힌 상태.
   */
  posts: BoardPost[]
  member: GroupMemberProfile | null
  isMe: boolean
  currentUserId: string
  onReact: (postId: string, emoji: string) => void
  onClose: () => void
}

/**
 * 사진 상세 — 전체화면 사진 + 작성자 + 끼니·시각 + 메모 + 리액션.
 *
 * 웹앱에는 사진을 크게 보는 화면이 아예 없었다. 친구가 뭘 먹었는지 자세히 보려는
 * 가장 자연스러운 동작(사진 탭)이 오히려 끼니를 넘겨버렸다(docs/UX_FINDINGS.md B항).
 *
 * 한 끼니에 여러 장을 올렸으면 사진 영역을 좌우로 넘겨 본다. 보드 타일은 가장 최근
 * 한 장과 「+N」만 보여 주므로 나머지를 볼 수 있는 곳은 여기뿐이다. 장마다 별개의
 * 기록이라 시각·메모·리액션도 보고 있는 장을 따라 바뀐다. 넘기는 건 사진 영역만 —
 * 화면 전체를 넘기게 하면 메모를 스크롤하려던 손가락이 장을 넘긴다.
 */
export function PostDetail({
  posts,
  member,
  isMe,
  currentUserId,
  onReact,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const [index, setIndex] = useState(0)
  const open = posts.length > 0 && member !== null
  // 보는 중에 장이 사라지면(삭제 등) 남은 마지막 장에 머문다.
  const post = posts[Math.min(index, posts.length - 1)]

  const onPageEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
  }

  return (
    <Modal
      visible={open}
      onRequestClose={onClose}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
    >
      {open && (
        <View className="flex-1 bg-board-bg" style={{ paddingTop: insets.top }}>
          <View className="flex-row items-center gap-3 px-4 py-2">
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="닫기"
              hitSlop={8}
              className="size-9 items-center justify-center rounded-full bg-white/10 active:opacity-70"
            >
              <Ionicons name="close" size={20} color="#fff" />
            </Pressable>
            <View className="flex-1">
              <Text className="text-base font-bold text-white">
                {isMe ? '나' : member.nickname}
              </Text>
              <Text className="text-xs text-white/55">
                {mealTimeLabel(post.recorded_at, post.meal_slot)}
              </Text>
            </View>
          </View>

          <View className="flex-1 bg-black">
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onPageEnd}
              // 한 장뿐이면 넘길 게 없다 — 끝에서 튕기는 것도 막는다.
              scrollEnabled={posts.length > 1}
            >
              {posts.map((p, i) => (
                <View
                  key={p.id}
                  style={{ width }}
                  accessible={posts.length > 1}
                  accessibilityLabel={`사진 ${posts.length}장 중 ${i + 1}번째`}
                >
                  <Photo post={p} />
                </View>
              ))}
            </ScrollView>
            {posts.length > 1 && <PageDots count={posts.length} active={index} />}
          </View>

          <ScrollView
            style={{ maxHeight: 176 }}
            contentContainerStyle={{
              gap: 12,
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: insets.bottom + 12,
            }}
          >
            {post.caption ? (
              <Text className="text-sm leading-relaxed text-white/85">{post.caption}</Text>
            ) : (
              <Text className="text-sm text-white/30">메모 없이 올렸어요</Text>
            )}
            <ReactionBar
              postId={post.id}
              reactions={post.reactions}
              currentUserId={currentUserId}
              onReact={onReact}
              alwaysExpanded
            />
          </ScrollView>
        </View>
      )}
    </Modal>
  )
}

function Photo({ post }: { post: BoardPost }) {
  const [failed, setFailed] = useState(false)

  if (!post.signedImageUrl || failed) {
    return (
      <View className="flex-1 items-center justify-center gap-2">
        <Ionicons name="image-outline" size={32} color="rgba(255,255,255,0.4)" />
        <Text className="text-xs text-white/40">사진을 불러오지 못했어요</Text>
      </View>
    )
  }
  return (
    <Image
      source={postImageSource(post)}
      style={{ width: '100%', height: '100%' }}
      contentFit="contain"
      transition={120}
      onError={() => setFailed(true)}
    />
  )
}

/** 몇 번째 장인지. 각 장이 읽기 라벨을 갖고 있어 점 자체는 화면 읽기에서 뺀다. */
function PageDots({ count, active }: { count: number; active: number }) {
  return (
    <View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      className="absolute inset-x-0 bottom-3 flex-row justify-center gap-1.5"
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          className={`size-1.5 rounded-full ${i === active ? 'bg-white' : 'bg-white/35'}`}
        />
      ))}
    </View>
  )
}
