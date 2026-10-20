import { useCallback, useRef, useState } from 'react'
import {
  Pressable,
  Text,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native'
import { slotLabel, buildSlotBoard, type MealSlotKey } from '@/entities/post'
import type { BoardPost } from '@/entities/post/model'
import type { GroupMemberProfile } from '@/entities/group'
import { FilledTile, EmptyTile } from '@/widgets/meal-tile'
import { decideAxis, edgeZone } from '@/features/board-nav'
import { Skeleton } from '@/shared/ui/skeleton'
import { slotBoardLayout, slotCountLabel } from './layout'

type Props = {
  slot: MealSlotKey
  members: GroupMemberProfile[]
  posts: BoardPost[]
  currentUserId: string
  /** 보고 있는 날짜가 오늘인가 — 내 빈 칸에 올리기 지름길을 둘지 결정한다 */
  isToday: boolean
  onReact: (postId: string, emoji: string) => void
  onUpload: () => void
  onOpenPost: (post: BoardPost, member: GroupMemberProfile) => void
  /**
   * 화면 좌우 끝(30%)을 눌렀을 때 — 스토리처럼 이전(-1)/다음(1) 끼니로.
   * 타일 위라도 끝이면 넘기고, 사진 상세·올리기는 가운데를 눌러야 열린다.
   */
  onEdgeTap: (dir: -1 | 1) => void
}

/** 타일 사이 간격(px). gap-2 = 8px과 같아야 폭 계산이 맞는다. */
const GAP = 8

/** 격자 영역을 잰다 — 타일 크기는 폭과 높이 둘 다로 정한다(`slotBoardLayout`). */
function useGridSize() {
  const [size, setSize] = useState({ width: 0, height: 0 })
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    setSize({ width, height })
  }, [])
  return { size, onLayout }
}

/**
 * 탭 위치로 "끼니 넘기기"와 "타일 동작"을 가른다. 화면 좌우 30%면 넘기고, 아니면 원래 동작.
 * 판정은 화면 폭 기준이다 — 보드는 화면 가로를 꽉 채우므로 스토리와 같은 감각이 된다.
 */
function useEdgeRouter(onEdgeTap: (dir: -1 | 1) => void) {
  const { width } = useWindowDimensions()
  return useCallback(
    (e: GestureResponderEvent, otherwise: () => void) => {
      const zone = edgeZone(e.nativeEvent.pageX, width)
      if (zone === 'left') onEdgeTap(-1)
      else if (zone === 'right') onEdgeTap(1)
      else otherwise()
    },
    [onEdgeTap, width],
  )
}

/**
 * 타일이 아닌 곳(남의 빈 칸·간격·여백)의 탭. 스와이프 끝에 손을 떼도 onPress가 오므로
 * (CLAUDE.md 함정) 누른 곳과 뗀 곳이 멀면 탭이 아니라 스와이프로 본다.
 */
function useBackgroundTap(route: ReturnType<typeof useEdgeRouter>) {
  const from = useRef<{ x: number; y: number } | null>(null)
  return {
    onPressIn: (e: GestureResponderEvent) => {
      from.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY }
    },
    onPress: (e: GestureResponderEvent) => {
      const start = from.current
      if (start && decideAxis(e.nativeEvent.pageX - start.x, e.nativeEvent.pageY - start.y, 10) !== null) return
      route(e, () => {})
    },
  }
}

/** 한 끼니의 멤버 타일 격자. */
export function SlotBoard({
  slot,
  members,
  posts,
  currentUserId,
  isToday,
  onReact,
  onUpload,
  onOpenPost,
  onEdgeTap,
}: Props) {
  const board = buildSlotBoard(members, posts, slot)
  const { size, onLayout } = useGridSize()
  const { cols, tileWidth, tileHeight } = slotBoardLayout(members.length, size, GAP)
  const route = useEdgeRouter(onEdgeTap)
  const background = useBackgroundTap(route)

  const rows: (typeof board.tiles)[] = []
  for (let i = 0; i < board.tiles.length; i += cols) {
    rows.push(board.tiles.slice(i, i + cols))
  }

  const allFilled = members.length > 0 && board.filledCount === members.length

  return (
    <View className="flex-1 pb-2">
      <SlotHeading
        slot={slot}
        filled={board.filledCount}
        total={members.length}
        allFilled={allFilled}
      />

      {/* 격자 영역 전체가 끝 탭을 받는다 — 타일이 아닌 곳을 눌러도 끼니가 넘어간다. */}
      <Pressable
        accessible={false}
        onLayout={onLayout}
        onPressIn={background.onPressIn}
        onPress={background.onPress}
        className="flex-1 items-center justify-center gap-2 px-3"
      >
        {tileWidth > 0 &&
          rows.map((row, rowIdx) => (
            <View key={rowIdx} className="flex-row gap-2">
              {row.map((tile) => {
                const isMe = tile.member.user_id === currentUserId
                return (
                  <View key={tile.member.user_id} style={{ width: tileWidth, height: tileHeight }}>
                    {tile.post ? (
                      <FilledTile
                        member={tile.member}
                        post={tile.post}
                        isMe={isMe}
                        extraCount={tile.extraCount}
                        currentUserId={currentUserId}
                        onReact={onReact}
                        onOpen={(e) =>
                          route(e, () => onOpenPost(tile.post as BoardPost, tile.member))
                        }
                      />
                    ) : (
                      <EmptyTile
                        member={tile.member}
                        isMe={isMe}
                        canUpload={isToday}
                        onUpload={(e) => route(e, onUpload)}
                      />
                    )}
                  </View>
                )
              })}
              {/* 마지막 행이 덜 찼을 때 왼쪽 정렬을 지키는 빈 칸 */}
              {Array.from({ length: cols - row.length }, (_, i) => (
                <View key={`spacer-${i}`} style={{ width: tileWidth, height: tileHeight }} />
              ))}
            </View>
          ))}
      </Pressable>
    </View>
  )
}

function SlotHeading({
  slot,
  filled,
  total,
  allFilled,
}: {
  slot: MealSlotKey
  filled: number
  total: number
  allFilled: boolean
}) {
  const count = slotCountLabel(filled, total)

  return (
    <View className="flex-row items-center justify-center gap-2 px-4 pb-2">
      <Text className="text-[15px] font-extrabold text-white">{slotLabel(slot)}</Text>
      {count ? (
        <View
          className={`rounded-full px-2 py-0.5 ${allFilled ? 'bg-primary' : 'bg-white/10'}`}
        >
          <Text className="text-xs font-bold text-white">{count}</Text>
        </View>
      ) : null}
    </View>
  )
}

/**
 * 공용 `Skeleton`은 밝은 화면용 크림색(`bg-muted`)이라 어두운 보드에서는 눈이 아프다.
 * 시그니처를 건드리지 않고, 바깥에서 전체 불투명도를 눌러 어두운 배경에 맞춘다
 * (안쪽 펄스는 그대로 살아 있고 두 불투명도가 곱해진다).
 */
function DarkSkeleton({ style }: { style?: ViewStyle }) {
  return (
    <View style={[{ opacity: 0.09 }, style]}>
      <Skeleton style={{ flex: 1, width: '100%', height: '100%' }} />
    </View>
  )
}

/**
 * 도착 전 자리 지킴이.
 *
 * 스피너는 화면 한복판에서 돌다가 사라지면서 레이아웃을 통째로 갈아치운다 —
 * 날짜를 넘길 때마다 화면이 두 번 튀는 셈이다. 뼈대는 실제 격자와 같은 모양·같은
 * 개수로 깔리므로 데이터가 오면 그림만 채워진다. 멤버 목록은 이미 캐시에 있어서
 * (`useGroupMembers`) 로딩 중에도 몇 칸이 필요한지 알 수 있다.
 */
export function SlotBoardSkeleton({ memberCount }: { memberCount: number }) {
  const { size, onLayout } = useGridSize()
  const { cols, rows, tileWidth, tileHeight } = slotBoardLayout(memberCount, size, GAP)

  return (
    <View className="flex-1 pb-2">
      <View className="items-center px-4 pb-2">
        <DarkSkeleton style={{ width: 96, height: 18, borderRadius: 999 }} />
      </View>
      <View onLayout={onLayout} className="flex-1 items-center justify-center gap-2 px-3">
        {tileWidth > 0 &&
          Array.from({ length: rows }, (_, rowIdx) => (
            <View key={rowIdx} className="flex-row gap-2">
              {Array.from({ length: cols }, (__, colIdx) => (
                <DarkSkeleton
                  key={colIdx}
                  style={{ width: tileWidth, height: tileHeight, borderRadius: 16 }}
                />
              ))}
            </View>
          ))}
      </View>
    </View>
  )
}
