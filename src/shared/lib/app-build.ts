import { Platform } from 'react-native'
import Constants from 'expo-constants'

/** 설치된 바이너리의 빌드 번호. 네이티브 빌드 때 app.json 값으로 생성된 설정을 읽는다. */
export function installedBuild(): string | number | undefined {
  const config = Constants.expoConfig
  return Platform.OS === 'ios' ? config?.ios?.buildNumber : config?.android?.versionCode
}
