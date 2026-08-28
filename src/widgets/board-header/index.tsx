import { Text, View } from 'react-native'
import { Image } from 'expo-image'
import Ionicons from '@expo/vector-icons/Ionicons'
import { PressableScale } from '@/shared/ui/press'

type Props = {
  /** 크게 보여줄 날짜 라벨 (`오늘`·`그저께`·`8월 21일 (금)`) */
  dateLabelText: string
  /** 주 라벨을 보완하는 캡션. `오늘`처럼 더 붙일 말이 없으면 null */
  dateCaption: string | null
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
 *
 * 뒤로가기 화살표와 날짜 알약 사이는 넉넉히 벌렸다. 둘은 결과가 전혀 다른 버튼인데
 * (화면을 떠나기 / 하루 거슬러 가기) 8px 간격으로 붙어 있어 오타가 잦았다.
 */
export function BoardHeader({
  dateLabelText,
  dateCaption,
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
      <View className="flex-row items-center">
        <PressableScale
          onPress={onBack}
          hapticKind={null}
          accessibilityRole="button"
          accessibilityLabel="그룹 목록으로"
          hitSlop={6}
          className="size-9 items-center justify-center rounded-full bg-white/10"
        >
          <Ionicons name="arrow-back" size={18} color="#fff" />
        </PressableScale>

        {/* 뒤로가기와 날짜 컨트롤을 가르는 여백. 눌러도 아무 일 없는 안전 지대다. */}
        <View className="w-5" />

        <View className="flex-row items-center rounded-full bg-white/10 p-1">
          <PressableScale
            onPress={onOlder}
            disabled={!canGoOlder}
            hapticKind={null}
            accessibilityRole="button"
            accessibilityLabel="이전 날짜"
            accessibilityState={{ disabled: !canGoOlder }}
            style={{ opacity: canGoOlder ? 1 : 0.25 }}
            className="size-7 items-center justify-center rounded-full"
          >
            <Ionicons name="chevron-back" size={18} color="#fff" />
          </PressableScale>

          <PressableScale
            onPress={onDatePress}
            hapticKind={null}
            accessibilityRole="button"
            accessibilityLabel={`날짜 선택 (달력 열기). 현재 ${dateLabelText}${
              dateCaption ? `, ${dateCaption}` : ''
            }`}
            className="min-w-[92px] rounded-full px-2 py-0.5"
          >
            <Text className="text-center text-sm font-bold text-white">
              {dateLabelText}
            </Text>
            {dateCaption ? (
              <Text className="text-center text-[10px] font-semibold text-white/45">
                {dateCaption}
              </Text>
            ) : null}
          </PressableScale>

          <PressableScale
            onPress={onNewer}
            disabled={!canGoNewer}
            hapticKind={null}
            accessibilityRole="button"
            accessibilityLabel="다음 날짜"
            accessibilityState={{ disabled: !canGoNewer }}
            style={{ opacity: canGoNewer ? 1 : 0.25 }}
            className="size-7 items-center justify-center rounded-full"
          >
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </PressableScale>
        </View>
      </View>

      <PressableScale
        onPress={onProfile}
        hapticKind={null}
        accessibilityRole="button"
        accessibilityLabel="내 프로필"
        className="size-9 items-center justify-center overflow-hidden rounded-full bg-primary"
      >
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={{ width: 36, height: 36 }}
            contentFit="cover"
          />
        ) : (
          <Text className="text-sm font-bold text-primary-foreground">
            {avatarInitial}
          </Text>
        )}
      </PressableScale>
    </View>
  )
}
