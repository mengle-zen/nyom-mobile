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
import { haptic, PressableScale } from '@/shared/ui/press'

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
    const tasks = [myGroupsQuery.refetch(), statsQuery.refetch()]
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

  const switchTab = (key: Tab) => {
    if (key === tab) return
    void haptic('select')
    setTab(key)
  }

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
            hapticKind="light"
            onPress={() => setAddMode('create')}
            hitSlop={8}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FFF4EC',
            }}
          >
            <Feather name="plus" size={20} color="#E8651A" />
          </PressableScale>
        </View>

        {/*
          웹의 shadcn TabsList 대체 — 세그먼트 컨트롤.
          선택된 쪽은 흰 pill + 그림자 + 진한 글자, 안 선택된 쪽은 한 단계 옅은
          글자(neutral-400)로 둔다. 둘 다 진하면 어디가 선택됐는지 한눈에 안 든다.
        */}
        <View accessibilityRole="tablist" className="flex-row gap-1 rounded-md bg-muted p-1">
          {TABS.map(({ key, label, icon }) => {
            const active = tab === key
            return (
              <PressableScale
                key={key}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected: active }}
                hapticKind={null}
                onPress={() => switchTab(key)}
                style={{ flex: 1 }}
              >
                <View
                  className="flex-row items-center justify-center gap-1.5 rounded-sm py-2"
                  style={
                    active
                      ? {
                          backgroundColor: '#FFFFFF',
                          shadowColor: '#5C2607',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.1,
                          shadowRadius: 3,
                          elevation: 2,
                        }
                      : undefined
                  }
                >
                  <Feather name={icon} size={14} color={active ? '#1F1B16' : '#A89A82'} />
                  <Text
                    className={`text-sm ${
                      active ? 'font-bold text-foreground' : 'font-medium text-neutral-400'
                    }`}
                  >
                    {label}
                  </Text>
                </View>
              </PressableScale>
            )
          })}
        </View>
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
        {tab === 'mine' ? (
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
