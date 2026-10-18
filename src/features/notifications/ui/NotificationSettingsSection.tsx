import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, Switch, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { toast } from 'sonner-native'
import { useAuth } from '@/features/auth'
import { haptic } from '@/shared/ui/press'
import { useNotificationSettings, useSaveNotificationSettings } from '../queries'
import { NOTIFICATION_KIND_META, withKind } from '../lib/settings'
import {
  getPushPermissionStatus,
  registerForPushNotifications,
} from '../register'

/**
 * 알림 종류별 on/off 섹션 (웹 NotificationSettingsSection의 네이티브 판).
 *
 * 설정은 사용자 단위(기기 단위가 아님)이므로, 이 기기가 등록돼 있는지와 무관하게
 * 토글을 항상 보여주고 저장도 허용한다. 이 기기에서만 알림이 안 오는 상태는
 * 토글을 막는 대신 위쪽 안내 줄로 구분해 알린다.
 */
export function NotificationSettingsSection() {
  const { user } = useAuth()
  const userId = user?.id
  const query = useNotificationSettings(userId)
  const save = useSaveNotificationSettings(userId)
  const settings = query.data

  if (!userId) return null

  return (
    <View className="gap-3 rounded-xl border border-border bg-card p-4">
      <View className="flex-row items-center gap-2">
        <Ionicons name="notifications-outline" size={16} color="#736756" />
        <Text className="text-sm font-semibold text-foreground">알림 설정</Text>
      </View>

      <DevicePushNotice userId={userId} />

      {query.isLoading && (
        <View className="py-4">
          <ActivityIndicator color="#FF7A2E" />
        </View>
      )}

      {query.error && (
        <View className="flex-row items-center gap-3">
          <Text className="flex-1 text-xs text-muted-foreground">
            알림 설정을 불러오지 못했어요
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void query.refetch()}
            className="h-control-sm justify-center rounded-xl border border-border px-3 active:opacity-70"
          >
            <Text className="text-xs font-medium text-foreground">다시 시도</Text>
          </Pressable>
        </View>
      )}

      {settings && (
        <View className="gap-4">
          {NOTIFICATION_KIND_META.map(({ kind, label, description }) => (
            <View key={kind} className="flex-row items-start gap-3">
              <View className="flex-1 gap-0.5">
                <Text className="text-sm font-medium text-foreground">{label}</Text>
                <Text className="text-xs text-muted-foreground">{description}</Text>
              </View>
              <Switch
                accessibilityLabel={label}
                value={settings[kind]}
                onValueChange={(next) => save.mutate(withKind(settings, kind, next))}
                trackColor={{ true: '#FF7A2E', false: '#D9CCB7' }}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

/**
 * 이 기기의 푸시 등록 상태 안내. 설정 자체와는 독립이라 별도 컴포넌트로 뺐다.
 * 권한이 이미 허용된 정상 상태에서는 아무것도 렌더하지 않는다.
 */
function DevicePushNotice({ userId }: { userId: string }) {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<
    'granted' | 'denied' | 'undetermined' | 'loading'
  >('loading')

  useEffect(() => {
    let alive = true
    void getPushPermissionStatus().then((s) => {
      if (alive) setStatus(s)
    })
    return () => {
      alive = false
    }
  }, [])

  if (status === 'loading' || status === 'granted') return null

  const handleEnable = async () => {
    if (busy) return
    setBusy(true)
    try {
      const result = await registerForPushNotifications(userId)
      if (result === 'registered') {
        setStatus('granted')
        void haptic('success')
        toast.success('이 기기에서 알림을 받아요')
        return
      }
      if (result === 'denied') {
        setStatus('denied')
        toast.error('알림 권한이 거부됐어요 (설정 → 뇸 → 알림에서 허용)')
        return
      }
      if (result === 'unsupported') {
        // 시뮬레이터에는 APNs 등록이 없어 여기로 온다. 실기기에서는 정상 발급된다.
        toast.error('이 기기에서는 푸시 토큰을 받을 수 없어요 (시뮬레이터 등)')
        return
      }
      toast.error('알림 토큰을 저장하지 못했어요')
    } catch (err) {
      console.error(err)
      toast.error('알림을 켜지 못했어요')
    } finally {
      setBusy(false)
    }
  }

  return (
    <View className="gap-2">
      <Text className="text-xs text-muted-foreground">
        {status === 'denied'
          ? '이 기기의 알림 권한이 거부돼 있어요. 설정 → 뇸 → 알림에서 허용하면 아래 설정대로 받아요.'
          : '이 기기는 아직 알림을 받지 않아요.'}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => void handleEnable()}
        disabled={busy}
        className={`h-control-sm items-center justify-center rounded-xl border border-border active:opacity-70 ${
          busy ? 'opacity-50' : ''
        }`}
      >
        <Text className="text-sm font-medium text-foreground">
          {busy ? '켜는 중…' : '이 기기에서 알림 켜기'}
        </Text>
      </Pressable>
    </View>
  )
}
