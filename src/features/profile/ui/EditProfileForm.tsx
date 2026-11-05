import { useState } from 'react'
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { toast } from 'sonner-native'
import { notifyError } from '@/shared/lib/error'
import { haptic } from '@/shared/ui/press'
import { changeMyAvatar, updateMyProfile } from '../api'
import { validateNickname } from '../nickname'

/**
 * 프로필 사진·닉네임 고치기 — 설정 화면 맨 위에 그대로 놓인다(2026-11-05 설정 시안 A).
 * 예전엔 프로필 화면의 연필 버튼이 띄우는 모달 카드 안에 있었다.
 *
 * 처음 값은 마운트할 때 한 번만 읽는다. 프로필을 불러온 뒤에 그린다(호출부).
 */
export function EditProfileForm({
  currentNickname,
  currentAvatarUrl,
  userId,
  onSaved,
}: {
  currentNickname: string
  currentAvatarUrl: string | null
  userId: string | undefined
  /** 저장이 끝난 뒤 — 프로필을 다시 받는다 */
  onSaved: () => void
}) {
  const [value, setValue] = useState(currentNickname)
  /** 아직 올리지 않은 아바타의 로컬 URI. 저장을 누를 때 올린다. */
  const [draftAvatar, setDraftAvatar] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const nicknameChanged = value.trim() !== currentNickname.trim()
  const changed = nicknameChanged || draftAvatar !== null
  const shownAvatar = draftAvatar ?? currentAvatarUrl

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
      setDraftAvatar(result.assets[0].uri)
    } catch (e) {
      notifyError(e, '사진을 불러오지 못했어요')
    }
  }

  const handleSave = async () => {
    if (!userId || saving || !changed) return
    const message = validateNickname(value)
    if (message) {
      setValidationError(message)
      return
    }
    try {
      setSaving(true)
      if (nicknameChanged) {
        await updateMyProfile(userId, { nickname: value.trim() })
      }
      // 아바타는 스토리지 업로드 + avatar_url 갱신 + 옛 파일 정리가 한 묶음이다.
      if (draftAvatar) {
        await changeMyAvatar(userId, draftAvatar)
      }
      void haptic('success')
      toast.success('프로필을 수정했어요')
      // 설정 화면에 그대로 머문다 — 다시 받은 프로필이 새 기준이 되도록 초안만 비운다.
      setDraftAvatar(null)
      onSaved()
    } catch (err) {
      notifyError(err, '프로필 수정에 실패했어요')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* 아바타 */}
      <View className="items-center">
        <View>
          <View className="size-20 items-center justify-center overflow-hidden rounded-full bg-primary-100">
            {shownAvatar ? (
              <Image
                source={{ uri: shownAvatar }}
                contentFit="cover"
                style={{ width: '100%', height: '100%' }}
                accessibilityLabel="프로필 사진"
              />
            ) : (
              <Ionicons name="person" size={32} color="#C24F0E" />
            )}
          </View>
          {/* NativeWind가 함수형 style을 버리므로 정적 style만 쓴다. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="프로필 사진 변경"
            disabled={saving}
            onPress={() => void handlePickAvatar()}
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 30,
              height: 30,
              borderRadius: 15,
              borderWidth: 3,
              borderColor: '#FFFCF8',
              backgroundColor: '#FF7A2E',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: saving ? 0.5 : 1,
            }}
          >
            <Ionicons name="camera" size={13} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <View className="gap-2">
        <TextInput
          value={value}
          onChangeText={(next) => {
            setValue(next)
            if (validationError) setValidationError(null)
          }}
          placeholder="닉네임"
          placeholderTextColor="#A89A82"
          accessibilityLabel="닉네임"
          maxLength={12}
          editable={!saving}
          className="h-field rounded-xl border border-border bg-background px-4 text-foreground"
        />
        {validationError && (
          <Text className="text-sm text-destructive">{validationError}</Text>
        )}
      </View>

      <View className="flex-row gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="저장"
          onPress={() => void handleSave()}
          disabled={saving || !value.trim() || !changed}
          className={`h-control flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-primary active:opacity-80 ${
            saving || !value.trim() || !changed ? 'opacity-40' : ''
          }`}
        >
          {saving && <ActivityIndicator color="#fff" size="small" />}
          <Text className="font-bold text-primary-foreground">저장</Text>
        </Pressable>
      </View>
    </>
  )
}
