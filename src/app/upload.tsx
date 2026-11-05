import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'

import { hhmmFromDate, localDayKey, recordedAtOnSameDay } from '@/entities/post/date-range'
import { createPostToGroups, deletePostBatch } from '@/entities/post/model'
import { invalidateAfterPostEdit, useMyRecentTags } from '@/entities/post/queries'
import { useMyGroups } from '@/entities/group'
import { useAuth } from '@/features/auth'
import { isUntouched } from '@/features/upload/lib/canvas-transform'
import { downscaleForUpload, type Shot } from '@/features/upload/lib/downscale'
import { pickFromLibrary, takePhoto } from '@/features/upload/lib/pick-photo'
import type { CameraBlocked } from '@/features/upload/lib/upload-href'
import { showUndoToast } from '@/features/upload/ui/UndoToast'
import { loadLastRecipients, saveLastRecipients } from '@/features/upload/lib/last-recipients'
import {
  defaultRecipients,
  recipientSummary,
  sendLabel,
} from '@/features/upload/lib/recipients'
import {
  fallbackAfterCamera,
  type CaptureFallback,
} from '@/features/upload/lib/capture-source'
import { CameraDenied } from '@/features/upload/ui/CameraDenied'
import { CaptureSourcePicker } from '@/features/upload/ui/CaptureSourcePicker'
import { PhotoCanvas, type PhotoCanvasHandle } from '@/features/upload/ui/PhotoCanvas'
import { RecipientSheet } from '@/features/upload/ui/RecipientSheet'
import { ShotEditor } from '@/features/upload/ui/ShotEditor'
import { queryClient } from '@/shared/api/query-client'
import { boardHref } from '@/shared/lib/board-href'
import { notifyError } from '@/shared/lib/error'
import { haptic } from '@/shared/ui/press'

/** 보낸 직후 되돌릴 수 있는 시간 */
const UNDO_MS = 5000

/** 카메라 버튼의 선택창에서 고른 사진(`uploadHref`)과, 카메라를 못 쓴 이유 */
type PickedParams = {
  pickedUri?: string
  pickedW?: string
  pickedH?: string
  pickedAt?: string
  cameraBlocked?: CameraBlocked
}

/** 선택창에서 카메라를 못 열었으면 안내로, 아니면(링크로 바로 들어옴 등) 고르는 화면으로 시작한다. */
function initialFallback(blocked: CameraBlocked | undefined): CaptureFallback {
  if (blocked === 'denied') return fallbackAfterCamera({ kind: 'denied', canAskAgain: true })
  if (blocked === 'settings') return fallbackAfterCamera({ kind: 'denied', canAskAgain: false })
  if (blocked === 'unavailable') return fallbackAfterCamera({ kind: 'unavailable' })
  return { stage: 'choose' }
}

/**
 * 되돌리기로 돌아올 때 들고 오는 것 — 사진(이미 정사각으로 확정된 파일)과 입력값.
 * 라우트 파라미터는 문자열뿐이라 펼쳐서 넘긴다.
 */
type RestoreParams = {
  restoreUri?: string
  restoreW?: string
  restoreH?: string
  /** 붙였던 태그. 없으면 빈 문자열 */
  restoreTag?: string
  restoreCaption?: string
  restoreAt?: string
  restoreGroups?: string
}

/**
 * 업로드 — 고른 사진의 미리보기 한 화면에서 보내기.
 *
 * 촬영은 **OS 기본 카메라**가 맡는다(`ImagePicker.launchCameraAsync`).
 * 자체 뷰파인더를 걷어낸 이유는 그게 기기 카메라의 장점(HDR·나이트모드·볼륨 셔터·줌·
 * 사용자가 이미 아는 UI)을 통째로 버리기 때문이다.
 *
 * 사진은 카메라 버튼의 선택창(촬영 / 앨범)에서 골라 들고 온다(2026-11-05 시안 B). 예전엔
 * 진입하자마자 OS 카메라를 띄웠다. 카메라를 못 열었으면 그 이유를, 사진 없이 들어오면
 * 고르는 화면을 보여 준다. 다시 찍기·취소 뒤 처리는 `fallbackAfterCamera`가 정한다.
 *
 * 미리보기 한 화면에서 끝낸다(2026-10 올리기 흐름 시안 A안):
 * - 먹은 시각 = 찍은 시각. 묻지 않고, 틀렸으면 기록 편집에서 고친다.
 * - 끼니는 그 시각으로 골라 두고 칩 하나로만 보여 준다.
 * - 받는 곳은 들고 온 그룹 → 마지막으로 보낸 그룹 → 하나뿐인 그룹. 버튼에 이름이 박힌다.
 * - 보낸 뒤 5초 동안 되돌릴 수 있다. 되돌리면 지우고 이 화면으로 입력 그대로 돌아온다.
 */
export default function UploadScreen() {
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const rq = useQueryClient()
  const search = useLocalSearchParams<{ group?: string } & RestoreParams & PickedParams>()

  /**
   * 촬영(또는 갤러리 선택) 결과 — 자르지 않은 편집 원본. null이면 아직 사진이 없다.
   * 올라갈 정사각 한 장은 보낼 때 캔버스에서 확정한다.
   */
  const [shot, setShot] = useState<Shot | null>(() => {
    const uri = search.restoreUri ?? search.pickedUri
    if (!uri) return null
    return {
      uri,
      width: Number(search.restoreW ?? search.pickedW) || 0,
      height: Number(search.restoreH ?? search.pickedH) || 0,
      mimeType: 'image/jpeg',
    }
  })
  const canvasRef = useRef<PhotoCanvasHandle>(null)
  /**
   * 사진이 없을 때 무엇을 보여줄지.
   * - null  : 사진이 있다
   * - choose: 촬영 / 갤러리 고르기
   * - blocked: 권한 거부·장치 부재 — 이유를 말하고 갤러리로 유도
   */
  const [fallback, setFallback] = useState<CaptureFallback | null>(() =>
    search.restoreUri || search.pickedUri ? null : initialFallback(search.cameraBlocked),
  )
  const [preparing, setPreparing] = useState(false)
  const [caption, setCaption] = useState(search.restoreCaption ?? '')
  const [uploading, setUploading] = useState(false)

  /** 찍은 시각 = 먹은 시각 */
  const [capturedAt, setCapturedAt] = useState<Date>(() =>
    search.restoreAt || search.pickedAt ? new Date(search.restoreAt ?? search.pickedAt ?? '') : new Date(),
  )
  /** 먹은 시각 'HH:mm' — 찍은 시각이 기본, 보내기 전에 고칠 수 있다 */
  const [time, setTime] = useState(() => hhmmFromDate(capturedAt))
  const [timeValid, setTimeValid] = useState(true)
  const [tag, setTag] = useState<string | null>(search.restoreTag || null)
  const { data: recentTags = [] } = useMyRecentTags(user?.id)

  const { data: groups = [], error: groupsError } = useMyGroups()

  useEffect(() => {
    if (groupsError) notifyError(groupsError, '그룹을 불러오지 못했어요', { haptic: false })
  }, [groupsError])

  // 마지막으로 보낸 그룹 — 불러오기 전(null)엔 보내기를 막아 기본값이 바뀌며 튀지 않게 한다.
  const [lastSent, setLastSent] = useState<string[] | null>(null)
  useEffect(() => {
    let alive = true
    void loadLastRecipients().then((ids) => {
      if (alive) setLastSent(ids)
    })
    return () => {
      alive = false
    }
  }, [])

  /** 사용자가 직접 고른 받는 곳. 손대기 전(null)엔 기본값을 따른다. */
  const [picked, setPicked] = useState<Set<string> | null>(() =>
    search.restoreGroups ? new Set(search.restoreGroups.split(',')) : null,
  )
  const myGroupIds = groups.map((g) => g.id)
  const recipients =
    picked ??
    new Set(
      defaultRecipients({ fromGroup: search.group, lastSent: lastSent ?? [], myGroupIds }),
    )
  const recipientNames = groups.filter((g) => recipients.has(g.id)).map((g) => g.name)
  const [recipientsOpen, setRecipientsOpen] = useState(false)

  const toggleRecipient = (id: string) => {
    const next = new Set(recipients)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setPicked(next)
  }

  /** 새 사진이 들어오면 시각·끼니를 그 사진 기준으로 다시 잡는다. (setter만 써서 안정적) */
  const acceptShot = useCallback((next: Shot, takenAt: Date) => {
    setShot(next)
    setCapturedAt(takenAt)
    setTime(hhmmFromDate(takenAt))
    setTimeValid(true)
    setFallback(null)
  }, [])

  const leave = useCallback(() => {
    if (router.canGoBack()) router.back()
    else router.replace('/(app)/groups')
  }, [])

  /** 찍은 사진이 있으면 버리기 전에 한 번 묻는다 — 다시 찍을 수 없는 순간일 수 있다. */
  const close = useCallback(() => {
    if (!shot || uploading) {
      leave()
      return
    }
    Alert.alert('기록을 그만둘까요?', '찍은 사진과 메모는 저장되지 않아요.', [
      { text: '계속 기록', style: 'cancel' },
      { text: '그만두기', style: 'destructive', onPress: leave },
    ])
  }, [leave, shot, uploading])

  // Android 뒤로 — X와 같은 확인을 거친다.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!shot) return false
      close()
      return true
    })
    return () => sub.remove()
  }, [close, shot])

  /** OS 카메라 — 다시 찍기·고르는 화면·권한 안내의 「다시 시도」. 못 찍었으면 이유에 따라 화면을 바꾼다. */
  const openCamera = useCallback(async () => {
    setPreparing(true)
    try {
      const result = await takePhoto()
      if (result.kind === 'shot') acceptShot(result.shot, result.takenAt)
      else setFallback(fallbackAfterCamera(result))
    } finally {
      setPreparing(false)
    }
  }, [acceptShot])

  /** 갤러리에서 선택 — 오늘 찍은 사진이면 그 촬영 시각을 먹은 시각으로 쓴다. */
  const handlePickGallery = async () => {
    if (preparing) return
    setPreparing(true)
    try {
      const picked = await pickFromLibrary()
      if (picked) acceptShot(picked.shot, picked.takenAt)
    } catch (e) {
      notifyError(e, '사진을 불러오지 못했어요')
    } finally {
      setPreparing(false)
    }
  }

  /**
   * "다시 찍기" — OS 카메라를 다시 연다.
   * 지금 사진과 메모는 새 사진이 도착할 때까지 그대로 둔다. 카메라에서 취소하면
   * 원래 사진으로 돌아와야 한다(먼저 지우면 취소한 순간 둘 다 잃는다).
   */
  const retake = () => {
    if (preparing || uploading) return
    void openCamera()
  }

  /**
   * 보내기 — 캔버스에 보이는 그대로 정사각 한 장을 확정해 올리고 보드로 간다.
   * 손대지 않았으면 캡처하지 않고 원본에서 가운데를 잘라 화질을 지킨다.
   */
  const send = async () => {
    const canvas = canvasRef.current
    const groupIds = [...recipients].filter((id) => myGroupIds.includes(id))
    if (!shot || !canvas || !user || groupIds.length === 0 || uploading) return
    setUploading(true)
    try {
      const final = isUntouched(canvas.getTransform())
        ? await downscaleForUpload(shot)
        : await canvas.capture()
      // 업로드는 오늘·지금까지만(now-only). 고친 시각도 찍은 날의 시:분이고 지금을 넘지 않는다.
      const now = new Date()
      const recordedAt = recordedAtOnSameDay(capturedAt.toISOString(), time, now)

      const { postId } = await createPostToGroups({
        userId: user.id,
        imageUri: final.uri,
        mimeType: final.mimeType,
        caption,
        groupIds,
        tag,
        recordedAt,
      })

      void saveLastRecipients(groupIds)
      invalidateAfterPostEdit(rq, user.id, groupIds)
      void haptic('success')

      // UX_FINDINGS E항 — 그룹 목록이 아니라 방금 올린 그룹의 보드로.
      const destination =
        search.group && groupIds.includes(search.group) ? search.group : groupIds[0]
      // 방금 올린 사진이 보이게 그날 보드를 연다(보드가 가장 최근 사진으로 스크롤한다).
      router.replace(boardHref(destination, { date: localDayKey(now) }))

      const names = groups.filter((g) => groupIds.includes(g.id)).map((g) => g.name)
      showUndoToast({
        message: names.length === 1 ? `${names[0]}에 올렸어요` : `${names.length}곳에 올렸어요`,
        durationMs: UNDO_MS,
        onUndo: () =>
          void undoUpload({
            postId,
            userId: user.id,
            groupIds,
            restore: {
              restoreUri: final.uri,
              restoreW: String(final.width),
              restoreH: String(final.height),
              restoreTag: tag ?? '',
              restoreCaption: caption,
              restoreAt: recordedAt,
              restoreGroups: groupIds.join(','),
            },
          }),
      })
    } catch (e) {
      notifyError(e, '업로드에 실패했어요. 잠시 후 다시 시도해 주세요.')
      setUploading(false)
    }
  }

  return (
    <View className="flex-1 bg-neutral-900">
      {/*
        배경 — 같은 사진을 흐리게 깐다. 사진 자체는 가운데 캔버스가 보여주고,
        배경은 분위기만 이어 준다(스토리 편집 화면처럼).
      */}
      {shot ? (
        <Image
          source={{ uri: shot.uri }}
          resizeMode="cover"
          blurRadius={40}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View className="absolute size-full bg-neutral-800" />
      )}

      {/*
        가독성 스크림. 사진 위에 흰 텍스트·칩이 얹히므로 배경을 한 겹 눌러준다.
        RN에는 기본 그라디언트가 없어(별도 패키지) 전체를 균일하게 낮추고,
        컨트롤이 몰린 아래쪽만 한 겹 더 어둡게 한다.
      */}
      {shot && (
        <>
          <View pointerEvents="none" style={StyleSheet.absoluteFill} className="bg-black/40" />
          <View
            pointerEvents="none"
            className="absolute inset-x-0 bottom-0 h-[38%] bg-black/35"
          />
        </>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={{ paddingTop: insets.top }} />

        {/* 상단 바 */}
        <View className="h-16 flex-row items-center justify-center px-4">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="닫기"
            onPress={close}
            hitSlop={8}
            className="absolute left-4 size-icon items-center justify-center rounded-full bg-white/15 active:opacity-70"
          >
            <Ionicons name="close" size={20} color="#fff" />
          </Pressable>
          <Text className="text-xl font-bold text-white">오늘의 한 끼</Text>
        </View>

        {/* 본문 */}
        <View
          className={`flex-1 items-center justify-center gap-7 ${shot ? 'px-4 py-2' : 'px-9'}`}
        >
          {shot ? (
            // 사진을 바꾸면(다시 찍기·갤러리) 편집 상태를 처음부터
            <PhotoCanvas key={shot.uri} ref={canvasRef} shot={shot} />
          ) : fallback?.stage === 'blocked' ? (
            <CameraDenied
              reason={fallback.reason}
              onRetry={() => void openCamera()}
              onPickGallery={() => void handlePickGallery()}
            />
          ) : (
            <View className="items-center gap-3">
              <View className="size-[88px] items-center justify-center rounded-full bg-white/10">
                <Ionicons name="restaurant-outline" size={40} color="rgba(255,255,255,0.7)" />
              </View>
              <Text className="text-lg font-bold text-white">사진 한 장이면 돼요</Text>
              <Text className="w-[280px] text-center text-sm leading-5 text-white/65">
                지금 찍거나, 갤러리에 있는 사진을 골라 올릴 수 있어요.
              </Text>
            </View>
          )}

          {preparing && (
            <View className="absolute inset-0 items-center justify-center bg-black/40">
              <ActivityIndicator color="#fff" />
            </View>
          )}
        </View>

        {/* 하단 컨트롤 */}
        <View style={{ paddingBottom: insets.bottom + 20 }} className="pt-2">
          {shot ? (
            <ShotEditor
              tag={tag}
              onTagChange={setTag}
              recentTags={recentTags}
              time={time}
              originalTime={hhmmFromDate(capturedAt)}
              maxTime={hhmmFromDate(new Date())}
              onTimeChange={(next) => {
                if (next) setTime(next)
                setTimeValid(next !== null)
              }}
              caption={caption}
              onCaptionChange={setCaption}
              recipientSummary={recipientSummary(recipientNames)}
              onOpenRecipients={() => setRecipientsOpen(true)}
              sendLabel={sendLabel(recipientNames)}
              canSend={recipientNames.length > 0 && lastSent !== null && !preparing && timeValid}
              sending={uploading}
              onRetake={retake}
              onSend={() => void send()}
            />
          ) : fallback?.stage === 'choose' ? (
            <CaptureSourcePicker
              disabled={preparing}
              onOpenCamera={() => void openCamera()}
              onPickGallery={() => void handlePickGallery()}
            />
          ) : null}
        </View>
      </KeyboardAvoidingView>

      <RecipientSheet
        open={recipientsOpen}
        groups={groups}
        selected={recipients}
        onToggle={toggleRecipient}
        onClose={() => setRecipientsOpen(false)}
      />
    </View>
  )
}

/**
 * 되돌리기 — 방금 올린 batch를 지우고, 같은 사진·입력으로 업로드 화면을 다시 연다.
 *
 * 업로드 화면은 이미 닫혔으므로 화면 상태에 기대지 않는 모듈 함수다. 지우기 전 5초
 * 동안은 친구 보드에 보였을 수 있다(알림은 아직 연결 전 — 연결할 때 5초 뒤로 미룬다).
 */
async function undoUpload({
  postId,
  userId,
  groupIds,
  restore,
}: {
  postId: string
  userId: string
  groupIds: string[]
  restore: Required<RestoreParams>
}) {
  try {
    await deletePostBatch(postId)
    invalidateAfterPostEdit(queryClient, userId, groupIds)
    void haptic('light')
    router.push({ pathname: '/upload', params: restore })
  } catch (e) {
    notifyError(e, '되돌리지 못했어요. 기록 편집에서 지워 주세요.')
  }
}
