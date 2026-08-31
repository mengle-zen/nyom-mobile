import { useState } from 'react'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { hasTestLogin, useAuth } from '@/features/auth'
import { notifyError } from '@/shared/lib/error'
import { CONTROL_SHADOW } from '@/shared/ui/shadow'
import { NyomIcon } from '@/shared/ui/nyom-icon'

/**
 * 로그인 화면.
 *
 * 로그인 성공 후 이 화면에서 직접 router.replace를 하지 않는다. 세션이 생기면
 * 루트 _layout.tsx의 AuthGate가 알아서 /groups로 보낸다. 웹앱은 라우터의
 * beforeLoad에 이동을 맡겼다가 세션이 바뀌어도 재실행되지 않아 화면이 안 넘어가는
 * 버그가 있었는데(docs/UX_FINDINGS.md F항), 여기서는 이동 주체를 한 곳(AuthGate)으로
 * 모아 그 문제를 원천 차단한다. 이 화면은 pending 표시만 책임진다.
 */
export default function LoginScreen() {
  const { signInWithKakao, signInWithTestAccount } = useAuth()
  const [isPending, setIsPending] = useState(false)
  const insets = useSafeAreaInsets()

  const handleKakaoLogin = async () => {
    try {
      setIsPending(true)
      await signInWithKakao()
    } catch (e) {
      notifyError(e, '로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      // 성공해도 pending을 푼다. 화면 전환은 AuthGate가 하므로 여기서 로딩을
      // 붙잡고 있으면 실패했을 때 버튼이 영영 잠긴다.
      setIsPending(false)
    }
  }

  const handleTestLogin = async () => {
    try {
      setIsPending(true)
      await signInWithTestAccount()
    } catch (e) {
      notifyError(e, '테스트 계정 로그인에 실패했어요')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <View className="flex-1 items-center bg-background px-6">
      {/* ── 로고 + 타이틀 ─────────────────────────────── */}
      <View className="flex-1 items-center justify-center gap-5">
        <NyomIcon size={96} shadow />

        <View className="items-center gap-2">
          <Text className="text-[40px] font-bold leading-[46px] tracking-tighter text-primary">
            NYOM
          </Text>
          <Text className="text-base text-muted-foreground">너네 오늘 뭐먹뇸 ?</Text>
        </View>
      </View>

      {/* ── 카카오 버튼 ────────────────────────────────── */}
      <View
        className="w-full items-center gap-6"
        style={{ paddingBottom: insets.bottom + 40 }}
      >
        {/*
          NativeWind(react-native-css-interop)로 감싼 컴포넌트는 함수 형태의
          style(({pressed}) => ...)을 통째로 버린다 — 배경색까지 사라진다.
          정적 style만 쓰고 눌림 피드백은 activeOpacity에 맡긴다.
        */}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="카카오로 시작하기"
          accessibilityState={{ disabled: isPending, busy: isPending }}
          onPress={() => void handleKakaoLogin()}
          disabled={isPending}
          activeOpacity={0.85}
          style={{
            width: '100%',
            height: 54,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
            backgroundColor: '#FEE500',
            opacity: isPending ? 0.7 : 1,
            ...CONTROL_SHADOW,
          }}
        >
          {isPending && <ActivityIndicator size="small" color="#1A140D" />}
          <Text className="text-base font-bold text-[#1A140D]">
            {isPending ? '이동 중...' : '카카오로 시작하기'}
          </Text>
        </TouchableOpacity>

        {hasTestLogin && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="테스트 계정으로 로그인 (개발용)"
            onPress={() => void handleTestLogin()}
            disabled={isPending}
            activeOpacity={0.6}
            style={{ opacity: isPending ? 0.5 : 1 }}
          >
            <Text className="text-xs font-medium text-muted-foreground underline">
              테스트 계정으로 로그인 (개발용)
            </Text>
          </TouchableOpacity>
        )}

        <Text className="text-xs font-medium text-muted-foreground">
          Nyom · 오늘의 한 끼
        </Text>
      </View>
    </View>
  )
}
