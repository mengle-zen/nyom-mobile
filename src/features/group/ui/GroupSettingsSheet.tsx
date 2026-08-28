import { useState } from 'react'
import { Alert, Switch, Text, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import Feather from '@expo/vector-icons/Feather'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'

import {
  approveRequest,
  kickMember,
  leaveGroup,
  rejectRequest,
  updateGroup,
  useGroupMembers,
  useJoinRequests,
  type Group,
} from '@/entities/group'
import { useAuth } from '@/features/auth'
import { queryKeys } from '@/shared/api/query-keys'
import { notifyError } from '@/shared/lib/error'
import { haptic } from '@/shared/ui/press'
import { MAX_MEMBERS } from '../lib/join-error'
import { Avatar, BottomSheet, Button, IconButton, Input } from './primitives'

/** 방장 전용 그룹 설정 시트 (이름 · 공개 · 가입요청 · 멤버 · 삭제) */
export function GroupSettingsSheet({
  group,
  onClose,
  onReload,
}: {
  group: Group
  onClose: () => void
  onReload: () => Promise<void>
}) {
  const { user } = useAuth()
  const [editName, setEditName] = useState(group.name)
  const [isPublic, setIsPublic] = useState(group.is_public)
  const [busy, setBusy] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  const qc = useQueryClient()
  const { data: requests = [] } = useJoinRequests(group.id)
  const { data: members = [] } = useGroupMembers(group.id)

  const invalidateRequests = () =>
    qc.invalidateQueries({ queryKey: queryKeys.groups.joinRequests(group.id) })
  const invalidateMembers = () =>
    qc.invalidateQueries({ queryKey: queryKeys.groups.members(group.id) })

  const handleSave = async () => {
    const trimmed = editName.trim()
    if (!trimmed) {
      setNameError('이름을 입력해 주세요')
      return
    }
    setBusy(true)
    try {
      await updateGroup(group.id, {
        name: trimmed !== group.name ? trimmed : undefined,
        isPublic: isPublic !== group.is_public ? isPublic : undefined,
      })
      await onReload()
      onClose()
    } catch {
      setNameError('저장에 실패했어요')
    } finally {
      setBusy(false)
    }
  }

  const handleApprove = async (requestId: string) => {
    try {
      await approveRequest(requestId)
      await Promise.all([invalidateRequests(), invalidateMembers()])
      await onReload()
    } catch (e) {
      notifyError(e, '요청을 수락하지 못했어요')
    }
  }

  const handleReject = async (requestId: string) => {
    try {
      await rejectRequest(requestId)
      await invalidateRequests()
    } catch (e) {
      notifyError(e, '요청을 거절하지 못했어요')
    }
  }

  const handleKick = async (userId: string) => {
    try {
      await kickMember(group.id, userId)
      await invalidateMembers()
      await onReload()
    } catch (e) {
      notifyError(e, '멤버를 내보내지 못했어요')
    }
  }

  const handleLeave = async () => {
    // 되돌릴 수 없는 동작 — 확인을 누른 순간에만 경고 햅틱을 준다.
    void haptic('warning')
    setBusy(true)
    try {
      await leaveGroup(group.id)
      await onReload()
      onClose()
    } catch (e) {
      notifyError(e, '그룹 삭제에 실패했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  // 웹의 ConfirmDialog 대신 네이티브 액션 시트를 쓴다. 문구는 웹과 동일하게 유지.
  const confirmLeave = () =>
    Alert.alert(
      '그룹을 삭제할까요?',
      '방장이 나가면 그룹이 삭제돼요. 이 작업은 되돌릴 수 없어요.',
      [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: () => void handleLeave() },
      ],
    )

  return (
    <BottomSheet title="그룹 설정" onClose={onClose}>
      <View>
          {/* 이름 수정 */}
          <View className="mb-5 gap-2">
            <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              이름
            </Text>
            <Input
              value={editName}
              onChangeText={(v) => {
                setEditName(v)
                setNameError(null)
              }}
              maxLength={24}
              accessibilityLabel="그룹 이름"
            />
            {nameError && <Text className="text-xs text-destructive">{nameError}</Text>}
          </View>

          {/* 공개/비공개 토글 */}
          <View className="mb-5">
            <Text className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              공개 설정
            </Text>
            <View className="flex-row items-center justify-between rounded-lg bg-card px-4 py-3">
              <View className="flex-1 flex-row items-center gap-2">
                <Feather
                  name={isPublic ? 'globe' : 'lock'}
                  size={16}
                  color={isPublic ? '#FF7A2E' : '#736756'}
                />
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">
                    {isPublic ? '공개' : '비공개'}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {isPublic
                      ? '탐색 목록에 노출, 참여 요청 받음'
                      : '초대코드로만 참여 가능'}
                  </Text>
                </View>
              </View>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                accessibilityLabel="그룹 공개 여부"
                trackColor={{ true: '#FF7A2E', false: '#D9CCB7' }}
              />
            </View>
          </View>

          {/* 저장 */}
          <View className="mb-5">
            <Button
              label={busy ? '저장 중...' : '저장'}
              onPress={() => void handleSave()}
              disabled={busy}
            />
          </View>

          {/* 가입 요청 (공개인 경우만) */}
          {(group.is_public || isPublic) && (
            <View className="mb-5">
              <Text className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {`가입 요청 ${requests.length > 0 ? `(${requests.length})` : ''}`}
              </Text>
              {requests.length === 0 ? (
                <Text className="py-2 text-sm text-muted-foreground">
                  새 요청이 없어요
                </Text>
              ) : (
                <View className="gap-2">
                  {requests.map((req) => (
                    <View
                      key={req.id}
                      className="flex-row items-center gap-3 rounded-lg bg-card px-3 py-2.5"
                    >
                      <Avatar
                        uri={req.requester.avatar_url}
                        nickname={req.requester.nickname}
                      />
                      <Text
                        numberOfLines={1}
                        className="flex-1 text-sm font-medium text-foreground"
                      >
                        {req.requester.nickname}
                      </Text>
                      <IconButton
                        icon="user-check"
                        accessibilityLabel={`${req.requester.nickname} 수락`}
                        color="#FF7A2E"
                        bg="#FFF4EC"
                        onPress={() => void handleApprove(req.id)}
                      />
                      <IconButton
                        icon="user-x"
                        accessibilityLabel={`${req.requester.nickname} 거절`}
                        color="#E5484D"
                        bg="#FDECEC"
                        onPress={() => void handleReject(req.id)}
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* 멤버 목록 */}
          <View className="mb-5">
            <Text className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {`멤버 (${members.length}/${MAX_MEMBERS})`}
            </Text>
            <View className="gap-2">
              {members.map((m) => {
                const isMe = m.user_id === user?.id
                return (
                  <View
                    key={m.user_id}
                    className="flex-row items-center gap-3 rounded-lg bg-card px-3 py-2.5"
                  >
                    <Avatar uri={m.avatar_url} nickname={m.nickname} />
                    <Text
                      numberOfLines={1}
                      className="flex-1 text-sm font-medium text-foreground"
                    >
                      {m.nickname}
                      {isMe && (
                        <Text className="text-xs text-muted-foreground"> (나)</Text>
                      )}
                    </Text>
                    {isMe ? (
                      <MaterialCommunityIcons name="crown" size={14} color="#F59E0B" />
                    ) : (
                      <IconButton
                        icon="log-out"
                        accessibilityLabel={`${m.nickname} 강퇴`}
                        bg="transparent"
                        onPress={() => void handleKick(m.user_id)}
                      />
                    )}
                  </View>
                )
              })}
            </View>
          </View>

          {/* 그룹 삭제 (방장 나가기) */}
          <Button
            label="그룹 삭제 (방장 나가기)"
            variant="destructive"
            onPress={confirmLeave}
            disabled={busy}
          />
      </View>
    </BottomSheet>
  )
}
