import { useCallback, useState } from 'react'
import { RefreshControl, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'
import Feather from '@expo/vector-icons/Feather'

import { useGroupStats, useMyGroups, usePublicGroups } from '@/entities/group'
import { useAuth } from '@/features/auth'
import {
  CreateJoinSheet,
  DiscoverTab,
  GroupActionSheet,
  GroupSettingsSheet,
  MyGroupsTab,
} from '@/features/group'
import { queryKeys } from '@/shared/api/query-keys'
import { PressableScale } from '@/shared/ui/press'
import { ErrorState } from '@/shared/ui/error-state'
import { SegmentedControl } from '@/shared/ui/segmented-control'

type Tab = 'mine' | 'discover'

const TABS: { key: Tab; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'mine', label: '내 그룹', icon: 'users' },
  { key: 'discover', label: '탐색', icon: 'search' },
]

export default function GroupsScreen() {
  const [tab, setTab] = useState<Tab>('mine')
  const [addMode, setAddMode] = useState<'create' | 'join' | null>(null)
  const [actionGroupId, setActionGroupId] = useState<string | null>(null)
  const [settingsGroupId, setSettingsGroupId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const insets = useSafeAreaInsets()
  const qc = useQueryClient()
  const { user } = useAuth()

  const myGroupsQuery = useMyGroups()
  const myGroups = myGroupsQuery.data ?? []
  // 탐색 탭을 열었을 때만 공개 그룹을 불러온다(웹과 동일).
  const publicQuery = usePublicGroups(tab === 'discover')
  // 카드에 붙는 멤버 수·오늘 올린 사람 수. 그룹 수와 무관하게 왕복 2번.
  const statsQuery = useGroupStats(myGroups.map((g) => g.id))

  const actionGroup = myGroups.find((g) => g.id === actionGroupId) ?? null
  const settingsGroup = myGroups.find((g) => g.id === settingsGroupId) ?? null

  /**
   * 당겨서 새로고침 — 목록 화면에 이게 없으면 손이 허공을 친다.
   *
   * 보이는 것만 다시 긁는다(탐색 탭이 닫혀 있으면 공개 목록은 건드리지 않는다).
   * allSettled + 타임아웃을 쓰는 이유: 하나가 실패하거나 응답이 오지 않을 때
   * 스피너가 화면에 박혀 남으면 "새로고침이 고장났다"로 읽힌다.
   */
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    const tasks: Promise<unknown>[] = [myGroupsQuery.refetch(), statsQuery.refetch()]
    if (tab === 'discover') tasks.push(publicQuery.refetch())
    try {
      await Promise.race([
        Promise.allSettled(tasks),
        new Promise((resolve) => setTimeout(resolve, 6000)),
      ])
    } finally {
      setRefreshing(false)
    }
  }, [myGroupsQuery, publicQuery, statsQuery, tab])

  return (
    <View className="flex-1 bg-background">
      {/* 헤더 + 탭 */}
      <View className="px-4 pb-0" style={{ paddingTop: insets.top + 12 }}>
        <View className="mb-3 flex-row items-center justify-between">
          <Text accessibilityRole="header" className="text-lg font-bold text-foreground">
            그룹
          </Text>
          {/* 만들기·참여는 상시 노출 폼이 아니라 이 버튼 뒤의 시트로 들어갔다 */}
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="그룹 추가"
            accessibilityHint="그룹을 만들거나 초대코드로 참여해요"
            // 시트를 여는 것은 무언가를 바꾼 게 아니다 — 햅틱 없이 눌림만.
            hapticKind={null}
            onPress={() => setAddMode('create')}
            hitSlop={8}
            style={{
              // tailwind `icon` 토큰(44)과 같게
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FFF4EC',
            }}
          >
            <Feather name="plus" size={20} color="#E8651A" />
          </PressableScale>
        </View>

        {/*
          웹의 shadcn TabsList 대체 — 미끄러지는 인디케이터가 달린 세그먼트 컨트롤.
          보드의 끼니 칩과 같은 움직임을 쓰도록 공용 컴포넌트로 뺐다.
        */}
        <SegmentedControl segments={TABS} value={tab} onChange={setTab} />
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 24, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor="#A89A82"
          />
        }
      >
        {/*
          불러오기 실패를 빈 목록으로 보여주면 "그룹이 없어요 → 만들기"를 권하게 되고,
          이미 있는 그룹을 하나 더 만들게 된다. 캐시가 없을 때만 오류 화면으로 바꾼다.
        */}
        {tab === 'mine' && myGroupsQuery.error && !myGroupsQuery.data ? (
          <ErrorState
            variant="onLight"
            message="그룹을 불러오지 못했어요"
            onRetry={() => void myGroupsQuery.refetch()}
          />
        ) : tab === 'discover' && publicQuery.error && !publicQuery.data ? (
          <ErrorState
            variant="onLight"
            message="공개 그룹을 불러오지 못했어요"
            onRetry={() => void publicQuery.refetch()}
          />
        ) : tab === 'mine' ? (
          <MyGroupsTab
            groups={myGroups}
            loading={myGroupsQuery.isLoading}
            stats={statsQuery.data}
            onOpenActions={setActionGroupId}
            onAdd={setAddMode}
          />
        ) : (
          <DiscoverTab
            groups={publicQuery.data ?? []}
            loading={publicQuery.isLoading}
            onAdd={setAddMode}
          />
        )}
      </ScrollView>

      {/* 그룹 추가(만들기 · 초대코드) */}
      {addMode && (
        <CreateJoinSheet mode={addMode} onClose={() => setAddMode(null)} />
      )}

      {/* 카드 부차 동작(복사 · 설정 · 나가기) */}
      {actionGroup && (
        <GroupActionSheet
          group={actionGroup}
          isOwner={actionGroup.created_by === user?.id}
          onClose={() => setActionGroupId(null)}
          onOpenSettings={() => {
            setActionGroupId(null)
            setSettingsGroupId(actionGroup.id)
          }}
        />
      )}

      {/* 방장 전용 그룹 설정 */}
      {settingsGroup && (
        <GroupSettingsSheet
          group={settingsGroup}
          onClose={() => setSettingsGroupId(null)}
          onReload={async () => {
            await qc.invalidateQueries({ queryKey: queryKeys.groups.all })
          }}
        />
      )}
    </View>
  )
}
