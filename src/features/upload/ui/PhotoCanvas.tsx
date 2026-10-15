import { useCallback, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { Image, StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { captureRef } from 'react-native-view-shot'

import { haptic } from '@/shared/ui/press'
import { DURATION_MOVE, EASE_OUT, useReducedMotion } from '@/shared/ui/motion'
import {
  INITIAL_TRANSFORM,
  baseSize,
  clampScale,
  snapAngle,
  snapOffset,
  type CanvasTransform,
} from '../lib/canvas-transform'
import { MAX_UPLOAD_EDGE, UPLOAD_JPEG_QUALITY } from '../lib/fit'
import type { Shot } from '../lib/downscale'

export type PhotoCanvasHandle = {
  /** 지금 캔버스의 변환. 손대지 않았는지 판단해 화질 좋은 경로를 고르는 데 쓴다. */
  getTransform: () => CanvasTransform
  /** 캔버스에 보이는 그대로 정사각 한 장으로 굽는다. */
  capture: () => Promise<Shot>
}

/** 가이드·라운드 같은 장식을 뺀, 실제로 올라갈 그림만 담는 영역의 배경 */
const FILL_BLUR = 28
/** 사진이 캔버스보다 작거나 기울었을 때 사진을 띄워 보이게 하는 그림자 */
const PHOTO_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.35,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
}

/**
 * 업로드 미리보기의 정사각 캔버스 — 인스타그램 스토리처럼 사진을 바로 잡아
 * 옮기고(끌기) 키우고(핀치) 돌린다(두 손가락 회전). 더블탭은 처음 위치.
 *
 * - 손대지 않으면 지금과 같은 그림(짧은 변이 꽉 찬 가운데)이라 기록 흐름이 그대로다.
 * - 사진이 캔버스보다 작아지거나 기울면 빈 곳은 같은 사진을 흐리게 깔아 채운다.
 * - 가운데·0°/90°에 가까우면 붙고, 붙는 순간에만 가벼운 햅틱 한 번.
 *
 * 모든 변환은 UI 스레드의 shared value로 처리한다(제스처 중 React 렌더 없음).
 * 위치는 캔버스 한 변에 대한 비율이라, 키보드로 캔버스가 줄어도 같은 그림이다.
 */
export function PhotoCanvas({
  shot,
  ref,
}: {
  shot: Shot
  ref?: Ref<PhotoCanvasHandle>
}) {
  const reduceMotion = useReducedMotion()
  const [size, setSize] = useState(0)
  const sizeSV = useSharedValue(0)
  const captureView = useRef<View>(null)

  const x = useSharedValue(INITIAL_TRANSFORM.x)
  const y = useSharedValue(INITIAL_TRANSFORM.y)
  const scale = useSharedValue(INITIAL_TRANSFORM.scale)
  const rotation = useSharedValue(INITIAL_TRANSFORM.rotation)

  // 제스처 시작 시점의 값 — 각 제스처는 시작점 대비 변화량을 준다.
  const startX = useSharedValue(0)
  const startY = useSharedValue(0)
  const startScale = useSharedValue(1)
  const startRotation = useSharedValue(0)

  // 가이드 표시와 "붙는 순간"을 가르는 상태
  const touching = useSharedValue(false)
  const snappedX = useSharedValue(false)
  const snappedY = useSharedValue(false)
  const snappedR = useSharedValue(false)

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout
      const next = Math.floor(Math.min(width, height))
      setSize(next)
      sizeSV.set(next)
    },
    [sizeSV],
  )

  useImperativeHandle(
    ref,
    () => ({
      getTransform: () => ({
        x: x.get(),
        y: y.get(),
        scale: scale.get(),
        rotation: rotation.get(),
      }),
      capture: async () => {
        // 가이드는 캡처 영역 밖에 있어 찍히지 않는다. 출력은 업로드 상한 크기의 정사각.
        const uri = await captureRef(captureView, {
          format: 'jpg',
          quality: UPLOAD_JPEG_QUALITY,
          width: MAX_UPLOAD_EDGE,
          height: MAX_UPLOAD_EDGE,
          result: 'tmpfile',
        })
        return {
          uri: uri.startsWith('file://') ? uri : `file://${uri}`,
          width: MAX_UPLOAD_EDGE,
          height: MAX_UPLOAD_EDGE,
          mimeType: 'image/jpeg',
        }
      },
    }),
    [rotation, scale, x, y],
  )

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onStart(() => {
      touching.set(true)
      startX.set(x.get())
      startY.set(y.get())
    })
    .onUpdate((e) => {
      const s = sizeSV.get()
      if (s <= 0) return
      const nx = snapOffset(startX.get() + e.translationX / s, s)
      const ny = snapOffset(startY.get() + e.translationY / s, s)
      // 붙는 "순간"에만 — 붙은 채 움직이는 동안 계속 울리면 진동이 배경 소음이 된다.
      if ((nx.snapped && !snappedX.get()) || (ny.snapped && !snappedY.get())) {
        scheduleOnRN(haptic, 'light')
      }
      snappedX.set(nx.snapped)
      snappedY.set(ny.snapped)
      x.set(nx.value)
      y.set(ny.value)
    })
    .onFinalize(() => {
      touching.set(false)
    })

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.set(scale.get())
    })
    .onUpdate((e) => {
      scale.set(clampScale(startScale.get() * e.scale))
    })

  const rotate = Gesture.Rotation()
    .onStart(() => {
      startRotation.set(rotation.get())
    })
    .onUpdate((e) => {
      const next = snapAngle(startRotation.get() + (e.rotation * 180) / Math.PI)
      if (next.snapped && !snappedR.get()) scheduleOnRN(haptic, 'light')
      snappedR.set(next.snapped)
      rotation.set(next.value)
    })

  // 헤맸을 때 되돌리는 길. 스토리와 같은 손버릇이다.
  const reset = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const to = (v: number) =>
        reduceMotion ? v : withTiming(v, { duration: DURATION_MOVE, easing: EASE_OUT })
      x.set(to(INITIAL_TRANSFORM.x))
      y.set(to(INITIAL_TRANSFORM.y))
      scale.set(to(INITIAL_TRANSFORM.scale))
      rotation.set(to(INITIAL_TRANSFORM.rotation))
      scheduleOnRN(haptic, 'light')
    })

  const gesture = Gesture.Simultaneous(pan, pinch, rotate, reset)

  const base = baseSize(shot, size)

  const photoStyle = useAnimatedStyle(() => {
    const s = sizeSV.get()
    const sc = scale.get()
    const rot = rotation.get()
    // 사진이 캔버스를 다 덮지 않을 수 있는 상태면 띄워 보이게 한다.
    const floating = sc < 1 || rot % 90 !== 0
    return {
      transform: [
        { translateX: x.get() * s },
        { translateY: y.get() * s },
        { rotate: `${rot}deg` },
        { scale: sc },
      ],
      shadowOpacity: floating ? PHOTO_SHADOW.shadowOpacity : 0,
    }
  })

  const guideV = useAnimatedStyle(() => ({
    opacity: touching.get() && snappedX.get() ? 1 : 0,
  }))
  const guideH = useAnimatedStyle(() => ({
    opacity: touching.get() && snappedY.get() ? 1 : 0,
  }))

  return (
    <View onLayout={onLayout} className="flex-1 items-center justify-center self-stretch">
      {size > 0 && (
        <GestureDetector gesture={gesture}>
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel="촬영한 사진"
            accessibilityHint="끌어서 옮기고, 두 손가락으로 확대하거나 돌릴 수 있어요. 두 번 탭하면 처음 위치로 돌아가요."
            style={{ width: size, height: size, borderRadius: 16, overflow: 'hidden' }}
          >
            {/* 캡처 영역: 여기 담긴 것만 올라간다 */}
            <View
              ref={captureView}
              collapsable={false}
              style={{ width: size, height: size, overflow: 'hidden', backgroundColor: '#251F18' }}
            >
              {/*
                빈 곳 채움 — 같은 사진을 흐리게 깔아 틀 안이 비어 보이지 않게 한다.
                로컬 file:// 이라 RN 기본 Image를 쓴다(CLAUDE.md: expo-image는 Expo Go에서 못 읽음).
              */}
              <Image
                source={{ uri: shot.uri }}
                blurRadius={FILL_BLUR}
                resizeMode="cover"
                style={StyleSheet.absoluteFill}
              />
              <View style={StyleSheet.absoluteFill} className="bg-black/25" />

              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    left: (size - base.width) / 2,
                    top: (size - base.height) / 2,
                    width: base.width,
                    height: base.height,
                    ...PHOTO_SHADOW,
                  },
                  photoStyle,
                ]}
              >
                <Image source={{ uri: shot.uri }} resizeMode="cover" style={StyleSheet.absoluteFill} />
              </Animated.View>
            </View>

            {/* 가운데 가이드 — 캡처 영역 밖이라 결과물에 찍히지 않는다 */}
            <Animated.View
              pointerEvents="none"
              style={[styles.guideV, { left: size / 2 - 0.75 }, guideV]}
            />
            <Animated.View
              pointerEvents="none"
              style={[styles.guideH, { top: size / 2 - 0.75 }, guideH]}
            />
          </View>
        </GestureDetector>
      )}
    </View>
  )
}

const GUIDE_COLOR = '#FF4FA3'

const styles = StyleSheet.create({
  guideV: { position: 'absolute', top: 0, bottom: 0, width: 1.5, backgroundColor: GUIDE_COLOR },
  guideH: { position: 'absolute', left: 0, right: 0, height: 1.5, backgroundColor: GUIDE_COLOR },
})
