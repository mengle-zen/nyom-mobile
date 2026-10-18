import { Text, View } from 'react-native'
import { Image } from 'expo-image'
import { slotLabel } from '@/entities/post'
import { hhmmFromDate } from '@/entities/post/date-range'
import type { DayPost } from '@/entities/post/model'
import { PressableScale } from '@/shared/ui/press'
import { Skeleton } from '@/shared/ui/skeleton'
import { dayKeyLabel } from '../lib/view-month'
import Ionicons from '@expo/vector-icons/Ionicons'

type Props = {
  /** 선택된 날짜 키('YYYY-MM-DD') */
  dayKey: string
  isToday: boolean
  posts: DayPost[]
  loading: boolean
  onSelect: (post: DayPost) => void
}

/** 선택한 날의 끼니 카드 타임라인(시각순). 빈 날은 조용한 톤. */
export function DayTimeline({ dayKey, isToday, posts, loading, onSelect }: Props) {
  return (
    <View className="gap-2">
      {/* 어느 날 목록인지 스스로 밝힌다 — 달을 넘기면 선택 표시가 안 보인다 */}
      <View className="flex-row items-center gap-2 px-0.5">
        <Text className="text-sm font-bold text-foreground">
          {isToday ? '오늘' : dayKeyLabel(dayKey)}
        </Text>
        {isToday && (
          <Text className="text-xs text-muted-foreground">{dayKeyLabel(dayKey)}</Text>
        )}
        {!loading && posts.length > 0 && (
          <Text className="ml-auto text-xs text-muted-foreground">
            {posts.length}끼니
          </Text>
        )}
      </View>

      {loading ? (
        <TimelineSkeleton />
      ) : posts.length === 0 ? (
        <View className="items-center justify-center gap-2 py-10">
          <Ionicons name="leaf-outline" size={28} color="#A89A82" />
          <Text className="text-sm text-muted-foreground">이 날은 기록이 없어요</Text>
        </View>
      ) : (
        posts.map((post) => (
          <PressableScale
            key={post.id}
            accessibilityRole="button"
            accessibilityLabel={`${post.meal_slot ? slotLabel(post.meal_slot) : '기록'} ${hhmmFromDate(new Date(post.recorded_at))} 보기`}
            // 상세를 여는 건 보기일 뿐 — 보드 타일과 같이 햅틱 없음.
            hapticKind={null}
            onPress={() => onSelect(post)}
            className="flex-row items-center gap-3 rounded-xl bg-card p-2"
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
                <Text
                  numberOfLines={1}
                  className="mt-0.5 text-sm text-muted-foreground"
                >
                  {post.caption}
                </Text>
              )}
            </View>
          </PressableScale>
        ))
      )}
    </View>
  )
}

/**
 * 스피너 대신 도착할 카드 모양을 미리 그린다 — 사진이 들어올 때 화면이 튀지 않고,
 * 같은 자리에 뭐가 올지 알기 때문에 기다림이 짧게 느껴진다.
 */
function TimelineSkeleton() {
  return (
    <View className="gap-2">
      {[0, 1].map((i) => (
        <View key={i} className="flex-row items-center gap-3 rounded-xl bg-card p-2">
          <Skeleton style={{ width: 64, height: 64, borderRadius: 10 }} />
          <View className="flex-1 gap-1.5">
            <Skeleton style={{ width: 96, height: 12, borderRadius: 6 }} />
            <Skeleton style={{ width: 150, height: 12, borderRadius: 6 }} />
          </View>
        </View>
      ))}
    </View>
  )
}
