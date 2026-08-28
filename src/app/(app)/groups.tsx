import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'
import Feather from '@expo/vector-icons/Feather'

import { useMyGroups, usePublicGroups } from '@/entities/group'
import { DiscoverTab, GroupSettingsSheet, MyGroupsTab } from '@/features/group'
import { queryKeys } from '@/shared/api/query-keys'

type Tab = 'mine' | 'discover'

const TABS: { key: Tab; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'mine', label: '내 그룹', icon: 'users' },
  { key: 'discover', label: '탐색', icon: 'search' },
]

export default function GroupsScreen() {
  const [tab, setTab] = useState<Tab>('mine')
  const [settingsGroupId, setSettingsGroupId] = useState<string | null>(null)
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()

  const { data: myGroups = [], isLoading: loadingMine } = useMyGroups()
  // 탐색 탭을 열었을 때만 공개 그룹을 불러온다(웹과 동일).
  const { data: publicGroups = [], isLoading: loadingDiscover } = usePublicGroups(
    tab === 'discover',
  )

  const reloadMine = () => qc.invalidateQueries({ queryKey: queryKeys.groups.mine })
  const reloadPublic = () => qc.invalidateQueries({ queryKey: queryKeys.groups.public })

  const settingsGroup = myGroups.find((g) => g.id === settingsGroupId) ?? null

  return (
    <View className="flex-1 bg-background">
      {/* 헤더 + 탭 */}
      <View className="px-4 pb-0" style={{ paddingTop: insets.top + 12 }}>
        <Text accessibilityRole="header" className="mb-3 text-lg font-bold text-foreground">
          그룹
        </Text>

        {/* 웹의 shadcn TabsList 대체 — 세그먼트 컨트롤 */}
        <View
          accessibilityRole="tablist"
          className="flex-row gap-1 rounded-md bg-muted p-1"
        >
          {TABS.map(({ key, label, icon }) => {
            const active = tab === key
            return (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected: active }}
                onPress={() => setTab(key)}
                className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-sm py-2 ${
                  active ? 'bg-card' : ''
                }`}
              >
                <Feather name={icon} size={14} color={active ? '#1F1B16' : '#736756'} />
                <Text
                  className={`text-sm font-semibold ${
                    active ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {tab === 'mine' ? (
          <MyGroupsTab
            groups={myGroups}
            loading={loadingMine}
            onOpenSettings={setSettingsGroupId}
            onReload={reloadMine}
          />
        ) : (
          <DiscoverTab
            groups={publicGroups}
            loading={loadingDiscover}
            onReload={reloadPublic}
          />
        )}
      </ScrollView>

      {/* 그룹 설정 시트 */}
      {settingsGroup && (
        <GroupSettingsSheet
          group={settingsGroup}
          onClose={() => setSettingsGroupId(null)}
          onReload={async () => {
            await reloadMine()
            await reloadPublic()
          }}
        />
      )}
    </View>
  )
}
