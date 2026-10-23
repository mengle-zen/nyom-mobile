import { useState } from 'react'
import { Text, View } from 'react-native'

import { useCreateGroup, useJoinByCode, type JoinGroupError } from '@/entities/group'
import { useAuth } from '@/features/auth'
import { notifyError } from '@/shared/lib/error'
import { haptic } from '@/shared/ui/press'
import { JOIN_ERROR_MSG } from '../lib/join-error'
import { BottomSheet, Button, Input } from './primitives'

/**
 * 그룹 만들기 · 초대코드 참여 시트.
 *
 * 이전에는 두 폼이 목록 바로 아래에 항상 펼쳐져 화면 절반을 먹었다. 그룹이 이미
 * 있는 사람은 거의 쓰지 않는 동작이라 목록이 주인공이 되도록 시트로 내렸다.
 * (그룹이 하나도 없는 사람에게는 빈 상태가 이 시트를 강하게 권한다.)
 *
 * 생성은 누른 즉시 시트를 닫는다 — 목록에 자리표시 행이 이미 앉아 있어
 * "먹혔나?" 하는 순간이 없다. 참여는 코드 오타가 흔해서 서버 응답까지 시트를
 * 열어 두고 필드 아래에 이유를 붙인다.
 */
export function CreateJoinSheet({
  mode,
  onClose,
}: {
  /** 어느 입력에 커서를 둘지 — 빈 상태의 두 CTA가 각각 다른 값을 준다. */
  mode: 'create' | 'join'
  onClose: () => void
}) {
  const { user } = useAuth()
  const create = useCreateGroup(user?.id)
  const join = useJoinByCode(user?.id)

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)

  const handleCreate = () => {
    const trimmed = name.trim()
    if (!trimmed || create.isPending) return
    onClose()
    create.mutate(trimmed, {
      onSuccess: () => void haptic('success'),
      onError: (e) => notifyError(e, '그룹을 만들지 못했어요'),
    })
  }

  const handleJoin = () => {
    const trimmed = code.trim()
    if (!trimmed || join.isPending) return
    setJoinError(null)
    join.mutate(trimmed, {
      onSuccess: () => {
        void haptic('success')
        onClose()
      },
      onError: (e) => {
        const key = (e as Error).message as JoinGroupError
        void haptic('error')
        setJoinError(JOIN_ERROR_MSG[key] ?? JOIN_ERROR_MSG.UNKNOWN)
      },
    })
  }

  return (
    <BottomSheet title="그룹 추가" onClose={onClose}>
      <View className="gap-2">
        <Text className="text-sm font-bold text-foreground">새 그룹 만들기</Text>
        <View className="flex-row gap-2">
          <Input
            value={name}
            onChangeText={setName}
            onSubmitEditing={handleCreate}
            returnKeyType="done"
            maxLength={24}
            placeholder="그룹 이름"
            accessibilityLabel="그룹 이름"
            autoFocus={mode === 'create'}
            className="flex-1"
          />
          <Button
            label="생성"
            icon="plus"
            onPress={handleCreate}
            disabled={!name.trim() || create.isPending}
          />
        </View>
        <Text className="text-xs text-muted-foreground">
          만들면 초대코드가 생겨요. 친구에게 보내 주세요.
        </Text>
      </View>

      <View className="my-5 h-px bg-border" />

      <View className="gap-2">
        <Text className="text-sm font-bold text-foreground">초대코드로 참여</Text>
        <View className="flex-row gap-2">
          <Input
            value={code}
            onChangeText={(v) => {
              setCode(v.toUpperCase())
              setJoinError(null)
            }}
            onSubmitEditing={handleJoin}
            returnKeyType="done"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={12}
            placeholder="12자리 코드"
            accessibilityLabel="초대코드"
            autoFocus={mode === 'join'}
            className="flex-1 tracking-widest"
          />
          <Button
            label={join.isPending ? '참여 중' : '참여'}
            onPress={handleJoin}
            disabled={!code.trim() || join.isPending}
          />
        </View>
        {joinError && (
          <Text className="text-xs font-medium text-destructive">{joinError}</Text>
        )}
      </View>
    </BottomSheet>
  )
}
