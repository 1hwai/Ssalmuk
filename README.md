# 오목 한 판

로그인이나 서버 없이 브라우저에서 바로 플레이하는 가벼운 오목 게임.

## 현재 기능
- 15 × 15 오목판
- 혼자 두기: 간단한 공격·방어 점수 기반 AI
- 둘이 두기: 같은 기기에서 번갈아 플레이
- 승리 판정, 마지막 착수 표시, 새 게임, 한 수 무르기
- 모바일 화면 대응
- 게임 실행 시 별도 패키지 설치 불필요 (배포용 난독화 빌드는 npm 사용)

## 실행
오목은 `index.html`을 브라우저에서 직접 열어도 된다. 바둑 AI는 iframe 출처 보안 때문에 로컬 HTTP 서버에서 실행해야 한다. 저장소 루트에서 `python3 -m http.server 8000`을 실행한 뒤 `http://localhost:8000/` 또는 `http://localhost:8000/baduk/`으로 접속한다. 패키지 설치나 빌드는 필요 없다.

## Cloudflare Pages 배포
Cloudflare Pages 프로젝트 설정에서 다음과 같이 지정한다.

- **Framework preset:** None
- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Root directory:** 저장소 루트

빌드 과정은 원본 HTML/CSS/JS를 `dist/`로 복사하고, 직접 작성한 JavaScript 세 파일(`game.js`, `baduk/game.js`, `baduk/engine.js`)만 `javascript-obfuscator`로 난독화한다. 원본 파일은 수정하지 않으며 `dist/`와 `node_modules/`는 Git에 커밋하지 않는다. GitHub에 push하면 Pages가 의존성을 설치하고 배포용 파일을 새로 생성한다.

난독화는 코드 분석을 어렵게 할 뿐 암호화나 완전한 복제 방지는 아니다. 외부 라이브러리인 TensorFlow.js는 CDN에서 그대로 로드한다.

현재 버전은 정적 프런트엔드 프로토타입이다. 광고 코드는 아직 없고, 광고 수익이나 검색 유입은 보장되지 않는다. 공개 전에 실제 기기에서 게임 동작과 모바일 화면을 확인할 것.


## 바둑 한 판

오목과 별도로 관리하는 바둑 프로토타입은 [baduk/](./baduk/)에 있다.

- 9 × 9, 13 × 13, 19 × 19 판
- AI 대전 및 같은 기기에서 2인 대전
- 대국 시작 전 흑돌/백돌 선택
- 돌 따내기, 자충수 금지, 반복 국면 방지, 패스, 간이 계가

실행하려면 `baduk/index.html`을 브라우저에서 열면 된다. AI는 브라우저 안에서 실행되는 돌담 자체의 JavaScript 휴리스틱 엔진을 사용하므로 외부 모델 다운로드나 TensorFlow.js CDN이 필요하지 않다. 이는 프로토타입 수준의 AI이며 KataGo와 같은 전문 엔진의 강도를 제공하지 않는다. 계가는 영역과 돌을 단순 계산하며 사활·사석·빅(세키)을 자동 판정하지 않는다.
