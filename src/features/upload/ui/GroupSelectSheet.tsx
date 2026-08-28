import {
  ActivityIndicator,
  Image as RNImage,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useGroupMembers, type Group } from '@/entities/group'

/** 그룹 한 줄 — 체크 + 이름 + 멤버 아바타 스택 */
function GroupRow({
  group,
  checked,
  disabled,
  onToggle,
}: {
  group: Group
  checked: boolean
  disabled: boolean
  onToggle: () => void
}) {
  const { data: members = [] } = useGroupMembers(group.id)
  const shown = members.slice(0, 3)
  const extra = members.length - shown.length

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={`${group.name} 그룹에 올리기`}
      onPress={onToggle}
      disabled={disabled}
      className={`mb-2 flex-row items-center gap-3 rounded-2xl px-3 py-3 active:opacity-80 ${
        checked ? 'bg-white/15' : 'bg-white/5'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <View
        className={`size-6 items-center justify-center rounded-full ${
          checked ? 'bg-primary' : 'border-[1.5px] border-white/40'
        }`}
      >
        {checked && <Ionicons name="checkmark" size={15} color="#fff" />}
      </View>

      <Text numberOfLines={1} className="flex-1 text-sm font-bold text-white">
        {group.name}
      </Text>

      <View className="flex-row">
        {shown.map((m, i) => (
          <View
            key={m.user_id}
            style={{ marginLeft: i === 0 ? 0 : -8 }}
            className="size-6 items-center justify-center overflow-hidden rounded-full border-[1.5px] border-neutral-900 bg-primary-100"
          >
            {m.avatar_url ? (
              <Image source={{ uri: m.avatar_url }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <Text className="text-[10px] font-bold text-primary-700">
                {m.nickname[0] ?? '?'}
              </Text>
            )}
          </View>
        ))}
        {extra > 0 && (
          <View
            style={{ marginLeft: -8 }}
            className="size-6 items-center justify-center rounded-full border-[1.5px] border-neutral-900 bg-white/20"
          >
            <Text className="text-[10px] font-bold text-white">+{extra}</Text>
          </View>
        )}
      </View>
    </Pressable>
  )
}

/** 2단계 — 보낼 그룹 다중 선택 + 전송 (풀스크린 오버레이) */
export function GroupSelectSheet({
  shotUri,
  summary,
  caption,
  groups,
  selected,
  uploading,
  onToggle,
  onBack,
  onSend,
}: {
  shotUri: string
  /** 상단 요약 (예: "점심 · 12:30") */
  summary: string
  /** 1단계에서 쓴 메모. 웹은 2단계에서 이걸 확인할 수 없었다(UX_FINDINGS F항). */
  caption: string
  groups: Group[]
  selected: Set<string>
  uploading: boolean
  onToggle: (id: string) => void
  onBack: () => void
  onSend: () => void
}) {
  const insets = useSafeAreaInsets()
  const count = selected.size
  const canSend = count > 0 && !uploading

  return (
    <View className="absolute inset-0 z-20 bg-neutral-900" style={{ paddingTop: insets.top }}>
      <View className="h-14 flex-row items-center gap-2 px-4">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          onPress={onBack}
          disabled={uploading}
          className={`size-9 items-center justify-center rounded-full bg-white/10 active:opacity-70 ${
            uploading ? 'opacity-50' : ''
          }`}
        >
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </Pressable>
        <Text className="text-sm font-medium text-white/80">{summary}</Text>
      </View>

      {/* 사진 미리보기 */}
      <View className="mx-4 mb-3 h-40 overflow-hidden rounded-2xl bg-neutral-800">
        {/*
          로컬 파일은 RN 기본 Image로 그린다 — expo-image는 Expo Go에서
          ImageManipulator 캐시 경로(file://…/Caches/…)를 조용히 못 읽었다.
          원격 signed URL(아바타)은 캐싱 이점이 있는 expo-image를 그대로 쓴다.
        */}
        <RNImage
          source={{ uri: shotUri }}
          resizeMode="cover"
          style={{ width: '100%', height: '100%' }}
          accessibilityLabel="올릴 사진"
        />
      </View>

      {/*
        1단계 메모 확인 — 웹은 2단계에서 메모가 사라져 무엇을 쓴 건지 볼 수 없었다.
        탭하면 1단계로 돌아가 고칠 수 있게 해 "확인 + 수정"을 한 동작으로 묶는다.
      */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          caption ? `메모: ${caption}. 눌러서 수정` : '메모 추가하기'
        }
        onPress={onBack}
        disabled={uploading}
        className="mx-4 mb-3 flex-row items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 active:opacity-70"
      >
        <Ionicons
          name="create-outline"
          size={14}
          color="rgba(255,255,255,0.5)"
        />
        <Text
          numberOfLines={1}
          className={`flex-1 text-xs ${caption ? 'text-white/80' : 'text-white/40'}`}
        >
          {caption || '메모 없음 — 눌러서 추가'}
        </Text>
      </Pressable>

      {/* 그룹 리스트 */}
      <ScrollView className="flex-1 px-4" contentContainerClassName="pb-2">
        <Text className="mb-2 px-1 text-xs font-medium text-white/50">보낼 그룹</Text>
        {groups.length === 0 ? (
          <Text className="px-1 py-6 text-center text-sm text-white/50">
            먼저 그룹을 만들어야 올릴 수 있어요
          </Text>
        ) : (
          groups.map((g) => (
            <GroupRow
              key={g.id}
              group={g}
              checked={selected.has(g.id)}
              disabled={uploading}
              onToggle={() => onToggle(g.id)}
            />
          ))
        )}
      </ScrollView>

      {/* 전송 */}
      <View className="px-4 pt-2" style={{ paddingBottom: insets.bottom + 16 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSend }}
          onPress={onSend}
          disabled={!canSend}
          className={`flex-row items-center justify-center gap-2 rounded-full bg-primary py-3.5 active:opacity-80 ${
            canSend ? '' : 'opacity-40'
          }`}
        >
          {uploading ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text className="text-sm font-bold text-primary-foreground">
                올리는 중…
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="arrow-up" size={18} color="#fff" />
              <Text className="text-sm font-bold text-primary-foreground">
                {count > 0 ? `${count}개 그룹에 올리기` : '그룹을 선택하세요'}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  )
}
