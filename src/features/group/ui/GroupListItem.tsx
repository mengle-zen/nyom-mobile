import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'

import { isOptimisticGroup, type Group, type GroupStats } from '@/entities/group'
import { boardHref } from '@/shared/lib/board-href'
import { haptic, PressableScale } from '@/shared/ui/press'
import { Skeleton } from '@/shared/ui/skeleton'
import { groupMeta, groupMetaLabel } from '../lib/group-meta'

/**
 * 내 그룹 목록 1행.
 *
 * 이전 카드에는 진입(셰브론) · 초대코드 복사 · 설정이 나란히 있어서 어디를 눌러야
 * 들어가는지 애매했다. 목표는 하나뿐이므로 **행 전체가 보드로 들어가는 버튼**이고,
 * 부차적인 동작(복사 · 설정 · 나가기)은 오른쪽 `⋯` 하나와 롱프레스로 모았다.
 *
 * 진입에는 햅틱을 주지 않는다(`hapticKind={null}`) — 단순 이동에까지 진동을 붙이면
 * 진동이 배경 소음이 되어 "뭔가 바뀌었다"는 신호로서의 의미를 잃는다.
 */
export function GroupListItem({
  group,
  isOwner,
  stats,
  onOpenActions,
}: {
  group: Group
  isOwner: boolean
  stats: GroupStats | undefined
  onOpenActions: (id: string) => void
}) {
  const router = useRouter()

  // 낙관적 자리표시 — 아직 서버에 없어 보드·초대코드·설정이 모두 무의미하다.
  if (isOptimisticGroup(group)) {
    return (
      <View
        accessibilityLabel={`${group.name} 준비 중`}
        className="flex-row items-center gap-3 rounded-lg bg-card px-4 py-3.5 shadow-sm"
      >
        <View className="flex-1">
          <Text numberOfLines={1} className="font-bold text-muted-foreground">
            {group.name}
          </Text>
          <View className="mt-1.5">
            <Skeleton style={{ width: '55%', height: 12, borderRadius: 6 }} />
          </View>
        </View>
      </View>
    )
  }

  const meta = groupMeta(stats)
  const a11y = [group.name, isOwner ? '방장' : null, groupMetaLabel(stats)]
    .filter(Boolean)
    .join(', ')

  return (
    <View className="flex-row items-center rounded-lg bg-card shadow-sm">
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${a11y} 보드 열기`}
        hapticKind={null}
        onPress={() => router.push(boardHref(group.id))}
        onLongPress={() => {
          void haptic('medium')
          onOpenActions(group.id)
        }}
        delayLongPress={320}
        style={{ flex: 1 }}
      >
        <View className="flex-row items-center gap-2 py-3.5 pl-4 pr-1">
          <View className="min-w-0 flex-1">
            <View className="flex-row items-center gap-1.5">
              <Text numberOfLines={1} className="flex-shrink font-bold text-foreground">
                {group.name}
              </Text>
              {/* 왕관만 두면 뜻을 짚어야 안다. 텍스트로 드러낸다. */}
              {isOwner && (
                <View
                  className="flex-row items-center gap-0.5 rounded-full px-1.5 py-0.5"
                  style={{ backgroundColor: '#FEF3C7' }}
                >
                  <MaterialCommunityIcons name="crown" size={9} color="#B45309" />
                  <Text className="text-[10px] font-bold" style={{ color: '#B45309' }}>
                    방장
                  </Text>
                </View>
              )}
            </View>

            <View className="mt-1 flex-row items-center gap-1.5">
              <Feather
                name={group.is_public ? 'globe' : 'lock'}
                size={11}
                color="#A89A82"
              />
              {meta ? (
                <Text numberOfLines={1} className="text-xs text-muted-foreground">
                  {meta.members}
                  <Text className="text-neutral-300"> · </Text>
                  <Text
                    className={
                      meta.hasToday ? 'font-semibold text-primary-700' : undefined
                    }
                  >
                    {meta.today}
                  </Text>
                </Text>
              ) : (
                <Skeleton style={{ width: 120, height: 11, borderRadius: 6 }} />
              )}
            </View>
          </View>
          <Feather name="chevron-right" size={16} color="#D9CCB7" />
        </View>
      </PressableScale>

      {/* 부차적 동작은 여기 하나로 모았다(롱프레스도 같은 시트를 연다) */}
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${group.name} 더보기`}
        accessibilityHint="초대코드 복사, 그룹 설정"
        hapticKind="light"
        onPress={() => onOpenActions(group.id)}
      >
        {/*
          여백을 Pressable **안쪽** View에 준다. PressableScale은 style을 감싸는
          Animated.View에 얹기 때문에, 바깥에 padding을 주면 그 여백은 터치
          영역에서 빠져 아이콘 18pt만 눌리는 과녁이 된다(실제로 옆 행이 눌렸다).
        */}
        <View style={{ paddingVertical: 16, paddingLeft: 8, paddingRight: 14 }}>
          <Feather name="more-vertical" size={18} color="#A89A82" />
        </View>
      </PressableScale>
    </View>
  )
}
