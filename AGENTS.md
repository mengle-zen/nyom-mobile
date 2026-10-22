# 공통 에이전트 지침

작업 전에 [.agents/project.md](.agents/project.md)를 읽고 적용한다. Codex와 Claude는 같은 지침을 사용한다.

PR을 생성하거나 설명을 작성할 때는 [.agents/skills/pr-create/SKILL.md](.agents/skills/pr-create/SKILL.md)를 읽고 적용한다.

공통 지침은 `.agents/`에서 관리한다. 공통 스킬을 추가할 때는 `.agents/skills/`를 원본으로 두고 `.claude/skills`를 `../.agents/skills`를 가리키는 심볼릭 링크로 연결한다. `.claude/settings.json` 같은 도구별 설정은 별도로 유지한다.
