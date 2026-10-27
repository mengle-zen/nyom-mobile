import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform, ScrollView, Text, View, type LayoutChangeEvent } from 'react-native'
import { Image } from 'expo-image'
import { FOLD_HEIGHT, hhmmFromDate, postImageSource, timeLanesLayout } from '@/entities/post'
import type { BoardPost } from '@/entities/post/model'
import type { GroupMemberProfile } from '@/entities/group'
import { PressableScale } from '@/shared/ui/press'
import { Skeleton } from '@/shared/ui/skeleton'

const GUTTER = 40
const PAD = 12
const GAP = 6
const VISIBLE = 4
const HEADER_H = 56
/** 띠 위아래 여백. 촬영 버튼은 띠 아래 따로 놓여 가리지 않는다. */
const TOP_PAD = 8
const BOTTOM_PAD = 24
const STAMP_FONT = Platform.select({ ios: 'Menlo', default: 'monospace' })
const AVATAR = ['#FFA56A', '#9FD18B', '#8EC5FF', '#F7A8C4', '#C7B6F2', '#F5D06F']

type Props = {
  members: GroupMemberProfile[]      // laneMembers로 이미 정렬
  posts: BoardPost[]
  currentUserId: string
  now: Date | null                   // 오늘만
  /** 오늘이면 가장 최근 사진으로, 지난날이면 맨 위로 처음 스크롤 */
  startAtLatest: boolean
  onOpenPost: (post: BoardPost) => void
}

/** 2026-10-27 설계 ① — 멤버별 세로 띠, 같은 시간축. 배치는 `timeLanesLayout`. */
export function TimeLanes({ members, posts, currentUserId, now, startAtLatest, onOpenPost }: Props) {
  const [width, setWidth] = useState(0)
  const [viewH, setViewH] = useState(0)
  const scrollRef = useRef<ScrollView>(null)
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width)
    setViewH(e.nativeEvent.layout.height)
  }, [])

  const shown = Math.min(Math.max(members.length, 1), VISIBLE)
  const photo = width > 0 ? Math.floor((width - GUTTER - PAD * 2 - GAP * (shown - 1)) / shown) : 0
  const lanesW = GUTTER + PAD * 2 + members.length * photo + GAP * Math.max(members.length - 1, 0)

  const byId = useMemo(() => new Map(posts.map((p) => [p.id, p])), [posts])
  const layout = useMemo(
    () =>
      timeLanesLayout({
        lanes: members.map((m) =>
          posts.filter((p) => p.user_id === m.user_id).map((p) => ({ id: p.id, at: p.recorded_at })),
        ),
        photo: photo || 1,
        now,
      }),
    [members, posts, photo, now],
  )

  // 오늘(또는 알림으로 연 날)은 가장 최근 사진이 촬영 버튼 위에 보이게, 지난날은 맨 위부터.
  const latestY = layout.items.reduce((max, i) => Math.max(max, i.y), 0)
  useEffect(() => {
    if (!photo || !viewH) return
    const viewport = viewH - HEADER_H
    const y = startAtLatest ? Math.max(0, TOP_PAD + latestY + photo - viewport + BOTTOM_PAD) : 0
    scrollRef.current?.scrollTo({ y, animated: false })
  }, [startAtLatest, latestY, photo, viewH])

  const laneX = (lane: number) => GUTTER + PAD + lane * (photo + GAP)

  return (
    <View className="flex-1" onLayout={onLayout}>
      {photo > 0 && (
        <ScrollView horizontal scrollEnabled={members.length > VISIBLE} showsHorizontalScrollIndicator={false}>
          <View style={{ width: Math.max(lanesW, width), flex: 1 }}>
            <View className="flex-row border-b border-white/10" style={{ height: HEADER_H, paddingLeft: GUTTER + PAD, gap: GAP }}>
              {members.map((m, i) => (
                <View key={m.user_id} style={{ width: photo }} className="items-center justify-center gap-0.5">
                  <View className="size-7 items-center justify-center rounded-full" style={{ backgroundColor: AVATAR[i % AVATAR.length] }}>
                    <Text className="text-xs font-extrabold text-neutral-900">{(m.user_id === currentUserId ? '나' : m.nickname)[0]}</Text>
                  </View>
                  <Text numberOfLines={1} className="text-[11.5px] font-bold text-white">
                    {m.user_id === currentUserId ? '나' : m.nickname}
                  </Text>
                </View>
              ))}
            </View>
            <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingTop: TOP_PAD, paddingBottom: BOTTOM_PAD }}>
              <View style={{ height: layout.height }}>
                {layout.marks.map((mark, i) =>
                  mark.kind === 'tick' ? (
                    <View key={`t${i}`} pointerEvents="none" style={{ position: 'absolute', left: PAD, right: PAD, top: mark.y }}>
                      <View className="h-px bg-white/5" />
                      <Text style={{ fontFamily: STAMP_FONT }} className="mt-0.5 text-[10.5px] text-white/55">{mark.label}</Text>
                    </View>
                  ) : (
                    <View key={`f${i}`} pointerEvents="none" className="flex-row items-center gap-2"
                      style={{ position: 'absolute', left: PAD, right: PAD, top: mark.y, height: FOLD_HEIGHT }}
                      accessibilityLabel={`${mark.from}부터 ${mark.to}까지 기록 없음`}>
                      <View className="h-0 flex-1 border-t border-dashed border-white/20" />
                      <Text style={{ fontFamily: STAMP_FONT }} className="text-[10.5px] text-white/60">{mark.from} ─ {mark.to}</Text>
                      <View className="h-0 flex-1 border-t border-dashed border-white/20" />
                    </View>
                  ),
                )}
                {layout.items.map((item) => {
                  const post = byId.get(item.postId)!
                  const who = members[item.lane]
                  const time = hhmmFromDate(new Date(post.recorded_at))
                  return (
                    <PressableScale
                      key={item.postId}
                      onPress={() => onOpenPost(post)}
                      swipeSafe
                      hapticKind={null}
                      accessibilityRole="button"
                      accessibilityLabel={`${who.user_id === currentUserId ? '나' : who.nickname} ${post.meal_tag ? `${post.meal_tag} ` : ''}${time} 사진 보기`}
                      style={{ position: 'absolute', left: laneX(item.lane), top: item.y, width: photo, height: photo }}
                      className="overflow-hidden rounded-[10px] bg-board-tile"
                    >
                      {post.signedImageUrl && (
                        <Image source={postImageSource(post)} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                      )}
                      {post.meal_tag ? (
                        // iOS는 Text의 둥근 배경을 깎지 않아 View로 감싼다
                        <View className="absolute left-1 top-1 max-w-[90%] rounded-full bg-black/50 px-1.5">
                          <Text numberOfLines={1} className="text-[10px] font-extrabold text-white">
                            {post.meal_tag}
                          </Text>
                        </View>
                      ) : null}
                      <Text
                        style={{ fontFamily: STAMP_FONT, textShadowColor: 'rgba(255,120,30,0.75)', textShadowRadius: 4 }}
                        className="absolute bottom-1 right-1.5 text-xs text-[#FF9A3D]"
                      >
                        {time}
                      </Text>
                    </PressableScale>
                  )
                })}
                {layout.nowY !== null && (
                  <View pointerEvents="none" style={{ position: 'absolute', left: 6, right: PAD, top: layout.nowY - 8 }} className="flex-row items-center">
                    <View className="rounded-full bg-primary px-1.5">
                      <Text className="text-[10px] font-extrabold text-neutral-900">지금</Text>
                    </View>
                    <View className="h-0.5 flex-1 rounded-full bg-primary" />
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </ScrollView>
      )}
    </View>
  )
}

/** 도착 전 뼈대 — 같은 머리줄 + 띠마다 회색 칸 두 개. */
export function TimeLanesSkeleton({ memberCount }: { memberCount: number }) {
  const n = Math.min(Math.max(memberCount, 1), VISIBLE)
  return (
    <View className="flex-1 flex-row pt-16" style={{ paddingLeft: GUTTER + PAD, paddingRight: PAD, gap: GAP }}>
      {Array.from({ length: n }, (_, i) => (
        <View key={i} className="flex-1 gap-24" style={{ opacity: 0.09 }}>
          <Skeleton style={{ width: '100%', aspectRatio: 1, borderRadius: 10 }} />
          <Skeleton style={{ width: '100%', aspectRatio: 1, borderRadius: 10 }} />
        </View>
      ))}
    </View>
  )
}
