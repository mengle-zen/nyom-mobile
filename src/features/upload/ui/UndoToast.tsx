import { useEffect } from 'react'
import { Text, View } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { toast } from 'sonner-native'

import { PressableScale } from '@/shared/ui/press'
import { useReducedMotion } from '@/shared/ui/motion'

/** 보드 하단 카메라 버튼(size-16)과 그 위 여백(pt-1) — board.tsx와 맞춘다. */
const FAB_BLOCK = 64 + 4
const GAP_ABOVE_FAB = 12

/**
 * 업로드 직후 보드 하단, 카메라 버튼 바로 위에 뜨는 한 줄 스낵바.
 *
 * sonner 기본 카드는 액션이 붙으면 제목·버튼이 위아래로 쌓여 커지고, 화면 맨 위라
 * 엄지가 멀다. 되돌리기는 실수를 바로잡는 동작이라 손이 닿는 곳에 둔다(시안 A).
 */
function UndoToast({ message, durationMs, onUndo }: { message: string; durationMs: number; onUndo: () => void }) {
  const insets = useSafeAreaInsets()
  const reduced = useReducedMotion()
  const remaining = useSharedValue(1)

  useEffect(() => {
    if (!reduced) remaining.set(withTiming(0, { duration: durationMs, easing: Easing.linear }))
  }, [durationMs, reduced, remaining])

  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: remaining.get() }] }))

  // sonner의 bottom-center 기준선(안전영역 + 8, 없으면 16)에서 카메라 버튼 위까지 올린다.
  const sonnerBase = insets.bottom > 0 ? insets.bottom + 8 : 16
  const marginBottom = Math.max(insets.bottom, 12) + FAB_BLOCK + GAP_ABOVE_FAB - sonnerBase

  return (
    <View style={{ marginBottom }} className="mx-3">
      <View
        accessibilityLiveRegion="polite"
        className="flex-row items-center overflow-hidden rounded-xl bg-neutral-700 pl-4 pr-1"
        style={{ minHeight: 48, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 }}
      >
        <Text className="flex-1 text-[15px] font-medium text-neutral-50" numberOfLines={1}>
          {message}
        </Text>
        <PressableScale
          onPress={onUndo}
          hapticKind={null}
          accessibilityRole="button"
          accessibilityLabel="되돌리기"
          accessibilityHint="방금 올린 기록을 지우고 편집 화면으로 돌아가요"
          className="h-12 justify-center px-3"
        >
          <Text className="text-[15px] font-bold text-primary-300">되돌리기</Text>
        </PressableScale>
        <Animated.View
          pointerEvents="none"
          className="absolute bottom-0 left-0 h-0.5 w-full bg-primary"
          style={[{ transformOrigin: 'left' }, reduced ? { opacity: 0 } : barStyle]}
        />
      </View>
    </View>
  )
}

/** 되돌리기 스낵바를 띄운다. 누르면 토스트를 닫고 onUndo를 부른다. */
export function showUndoToast({ message, durationMs, onUndo }: { message: string; durationMs: number; onUndo: () => void }) {
  const id = toast.custom(
    <UndoToast
      message={message}
      durationMs={durationMs}
      onUndo={() => {
        toast.dismiss(id)
        onUndo()
      }}
    />,
    { duration: durationMs, position: 'bottom-center' },
  )
}
