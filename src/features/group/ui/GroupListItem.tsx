import { useEffect, useRef, useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import Feather from '@expo/vector-icons/Feather'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'

import type { Group } from '@/entities/group'
import { notifyError } from '@/shared/lib/error'
import { boardHref } from '@/shared/lib/board-href'
import { IconButton } from './primitives'

/** 내 그룹 목록 1행 (진입 · 초대코드 복사 · 방장 설정) */
export function GroupListItem({
  group,
  isOwner,
  onOpenSettings,
}: {
  group: Group
  isOwner: boolean
  onOpenSettings: (id: string) => void
}) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 언마운트 후 setState 하지 않도록 타이머를 정리한다.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const copyInviteCode = async () => {
    try {
      // 웹의 navigator.clipboard 대응. RN에는 없어 expo-clipboard를 쓴다.
      await Clipboard.setStringAsync(group.invite_code)
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1500)
    } catch (e) {
      notifyError(e, '초대코드를 복사하지 못했어요')
    }
  }

  return (
    <View className="flex-row items-center gap-2 rounded-lg bg-card px-4 py-3 shadow-sm">
      {/* 그룹 진입 */}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${group.name} 보드 열기`}
        onPress={() => router.push(boardHref(group.id))}
        activeOpacity={0.7}
        className="flex-1 flex-row items-center gap-3"
      >
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-1.5">
            {isOwner && (
              <MaterialCommunityIcons name="crown" size={12} color="#F59E0B" />
            )}
            <Text numberOfLines={1} className="font-bold text-foreground">
              {group.name}
            </Text>
          </View>
          <View className="mt-0.5 flex-row items-center gap-1.5">
            <Feather
              name={group.is_public ? 'globe' : 'lock'}
              size={12}
              color={group.is_public ? '#FF7A2E' : '#736756'}
            />
            <Text className="text-xs text-muted-foreground">
              {group.is_public ? '공개' : '비공개'}
            </Text>
          </View>
        </View>
        <Feather name="chevron-right" size={16} color="#736756" />
      </TouchableOpacity>

      {/* 초대코드 복사 */}
      <IconButton
        icon={copied ? 'check' : 'copy'}
        color={copied ? '#FF7A2E' : '#736756'}
        accessibilityLabel={`${group.name} 초대코드 복사`}
        onPress={() => void copyInviteCode()}
      />

      {/* 방장: 설정 */}
      {isOwner && (
        <IconButton
          icon="settings"
          accessibilityLabel={`${group.name} 그룹 설정`}
          onPress={() => onOpenSettings(group.id)}
        />
      )}
    </View>
  )
}
