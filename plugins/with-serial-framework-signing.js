const fs = require('fs')
const path = require('path')
const { withDangerousMod } = require('expo/config-plugins')

const MARKER = 'nyom:serial-framework-signing'

// Expo는 `COCOAPODS_PARALLEL_CODE_SIGN=true`로 xcodebuild를 돌린다. 그러면 CocoaPods가
// 생성한 `Pods-app-frameworks.sh`가 프레임워크 서명을 `&`로 백그라운드에 던진다:
//
//   code_sign_cmd="$code_sign_cmd &"
//
// 이때 codesign들이 키체인 개인 키 접근에서 경합하면 `errSecInternalComponent`로 실패하는데,
// 백그라운드 프로세스라 종료 코드가 회수되지 않는다. 결과적으로 **빌드는 성공으로 끝나고**
// 서명 없는 프레임워크가 그대로 패키징되며, 설치 단계에 가서야 기기가 거부한다:
//
//   Failed to verify code signature of .../hermesvm.framework
//   : 0xe800801c (No code signature found.)  →  ApplicationVerificationFailed
//
// 경합은 간헐적이라 어떤 빌드는 멀쩡하고 어떤 빌드는 9개가 통째로 빠진다.
//
// 이 훅은 생성된 스크립트에서 병렬 서명만 끈다. 스크립트 상단에 `set -e`가 있으므로
// 직렬로 돌리면 codesign 실패가 곧바로 빌드 실패가 된다 — 조용히 넘어가는 경로가 없어진다.
//
// 별도의 재서명 빌드 페이즈로도 해결할 수 있지만, 그 방식은 페이즈가 반드시
// `[CP] Embed Pods Frameworks` 뒤에 있어야 하는데 CocoaPods가 post_install 이후에도
// 자기 임베드 페이즈를 뒤로 재배치해서 순서를 보장할 수 없다. 이 방식은 순서와 무관하다.
const RUBY_HOOK = `
    # >>> ${MARKER}
    Dir.glob(File.join(installer.sandbox.root, 'Target Support Files', '**', '*-frameworks.sh')).each do |script_path|
      contents = File.read(script_path)
      patched = contents.sub(
        /^COCOAPODS_PARALLEL_CODE_SIGN=.*$/,
        'COCOAPODS_PARALLEL_CODE_SIGN="false" # ${MARKER}: codesign 실패가 빌드를 실패시키도록 직렬화'
      )
      next if patched == contents

      File.write(script_path, patched)
      Pod::UI.puts "[${MARKER}] serialized code signing in #{File.basename(script_path)}"
    end
    # <<< ${MARKER}
`

/**
 * Podfile의 post_install 블록에 훅을 주입해, CocoaPods가 생성한 프레임워크 임베드
 * 스크립트에서 병렬 코드 서명을 끈다.
 *
 * prebuild가 ios/를 재생성해도 플러그인이 다시 적용되므로 설정이 유실되지 않는다.
 */
module.exports = function withSerialFrameworkSigning(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile')
      const podfile = fs.readFileSync(podfilePath, 'utf8')

      if (podfile.includes(MARKER)) {
        return config
      }

      const anchor = 'post_install do |installer|'
      if (!podfile.includes(anchor)) {
        throw new Error(
          `[${MARKER}] Podfile에 "${anchor}" 블록이 없어 훅을 넣지 못했습니다. ` +
            'Expo 템플릿이 바뀌었는지 확인하세요.'
        )
      }

      fs.writeFileSync(podfilePath, podfile.replace(anchor, anchor + RUBY_HOOK), 'utf8')
      return config
    },
  ])
}
