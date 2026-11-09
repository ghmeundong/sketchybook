# 스테이지 오브젝트 정의

## 개요

스테이지 초기화 함수가 반환하는 객체의 `objects` 배열에 게임 오브젝트를 정의합니다. 각 항목은 `type`과 오브젝트별 속성을 가진 일반 JavaScript 객체입니다. 별도 설명이 없는 위치 값은 캔버스 너비와 높이에 대한 0~1 정규화 좌표입니다.

## 맵 메이커 JSON 안내

맵 메이커의 **JSON** 탭에서는 스테이지와 같은 오브젝트 정의를 편집합니다. 최상위 맵 객체에는 버전, 이름, 난이도, `objects` 배열이 들어갑니다.

```json
{
  "version": 1,
  "name": "첫 번째 맵",
  "difficulty": "normal",
  "objects": [
    { "type": "ball", "x": 0.25, "y": 0.3, "radius": 0.02 },
    { "type": "platform", "x": 0.5, "y": 0.7, "width": 0.3, "height": 0.04 },
    { "type": "star", "x": 0.8, "y": 0.35, "radius": 0.02 }
  ]
}
```

- `version`은 현재 `1`입니다.
- `name`은 맵 이름입니다. `difficulty`는 `easy`, `normal`, `hard`, `insane` 중 하나이며, 생략하면 `easy`입니다. `objects`는 오브젝트 정의 배열입니다.
- 난이도에 따라 게임 규칙과 오브젝트의 선택 속성인 `levels` 필터가 적용됩니다. 저장하거나 공유해도 설정한 난이도가 유지됩니다.
- 좌표와 크기 값이 0~1이면 캔버스 기준 비율입니다. 오브젝트 크기가 1보다 크면 엔진은 픽셀 값으로 처리합니다.
- JSON 편집기는 입력 중 유효성을 검사하고 올바른 변경 사항을 자동 적용합니다. 잘못된 JSON이나 필드는 현재 맵을 바꾸지 않고 오류를 표시합니다. 입력은 64 KiB로 제한되며, 유효한 변경은 실행 취소할 수 있습니다.
- 입력 중 지원되는 `type`과 일반 필드를 추천합니다. `Tab` 또는 `Enter`로 추천 항목을 적용하고 방향키로 선택 항목을 바꿀 수 있습니다.
- **저장**은 로그인해야 사용할 수 있으며, 맵을 계정에 보관합니다. 저장하려면 공과 별이 각각 하나 이상 있어야 합니다. **JSON 내보내기**는 로그인 없이도 공유하거나 외부에서 편집할 파일을 내려받습니다.

지원하는 유형은 `ball`, `circle`, `star`, `platform`, `stripedRect`, `portal`, `segment`, `poly`/`complex`, `rotor`, `text`입니다. 각 유형의 속성과 예시는 아래 설명을 참고하세요.

---

## 기본 오브젝트

### `ball` (공)

- `x`, `y`: 정규화된 위치
- `radius`: 정규화 크기 또는 1보다 큰 픽셀 값
- 기본 반지름: `0.02`

```json
{ "type": "ball", "x": 0.7, "y": 0.3, "radius": 0.02 }
```

### `circle` (원)

정적 또는 동적 물리 오브젝트입니다. 공과 달리 정적 오브젝트로 설정할 수 있습니다.

- `x`, `y`: 중심 위치. 기본값은 `0.5`, `0.5`입니다.
- `radius`: 정규화 반지름 또는 1보다 큰 픽셀 값. 기본값은 `0.025`입니다.
- `isStatic`: 정적 여부. 기본값은 `false`입니다.

```json
{ "type": "circle", "x": 0.5, "y": 0.55, "radius": 0.05, "isStatic": true }
```

### `star` (별)

획득해야 하는 목표 오브젝트입니다.

- `x`, `y`: 중심 위치. 기본값은 `0.5`, `0.5`입니다.
- `radius`: 정규화 반지름 또는 1보다 큰 픽셀 값. 기본값은 `0.02`입니다.

```json
{ "type": "star", "x": 0.8, "y": 0.3, "radius": 0.025 }
```

### `platform` (발판)

- `x`, `y`: 중심 위치
- `width`, `height`: 정규화 크기 또는 1보다 큰 픽셀 값
- 기본 크기: 너비 `0.1`, 높이 `0.05`

```json
{ "type": "platform", "x": 0.3, "y": 0.65, "width": 0.1, "height": 0.05 }
```

### `stripedRect` (줄무늬 위험 지대)

빨간색 빗금 영역입니다. 단단한 발판이 아니라 그리기를 제한하는 시각 영역입니다.

- `x`, `y`: 중심 위치. 기본값은 `0.5`, `0.5`입니다.
- `width`, `height`: 정규화 크기 또는 픽셀 값. 기본값은 `0.12`, `0.08`입니다.

```json
{ "type": "stripedRect", "x": 0.5, "y": 0.5, "width": 0.08, "height": 0.7 }
```

### `portal` (포털)

포털은 색상 ID에 따라 두 쌍으로 연결됩니다: `orange`-`blue`, `green`-`purple`.

- `x`, `y`: 중심 위치. 기본값은 `0.5`, `0.5`입니다.
- `width`, `height`: 정규화 크기 또는 픽셀 값. 기본값은 `0.02`, `0.1`입니다.
- `portalId`: 포털의 색상과 연결할 짝을 정하는 ID입니다. 기본 ID는 `orange`, `blue`, `green`, `purple`이며, 각각 `orange`-`blue`, `green`-`purple`로 연결됩니다.
- 맵 에디터에서는 포털을 최대 두 쌍까지 추가할 수 있습니다.

```json
{
  "version": 1,
  "name": "포털 두 쌍",
  "objects": [
    { "type": "portal", "x": 0.25, "y": 0.5, "width": 0.025, "height": 0.12, "portalId": "orange" },
    { "type": "portal", "x": 0.75, "y": 0.5, "width": 0.025, "height": 0.12, "portalId": "blue" },
    { "type": "portal", "x": 0.25, "y": 0.75, "width": 0.025, "height": 0.12, "portalId": "green" },
    { "type": "portal", "x": 0.75, "y": 0.75, "width": 0.025, "height": 0.12, "portalId": "purple" }
  ]
}
```

### `segment` (선분)

- `x1`, `y1`, `x2`, `y2`: 정규화된 양 끝점 좌표

```json
{ "type": "segment", "x1": 0.2, "y1": 0.6, "x2": 0.8, "y2": 0.6 }
```

맵 메이커에서 첫 점에서 다음 점까지 드래그해 선분을 그립니다.

### `text` (텍스트)

- `x`, `y`: 정규화된 위치
- `text`: 표시할 문자열
- `fontSize`: 화면 높이 기준 비율 또는 1보다 큰 픽셀 값
- `color`, `fontFamily`: 선택 속성
- 기본값: 크기 `0.04`, 색상 `#4f3b24`, 글꼴 `MyeongjoFont, serif`

```json
{ "type": "text", "x": 0.7, "y": 0.2, "text": "안녕하세요", "fontSize": 0.03, "color": "#4f3b24", "fontFamily": "ryuryufont, myeongjofont, serif" }
```

### `poly` / `complex` (다각형·꺾은선)

- `type`: `"poly"` 또는 `"complex"`
- `points`: 정규화 좌표 배열 `[{x:..., y:...}, ...]`
- `closed`: `true`이면 마지막 점과 첫 점을 연결해 채워진 다각형을 만듭니다. `false`이면 열린 꺾은선입니다.
- `isStatic`: 정적 여부. 기본값은 `true`입니다.

```json
{
  "type": "poly",
  "closed": true,
  "points": [
    { "x": 0.2, "y": 0.6 },
    { "x": 0.5, "y": 0.2 },
    { "x": 0.8, "y": 0.6 }
  ]
}
```

`complex`는 `poly`와 같은 도형을 만드는 별칭입니다.

```json
{
  "type": "complex",
  "closed": true,
  "points": [
    { "x": 0.2, "y": 0.6 },
    { "x": 0.5, "y": 0.2 },
    { "x": 0.8, "y": 0.6 }
  ]
}
```

열린 꺾은선 예시:

```json
{
  "type": "poly",
  "closed": false,
  "isStatic": true,
  "points": [
    { "x": 0.15, "y": 0.7 },
    { "x": 0.35, "y": 0.5 },
    { "x": 0.55, "y": 0.55 },
    { "x": 0.75, "y": 0.4 }
  ]
}
```

### `rotor` (회전 발판)

`rotor`는 축을 중심으로 회전하는 도형입니다.

- `points`: 사용자 정의 회전 발판의 정규화 좌표 배열
- `x`, `y`, `radius`: 원형 회전 발판의 중심과 반지름
- `pointCount`: 원을 근사하는 점의 개수. 기본값은 `24`입니다.
- `closed`: 도형을 닫을지 여부. 기본값은 `true`이며 열린 도형은 `false`로 설정합니다.
- `axisX`, `axisY`: 회전축 위치. 기본값은 발판의 중심입니다.
- `spinMode`: `free` 또는 `auto`. 기본값은 `free`입니다.
- `motorSpeed`: 회전 속도. 양수와 음수로 방향을 정합니다.
- `maxMotorTorque`: 최대 모터 토크
- `isStatic`: 정적 여부. 기본값은 `false`입니다.

```json
{
  "type": "rotor",
  "points": [{ "x": 0.3, "y": 0.4 }, { "x": 0.7, "y": 0.4 }, { "x": 0.75, "y": 0.5 }],
  "closed": true,
  "axisX": 0.5,
  "axisY": 0.5,
  "spinMode": "auto",
  "motorSpeed": -2,
  "maxMotorTorque": 400
}
```

## 기본값 요약

크기나 스타일 속성을 생략하면 엔진이 다음 값을 사용합니다.

- `ball.radius`: `0.02`
- `star.radius`: `0.02`
- `platform.width`: `0.1`
- `platform.height`: `0.05`
- `text.fontSize`: `0.04`
- `text.color`: `#4f3b24`
- `circle.radius`: `0.025`
- `portal.width`: `0.02`
- `portal.height`: `0.1`
- `stripedRect.width`: `0.12`
- `stripedRect.height`: `0.08`
