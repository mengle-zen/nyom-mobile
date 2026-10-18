import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'

import { useRequestToJoin, type PublicGroup } from '@/entities/group'
import { notifyError } from '@/shared/lib/error'
import { boardHref } from '@/shared/lib/board-href'
import { haptic, PressableScale } from '@/shared/ui/press'
import { MAX_MEMBERS } from '../lib/join-error'
import { GroupCard } from './GroupCard'
import { Badge, Button } from './primitives'
import { LoadingSkeleton } from './LoadingSkeleton'
import Ionicons from '@expo/vector-icons/Ionicons'

/**
 * 탐색 탭 — 공개 그룹 목록 + 참여 요청.
 *
 * 빈 상태에 안내문만 있고 버튼이 없어 막다른 길이었다. 여기서 할 수 있는 유일한
 * 행동(그룹을 만들어 공개로 전환)을 실제 버튼으로 주고, 수직 중앙에 놓는다.
 */
export function DiscoverTab({
  groups,
  loading,
  onAdd,
}: {
  groups: PublicGroup[]
  loading: boolean
  onAdd: (mode: 'create' | 'join') => void
}) {
  const router = useRouter()
  const request = useRequestToJoin()

  const handleRequest = (groupId: string) => {
    request.mutate(groupId, {
      onSuccess: () => void haptic('success'),
      onError: (e) => notifyError(e, '참여 요청을 보내지 못했어요'),
    })
  }

  if (loading) return <LoadingSkeleton />

  if (groups.length === 0) {
    return (
      <View className="flex-1 items-center justify-center gap-3 px-2 py-10">
        <Ionicons name="search-outline" size={44} color="#A89A82" />
        <Text className="text-base font-bold text-foreground">공개 그룹이 없어요</Text>
        <Text className="mb-2 text-center text-sm text-muted-foreground">
          지금은 탐색할 그룹이 없어요.{'\n'}직접 만들어 공개로 열면 여기 뜨게 돼요
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
      {groups.map((g) => {
        const isFull = g.member_count >= MAX_MEMBERS
        const status = g.user_status
        const pending = request.isPending && request.variables === g.id

        return (
          <GroupCard key={g.id} className="gap-3 px-4 py-3.5">
            {/* 그룹 정보 — 이미 멤버인 그룹만 눌러서 들어갈 수 있다 */}
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={status === 'member' ? `${g.name} 보드 열기` : g.name}
              accessibilityState={{ disabled: status !== 'member' }}
              hapticKind={null}
              onPress={() => {
                if (status === 'member') router.push(boardHref(g.id))
              }}
              disabled={status !== 'member'}
              style={{ flex: 1 }}
            >
              <Text numberOfLines={1} className="font-bold text-foreground">
                {g.name}
              </Text>
              <Text className="mt-0.5 text-xs text-muted-foreground">
                멤버 {g.member_count}/{MAX_MEMBERS}
              </Text>
            </PressableScale>

            {/* 상태 배지 / 액션 */}
            <View>
              {status === 'member' && (
                <Badge label="참여중" tone="primary" icon="check" />
              )}
              {status === 'requested' && <Badge label="요청중" tone="amber" />}
              {status === 'banned' && <Badge label="참여 불가" />}
              {status === 'none' && isFull && <Badge label="가득참" />}
              {status === 'none' && !isFull && (
                <Button
                  label={pending ? '요청 중' : '참여 요청'}
                  accessibilityLabel={`${g.name} 참여 요청`}
                  size="sm"
                  onPress={() => handleRequest(g.id)}
                  disabled={pending}
                  className="rounded-full"
                />
              )}
            </View>
          </GroupCard>
        )
      })}
    </View>
  )
}
