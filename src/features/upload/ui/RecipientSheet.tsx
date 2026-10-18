import { Pressable, ScrollView, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useGroupMembers, type Group } from '@/entities/group'
import { haptic } from '@/shared/ui/press'
import { DarkSheet } from './DarkSheet'

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
      onPress={() => {
        void haptic('select')
        onToggle()
      }}
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

/**
 * 받는 곳(그룹) 고르기 — 보내기 버튼 위 「받는 곳」 이름을 누르면 열리는 시트.
 *
 * 예전엔 「다음」 뒤의 별도 화면이었다. 기본값(들고 온 그룹 → 마지막으로 보낸 그룹)이
 * 대부분 맞으므로 바꿀 때만 열게 했다. 체크는 바로 반영되고 「완료」는 닫기만 한다.
 */
export function RecipientSheet({
  open,
  groups,
  selected,
  onToggle,
  onClose,
}: {
  open: boolean
  groups: Group[]
  selected: Set<string>
  onToggle: (id: string) => void
  onClose: () => void
}) {
  return (
    <DarkSheet open={open} title="어디에 올릴까요?" onClose={onClose}>
      <ScrollView style={{ maxHeight: 360 }} contentContainerClassName="pb-1">
        {groups.length === 0 ? (
          <Text className="py-6 text-center text-sm text-white/50">
            먼저 그룹을 만들어야 올릴 수 있어요
          </Text>
        ) : (
          groups.map((g) => (
            <GroupRow
              key={g.id}
              group={g}
              checked={selected.has(g.id)}
              disabled={false}
              onToggle={() => onToggle(g.id)}
            />
          ))
        )}
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        onPress={onClose}
        className="h-control items-center justify-center rounded-full bg-white/15 active:opacity-70"
      >
        <Text className="font-bold text-white">완료</Text>
      </Pressable>
    </DarkSheet>
  )
}
