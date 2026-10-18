import { useState } from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { mealTimeLabel, postImageSource } from '@/entities/post'
import type { BoardPost } from '@/entities/post/model'
import type { GroupMemberProfile } from '@/entities/group'
import { ReactionBar } from '@/widgets/meal-tile'

type Props = {
  /** null이면 닫힌 상태 */
  post: BoardPost | null
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
 */
export function PostDetail({
  post,
  member,
  isMe,
  currentUserId,
  onReact,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets()
  const [imgFailed, setImgFailed] = useState(false)
  const open = post !== null && member !== null

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

          <View className="flex-1 justify-center bg-black">
            {post.signedImageUrl && !imgFailed ? (
              <Image
                source={postImageSource(post)}
                style={{ width: '100%', height: '100%' }}
                contentFit="contain"
                transition={120}
                onError={() => setImgFailed(true)}
              />
            ) : (
              <View className="items-center gap-2">
                <Ionicons name="image-outline" size={32} color="rgba(255,255,255,0.4)" />
                <Text className="text-xs text-white/40">사진을 불러오지 못했어요</Text>
              </View>
            )}
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
