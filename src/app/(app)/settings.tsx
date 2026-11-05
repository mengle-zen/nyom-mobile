import { Alert, ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import Constants from 'expo-constants'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAuth } from '@/features/auth'
import { NotificationSettingsSection } from '@/features/notifications'
import { useMyProfile } from '@/features/profile'
import { EditProfileForm } from '@/features/profile/ui/EditProfileForm'
import { SwipeBack } from '@/shared/ui/swipe-back'

/** 앱 버전 (빌드 번호) — 설정 맨 아래 */
function versionLabel(): string {
  const config = Constants.expoConfig
  const build = config?.ios?.buildNumber ?? config?.android?.versionCode
  return `뇸 ${config?.version ?? ''}${build ? ` (${build})` : ''}`
}

/**
 * 설정 — 프로필 수정 · 알림 설정 · 로그아웃(2026-11-05 시안 A).
 *
 * 예전엔 프로필 화면 아래쪽에 알림 스위치와 로그아웃이, 위쪽 연필에 수정 카드가 있었다.
 * 프로필 화면은 기록만 보이게 두고 고치는 일은 여기로 모았다. 프로필 사진·닉네임은
 * 맨 위에서 바로 고친다(한 겹 더 열지 않는다).
 */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets()
  const { user, signOut } = useAuth()
  const { profile, loading, refetch } = useMyProfile()

  const goBack = () => {
    if (router.canGoBack()) router.back()
    else router.navigate('/(app)/profile' as never)
  }

  const confirmSignOut = () => {
    Alert.alert('로그아웃할까요?', undefined, [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: () => void signOut() },
    ])
  }

  return (
    <SwipeBack onBack={goBack} backdrop="#EDE4D6">
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <View className="h-header flex-row items-center gap-1 border-b border-border/50 px-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="뒤로"
            onPress={goBack}
            hitSlop={6}
            className="size-icon items-center justify-center rounded-lg active:opacity-60"
          >
            <Ionicons name="chevron-back" size={22} color="#3A3329" />
          </Pressable>
          <Text accessibilityRole="header" className="text-base font-semibold text-foreground">
            설정
          </Text>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-6 px-4 pt-6"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-4 rounded-xl border border-border bg-card p-4">
            <View className="flex-row items-center gap-2">
              <Ionicons name="person-circle-outline" size={16} color="#736756" />
              <Text className="text-sm font-semibold text-foreground">프로필</Text>
            </View>
            {profile ? (
              // 처음 값을 마운트할 때 읽으므로 프로필을 받은 뒤에 그린다.
              <EditProfileForm
                key={profile.id}
                currentNickname={profile.nickname ?? ''}
                currentAvatarUrl={profile.avatar_url ?? null}
                userId={user?.id}
                onSaved={() => void refetch()}
              />
            ) : loading ? (
              <View className="py-6">
                <ActivityIndicator color="#FF7A2E" />
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => void refetch()}
                className="h-control items-center justify-center rounded-xl border border-border active:opacity-70"
              >
                <Text className="text-sm text-foreground">프로필을 불러오지 못했어요. 다시 시도</Text>
              </Pressable>
            )}
          </View>

          <NotificationSettingsSection />

          <Pressable
            accessibilityRole="button"
            onPress={confirmSignOut}
            className="h-control items-center justify-center rounded-xl border border-border bg-card active:opacity-70"
          >
            <Text className="font-medium text-destructive">로그아웃</Text>
          </Pressable>

          <Text className="text-center text-xs text-muted-foreground">{versionLabel()}</Text>
        </ScrollView>
      </View>
    </SwipeBack>
  )
}
