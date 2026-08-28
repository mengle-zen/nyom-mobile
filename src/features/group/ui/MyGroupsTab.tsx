import { Text, View } from 'react-native'

import type { Group, GroupStats } from '@/entities/group'
import { useAuth } from '@/features/auth'
import { GroupListItem } from './GroupListItem'
import { LoadingSkeleton } from './LoadingSkeleton'
import { Button } from './primitives'

/**
 * 내 그룹 탭 — 목록만.
 *
 * 만들기·참여 폼은 시트(`CreateJoinSheet`)로 내렸다. 다만 **그룹이 하나도 없는
 * 사람에게는 목록이 보여줄 게 없으므로** 빈 상태가 그 두 동작을 직접 권한다.
 * 화면 상단 1/3에 안내문만 띄우고 아래를 비워 두지 않도록 수직 중앙에 놓는다.
 */
export function MyGroupsTab({
  groups,
  loading,
  stats,
  onOpenActions,
  onAdd,
}: {
  groups: Group[]
  loading: boolean
  stats: Record<string, GroupStats> | undefined
  onOpenActions: (id: string) => void
  onAdd: (mode: 'create' | 'join') => void
}) {
  const { user } = useAuth()

  if (loading) return <LoadingSkeleton />

  if (groups.length === 0) {
    return (
      <View className="flex-1 items-center justify-center gap-3 px-2 py-10">
        <Text className="text-5xl">🍱</Text>
        <Text className="text-base font-bold text-foreground">아직 그룹이 없어요</Text>
        <Text className="mb-2 text-center text-sm text-muted-foreground">
          그룹을 만들어 친구를 초대하거나,{'\n'}받은 초대코드로 들어가 보세요
        </Text>
        <View className="w-full gap-2">
          <Button label="그룹 만들기" icon="plus" onPress={() => onAdd('create')} />
          <Button
            label="초대코드로 참여"
            variant="outline"
            onPress={() => onAdd('join')}
          />
        </View>
      </View>
    )
  }

  return (
    <View className="gap-2">
      {groups.map((g) => (
        <GroupListItem
          key={g.id}
          group={g}
          isOwner={g.created_by === user?.id}
          stats={stats?.[g.id]}
          onOpenActions={onOpenActions}
        />
      ))}
    </View>
  )
}
