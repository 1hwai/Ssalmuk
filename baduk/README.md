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

`index.html`을 브라우저에서 연다. AI 대전에서는 **돌 색상 → 난이도** 순서로 설정한 뒤 대국실에 입장한다. 2인 대전에서는 AI 설정을 숨긴다.

## 규칙 및 계가 범위

현재 게임은 착수 가능 여부, 포획, 자충수, 반복 국면 방지, 패스 및 간이 계가를 처리한다. 사활과 사석 판정은 자동화되어 있지 않다.

## 출처

- [Game of Go / KataNet browser implementation](https://github.com/maksimKorzh/go)
- [KataGo](https://github.com/lightvector/KataGo)
- [Original KataNet browser project and playable demo](https://github.com/maksimKorzh/kata-model-js)

엔진 코드는 별도 `engine.html` 브리지에서 불러오며, 오목 게임의 AI 구현과는 분리되어 있다.
