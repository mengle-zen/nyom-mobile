import { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { useQueryClient } from '@tanstack/react-query'

import { leaveGroup, type Group } from '@/entities/group'
import { queryKeys } from '@/shared/api/query-keys'
import { notifyError } from '@/shared/lib/error'
import { haptic } from '@/shared/ui/press'
import { BottomSheet, SheetRow } from './primitives'

/**
 * 그룹 카드의 부차적 동작 시트 (초대코드 복사 · 설정 · 나가기).
 *
 * 카드에 아이콘을 늘어놓는 대신 여기로 모았다. 목록의 주인공은 그룹이고,
 * 복사·설정은 하루에 한 번도 안 쓰는 동작이라 상시 노출할 값이 없다.
 *
 * 비방장에게 '그룹 나가기'가 여기 처음 생긴다 — 이전에는 설정 시트가 방장
 * 전용이라 일반 멤버가 그룹을 떠날 방법이 화면에 없었다.
 */
export function GroupActionSheet({
  group,
  isOwner,
  onClose,
  onOpenSettings,
}: {
  group: Group
  isOwner: boolean
  onClose: () => void
  onOpenSettings: () => void
}) {
  const qc = useQueryClient()
  const [copied, setCopied] = useState(false)

  const copyInviteCode = async () => {
    try {
      // 웹의 navigator.clipboard 대응. RN에는 없어 expo-clipboard를 쓴다.
      await Clipboard.setStringAsync(group.invite_code)
      setCopied(true)
    } catch (e) {
      notifyError(e, '초대코드를 복사하지 못했어요')
    }
  }

  const handleLeave = async () => {
    void haptic('warning')
    try {
      await leaveGroup(group.id)
      await qc.invalidateQueries({ queryKey: queryKeys.groups.all })
      onClose()
    } catch (e) {
      notifyError(e, '그룹을 나가지 못했어요')
    }
  }

  const confirmLeave = () =>
    Alert.alert('그룹을 나갈까요?', `'${group.name}'에 올린 기록은 남아요.`, [
      { text: '취소', style: 'cancel' },
      { text: '나가기', style: 'destructive', onPress: () => void handleLeave() },
    ])

  return (
    <BottomSheet title={group.name} onClose={onClose}>
      <SheetRow
        icon={copied ? 'check' : 'copy'}
        label={copied ? '복사했어요' : '초대코드 복사'}
        hint={group.invite_code}
        onPress={() => void copyInviteCode()}
      />

      {isOwner ? (
        <SheetRow
          icon="settings"
          label="그룹 설정"
          hint="이름 · 공개 여부 · 멤버 · 가입 요청"
          hapticKind={null}
          onPress={onOpenSettings}
        />
      ) : (
        <SheetRow
          icon="log-out"
          label="그룹 나가기"
          tone="destructive"
          hapticKind={null}
          onPress={confirmLeave}
        />
      )}

      <View className="pt-2">
        <Text className="text-xs text-muted-foreground">
          카드를 길게 누르면 이 창이 바로 열려요
        </Text>
      </View>
    </BottomSheet>
  )
}
