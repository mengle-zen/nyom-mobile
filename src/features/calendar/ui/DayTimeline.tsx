import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { slotLabel } from '@/entities/post'
import { hhmmFromDate } from '@/entities/post/date-range'
import type { DayPost } from '@/entities/post/model'

type Props = {
  posts: DayPost[]
  loading: boolean
  onSelect: (post: DayPost) => void
}

/** 선택한 날의 끼니 카드 타임라인(시각순). 빈 날은 조용한 톤. */
export function DayTimeline({ posts, loading, onSelect }: Props) {
  if (loading) {
    return (
      <View className="py-8">
        <ActivityIndicator color="#FF7A2E" />
      </View>
    )
  }

  if (posts.length === 0) {
    return (
      <View className="items-center justify-center gap-2 py-10">
        <Text className="text-3xl">🍃</Text>
        <Text className="text-sm text-muted-foreground">이 날은 기록이 없어요</Text>
      </View>
    )
  }

  return (
    <View className="gap-2">
      {posts.map((post) => (
        <Pressable
          key={post.id}
          accessibilityRole="button"
          accessibilityLabel={`${post.meal_slot ? slotLabel(post.meal_slot) : '기록'} ${hhmmFromDate(new Date(post.recorded_at))} 보기`}
          onPress={() => onSelect(post)}
          className="flex-row items-center gap-3 rounded-xl bg-card p-2 active:opacity-80"
        >
          <View className="size-16 overflow-hidden rounded-lg bg-muted">
            {post.signedImageUrl && (
              <Image
                source={{ uri: post.signedImageUrl }}
                contentFit="cover"
                style={{ width: '100%', height: '100%' }}
              />
            )}
          </View>
          <View className="min-w-0 flex-1">
            <View className="flex-row items-center gap-1.5">
              {post.meal_slot && (
                <Text className="text-sm font-bold text-foreground">
                  {slotLabel(post.meal_slot)}
                </Text>
              )}
              <Text className="text-xs text-muted-foreground">
                {hhmmFromDate(new Date(post.recorded_at))}
              </Text>
            </View>
            {post.caption && (
              <Text numberOfLines={1} className="mt-0.5 text-sm text-muted-foreground">
                {post.caption}
              </Text>
            )}
          </View>
        </Pressable>
      ))}
    </View>
  )
}
