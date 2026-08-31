import { useMemo, useState } from 'react'
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import Feather from '@expo/vector-icons/Feather'
import { toast } from 'sonner-native'

import { useAuth } from '@/features/auth'
import {
  changeMyAvatar,
  updateMyProfile,
  useMyProfile,
  validateNickname,
} from '@/features/profile'
import { notifyError } from '@/shared/lib/error'

/**
 * 온보딩 — 닉네임 + 프로필 사진.
 *
 * 웹에 있던 "개인 초대코드" 블록은 죽은 기능이라 옮기지 않았다(웹에서도 PR #34로 제거).
 */
export default function OnboardingScreen() {
  const { user } = useAuth()
  const { profile, loading, refetch } = useMyProfile()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  // 닉네임은 "사용자가 입력한 값(draft)"만 상태로 들고, 아직 입력이 없으면
  // 서버 프로필에서 파생한다. 프로필이 늦게 도착해도 effect로 setState 하지 않는다.
  const [draftNickname, setDraftNickname] = useState<string | null>(null)
  const nickname = draftNickname ?? profile?.nickname ?? ''
  /** 아직 올리지 않은 아바타의 로컬 파일 URI. 저장 시 스토리지로 올린다. */
  const [draftAvatar, setDraftAvatar] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [touched, setTouched] = useState(false)

  const errorMsg = useMemo(
    () => (touched ? validateNickname(nickname) : null),
    [nickname, touched],
  )

  const avatarUri =
    draftAvatar ??
    profile?.avatar_url ??
    (user?.user_metadata?.avatar_url as string | undefined) ??
    (user?.user_metadata?.picture as string | undefined) ??
    null

  const handlePickAvatar = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!perm.granted) {
        toast.error('사진 접근을 허용해 주세요')
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      })
      if (result.canceled || !result.assets[0]) return

      // 여기서는 업로드하지 않는다 — 로컬 URI를 미리보기로만 들고 있다가
      // "시작하기"를 눌렀을 때 닉네임과 함께 올린다. 취소하고 나가면
      // 스토리지에 아무것도 남지 않는다. (리사이즈는 changeMyAvatar가 한다)
      setDraftAvatar(result.assets[0].uri)
    } catch (e) {
      notifyError(e, '사진을 불러오지 못했어요')
    }
  }

  const handleSave = async () => {
    if (!user) return
    setTouched(true)
    const err = validateNickname(nickname)
    if (err) {
      toast.error(err)
      return
    }

    try {
      setSaving(true)
      await updateMyProfile(user.id, { nickname: nickname.trim() })
      // 아바타는 스토리지 업로드가 따로 필요하므로 닉네임 저장 뒤에 이어서 한다.
      // 사진만 실패해도 닉네임은 남는다 — 온보딩을 처음부터 다시 하게 만들지 않는다.
      if (draftAvatar) {
        try {
          await changeMyAvatar(user.id, draftAvatar)
        } catch (e) {
          notifyError(e, '사진은 저장하지 못했어요. 프로필에서 다시 시도해 주세요.')
        }
      }
      toast.success('프로필 설정 완료!')
      await refetch()
      router.replace('/(app)/groups')
    } catch (e) {
      notifyError(e, '저장에 실패했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Text className="text-sm text-muted-foreground">불러오는 중...</Text>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="px-6 pb-6" style={{ paddingTop: insets.top + 48 }}>
          <Text className="text-sm font-bold text-primary">반가워요</Text>
          <Text
            accessibilityRole="header"
            className="mt-1 text-2xl font-bold leading-[30px] text-foreground"
          >
            프로필을 설정해 주세요
          </Text>
          <Text className="mt-1.5 text-sm text-muted-foreground">
            친구들에게 어떤 이름과 사진으로 보일지 정해요
          </Text>
        </View>

        <View className="flex-1 gap-8 px-6 py-2">
          {/* 아바타 */}
          <View className="items-center pt-2">
            <View>
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={{ width: 104, height: 104, borderRadius: 52 }}
                  accessibilityLabel="프로필 사진"
                />
              ) : (
                <View className="size-[104px] items-center justify-center rounded-full bg-primary-100">
                  <Text className="text-[40px] font-bold text-primary">
                    {nickname.trim()[0] ?? '🙂'}
                  </Text>
                </View>
              )}
              {/* NativeWind가 함수형 style을 버리므로 정적 style만 쓴다. */}
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="프로필 사진 변경"
                onPress={() => void handlePickAvatar()}
                activeOpacity={0.85}
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  borderWidth: 3,
                  borderColor: '#FFFCF8',
                  backgroundColor: '#FF7A2E',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Feather name="camera" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* 닉네임 입력 */}
          <View className="gap-2">
            <Text className="text-sm font-bold text-foreground">닉네임</Text>
            <TextInput
              value={nickname}
              onChangeText={(v) => {
                setDraftNickname(v)
                if (!touched) setTouched(true)
              }}
              onBlur={() => setTouched(true)}
              placeholder="예: 효린"
              placeholderTextColor="#A89A82"
              maxLength={12}
              accessibilityLabel="닉네임"
              className="h-[50px] rounded-md border-[1.5px] border-primary bg-card px-4 text-base text-foreground"
            />
            <Text
              className={`text-xs font-medium ${
                errorMsg ? 'text-destructive' : 'text-muted-foreground'
              }`}
            >
              {errorMsg ?? '2~12자 · 한글, 영문, 숫자 사용 가능'}
            </Text>
          </View>
        </View>

        <View className="px-6 pt-4" style={{ paddingBottom: insets.bottom + 24 }}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="시작하기"
            accessibilityState={{ disabled: saving || !!validateNickname(nickname) }}
            onPress={() => void handleSave()}
            disabled={saving || !!validateNickname(nickname)}
            activeOpacity={0.85}
            style={{
              height: 54,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FF7A2E',
              opacity: saving || validateNickname(nickname) ? 0.45 : 1,
            }}
          >
            <Text className="text-sm font-medium text-primary-foreground">
              {saving ? '저장 중...' : '시작하기'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
