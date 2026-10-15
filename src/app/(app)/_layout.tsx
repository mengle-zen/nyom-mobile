import { Pressable, Text, TouchableOpacity, View } from 'react-native'
import { Tabs, usePathname, useRouter, type Href } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Feather from '@expo/vector-icons/Feather'

import { FLOATING_SHADOW } from '@/shared/ui/shadow'

/**
 * 앱 하단 탭바 (그룹 · 기록 · 프로필).
 *
 * 웹 widgets/bottom-nav와 동일한 3분할이지만 가운데 '기록'은 탭이 아니라
 * /upload를 push하는 FAB이다. 보드·업로드는 몰입 화면이라 탭바를 감춘다.
 */

/**
 * board/profile/upload 화면은 별도 작업으로 추가되는 중이라 expo-router의
 * typedRoutes(.expo/types)에 아직 없다. 파일이 생기면 캐스팅을 지워도 된다.
 */
const href = (path: string): Href => path as unknown as Href

type NavItem = {
  path: string
  label: string
  icon: keyof typeof Feather.glyphMap
  /** 활성 판정에 쓰는 pathname 프리픽스 */
  match: string
}

const LEFT: NavItem = {
  path: '/(app)/groups',
  label: '그룹',
  icon: 'home',
  match: '/groups',
}
const RIGHT: NavItem = {
  path: '/(app)/profile',
  label: '프로필',
  icon: 'user',
  match: '/profile',
}

/** 탭바를 숨길 몰입 화면 */
const IMMERSIVE = ['/board', '/upload']

export default function AppLayout() {
  return (
    <Tabs
      tabBar={() => <BottomNav />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: '#FFFCF8' },
        // 탭 전환은 애니메이션하지 않는다. 하루에 수십 번 오가는 동작이라
        // 180ms 페이드도 매번 기다림으로 쌓인다(iOS 기본 탭바도 즉시 바뀐다).
        // 탭은 서로 위계가 없으니 슬라이드는 더더욱 아니다.
        animation: 'none',
      }}
    >
      <Tabs.Screen name="groups" options={{ title: '그룹' }} />
      {/*
        board · profile 화면 파일은 다른 작업에서 추가된다. expo-router의
        Tabs.Screen은 실제 파일이 없으면 "No route named ..." 로 죽기 때문에
        여기서 미리 선언하지 않는다. 탭바가 라우트 목록이 아니라 고정 항목으로
        그려지므로, 파일이 생기면 선언 없이도 그대로 동작한다.
      */}
    </Tabs>
  )
}

function BottomNav() {
  const router = useRouter()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()

  // 보드·업로드는 몰입 화면 — 웹과 마찬가지로 탭바를 띄우지 않는다.
  if (IMMERSIVE.some((p) => pathname.startsWith(p))) return null

  return (
    <View
      className="border-t border-border bg-card"
      style={{ paddingBottom: insets.bottom }}
    >
      {/* 웹의 backdrop-blur는 RN에 없어 불투명 카드 배경으로 대체한다. */}
      <View className="h-16 flex-row items-center px-2">
        <NavTab item={LEFT} pathname={pathname} onPress={() => router.navigate(href(LEFT.path))} />

        {/* 가운데 기록 FAB — 탭이 아니라 /upload를 push한다 */}
        <View className="flex-1 items-center justify-center">
          {/*
            NativeWind로 감싼 컴포넌트는 함수 형태 style(({pressed}) => ...)을
            버리므로 정적 style만 쓰고 눌림 효과는 activeOpacity에 맡긴다.
          */}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="기록"
            accessibilityHint="사진을 찍어 끼니를 기록해요"
            onPress={() => router.push(href('/upload'))}
            activeOpacity={0.85}
            style={{
              width: 44,
              height: 44,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FF7A2E',
              ...FLOATING_SHADOW,
            }}
          >
            <Feather name="camera" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <NavTab item={RIGHT} pathname={pathname} onPress={() => router.navigate(href(RIGHT.path))} />
      </View>
    </View>
  )
}

function NavTab({
  item,
  pathname,
  onPress,
}: {
  item: NavItem
  pathname: string
  onPress: () => void
}) {
  const active = pathname === '/' ? item.match === '/groups' : pathname.startsWith(item.match)
  const color = active ? '#FF7A2E' : '#A89A82'

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className="flex-1 items-center justify-center gap-0.5 py-2"
    >
      <Feather name={item.icon} size={22} color={color} />
      <Text className="text-[10px] font-medium" style={{ color }}>
        {item.label}
      </Text>
    </Pressable>
  )
}
