import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import * as Haptics from 'expo-haptics'
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
import { downscaleForUpload, type Shot } from '@/features/upload/lib/downscale'
import { clampTime } from '@/shared/lib/time-step'
import { CameraControls } from '@/features/upload/ui/CameraControls'
import { CameraDenied } from '@/features/upload/ui/CameraDenied'
import { GroupSelectSheet } from '@/features/upload/ui/GroupSelectSheet'
import { ShotEditor } from '@/features/upload/ui/ShotEditor'
import { queryKeys } from '@/shared/api/query-keys'
import { boardHref } from '@/shared/lib/board-href'
import { notifyError } from '@/shared/lib/error'

/**
 * 업로드 — 촬영/갤러리 → 맥락 입력 → 그룹 선택.
 *
 * 웹의 3단계 플로우를 그대로 옮기되 두 가지를 고쳤다(docs/UX_FINDINGS.md):
 *  - E항: 업로드 후 `/`가 아니라 **들고 있던 그룹의 보드**로 돌아간다. 기록 앱에서
 *    "올렸다"의 확인은 토스트가 아니라 보드에 내 타일이 채워진 걸 보는 것이다.
 *  - F항: 2단계에서 1단계 메모를 확인·수정할 수 있게 요약 줄을 넣었다.
 *
 * 끼니 기본값은 `defaultSlotForHour`(새벽 0~4시 = 야식으로 교정된 버전)를 그대로 쓴다.
 */
export default function UploadScreen() {
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const search = useLocalSearchParams<{ group?: string }>()
  const cameraRef = useRef<CameraView>(null)

  const [permission, requestPermission] = useCameraPermissions()
  const [cameraReady, setCameraReady] = useState(false)
  const [facing, setFacing] = useState<'back' | 'front'>('back')
  /** 카메라가 실제로 프레임을 못 주는 환경(시뮬레이터 등)에서의 폴백 유도 */
  const [cameraFailed, setCameraFailed] = useState(false)

  /** 촬영(또는 갤러리 선택) 결과. null이면 라이브 뷰파인더 */
  const [shot, setShot] = useState<Shot | null>(null)
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
    if (groupsError) notifyError(groupsError, '그룹을 불러오지 못했어요')
  }, [groupsError])

  // 권한 상태를 아직 모를 때 한 번만 물어본다(설정에서 거부한 사용자는 다시 안 뜬다).
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission()
    }
  }, [permission, requestPermission])

  const toggleGroup = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const close = () => {
    if (router.canGoBack()) router.back()
    else router.replace('/(app)/groups')
  }

  /** 촬영 */
  const handleCapture = async () => {
    if (!cameraRef.current || preparing) return
    setPreparing(true)
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      const photo = await cameraRef.current.takePictureAsync({ quality: 1 })
      if (!photo) throw new Error('CAPTURE_EMPTY')
      setShot(await downscaleForUpload(photo))
    } catch (e) {
      setCameraFailed(true)
      notifyError(e, '사진을 찍지 못했어요. 갤러리에서 골라주세요.')
    } finally {
      setPreparing(false)
    }
  }

  /** 갤러리에서 선택 */
  const handlePickGallery = async () => {
    if (preparing) return
    setPreparing(true)
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        // 편집(크롭)은 다음 단계에서 다루지 않으므로 켜지 않는다 — 5초 기록이 목표다.
        allowsEditing: false,
      })
      if (result.canceled) return
      const asset = result.assets[0]
      if (!asset) return
      setShot(
        await downscaleForUpload({
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
        }),
      )
    } catch (e) {
      notifyError(e, '사진을 불러오지 못했어요')
    } finally {
      setPreparing(false)
    }
  }

  /** 미리보기 닫고 1단계로 되돌림 */
  const retake = () => {
    setShot(null)
    setCaption('')
    setStep('details')
  }

  /** 선택한 그룹들에 업로드 후 보드로 이동 */
  const upload = async () => {
    if (!shot || !user || selected.size === 0 || uploading) return
    setUploading(true)
    const groupIds = [...selected]
    try {
      await createPostToGroups({
        userId: user.id,
        imageUri: shot.uri,
        mimeType: shot.mimeType,
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

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
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

  const cameraBlocked =
    cameraFailed || (permission !== null && !permission.granted && !permission.canAskAgain)
  const deniedReason = cameraFailed
    ? '이 기기에서 카메라를 열 수 없어요.\n아래에서 갤러리 사진을 골라 올릴 수 있어요.'
    : '설정 → 뇸 → 카메라에서 권한을 허용하거나,\n아래에서 갤러리 사진을 골라주세요.'

  return (
    <View className="flex-1 bg-neutral-900">
      {/* 배경 — 라이브 카메라 또는 미리보기 */}
      {shot ? (
        <Image
          source={{ uri: shot.uri }}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
          accessibilityLabel="촬영한 사진"
        />
      ) : permission?.granted && !cameraBlocked ? (
        <CameraView
          ref={cameraRef}
          facing={facing}
          onCameraReady={() => setCameraReady(true)}
          onMountError={() => setCameraFailed(true)}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      {/* 카메라가 없을 때의 배경 */}
      {!shot && (!permission?.granted || cameraBlocked) && (
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
            className="absolute left-4 size-9 items-center justify-center rounded-full bg-white/15 active:opacity-70"
          >
            <Ionicons name="close" size={20} color="#fff" />
          </Pressable>
          <Text className="text-xl font-bold text-white">오늘의 한 끼</Text>
        </View>

        {/* 뷰파인더 오버레이 */}
        <View className="flex-1 items-center justify-center gap-7 px-9">
          {cameraBlocked && !shot ? (
            <CameraDenied
              reason={deniedReason}
              onRetry={() => {
                setCameraFailed(false)
                void requestPermission()
              }}
              onPickGallery={() => void handlePickGallery()}
            />
          ) : (
            <>
              <View className="flex-row items-center gap-1.5 rounded-full bg-black/40 py-2 pl-3.5 pr-4">
                <Ionicons name="restaurant-outline" size={16} color="#fff" />
                <Text className="text-sm font-bold text-white">
                  {shot ? '이대로 괜찮나요?' : '음식을 화면 가운데에 담아요'}
                </Text>
              </View>
              <View className="aspect-square w-full max-w-[321px] rounded-xl border-2 border-dashed border-white/45" />
            </>
          )}

          {preparing && (
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
              onNext={() => setStep('groups')}
            />
          ) : cameraBlocked ? null : (
            <CameraControls
              canCapture={cameraReady && !preparing}
              onPickGallery={() => void handlePickGallery()}
              onCapture={() => void handleCapture()}
              onToggleFacing={() =>
                setFacing((f) => (f === 'back' ? 'front' : 'back'))
              }
            />
          )}
        </View>
      </KeyboardAvoidingView>

      {/* 2단계 — 보낼 그룹 선택 */}
      {shot && step === 'groups' && (
        <GroupSelectSheet
          shotUri={shot.uri}
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
