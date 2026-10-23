# 바둑 한 판

오목과 분리된 브라우저 바둑 프로토타입이다.

## AI 엔진

AI는 [Game of Go](https://github.com/maksimKorzh/go)의 브라우저용 KataNet 구현을 사용한다. 이 프로젝트는 KataGo 계열 신경망의 정책 출력을 이용해 착수 후보를 고른다. TensorFlow.js 런타임과 신경망 모델은 원본 프로젝트의 호스팅 경로에서 불러온다.

- 초급·중급: Kyu 모델에서 상위 후보 중 선택
- 고급·특급: Dan 모델에서 상위 후보 중 선택
- 난이도에 따라 후보 선택 폭을 줄여 강도를 조절한다.
- 첫 AI 대국에는 인터넷 연결과 모델 다운로드가 필요하다.

이 구현은 전체 KataGo 엔진이나 MCTS 탐색을 포함하지 않는다. 따라서 전술적 실수가 남아 있으며, 난이도는 정식 단급을 보장하지 않는다.

## 실행

저장소 루트에서 `python3 -m http.server 8000`을 실행한 뒤 `http://localhost:8000/baduk/`으로 접속한다. `file://`로 직접 열면 브라우저가 iframe의 출처를 격리하므로 신경망 AI를 사용할 수 없다. AI 대전에서는 **돌 색상 → 난이도** 순서로 설정한 뒤 대국실에 입장한다. 2인 대전에서는 AI 설정을 숨긴다.

## 규칙 및 계가 범위

현재 게임은 착수 가능 여부, 포획, 자충수, 반복 국면 방지, 패스 및 간이 계가를 처리한다. 사활과 사석 판정은 자동화되어 있지 않다.

## 출처

- [Game of Go / KataNet browser implementation](https://github.com/maksimKorzh/go)
- [KataGo](https://github.com/lightvector/KataGo)
- [Original KataNet browser project and playable demo](https://github.com/maksimKorzh/kata-model-js)

엔진 코드는 별도 `engine.html` 브리지에서 불러오며, 오목 게임의 AI 구현과는 분리되어 있다.

## 라이선스와 상업 배포

라이선스 조사 결과와 배포 전 확인 사항은 [`LICENSE.md`](LICENSE.md)에 기록한다. g170 계열 신경망 가중치는 KataGo 공식 페이지에서 CC0 1.0으로 안내하지만, 원본 브라우저 앱의 `goban.js`와 `gui.js`는 명시적인 재사용 라이선스를 확인하지 못했다. 따라서 **모델 라이선스만으로 현재 AI 구현 전체가 상업 배포 가능한 것은 아니다.** 해당 코드의 허가를 확인하거나 상업적 사용이 허용된 코드로 교체하기 전까지는 상업 배포를 승인된 상태로 취급하지 않는다.
