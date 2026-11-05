# pixel-tavern

Claude Code 데스크톱 앱용 모드입니다. 프롬프트 위에 픽셀 배너를 그리고, 오른쪽에 "여관" 패널을 엽니다.

- 장면 4개: 비 오는 밤 다락방, 7080 다방, 8비트 던전, 네온 펑크 성
- 배너: 컨텍스트·5시간·주간 한도 게이지, 프로젝트·브랜치·모델
- 패널: 장면 고르기, 음악(24시간 인터넷 라디오, 음량 조절), 빠른 실행(리뷰·커밋·정리), 한도, 오늘 통계, 이 채팅에서 만진 파일
- 음악은 Windows 전용입니다. 숨김 PowerShell 재생기로 http 라디오 스트림을 틉니다. 방송은 외부 서비스라 끊기거나 주소가 바뀔 수 있습니다.

## 쓰는 법

1. 이 폴더의 절대경로를 환경변수 `CLAUDE_CODE_PLUGIN_DIRS`에 넣고 앱을 다시 시작합니다.
2. `/tavern`으로 패널을 엽니다.

## 개발

```
claude plugin validate .
claude plugin test .
python tools/gen_art.py   # 그림 원본(tools/scenes) -> hooks/art
```

`.claude-plugin/types/`는 엔진이 만드는 파일이라 저장소에 넣지 않았습니다. 라이선스는 아직 정하지 않았습니다.