import { useEffect, useRef, useState } from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Ionicons from '@expo/vector-icons/Ionicons'
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAuth } from '@/features/auth'
import { installedBuild } from '@/shared/lib/app-build'
import { PressableScale } from '@/shared/ui/press'
import { usePullToClose } from '@/shared/ui/pull-to-close'
import { RELEASE_NOTES, type ReleaseNote } from '../lib/release-notes'
import { notesToShow, parseBuild } from '../lib/whats-new'

/** 「새로 바뀐 점」을 마지막으로 본 빌드 번호 */
const LAST_SEEN_KEY = 'whats-new:last-seen-build'

const markSeen = (build: number) =>
  AsyncStorage.setItem(LAST_SEEN_KEY, String(build)).catch(() => {})

/**
 * 새로 설치한 사람에게는 바뀐 점을 띄우지 않는다 — 바뀐 게 아니라 처음 쓰는 것이다.
 * 켤 때 로그인돼 있지 않고 기록도 없으면 새 설치로 보고 지금 빌드를 본 것으로 적는다.
 * 기록이 없는데 로그인돼 있으면 이 기능 전부터 쓰던 사람이라 그대로 둔다(시트가 적어 둔 내역을 다 보여 준다).
 * 루트에 둔다 — 그룹 화면은 로그인 뒤에만 열려 켤 때의 로그인 여부를 모른다. 렌더 없음.
 */
export function WhatsNewInstallMark() {
  const { session, loading } = useAuth()
  const checked = useRef(false)

  useEffect(() => {
    if (loading || checked.current) return
    checked.current = true
    const current = parseBuild(installedBuild())
    if (session || current === null) return
    void AsyncStorage.getItem(LAST_SEEN_KEY)
      .then((raw) => (raw === null ? markSeen(current) : undefined))
      .catch(() => {})
  }, [loading, session])

  return null
}

/**
 * 업데이트 뒤 처음 열 때 한 번 — 아래 시트에 바뀐 점을 한눈에(2026-11-19 시안 A,
 * https://claude.ai/artifact/3fxy5T98Fj49fmp1jQp1TQ). 내용은 `RELEASE_NOTES`.
 *
 * 그룹 화면에 둔다. 다른 안내(알림 켜기)와 겹치지 않게 다 보거나 띄울 게 없으면 `onDone`을
 * 부르고, 그룹 화면은 그 뒤에 알림 켜기 안내를 띄운다(iOS는 모달 두 개를 한꺼번에 못 띄운다).
 */
export function WhatsNewSheet({ onDone }: { onDone: () => void }) {
  const [items, setItems] = useState<ReleaseNote[] | null>(null)
  const current = parseBuild(installedBuild())

  useEffect(() => {
    if (current === null) {
      onDone()
      return
    }
    let alive = true
    void (async () => {
      const raw = await AsyncStorage.getItem(LAST_SEEN_KEY).catch(() => null)
      if (!alive) return
      const next = notesToShow(raw === null ? null : parseBuild(raw), current, RELEASE_NOTES)
      if (next.length > 0) {
        setItems(next)
        return
      }
      void markSeen(current)
      onDone()
    })()
    return () => {
      alive = false
    }
  }, [current, onDone])

  const close = () => {
    setItems(null)
    if (current !== null) void markSeen(current)
    onDone()
  }

  if (!items) return null
  return <Sheet items={items} onClose={close} />
}

function Sheet({ items, onClose }: { items: ReleaseNote[]; onClose: () => void }) {
  const insets = useSafeAreaInsets()
  const pull = usePullToClose(onClose)

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      {/* Android는 Modal 안에 루트가 따로 있어야 제스처를 받는다. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="새로 바뀐 점 닫기"
          onPress={onClose}
          className="flex-1"
          style={{ backgroundColor: 'rgba(31,27,22,0.45)' }}
        />
        <Animated.View
          accessibilityViewIsModal
          className="rounded-t-xl bg-background px-5"
          style={[{ maxHeight: '88%', paddingBottom: insets.bottom + 16 }, pull.style]}
        >
          {/* 손잡이·제목을 끌어내리면 닫힌다. 항목은 길면 스크롤이라 위쪽에서만 받는다. */}
          <GestureDetector gesture={pull.gesture}>
            <View className="gap-1 pb-4 pt-3">
              <View className="mb-3 h-1 w-10 self-center rounded-full bg-border" />
              <Text className="text-xs font-bold text-primary-700">업데이트</Text>
              <Text accessibilityRole="header" className="text-[22px] font-extrabold text-foreground">
                새로 바뀐 점
              </Text>
            </View>
          </GestureDetector>

          <ScrollView contentContainerClassName="gap-4 pb-5">
            {items.map((item) => (
              <View key={item.title} className="flex-row items-start gap-3.5">
                <View className="size-10 items-center justify-center rounded-xl bg-primary-100">
                  <Ionicons name={item.icon} size={20} color="#C24F0E" />
                </View>
                <View className="min-w-0 flex-1 gap-0.5">
                  <Text className="text-[15px] font-bold text-foreground">{item.title}</Text>
                  <Text className="text-[13px] leading-[19px] text-muted-foreground">{item.body}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <PressableScale
            onPress={onClose}
            hapticKind={null}
            accessibilityRole="button"
            className="h-control items-center justify-center rounded-full bg-primary"
          >
            <Text className="text-base font-bold text-primary-foreground">확인</Text>
          </PressableScale>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  )
}
