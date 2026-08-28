import { useState } from 'react'
import { Text, View } from 'react-native'

import { useAuth } from '@/features/auth'
import { createGroup, joinByCode, type Group, type JoinGroupError } from '@/entities/group'
import { JOIN_ERROR_MSG } from '../lib/join-error'
import { GroupListItem } from './GroupListItem'
import { LoadingSkeleton } from './LoadingSkeleton'
import { Button, Input, Section } from './primitives'

/** 내 그룹 탭 — 목록 + 그룹 생성 / 초대코드 참여 */
export function MyGroupsTab({
  groups,
  loading,
  onOpenSettings,
  onReload,
}: {
  groups: Group[]
  loading: boolean
  onOpenSettings: (id: string) => void
  onReload: () => Promise<void>
}) {
  const { user } = useAuth()
  const [createName, setCreateName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!createName.trim() || busy) return
    setBusy(true)
    setCreateError(null)
    try {
      await createGroup(createName.trim())
      setCreateName('')
      await onReload()
    } catch {
      setCreateError('그룹을 만들지 못했어요')
    } finally {
      setBusy(false)
    }
  }

  const handleJoin = async () => {
    if (!inviteCode.trim() || busy) return
    setBusy(true)
    setJoinError(null)
    try {
      await joinByCode(inviteCode.trim())
      setInviteCode('')
      await onReload()
    } catch (e) {
      const key = (e as Error).message as JoinGroupError
      setJoinError(JOIN_ERROR_MSG[key] ?? JOIN_ERROR_MSG.UNKNOWN)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingSkeleton />

  return (
    <View className="gap-3">
      {/* 내 그룹 목록 */}
      {groups.length === 0 ? (
        <View className="items-center justify-center gap-3 py-10">
          <Text className="text-5xl">🍱</Text>
          <Text className="font-semibold text-foreground">아직 그룹이 없어요</Text>
          <Text className="text-sm text-muted-foreground">
            아래에서 만들거나 참여해 보세요
          </Text>
        </View>
      ) : (
        <View className="gap-2">
          {groups.map((g) => (
            <GroupListItem
              key={g.id}
              group={g}
              isOwner={g.created_by === user?.id}
              onOpenSettings={onOpenSettings}
            />
          ))}
        </View>
      )}

      {/* 구분선 */}
      <View className="my-2 h-px bg-border" />

      {/* 그룹 만들기 */}
      <Section title="그룹 만들기">
        <View className="flex-row gap-2">
          <Input
            value={createName}
            onChangeText={(v) => {
              setCreateName(v)
              setCreateError(null)
            }}
            onSubmitEditing={() => void handleCreate()}
            returnKeyType="done"
            maxLength={24}
            placeholder="그룹 이름"
            accessibilityLabel="그룹 이름"
            className="flex-1"
          />
          <Button
            label="생성"
            icon="plus"
            onPress={() => void handleCreate()}
            disabled={!createName.trim() || busy}
          />
        </View>
        {createError && (
          <Text className="text-xs font-medium text-destructive">{createError}</Text>
        )}
      </Section>

      {/* 초대코드로 참여 */}
      <Section title="초대코드로 참여">
        <View className="flex-row gap-2">
          <Input
            value={inviteCode}
            onChangeText={(v) => {
              setInviteCode(v.toUpperCase())
              setJoinError(null)
            }}
            onSubmitEditing={() => void handleJoin()}
            returnKeyType="done"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            placeholder="6자리 코드"
            accessibilityLabel="초대코드"
            className="flex-1 tracking-widest"
          />
          <Button
            label="참여"
            onPress={() => void handleJoin()}
            disabled={!inviteCode.trim() || busy}
          />
        </View>
        {joinError && (
          <Text className="text-xs font-medium text-destructive">{joinError}</Text>
        )}
      </Section>
    </View>
  )
}
