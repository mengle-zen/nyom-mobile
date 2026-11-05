import { useState } from 'react'
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'
import { usePullToClose } from '@/shared/ui/pull-to-close'
import { notifyError } from '@/shared/lib/error'
import { pickFromLibrary, takePhoto } from '../lib/pick-photo'
import { uploadHref } from '../lib/upload-href'

type Source = 'camera' | 'library'

/**
 * 카메라 버튼을 누르면 보던 화면 위로 올라오는 선택창 — 사진 찍기 / 앨범에서 고르기
 * (2026-11-05 시안 B). 사진을 고른 뒤에야 올리기 화면을 연다.
 *
 * 고른 뒤 바로 OS 카메라·앨범을 띄우지 않고 이 창이 **다 닫힌 뒤**에 띄운다. iOS는
 * 모달이 내려가는 도중에 다른 화면을 present하면 오류 없이 무시한다(launchCameraAsync가
 * 끝나지 않는다). iOS는 `onDismiss`를 기다리고, onDismiss가 없는 Android는 바로 띄운다.
 *
 * 카메라를 취소하면 보던 화면에 그대로 남는다. 권한 거부·장치 부재면 올리기 화면을
 * 안내(갤러리로 유도)로 연다.
 */
export function PhotoSourceSheet({
  open,
  onClose,
  groupId,
}: {
  open: boolean
  onClose: () => void
  /** 들고 갈 방 — 받는 곳의 기본값 */
  groupId?: string | null
}) {
  const insets = useSafeAreaInsets()
  const [pending, setPending] = useState<Source | null>(null)
  const pull = usePullToClose(onClose)

  const choose = (source: Source) => {
    onClose()
    // Android에는 onDismiss가 없고 같은 문제도 없다 — 바로 띄운다.
    if (Platform.OS === 'ios') setPending(source)
    else void launch(source)
  }

  const launch = async (source: Source) => {
    setPending(null)
    try {
      if (source === 'library') {
        const picked = await pickFromLibrary()
        if (picked) router.push(uploadHref({ group: groupId, picked }))
        return
      }
      const result = await takePhoto()
      if (result.kind === 'shot') {
        router.push(uploadHref({ group: groupId, picked: result }))
      } else if (result.kind === 'denied') {
        router.push(
          uploadHref({ group: groupId, cameraBlocked: result.canAskAgain ? 'denied' : 'settings' }),
        )
      } else if (result.kind === 'unavailable') {
        router.push(uploadHref({ group: groupId, cameraBlocked: 'unavailable' }))
      }
    } catch (e) {
      notifyError(e, '사진을 불러오지 못했어요')
    }
  }

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={() => {
        if (pending) void launch(pending)
      }}
    >
      {/* Android는 Modal 안에 루트가 따로 있어야 제스처를 받는다. */}
      <GestureHandlerRootView style={{ flex: 1, justifyContent: 'flex-end' }}>
        {/* 배경은 형제로 깐다 — 감싸면 스크린 리더가 선택창 전체를 「닫기」 하나로 읽는다. */}
        <Pressable
          accessible={false}
          importantForAccessibility="no"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
          className="bg-black/50"
        />
        {/* 선택창을 끌어내려도 닫힌다 — 누르는 줄뿐이라 세로 스크롤과 겹치지 않는다. */}
        <Animated.View style={pull.style}>
          <GestureDetector gesture={pull.gesture}>
            <View className="gap-2 px-2" style={{ paddingBottom: insets.bottom + 8 }}>
              <View className="overflow-hidden rounded-2xl bg-[#2E2922]">
                <SourceRow icon="camera-outline" label="사진 찍기" onPress={() => choose('camera')} />
                <View className="h-px bg-white/10" />
                <SourceRow
                  icon="images-outline"
                  label="앨범에서 고르기"
                  onPress={() => choose('library')}
                />
              </View>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                className="h-14 items-center justify-center rounded-2xl bg-[#2E2922] active:opacity-70"
              >
                <Text className="text-base font-bold text-primary-200">취소</Text>
              </Pressable>
            </View>
          </GestureDetector>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  )
}

function SourceRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-14 flex-row items-center gap-3 px-5 active:bg-white/5"
    >
      <Ionicons name={icon} size={22} color="#fff" />
      <Text className="text-base text-white">{label}</Text>
    </Pressable>
  )
}
