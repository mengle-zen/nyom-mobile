import { Pressable, Text, View } from 'react-native'
import { Image } from 'expo-image'
import Ionicons from '@expo/vector-icons/Ionicons'

type Props = {
  dateLabelText: string
  /** 더 과거로 갈 수 있나(최대 13일) */
  canGoOlder: boolean
  /** 더 최근으로 갈 수 있나(오늘이면 false — 미래는 없다) */
  canGoNewer: boolean
  onOlder: () => void
  onNewer: () => void
  onDatePress: () => void
  onBack: () => void
  onProfile: () => void
  avatarInitial: string
  avatarUrl: string | null
}

/**
 * 보드 상단 앱바 — 그룹 목록으로 / `< 날짜 >` / 달력 / 내 프로필.
 *
 * 웹에 있던 4칸 슬롯 진행바는 여기서 없앴다. 위치만 보여주고 눌리지 않아
 * "하루가 4끼니"라는 사실을 전달하지 못했기 때문이다(docs/UX_FINDINGS.md B항).
 * 그 역할은 바로 아래 탭 가능한 끼니 칩(SlotChips)이 대신한다.
 */
export function BoardHeader({
  dateLabelText,
  canGoOlder,
  canGoNewer,
  onOlder,
  onNewer,
  onDatePress,
  onBack,
  onProfile,
  avatarInitial,
  avatarUrl,
}: Props) {
  return (
    <View className="flex-row items-center justify-between px-4 pb-1 pt-2">
      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="그룹 목록으로"
          hitSlop={6}
          className="size-9 items-center justify-center rounded-full bg-white/10 active:opacity-70"
        >
          <Ionicons name="arrow-back" size={18} color="#fff" />
        </Pressable>

        <View className="flex-row items-center rounded-full bg-white/10 p-1">
          <Pressable
            onPress={onOlder}
            disabled={!canGoOlder}
            accessibilityRole="button"
            accessibilityLabel="이전 날짜"
            accessibilityState={{ disabled: !canGoOlder }}
            className="size-7 items-center justify-center rounded-full active:opacity-60"
            style={{ opacity: canGoOlder ? 1 : 0.25 }}
          >
            <Ionicons name="chevron-back" size={18} color="#fff" />
          </Pressable>

          <Pressable
            onPress={onDatePress}
            accessibilityRole="button"
            accessibilityLabel={`날짜 선택 (달력 열기). 현재 ${dateLabelText}`}
            className="min-w-[76px] rounded-full px-2 py-0.5 active:opacity-70"
          >
            <Text className="text-center text-sm font-bold text-white">
              {dateLabelText}
            </Text>
          </Pressable>

          <Pressable
            onPress={onNewer}
            disabled={!canGoNewer}
            accessibilityRole="button"
            accessibilityLabel="다음 날짜"
            accessibilityState={{ disabled: !canGoNewer }}
            className="size-7 items-center justify-center rounded-full active:opacity-60"
            style={{ opacity: canGoNewer ? 1 : 0.25 }}
          >
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </Pressable>
        </View>
      </View>

      <Pressable
        onPress={onProfile}
        accessibilityRole="button"
        accessibilityLabel="내 프로필"
        className="size-9 items-center justify-center overflow-hidden rounded-full bg-primary active:opacity-80"
      >
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={{ width: 36, height: 36 }} contentFit="cover" />
        ) : (
          <Text className="text-sm font-bold text-primary-foreground">{avatarInitial}</Text>
        )}
      </Pressable>
    </View>
  )
}
