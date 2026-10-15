/**
 * iOS 27 SDK로 빌드한 앱은 UIScene 생명주기를 쓰지 않으면 iOS 27에서 실행 즉시 종료된다
 * ("UIScene life cycle is required for apps built with this SDK", SIGTRAP).
 *
 * Expo 57.0.29부터 `ExpoAppSceneDelegate`가 들어왔지만 prebuild 템플릿은 아직 옛 방식이라
 * 앱이 직접 켜야 한다. `ios/`는 prebuild가 매번 새로 만드므로 손으로 고치지 않고 여기서 넣는다.
 *
 * 1. Info.plist에 scene 매니페스트 — 창을 만드는 일을 `EXExpoAppSceneDelegate`에 맡긴다.
 * 2. AppDelegate는 `ExpoReactNativeFactoryProvider`를 채택하고 창을 직접 만들지 않는다.
 *    factory는 그대로 만들어 두고, scene delegate가 그 factory로 React Native를 띄운다.
 *
 * Expo 템플릿이 scene을 기본으로 갖추면 이 플러그인은 지운다.
 */
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins')

const SCENE_DELEGATE_CLASS = 'EXExpoAppSceneDelegate'

function withSceneManifest(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: SCENE_DELEGATE_CLASS,
          },
        ],
      },
    }
    return cfg
  })
}

function withSceneAppDelegate(config) {
  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error('with-scene-lifecycle: Swift AppDelegate만 지원한다')
    }
    let src = cfg.modResults.contents

    const classDecl = 'class AppDelegate: ExpoAppDelegate {'
    if (src.includes(classDecl)) {
      src = src.replace(
        classDecl,
        'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {',
      )
    } else if (!src.includes('ExpoReactNativeFactoryProvider')) {
      throw new Error('with-scene-lifecycle: AppDelegate 선언을 찾지 못했다 — 템플릿이 바뀌었는지 확인')
    }

    // 창 생성 + startReactNative 블록 제거. scene delegate가 같은 일을 scene 위에서 한다.
    const startBlock =
      /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/
    if (startBlock.test(src)) {
      src = src.replace(startBlock, '\n')
    } else if (src.includes('factory.startReactNative(')) {
      throw new Error('with-scene-lifecycle: startReactNative 블록 형태가 바뀌었다 — 정규식 확인')
    }

    cfg.modResults.contents = src
    return cfg
  })
}

module.exports = function withSceneLifecycle(config) {
  return withSceneAppDelegate(withSceneManifest(config))
}
