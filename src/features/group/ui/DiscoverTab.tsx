import { useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'

import { requestToJoin, type PublicGroup } from '@/entities/group'
import { notifyError } from '@/shared/lib/error'
import { MAX_MEMBERS } from '../lib/join-error'
import { boardHref } from '@/shared/lib/board-href'
import { Badge, Button } from './primitives'
import { LoadingSkeleton } from './LoadingSkeleton'

/** 탐색 탭 — 공개 그룹 목록 + 참여 요청 */
export function DiscoverTab({
  groups,
  loading,
  onReload,
}: {
  groups: PublicGroup[]
  loading: boolean
  onReload: () => Promise<void>
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null) // groupId

  const handleRequest = async (groupId: string) => {
    setBusy(groupId)
    try {
      await requestToJoin(groupId)
      await onReload()
    } catch (e) {
      notifyError(e, '참여 요청을 보내지 못했어요')
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <LoadingSkeleton />

  if (groups.length === 0) {
    return (
      <View className="items-center justify-center gap-3 py-16">
        <Text className="text-5xl">🔍</Text>
        <Text className="font-semibold text-foreground">공개 그룹이 없어요</Text>
        <Text className="text-sm text-muted-foreground">
          그룹을 만들고 공개로 전환해 보세요
        </Text>
      </View>
    )
  }

  return (
    <View className="gap-2">
      {groups.map((g) => {
        const isFull = g.member_count >= MAX_MEMBERS
        const status = g.user_status

        return (
          <View
            key={g.id}
            className="flex-row items-center gap-3 rounded-lg bg-card px-4 py-3 shadow-sm"
          >
            {/* 그룹 정보 — 이미 멤버인 그룹만 눌러서 들어갈 수 있다 */}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={
                status === 'member' ? `${g.name} 보드 열기` : g.name
              }
              accessibilityState={{ disabled: status !== 'member' }}
              onPress={() => {
                if (status === 'member') router.push(boardHref(g.id))
              }}
              disabled={status !== 'member'}
              activeOpacity={0.7}
              className="flex-1"
            >
              <Text className="font-bold text-foreground">{g.name}</Text>
              <Text className="mt-0.5 text-xs text-muted-foreground">
                멤버 {g.member_count}/{MAX_MEMBERS}
              </Text>
            </TouchableOpacity>

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
                  label={busy === g.id ? '...' : '참여 요청'}
                  accessibilityLabel={`${g.name} 참여 요청`}
                  size="sm"
                  onPress={() => void handleRequest(g.id)}
                  disabled={busy === g.id}
                  className="rounded-full"
                />
              )}
            </View>
          </View>
        )
      })}
    </View>
  )
}
