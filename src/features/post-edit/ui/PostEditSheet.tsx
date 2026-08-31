import { useState } from 'react'
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
import type { MealSlotKey } from '@/entities/post'
import {
  hhmmFromDate,
  maxTimeForRecordedDay,
  recordedAtOnSameDay,
} from '@/entities/post/date-range'
import {
  diffGroupSelection,
  hasPostBatchChanges,
  mealSlotChange,
  postEditErrorMessage,
  type PostBatchDraft,
} from '@/entities/post/edit'
import type { PostBatch, PostBatchRef } from '@/entities/post/model'
import {
  usePostBatch,
  useUpdatePostBatch,
  useDeletePostBatch,
} from '@/entities/post/queries'
import { useMyGroups, type Group } from '@/entities/group'
import { useAuth } from '@/features/auth'
import { MealSlotChips } from '@/entities/post/ui/MealSlotChips'
import { TimeStepper } from '@/shared/ui/TimeStepper'
import { clampTime } from '@/shared/lib/time-step'
import { haptic } from '@/shared/ui/press'

/** 편집할 기록 — 프로필 그리드/타임라인의 행에서 이 정도만 필요하다. */
export type EditablePost = PostBatchRef

/**
 * 게시물 사후 편집 (끼니 · 섭취 시각 · 메모 · 공유 그룹 + 삭제).
 *
 * 끼니 변경은 새벽에 먹은 야식이 "아침"으로 잡히면 영영 고칠 수 없던 문제를 푼다
 * (docs/UX_FINDINGS.md C항). 처음엔 RPC가 끼니를 받지 않아 posts.meal_slot을 별도
 * statement로 직접 update하는 우회를 썼는데, 지금은 update_post_batch가
 * p_meal_slot을 받아 한 트랜잭션으로 처리한다.
 * 사진 교체는 여전히 범위 밖 — 스토리지 객체 관리가 얽힌다.
 */
export function PostEditSheet({
  post,
  onClose,
}: {
  post: EditablePost | null
  onClose: () => void
}) {
  return (
    <Modal
      visible={post !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 bg-background"
      >
        <View className="h-14 flex-row items-center border-b border-border px-4">
          <Text className="text-base font-semibold text-foreground">기록 편집</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="닫기"
            onPress={onClose}
            className="ml-auto size-9 items-center justify-center rounded-full active:opacity-60"
          >
            <Ionicons name="close" size={20} color="#3A3329" />
          </Pressable>
        </View>

        {/* 열릴 때만 마운트 → 매번 서버 상태로 초기화 (effect 불필요) */}
        {post && <PostEditLoader post={post} onClose={onClose} />}
      </KeyboardAvoidingView>
    </Modal>
  )
}

/** batch 현재 상태 + 내 그룹이 모두 준비된 뒤에 폼을 마운트한다. */
function PostEditLoader({
  post,
  onClose,
}: {
  post: EditablePost
  onClose: () => void
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
          className="flex-row items-center gap-1.5 rounded-xl border border-border px-4 py-2 active:opacity-70"
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
    />
  )
}

function PostEditForm({
  batch,
  groups,
  onClose,
}: {
  batch: PostBatch
  groups: Group[]
  onClose: () => void
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
    // 끼니가 비어 있던 기존 행은 아침을 기본으로 보여준다(선택 없음 상태를 만들지 않는다).
    mealSlot: batch.mealSlot ?? 'breakfast',
  }

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(batch.groupIds),
  )
  const [caption, setCaption] = useState(original.caption)
  const [recordedTime, setRecordedTime] = useState(original.recordedTime)
  const [slot, setSlot] = useState<MealSlotKey>(original.mealSlot)

  const maxTime = maxTimeForRecordedDay(batch.recordedAt, now)
  const busy = updateMutation.isPending || deleteMutation.isPending

  // 내가 나간 그룹의 행은 목록에 뜨지 않으므로 제출 대상에서 뺀다.
  const myGroupIds = new Set(groups.map((g) => g.id))
  const nextGroupIds = [...selected].filter((id) => myGroupIds.has(id))

  const draft: PostBatchDraft = {
    groupIds: nextGroupIds,
    caption,
    recordedTime,
    mealSlot: slot,
  }
  const changed = hasPostBatchChanges(
    { ...original, groupIds: original.groupIds.filter((id) => myGroupIds.has(id)) },
    draft,
  )
  const isDeleting = nextGroupIds.length === 0

  const toggleGroup = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const affectedGroupIds = diffGroupSelection(batch.groupIds, nextGroupIds).affected

  const handleSave = () => {
    if (busy) return
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
        // 안 바뀌었으면 null — batch의 기존 끼니(옛 행의 null 포함)를 덮어쓰지 않는다
        mealSlot: mealSlotChange(original.mealSlot, slot),
        affectedGroupIds,
      },
      {
        onSuccess: () => {
          toast.success('기록을 수정했어요')
          onClose()
        },
        onError: (err) => {
          console.error(err)
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
          toast.success('기록을 삭제했어요')
          onClose()
        },
        onError: (err) => {
          console.error(err)
          toast.error(postEditErrorMessage(err))
        },
      },
    )
  }

  // 되돌릴 수 없는 삭제를 묻는 순간 — 손끝에서도 "잠깐" 하고 걸리게 한다.
  const askDelete = () => {
    void haptic('warning')
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
      <ScrollView className="flex-1" contentContainerClassName="gap-5 p-4 pb-8">
        {/* 끼니 — 잘못 분류된 기록을 여기서 고친다 (UX_FINDINGS C항) */}
        <View className="gap-1.5">
          <Text className="text-sm font-medium text-muted-foreground">끼니</Text>
          <MealSlotChips
            value={slot}
            onChange={setSlot}
            disabled={busy}
            variant="onLight"
          />
        </View>

        {/* 섭취 시각 — 기록한 날의 시:분만 (날짜 백필은 허용하지 않는다) */}
        <View className="gap-1.5">
          <Text className="text-sm font-medium text-muted-foreground">섭취 시각</Text>
          <TimeStepper
            value={recordedTime}
            max={maxTime}
            onChange={setRecordedTime}
            disabled={busy}
            variant="onLight"
          />
        </View>

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
            className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground"
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
                    onPress={() => toggleGroup(group.id)}
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
          className={`flex-row items-center gap-1.5 self-start active:opacity-60 ${
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
          onPress={onClose}
          disabled={busy}
          className={`flex-1 items-center rounded-xl border border-border py-3 active:opacity-70 ${
            busy ? 'opacity-50' : ''
          }`}
        >
          <Text className="font-medium text-foreground">취소</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isDeleting ? '기록 삭제' : '저장'}
          onPress={handleSave}
          disabled={busy || !changed}
          className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3 active:opacity-80 ${
            isDeleting ? 'bg-destructive' : 'bg-primary'
          } ${busy || !changed ? 'opacity-40' : ''}`}
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
