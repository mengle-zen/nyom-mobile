import { useCallback, useState } from 'react'
import { Text, View, type LayoutChangeEvent, type ViewStyle } from 'react-native'
import { slotLabel, buildSlotBoard, type MealSlotKey } from '@/entities/post'
import type { BoardPost } from '@/entities/post/model'
import type { GroupMemberProfile } from '@/entities/group'
import { FilledTile, EmptyTile } from '@/widgets/meal-tile'
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
}

/** 타일 사이 간격(px). gap-2 = 8px과 같아야 폭 계산이 맞는다. */
const GAP = 8

/** 격자 폭을 재서 타일 하나의 폭을 낸다. 높이 상한의 기준이 된다. */
function useGridWidth() {
  const [width, setWidth] = useState(0)
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width)
  }, [])
  return { width, onLayout }
}

function tileMaxHeight(gridWidth: number, cols: number, maxAspect: number | null) {
  if (maxAspect === null || gridWidth <= 0) return undefined
  const tileWidth = (gridWidth - GAP * (cols - 1)) / cols
  return tileWidth * maxAspect
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
}: Props) {
  const board = buildSlotBoard(members, posts, slot)
  const { cols, maxAspect, center } = slotBoardLayout(members.length)
  const { width, onLayout } = useGridWidth()

  const rows: (typeof board.tiles)[] = []
  for (let i = 0; i < board.tiles.length; i += cols) {
    rows.push(board.tiles.slice(i, i + cols))
  }

  const allFilled = members.length > 0 && board.filledCount === members.length
  // 상한이 있는 행은 `flex-1`로 늘어나되 여기서 멈춘다. 남는 여백은 가운데 정렬이
  // 위아래로 나눠 가지므로, 1인 그룹의 빈 칸도 화면 한복판의 카드로 앉는다.
  const maxHeight = tileMaxHeight(width, cols, maxAspect)

  return (
    <View className="flex-1 pb-2">
      <SlotHeading
        slot={slot}
        filled={board.filledCount}
        total={members.length}
        allFilled={allFilled}
      />

      <View
        onLayout={onLayout}
        className={`flex-1 gap-2 px-3 ${center ? 'justify-center' : ''}`}
      >
        {rows.map((row, rowIdx) => (
          <View key={rowIdx} className="flex-1 flex-row gap-2" style={{ maxHeight }}>
            {row.map((tile) => {
              const isMe = tile.member.user_id === currentUserId
              return (
                <View key={tile.member.user_id} className="flex-1">
                  {tile.post ? (
                    <FilledTile
                      member={tile.member}
                      post={tile.post}
                      isMe={isMe}
                      extraCount={tile.extraCount}
                      currentUserId={currentUserId}
                      onReact={onReact}
                      onOpen={() => onOpenPost(tile.post as BoardPost, tile.member)}
                    />
                  ) : (
                    <EmptyTile
                      member={tile.member}
                      isMe={isMe}
                      canUpload={isToday}
                      onUpload={onUpload}
                    />
                  )}
                </View>
              )
            })}
            {/* 마지막 행이 덜 찼을 때 타일 폭이 늘어나지 않도록 빈 칸을 채운다 */}
            {Array.from({ length: cols - row.length }, (_, i) => (
              <View key={`spacer-${i}`} className="flex-1" />
            ))}
          </View>
        ))}
      </View>
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
  const { cols, maxAspect, center } = slotBoardLayout(memberCount)
  const { width, onLayout } = useGridWidth()
  const maxHeight = tileMaxHeight(width, cols, maxAspect)
  const rowCount = Math.max(1, Math.ceil(Math.max(memberCount, 1) / cols))

  return (
    <View className="flex-1 pb-2">
      <View className="items-center px-4 pb-2">
        <DarkSkeleton style={{ width: 96, height: 18, borderRadius: 999 }} />
      </View>
      <View
        onLayout={onLayout}
        className={`flex-1 gap-2 px-3 ${center ? 'justify-center' : ''}`}
      >
        {Array.from({ length: rowCount }, (_, rowIdx) => (
          <View key={rowIdx} className="flex-1 flex-row gap-2" style={{ maxHeight }}>
            {Array.from({ length: cols }, (__, colIdx) => (
              <View key={colIdx} className="flex-1">
                <DarkSkeleton style={{ flex: 1, borderRadius: 16 }} />
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  )
}
