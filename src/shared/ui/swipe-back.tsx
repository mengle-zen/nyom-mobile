import { useMemo, type ReactNode } from 'react'
import { View, useWindowDimensions } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { DURATION_MOVE, EASE_OUT, useReducedMotion } from './motion'

/** 이만큼(화면 너비 비율) 넘기거나 빠르게 튕기면 뒤로 간다. */
const COMMIT_RATIO = 0.3
const COMMIT_VELOCITY = 700
/** edge 모드에서 밀기를 받는 왼쪽 띠 너비. 헤더 버튼(px-4 = 16)과 겹치지 않는다. */
const EDGE_WIDTH = 16

type Props = {
  onBack: () => void
  /**
   * true면 왼쪽 가장자리 띠에서 시작한 밀기만 받는다. 화면 안의 가로 밀기가 이미 다른 일을
   * 할 때(보드의 날짜 넘기기) 띠를 그 위에 얹어 터치를 따로 받는다.
   */
  edge?: boolean
  children: ReactNode
}

/**
 * 오른쪽으로 밀어 뒤로 가기. iOS 스택의 뒤로 가기 스와이프가 없는 화면용이다
 * (탭 레이아웃 안의 채팅·보드).
 *
 * 화면이 손가락을 따라오고, 놓았을 때 충분히 밀었으면 밀려나며 onBack, 아니면 제자리로.
 * 세로 움직임·왼쪽 밀기는 실패시켜 목록 스크롤과 말풍선 답장 밀기를 막지 않는다.
 * 손으로 밀 수 없는 사람은 화면의 뒤로·닫기 버튼을 쓴다.
 */
export function SwipeBack({ onBack, edge = false, children }: Props) {
  const { width } = useWindowDimensions()
  const reduced = useReducedMotion()
  const x = useSharedValue(0)

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX(16)
        .failOffsetX(-16)
        .failOffsetY([-14, 14])
        .onUpdate((e) => {
          x.set(Math.max(0, e.translationX))
        })
        .onEnd((e) => {
          const commit = x.get() > width * COMMIT_RATIO || e.velocityX > COMMIT_VELOCITY
          if (!commit) {
            x.set(withTiming(0, { duration: DURATION_MOVE, easing: EASE_OUT }))
          } else if (reduced) {
            scheduleOnRN(onBack)
          } else {
            x.set(
              withTiming(width, { duration: DURATION_MOVE, easing: EASE_OUT }, (done) => {
                if (!done) return
                scheduleOnRN(onBack)
                // 탭 화면은 떠난 뒤에도 마운트된 채 남는다. 다시 왔을 때 밀려난 채면 안 되니
                // 화면이 바뀐 뒤 제자리로 돌린다.
                x.set(withDelay(DURATION_MOVE, withTiming(0, { duration: 0 })))
              }),
            )
          }
        }),
    [x, width, reduced, onBack],
  )

  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }))

  // 밀려난 자리에 흰 배경이 드러나지 않게 어두운 바탕을 깐다.
  if (edge) {
    return (
      <View style={{ flex: 1 }} className="bg-black">
        <Animated.View style={[{ flex: 1 }, slide]}>
          {children}
          <GestureDetector gesture={pan}>
            <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: EDGE_WIDTH }} />
          </GestureDetector>
        </Animated.View>
      </View>
    )
  }
  return (
    <View style={{ flex: 1 }} className="bg-black">
      <GestureDetector gesture={pan}>
        <Animated.View style={[{ flex: 1 }, slide]}>{children}</Animated.View>
      </GestureDetector>
    </View>
  )
}
