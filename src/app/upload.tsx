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
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner-native'

import { defaultSlotForHour, slotLabel, type MealSlotKey } from '@/entities/post'
import { hhmmFromDate, recordedAtFromTime } from '@/entities/post/date-range'
import { createPostToGroups } from '@/entities/post/model'
import { useMyGroups } from '@/entities/group'
import { useAuth } from '@/features/auth'
import { isUntouched } from '@/features/upload/lib/canvas-transform'
import { downscaleForUpload, type Shot } from '@/features/upload/lib/downscale'
import { EDIT_SOURCE_EDGE } from '@/features/upload/lib/fit'
import {
  fallbackAfterCamera,
  type CaptureFallback,
} from '@/features/upload/lib/capture-source'
import { clampTime } from '@/shared/lib/time-step'
import { CameraDenied } from '@/features/upload/ui/CameraDenied'
import { CaptureSourcePicker } from '@/features/upload/ui/CaptureSourcePicker'
import { GroupSelectSheet } from '@/features/upload/ui/GroupSelectSheet'
import { PhotoCanvas, type PhotoCanvasHandle } from '@/features/upload/ui/PhotoCanvas'
import { ShotEditor } from '@/features/upload/ui/ShotEditor'
import { queryKeys } from '@/shared/api/query-keys'
import { boardHref } from '@/shared/lib/board-href'
import { notifyError } from '@/shared/lib/error'
import { haptic } from '@/shared/ui/press'

/**
 * 업로드 — 촬영/갤러리 → 맥락 입력 → 그룹 선택.
 *
 * 촬영은 **OS 기본 카메라**가 맡는다(`ImagePicker.launchCameraAsync`).
 * 자체 뷰파인더(expo-camera `CameraView`)를 걷어낸 이유는 그게 기기 카메라의 장점을
 * 통째로 버리기 때문이다 — HDR·나이트모드·화질 보정 같은 기기 파이프라인, 볼륨 버튼
 * 셔터, 줌·플래시·포커스, 그리고 사용자가 이미 아는 UI. 음식 사진 앱에서 이 차이는
 * 그대로 결과물의 차이다.
 *
 * **진입하면 바로 OS 카메라를 띄운다.** 제품 원칙이 "사진 1장 5초 기록"이라 촬영과
 * 화면 사이에 선택지를 한 겹 끼우면 매번 탭이 하나 는다. 대신 자동으로 띄운 카메라를
 * 취소하면 빈 화면이 남는 문제가 생기므로, 취소·거부·장치부재를 모두
 * `fallbackAfterCamera`로 받아 선택 화면이나 폴백 안내로 떨어뜨린다(빈 화면 없음).
 *
 * 촬영 이후 파이프라인(다운스케일 → ShotEditor → 그룹 선택 → 업로드)은 그대로다.
 * docs/UX_FINDINGS.md E항(업로드 후 그룹 보드로 복귀)·F항(2단계에 1단계 요약)도 유지.
 */
export default function UploadScreen() {
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const search = useLocalSearchParams<{ group?: string }>()

  /**
   * 촬영(또는 갤러리 선택) 결과 — 자르지 않은 편집 원본. null이면 아직 사진이 없다.
   * 올라갈 정사각 한 장(`finalShot`)은 「다음」을 누를 때 캔버스에서 확정한다.
   */
  const [shot, setShot] = useState<Shot | null>(null)
  const [finalShot, setFinalShot] = useState<Shot | null>(null)
  const canvasRef = useRef<PhotoCanvasHandle>(null)
  /**
   * 사진이 없을 때 무엇을 보여줄지.
   * - null  : OS 카메라를 띄우는 중(=진입 직후). 사용자는 곧 OS 화면을 본다.
   * - choose: 취소하고 돌아옴 — 다시 찍기/갤러리
   * - blocked: 권한 거부·장치 부재 — 이유를 말하고 갤러리로 유도
   */
  const [fallback, setFallback] = useState<CaptureFallback | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [caption, setCaption] = useState('')
  const [uploading, setUploading] = useState(false)
  const [slot, setSlot] = useState<MealSlotKey>(() =>
    defaultSlotForHour(new Date().getHours()),
  )

  // 섭취 시각 'HH:mm' — 기본값=지금, 오늘·현재 시각까지만.
  // maxTime은 화면이 살아있는 동안 고정하지 않고 매 렌더 계산한다(오래 열어둔 경우 대비).
  const [recordedTime, setRecordedTime] = useState(() => hhmmFromDate(new Date()))
  const maxTime = hhmmFromDate(new Date())

  const [step, setStep] = useState<'details' | 'groups'>('details')
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(search.group ? [search.group] : []),
  )

  const { data: groups = [], error: groupsError } = useMyGroups()

  useEffect(() => {
    if (groupsError) notifyError(groupsError, '그룹을 불러오지 못했어요', { haptic: false })
  }, [groupsError])

  const toggleGroup = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

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

  // Android 뒤로 — 그룹 선택 단계면 한 단계만 돌아가고, 아니면 X와 같은 확인을 거친다.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'groups') {
        if (!uploading) setStep('details')
        return true
      }
      if (!shot) return false
      close()
      return true
    })
    return () => sub.remove()
  }, [close, shot, step, uploading])

  /**
   * OS 기본 카메라로 촬영.
   *
   * 취소(`canceled: true`)는 에러가 아니다 — 토스트도 띄우지 않고 선택 화면으로만
   * 내린다. 시뮬레이터처럼 카메라가 없는 기기에서는 launch가 throw하거나 빈 결과를
   * 주는데, 둘 다 "장치 부재"로 묶어 갤러리 폴백을 띄운다(앱이 깨지지 않는다).
   */
  const openCamera = useCallback(async () => {
    setPreparing(true)
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync()
      if (!permission.granted) {
        setFallback(
          fallbackAfterCamera({
            kind: 'denied',
            canAskAgain: permission.canAskAgain,
          }),
        )
        return
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 1,
        // 크롭은 다음 단계에서 다루지 않는다 — 5초 기록이 목표다.
        allowsEditing: false,
      })
      if (result.canceled) {
        setFallback(fallbackAfterCamera({ kind: 'canceled' }))
        return
      }

      const asset = result.assets[0]
      if (!asset) {
        // 취소도 에러도 아닌데 사진이 없다 — 카메라가 정상 동작하지 않은 것으로 본다.
        setFallback(fallbackAfterCamera({ kind: 'unavailable' }))
        return
      }

      setShot(
        await downscaleForUpload(
          { uri: asset.uri, width: asset.width, height: asset.height },
          EDIT_SOURCE_EDGE,
          { square: false },
        ),
      )
      setFallback(null)
    } catch {
      // 카메라를 열지 못함(시뮬레이터·장치 오류). 조용히 갤러리 경로로 유도한다 —
      // 화면 안 안내가 이미 이유를 말하고 있어 토스트까지 겹치면 시끄럽다.
      setFallback(fallbackAfterCamera({ kind: 'unavailable' }))
    } finally {
      setPreparing(false)
    }
  }, [])

  // 진입하자마자 OS 카메라. 마운트당 한 번만 — 사용자가 취소한 뒤 다시 자동으로
  // 띄우면 화면을 벗어날 수 없는 덫이 된다.
  const autoLaunched = useRef(false)
  useEffect(() => {
    if (autoLaunched.current) return
    autoLaunched.current = true
    void openCamera()
  }, [openCamera])

  /** 갤러리에서 선택 */
  const handlePickGallery = async () => {
    if (preparing) return
    setPreparing(true)
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsEditing: false,
      })
      if (result.canceled) return
      const asset = result.assets[0]
      if (!asset) return
      setShot(
        await downscaleForUpload(
          { uri: asset.uri, width: asset.width, height: asset.height },
          EDIT_SOURCE_EDGE,
          { square: false },
        ),
      )
      setFallback(null)
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
    if (preparing) return
    setStep('details')
    void openCamera()
  }

  /** 선택한 그룹들에 업로드 후 보드로 이동 */
  const upload = async () => {
    if (!finalShot || !user || selected.size === 0 || uploading) return
    setUploading(true)
    const groupIds = [...selected]
    try {
      await createPostToGroups({
        userId: user.id,
        imageUri: finalShot.uri,
        mimeType: finalShot.mimeType,
        caption,
        groupIds,
        mealSlot: slot,
        recordedAt: recordedAtFromTime(new Date(), clampTime(recordedTime, maxTime)),
      })

      groupIds.forEach((gid) => {
        void queryClient.invalidateQueries({ queryKey: ['board', gid] })
        void queryClient.invalidateQueries({ queryKey: queryKeys.recordedDays(gid) })
      })
      void queryClient.invalidateQueries({ queryKey: queryKeys.myPosts(user.id) })

      void haptic('success')
      toast.success('오늘의 한 끼를 올렸어요')

      // UX_FINDINGS E항 — 그룹 목록이 아니라 방금 올린 그룹의 보드로.
      // 들고 온 그룹이 선택에 남아 있으면 그 그룹을, 아니면 선택한 첫 그룹을 연다.
      const destination =
        search.group && groupIds.includes(search.group) ? search.group : groupIds[0]
      router.replace(boardHref(destination))
    } catch (e) {
      notifyError(e, '업로드에 실패했어요. 잠시 후 다시 시도해 주세요.')
      setUploading(false)
    }
  }

  /**
   * 「다음」 — 캔버스에 보이는 그대로 정사각 한 장을 확정하고 그룹 선택으로.
   * 손대지 않았으면 캡처하지 않고 원본에서 가운데를 잘라 화질을 지킨다(예전과 같은 결과).
   */
  const goNext = async () => {
    const canvas = canvasRef.current
    if (!shot || !canvas || preparing) return
    setPreparing(true)
    try {
      const final = isUntouched(canvas.getTransform())
        ? await downscaleForUpload(shot)
        : await canvas.capture()
      setFinalShot(final)
      setStep('groups')
    } catch (e) {
      notifyError(e, '사진을 준비하지 못했어요. 다시 시도해 주세요.')
    } finally {
      setPreparing(false)
    }
  }

  /** OS 카메라를 띄우는 중 — 사진도 폴백도 없는 짧은 대기 구간 */
  const launching = !shot && fallback === null

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
        웹은 위아래 그라디언트를 썼는데 RN에는 기본 그라디언트가 없어(별도 패키지)
        전체를 균일하게 낮추고, 컨트롤이 몰린 아래쪽만 한 겹 더 어둡게 한다.
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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
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
          ) : fallback?.stage === 'choose' ? (
            <View className="items-center gap-3">
              <View className="size-[88px] items-center justify-center rounded-full bg-white/10">
                <Ionicons name="restaurant-outline" size={40} color="rgba(255,255,255,0.7)" />
              </View>
              <Text className="text-lg font-bold text-white">사진 한 장이면 돼요</Text>
              <Text className="w-[280px] text-center text-sm leading-5 text-white/65">
                지금 찍거나, 갤러리에 있는 사진을 골라 올릴 수 있어요.
              </Text>
            </View>
          ) : (
            // 카메라를 여는 중. OS 화면이 곧 덮으므로 최소한만 보여준다.
            <ActivityIndicator color="#fff" />
          )}

          {preparing && !launching && (
            <View className="absolute inset-0 items-center justify-center bg-black/40">
              <ActivityIndicator color="#fff" />
            </View>
          )}
        </View>

        {/* 하단 컨트롤 */}
        <View style={{ paddingBottom: insets.bottom + 24 }} className="pt-2">
          {shot ? (
            <ShotEditor
              slot={slot}
              onSlotChange={setSlot}
              recordedTime={recordedTime}
              onRecordedTimeChange={setRecordedTime}
              maxTime={maxTime}
              caption={caption}
              onCaptionChange={setCaption}
              onRetake={retake}
              onNext={() => void goNext()}
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

      {/* 2단계 — 보낼 그룹 선택 */}
      {finalShot && step === 'groups' && (
        <GroupSelectSheet
          shotUri={finalShot.uri}
          summary={`${slotLabel(slot)} · ${recordedTime}`}
          caption={caption}
          groups={groups}
          selected={selected}
          uploading={uploading}
          onToggle={toggleGroup}
          onBack={() => setStep('details')}
          onSend={() => void upload()}
        />
      )}
    </View>
  )
}
