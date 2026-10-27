import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { toast } from 'sonner-native'
import {
  hhmmFromDate,
  localDayKey,
  maxTimeForRecordedDay,
  recordedAtOnSameDay,
} from '@/entities/post/date-range'
import {
  diffGroupSelection,
  hasPostBatchChanges,
  tagChange,
  postEditErrorMessage,
  type PostBatchDraft,
} from '@/entities/post/edit'
import type { PostBatch, PostBatchRef } from '@/entities/post/model'
import {
  usePostBatch,
  useUpdatePostBatch,
  useMyRecentTags,
  useDeletePostBatch,
} from '@/entities/post/queries'
import { useMyGroups, type Group } from '@/entities/group'
import { useAuth } from '@/features/auth'
import { MealTagPicker } from '@/entities/post/ui/MealTagPicker'
import { TimeField } from '@/shared/ui/TimeField'
import { clampTime } from '@/shared/lib/time-input'
import { haptic } from '@/shared/ui/press'

/** 편집할 기록 — 프로필 그리드/타임라인의 행에서 이 정도만 필요하다. */
export type EditablePost = PostBatchRef

/**
 * 게시물 사후 편집 (태그 · 섭취 시각 · 메모 · 공유 그룹 + 삭제).
 *
 * 끼니 칸은 2026-10-27 시간 띠 개편으로 없어졌다. 방 화면은 섭취 시각 자리에 사진을
 * 놓으므로 잘못 잡힌 시각을 여기서 고친다. 태그는 붙이기·바꾸기·빼기 모두 되고,
 * 빼기는 update_post_batch에 빈 태그('')를 보낸다(20261027000000_time_lanes.sql).
 * 사진 교체는 여전히 범위 밖 — 스토리지 객체 관리가 얽힌다.
 */
export function PostEditSheet({
  post,
  onClose,
}: {
  post: EditablePost | null
  onClose: () => void
}) {
  /** 폼에 저장 안 한 변경이 있는지. 폼이 알려 준다(헤더 X는 폼 바깥에 있다). */
  const dirty = useRef(false)
  const setDirty = useCallback((next: boolean) => {
    dirty.current = next
  }, [])

  // 닫기 경로(X · 취소 · Android 뒤로)는 모두 여기로 — 고친 내용을 말없이 버리지 않는다.
  // 저장·삭제 성공 뒤의 닫기는 확인이 필요 없으므로 onClose를 직접 쓴다.
  const requestClose = () => {
    if (!dirty.current) {
      onClose()
      return
    }
    Alert.alert('수정을 그만둘까요?', '바꾼 내용은 저장되지 않아요.', [
      { text: '계속 수정', style: 'cancel' },
      { text: '그만두기', style: 'destructive', onPress: onClose },
    ])
  }

  return (
    <Modal
      visible={post !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={requestClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        className="bg-background"
      >
        <View className="h-header flex-row items-center border-b border-border px-4">
          <Text className="text-base font-semibold text-foreground">기록 편집</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="닫기"
            onPress={requestClose}
            hitSlop={8}
            className="ml-auto size-icon items-center justify-center rounded-full active:opacity-60"
          >
            <Ionicons name="close" size={20} color="#3A3329" />
          </Pressable>
        </View>

        {/* 열릴 때만 마운트 → 매번 서버 상태로 초기화 (effect 불필요) */}
        {post && (
          <PostEditLoader
            post={post}
            onClose={onClose}
            onCancel={requestClose}
            onDirtyChange={setDirty}
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  )
}

/** batch 현재 상태 + 내 그룹이 모두 준비된 뒤에 폼을 마운트한다. */
function PostEditLoader({
  post,
  onClose,
  onCancel,
  onDirtyChange,
}: {
  post: EditablePost
  onClose: () => void
  onCancel: () => void
  onDirtyChange: (dirty: boolean) => void
}) {
  const { user } = useAuth()
  const batchQuery = usePostBatch(user?.id, post)
  const groupsQuery = useMyGroups()

  if (batchQuery.isPending || groupsQuery.isPending) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#FF7A2E" />
      </View>
    )
  }

  // 그룹 목록이 없으면 "속한 그룹 없음"과 구분이 안 되므로 에러도 같이 잡는다
  if (batchQuery.error || !batchQuery.data || groupsQuery.error) {
    return (
      <View className="flex-1 items-center justify-center gap-3 px-6">
        <Text className="text-sm text-muted-foreground">
          기록을 불러오지 못했어요
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void batchQuery.refetch()
            void groupsQuery.refetch()
          }}
          className="h-control-sm flex-row items-center gap-1.5 rounded-xl border border-border px-4 active:opacity-70"
        >
          <Ionicons name="refresh" size={14} color="#3A3329" />
          <Text className="text-sm font-medium text-foreground">다시 시도</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <PostEditForm
      batch={batchQuery.data}
      groups={groupsQuery.data ?? []}
      onClose={onClose}
      onCancel={onCancel}
      onDirtyChange={onDirtyChange}
    />
  )
}

function PostEditForm({
  batch,
  groups,
  onClose,
  onCancel,
  onDirtyChange,
}: {
  batch: PostBatch
  groups: Group[]
  /** 저장·삭제가 끝난 뒤 확인 없이 닫는다. */
  onClose: () => void
  /** 사용자가 그만두려 할 때. 변경이 있으면 시트가 한 번 더 묻는다. */
  onCancel: () => void
  onDirtyChange: (dirty: boolean) => void
}) {
  const { user } = useAuth()
  const userId = user?.id
  const updateMutation = useUpdatePostBatch(userId)
  const deleteMutation = useDeletePostBatch(userId)

  // 시트가 열려 있는 동안 기준 시각은 고정 (max가 초 단위로 흔들리지 않게)
  const [now] = useState(() => new Date())

  const original: PostBatchDraft = {
    groupIds: batch.groupIds,
    caption: batch.caption ?? '',
    recordedTime: hhmmFromDate(new Date(batch.recordedAt)),
    tag: batch.tag,
  }

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(batch.groupIds),
  )
  const [caption, setCaption] = useState(original.caption)
  const [recordedTime, setRecordedTime] = useState(original.recordedTime)
  /** 시각 칸을 다 채우지 않았거나 범위를 넘으면 false — 저장을 막는다 */
  const [timeValid, setTimeValid] = useState(true)
  const [tag, setTag] = useState<string | null>(original.tag)
  const { data: recentTags = [] } = useMyRecentTags(userId)

  const maxTime = maxTimeForRecordedDay(batch.recordedAt, now)
  // 「현재」는 오늘 기록에만 — 지난날 기록을 지금 시각으로 맞출 일은 없다
  const isToday = localDayKey(new Date(batch.recordedAt)) === localDayKey(now)
  const busy = updateMutation.isPending || deleteMutation.isPending

  // 내가 나간 그룹의 행은 목록에 뜨지 않으므로 제출 대상에서 뺀다.
  const myGroupIds = new Set(groups.map((g) => g.id))
  const nextGroupIds = [...selected].filter((id) => myGroupIds.has(id))

  const draft: PostBatchDraft = {
    groupIds: nextGroupIds,
    caption,
    recordedTime,
    tag,
  }
  const changed = hasPostBatchChanges(
    { ...original, groupIds: original.groupIds.filter((id) => myGroupIds.has(id)) },
    draft,
  )
  const isDeleting = nextGroupIds.length === 0

  useEffect(() => {
    onDirtyChange(changed)
  }, [changed, onDirtyChange])
  // 폼이 내려가면(닫힘·다른 기록) 이전 변경 여부가 남지 않게
  useEffect(() => () => onDirtyChange(false), [onDirtyChange])

  const toggleGroup = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // 삭제는 시각과 상관없다 — 시각 칸이 덜 채워져 있어도 막지 않는다
  const blocked = busy || !changed || (!timeValid && !isDeleting)

  const affectedGroupIds = diffGroupSelection(batch.groupIds, nextGroupIds).affected

  const handleSave = () => {
    if (blocked) return
    // 마지막 그룹까지 빼면 기록이 사라진다 → 확인을 받는다
    if (isDeleting) {
      askDelete()
      return
    }

    updateMutation.mutate(
      {
        postId: batch.postId,
        groupIds: nextGroupIds,
        caption: caption.trim() ? caption.trim() : null,
        recordedAt:
          recordedTime === original.recordedTime
            ? null
            : recordedAtOnSameDay(
                batch.recordedAt,
                clampTime(recordedTime, maxTime),
                now,
              ),
        // 안 바뀌었으면 null — 옛 기록에 남은 끼니 값을 덮어쓰지 않는다. 빼면 ''.
        tag: tagChange(original.tag, tag),
        affectedGroupIds,
      },
      {
        onSuccess: () => {
          void haptic('success')
          toast.success('기록을 수정했어요')
          onClose()
        },
        onError: (err) => {
          console.error(err)
          void haptic('error')
          toast.error(postEditErrorMessage(err))
        },
      },
    )
  }

  const handleDelete = () => {
    if (deleteMutation.isPending) return
    deleteMutation.mutate(
      { postId: batch.postId, affectedGroupIds: batch.groupIds },
      {
        onSuccess: () => {
          void haptic('medium')
          toast.success('기록을 삭제했어요')
          onClose()
        },
        onError: (err) => {
          console.error(err)
          void haptic('error')
          toast.error(postEditErrorMessage(err))
        },
      },
    )
  }

  // 묻는 순간에는 햅틱을 주지 않는다 — 아직 아무것도 바뀌지 않았다.
  // 실제로 지워진 순간(handleDelete 성공)에 무게감 있는 햅틱을 준다.
  const askDelete = () => {
    Alert.alert(
      '기록을 삭제할까요?',
      '사진과 반응까지 함께 사라져요. 이 작업은 되돌릴 수 없어요.',
      [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: handleDelete },
      ],
    )
  }

  return (
    <>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 p-4 pb-8"
        // 태그를 입력하다 「붙이기」를 누르면 첫 탭이 키보드 닫기로 먹히지 않게
        keyboardShouldPersistTaps="handled"
      >
        {/* 태그 — 선택. 붙이기·바꾸기·빼기 */}
        <View className="gap-1.5">
          <Text className="text-sm font-medium text-muted-foreground">태그</Text>
          <MealTagPicker
            value={tag}
            onChange={setTag}
            recentTags={recentTags}
            disabled={busy}
            variant="onLight"
          />
        </View>

        {/* 섭취 시각 — 기록한 날의 시:분만 (날짜 백필은 허용하지 않는다) */}
        <TimeField
          label="섭취 시각"
          value={recordedTime}
          original={original.recordedTime}
          max={maxTime}
          current={isToday ? hhmmFromDate(now) : null}
          onChange={(next) => {
            if (next) setRecordedTime(next)
            setTimeValid(next !== null)
          }}
          disabled={busy}
        />

        {/* 메모 */}
        <View className="gap-1.5">
          <Text className="text-sm font-medium text-muted-foreground">메모</Text>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            maxLength={100}
            editable={!busy}
            placeholder="한 줄 메모 (선택)"
            placeholderTextColor="#A89A82"
            accessibilityLabel="메모"
            className="h-field rounded-xl border border-border bg-card px-4 text-sm text-foreground"
          />
        </View>

        {/* 공유 그룹 */}
        <View className="gap-1.5">
          <Text className="text-sm font-medium text-muted-foreground">공유 그룹</Text>
          {groups.length === 0 ? (
            <Text className="py-2 text-sm text-muted-foreground">
              속한 그룹이 없어요
            </Text>
          ) : (
            <View className="gap-1 rounded-xl border border-border p-1">
              {groups.map((group) => {
                const checked = selected.has(group.id)
                return (
                  <Pressable
                    key={group.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked, disabled: busy }}
                    accessibilityLabel={`${group.name} 그룹에 공유`}
                    disabled={busy}
                    onPress={() => {
                      void haptic('select')
                      toggleGroup(group.id)
                    }}
                    className="flex-row items-center gap-2.5 rounded-lg px-2.5 py-2.5 active:opacity-70"
                  >
                    <View
                      className={`size-5 items-center justify-center rounded-md ${
                        checked ? 'bg-primary' : 'border-[1.5px] border-neutral-300'
                      }`}
                    >
                      {checked && <Ionicons name="checkmark" size={13} color="#fff" />}
                    </View>
                    <Text numberOfLines={1} className="flex-1 text-sm text-foreground">
                      {group.name}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          )}
          {isDeleting && (
            <Text className="text-xs text-destructive">
              그룹을 모두 빼면 이 기록이 사라져요
            </Text>
          )}
        </View>

        {/* 조용한 삭제 진입점 — 사후 편집 자체가 예외적 동작이므로 눈에 띄지 않게 */}
        <Pressable
          accessibilityRole="button"
          onPress={askDelete}
          disabled={busy}
          className={`min-h-11 flex-row items-center gap-1.5 self-start active:opacity-60 ${
            busy ? 'opacity-50' : ''
          }`}
        >
          <Ionicons name="trash-outline" size={14} color="#736756" />
          <Text className="text-xs text-muted-foreground">이 기록 삭제</Text>
        </Pressable>
      </ScrollView>

      <View className="flex-row gap-2 border-t border-border p-4">
        <Pressable
          accessibilityRole="button"
          onPress={onCancel}
          disabled={busy}
          className={`h-control flex-1 items-center justify-center rounded-xl border border-border active:opacity-70 ${
            busy ? 'opacity-50' : ''
          }`}
        >
          <Text className="font-medium text-foreground">취소</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isDeleting ? '기록 삭제' : '저장'}
          onPress={handleSave}
          disabled={blocked}
          className={`h-control flex-1 flex-row items-center justify-center gap-2 rounded-xl active:opacity-80 ${
            isDeleting ? 'bg-destructive' : 'bg-primary'
          } ${blocked ? 'opacity-40' : ''}`}
        >
          {busy && <ActivityIndicator color="#fff" size="small" />}
          <Text className="font-bold text-primary-foreground">
            {isDeleting ? '기록 삭제' : '저장'}
          </Text>
        </Pressable>
      </View>
    </>
  )
}
