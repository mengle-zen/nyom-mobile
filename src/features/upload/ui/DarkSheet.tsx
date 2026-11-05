import type { ReactNode } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'
import { usePullToClose } from '@/shared/ui/pull-to-close'

/**
 * 업로드 화면(어두운 몰입 화면) 위에 뜨는 바텀시트 껍데기.
 * 끼니 고르기·받는 곳 고르기가 같은 모양을 쓴다.
 *
 * 배경은 형제로 깔아 탭하면 닫힌다 — 시트를 감싸면 스크린 리더가 시트 전체를
 * 「닫기」 하나로 읽는다(프로필 상세에서 겪은 문제).
 *
 * 끼니 시트에서 태그를 입력하므로 키보드가 올라오면 시트도 따라 올라간다.
 * 손잡이·제목을 끌어내리면 닫힌다(내용에는 세로 스크롤이 있을 수 있어 그 위에서만 받는다).
 */
export function DarkSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const insets = useSafeAreaInsets()
  const pull = usePullToClose(onClose)
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      {/* Android는 Modal 안에 루트가 따로 있어야 제스처를 받는다. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          className="justify-end"
        >
          <Pressable
            accessible={false}
            importantForAccessibility="no"
            onPress={onClose}
            style={StyleSheet.absoluteFill}
            className="bg-black/50"
          />
          <Animated.View
            className="gap-4 rounded-t-3xl bg-[#2A2620] px-4 pt-2.5"
            style={[{ paddingBottom: insets.bottom + 16 }, pull.style]}
          >
            <GestureDetector gesture={pull.gesture}>
              <View className="gap-4">
                <View className="h-1 w-9 self-center rounded-full bg-white/25" />
                <Text accessibilityRole="header" className="text-base font-bold text-white">
                  {title}
                </Text>
              </View>
            </GestureDetector>
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  )
}
