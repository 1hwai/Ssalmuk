# 바둑 프로토타입 라이선스 및 출처 기록

이 문서는 `baduk/` 디렉터리에서 사용하는 코드와 모델의 출처 및 라이선스 조사 결과를 기록한다. **이 문서 자체가 제3자 코드에 새로운 사용 권한을 부여하지는 않는다.**

## 상업 배포 판단

현재 상태는 **상업 배포 승인 전**이다. 신경망 가중치의 사용 조건은 확인했지만, 원본 브라우저 앱의 핵심 JavaScript 파일에 명시적인 라이선스를 확인하지 못했다. 해당 코드의 라이선스 또는 저작권자의 허가를 확인하기 전에는 이를 복사해 배포하거나 상업 제품에 포함하지 않는다.

## 구성 요소별 기록

| 구성 요소 | 현재 사용 방식 / 식별 정보 | 라이선스 상태 | 조치 |
|---|---|---|---|
| KataGo g170 신경망 가중치 | 원본 프로젝트 README에 기재된 `kata1-b6c96-s175395328-d26788732` (Kyu), `kata1-b10c128-s1141046784-d204142634` (Dan) | KataGo 공식 네트워크 라이선스 페이지는 g170 실행의 네트워크를 CC0 1.0으로 명시 | 모델 출처를 기록하고, 배포에 포함할 실제 파일이 해당 네트워크에서 파생된 것인지 해시/출처로 확인 |
| Game of Go의 `js/goban.js` | 이전 버전에서 사용했으나 현재 자체 구현으로 대체 | 원본 저장소에서 명시적 LICENSE 파일을 확인하지 못함 | 외부 코드 의존성 제거 완료; 배포본에 포함하지 않음 |
| Game of Go의 `js/gui.js` | 이전 버전에서 사용했으나 현재 자체 UI/보드 렌더링으로 대체 | 원본 저장소에서 명시적 LICENSE 파일을 확인하지 못함 | 외부 코드 의존성 제거 완료; 배포본에 포함하지 않음 |
| TensorFlow.js 런타임 | `engine.html`에서 jsDelivr의 `@tensorflow/tfjs@4.22.0` 배포물을 불러옴 | upstream 프로젝트는 Apache-2.0 계열 라이선스. 현재 CDN 파일 자체의 해시·NOTICE는 별도 검증 필요 | 버전 고정 완료; 배포 시 LICENSE/NOTICE 고지 포함 여부 확인 |
| Ssalmuk의 자체 바둑 코드 | `baduk/game.js`, `baduk/engine.js`, `baduk/engine.html` | 저장소 루트에 별도 LICENSE 파일이 없어, 프로젝트 전체에 적용할 라이선스는 아직 명시되지 않음 | 프로젝트 소유자가 상업 배포용 라이선스 정책을 결정하고 루트에 명시 |

## 확인한 출처

- [KataGo Neural Network License](https://katagotraining.org/network_license/) — g170 네트워크는 CC0 1.0으로 설명되어 있다.
- [KataGo g170 network listing](https://katagotraining.org/networks/) — 모델 식별자와 원본 네트워크를 대조할 때 사용한다.
- [Game of Go / maksimKorzh/go](https://github.com/maksimKorzh/go) — 현재 참고·호출 중인 브라우저 바둑 앱. README에는 Kyu/Dan 모델 식별자가 기재되어 있지만, 저장소에서 별도 LICENSE 파일은 확인하지 못했다.
- [TensorFlow.js](https://github.com/tensorflow/tfjs) — 런타임의 upstream 라이선스 참고 자료. 현재 원격 번들의 정확한 버전을 확인한 것으로 간주하지 않는다.

## 배포 전 체크리스트

- [ ] 실제 Kyu/Dan 모델 JSON과 가중치 파일의 출처·체크섬·권리 상태를 확인한다. CC0 가중치 확인만으로 변환된 모델 그래프 파일의 권리까지 확정하지 않는다.
- [x] `goban.js`와 `gui.js`에 대한 런타임 의존성을 제거하고 자체 코드로 대체했다.
- [x] TensorFlow.js 버전을 `4.22.0`으로 고정했다.
- [ ] TensorFlow.js 배포물의 LICENSE/NOTICE 고지를 최종 배포물에 포함한다.
- [ ] Ssalmuk 자체 코드의 프로젝트 라이선스와 제3자 고지를 정한다.
- [ ] 원격 호스팅에 의존하지 않도록 배포할 파일을 자체 호스팅하는 방안을 검토한다.

이 문서는 현재 조사 시점의 기술적 기록이며 법률 자문이 아니다. 라이선스가 불명확한 항목은 상업적 사용이 허용된 것으로 추정하지 않는다.
