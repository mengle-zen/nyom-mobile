import { Text, View } from 'react-native'
import { slotLabel, buildSlotBoard, type MealSlotKey } from '@/entities/post'
import type { BoardPost } from '@/entities/post/model'
import type { GroupMemberProfile } from '@/entities/group'
import { FilledTile, EmptyTile } from '@/widgets/meal-tile'

type Props = {
  slot: MealSlotKey
  members: GroupMemberProfile[]
  posts: BoardPost[]
  currentUserId: string
  onReact: (postId: string, emoji: string) => void
  onUpload: () => void
  onOpenPost: (post: BoardPost, member: GroupMemberProfile) => void
}

/** 멤버 수에 따라 열 수를 정한다. ≤2: 1열, 3+: 2열(행이 늘어난다) */
function columnsFor(count: number): number {
  return count <= 2 ? 1 : 2
}

/** 한 끼니의 멤버 타일 격자. */
export function SlotBoard({
  slot,
  members,
  posts,
  currentUserId,
  onReact,
  onUpload,
  onOpenPost,
}: Props) {
  const board = buildSlotBoard(members, posts, slot)
  const cols = columnsFor(members.length)
  const rows: (typeof board.tiles)[] = []
  for (let i = 0; i < board.tiles.length; i += cols) {
    rows.push(board.tiles.slice(i, i + cols))
  }

  const allFilled = members.length > 0 && board.filledCount === members.length

  return (
    <View className="flex-1 pb-2">
      <View className="flex-row items-center justify-center gap-2 px-4 pb-2">
        <Text className="text-[15px] font-extrabold text-white">{slotLabel(slot)}</Text>
        <View
          className={`rounded-full px-2 py-0.5 ${allFilled ? 'bg-primary' : 'bg-white/10'}`}
        >
          <Text className="text-xs font-bold text-white">
            {board.filledCount}/{members.length} 올림
          </Text>
        </View>
      </View>

      <View className="flex-1 gap-2 px-3">
        {rows.map((row, rowIdx) => (
          <View key={rowIdx} className="flex-1 flex-row gap-2">
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
                    <EmptyTile member={tile.member} isMe={isMe} onUpload={onUpload} />
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
