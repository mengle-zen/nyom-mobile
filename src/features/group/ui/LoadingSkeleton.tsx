import { View } from 'react-native'

import { Skeleton } from '@/shared/ui/skeleton'
import { GroupCard } from './GroupCard'

/**
 * 그룹 목록 로딩 뼈대.
 *
 * 정지된 회색 블록은 "멈췄나?"로도 읽힌다. 공용 `Skeleton`(펄스)으로 통일하고,
 * 실제 카드와 같은 껍데기(`GroupCard`)로 그려서 도착 순간에 레이아웃이 튀지 않게 한다.
 * 이름 줄과 지표 줄을 따로 그리는 이유도 같다 — 실제 카드의 두 줄 구조와 맞춘다.
 */
export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <View className="gap-2">
      {Array.from({ length: rows }, (_, i) => (
        // GroupCard는 flex-row라 안쪽에 세로 스택을 한 겹 둔다.
        <GroupCard key={i} className="px-4 py-3.5">
          <View className="flex-1">
            <Skeleton style={{ width: '45%', height: 15, borderRadius: 6 }} />
            <View style={{ height: 8 }} />
            <Skeleton style={{ width: '62%', height: 12, borderRadius: 6 }} />
          </View>
        </GroupCard>
      ))}
    </View>
  )
}
