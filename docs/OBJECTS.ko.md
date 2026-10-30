# 스테이지 오브젝트 정의

## 개요

스테이지 초기화 함수가 반환하는 객체의 `objects` 배열에 게임 오브젝트를 정의합니다. 각 항목은 `type`과 오브젝트별 속성을 가진 일반 JavaScript 객체입니다. 별도 설명이 없는 위치 값은 캔버스 너비와 높이에 대한 0~1 정규화 좌표입니다.

## 맵 메이커 JSON 안내

맵 메이커의 **JSON** 탭에서는 스테이지와 같은 오브젝트 정의를 편집합니다. 최상위 맵 객체에는 버전, 이름, `objects` 배열이 들어갑니다.

```json
{
  "version": 1,
  "name": "첫 번째 맵",
  "objects": [
    { "type": "ball", "x": 0.25, "y": 0.3, "radius": 0.02 },
    { "type": "platform", "x": 0.5, "y": 0.7, "width": 0.3, "height": 0.04 },
    { "type": "star", "x": 0.8, "y": 0.35, "radius": 0.02 }
  ]
}
```

- `version`은 현재 `1`입니다.
- `name`은 맵 이름이며, `objects`는 오브젝트 정의 배열입니다.
- 좌표와 크기 값이 0~1이면 캔버스 기준 비율입니다. 오브젝트 크기가 1보다 크면 엔진은 픽셀 값으로 처리합니다.
- **JSON 적용**을 눌러 유효성을 검사하고 변경 사항을 적용합니다. 잘못된 JSON이나 필드는 현재 맵을 바꾸지 않고 오류를 표시합니다. 적용은 실행 취소할 수 있습니다.
- 입력 중 지원되는 `type`과 일반 필드를 추천합니다. `Tab` 또는 `Enter`로 추천 항목을 적용하고 방향키로 선택 항목을 바꿀 수 있습니다.
- **저장**은 맵을 계정에 보관합니다. **JSON 내보내기**는 다른 사람과 공유하거나 외부에서 편집할 수 있는 파일을 내려받습니다.

지원하는 유형은 `ball`, `circle`, `star`, `platform`, `stripedRect`, `portal`, `segment`, `poly`/`complex`, `rotor`, `text`입니다.

---

## 기본 오브젝트

### 공 (`ball`)

- `x`, `y`: 정규화된 위치
- `radius`: 정규화 크기 또는 1보다 큰 픽셀 값
- 기본 반지름: `0.02`

```js
{ type: "ball", x: 0.7, y: 0.3, radius: 0.02 }
```

### 원 (`circle`)

정적 또는 동적 물리 오브젝트입니다. 공과 달리 정적 오브젝트로 설정할 수 있습니다.

- `x`, `y`: 중심 위치. 기본값은 `0.5`, `0.5`입니다.
- `radius`: 정규화 반지름 또는 1보다 큰 픽셀 값. 기본값은 `0.025`입니다.
- `isStatic`: 정적 여부. 기본값은 `false`입니다.

```json
{ "type": "circle", "x": 0.5, "y": 0.55, "radius": 0.05, "isStatic": true }
```

### 별 (`star`)

획득해야 하는 목표 오브젝트입니다.

- `x`, `y`: 중심 위치. 기본값은 `0.5`, `0.5`입니다.
- `radius`: 정규화 반지름 또는 1보다 큰 픽셀 값. 기본값은 `0.02`입니다.

```json
{ "type": "star", "x": 0.8, "y": 0.3, "radius": 0.025 }
```

### 발판 (`platform`)

- `x`, `y`: 중심 위치
- `width`, `height`: 정규화 크기 또는 1보다 큰 픽셀 값
- 기본 크기: 너비 `0.1`, 높이 `0.05`

```js
{ type: "platform", x: 0.3, y: 0.65, width: 0.1, height: 0.05 }
```

### 줄무늬 위험 지대 (`stripedRect`)

빨간색 빗금 영역입니다. 단단한 발판이 아니라 그리기를 제한하는 시각 영역입니다.

- `x`, `y`: 중심 위치. 기본값은 `0.5`, `0.5`입니다.
- `width`, `height`: 정규화 크기 또는 픽셀 값. 기본값은 `0.12`, `0.08`입니다.

```json
{ "type": "stripedRect", "x": 0.5, "y": 0.5, "width": 0.08, "height": 0.7 }
```

### 포털 (`portal`)

같은 ID를 가진 포털끼리 연결됩니다.

- `x`, `y`: 중심 위치. 기본값은 `0.5`, `0.5`입니다.
- `width`, `height`: 정규화 크기 또는 픽셀 값. 기본값은 `0.02`, `0.1`입니다.
- `portalId`: 짝과 색상을 정하는 ID입니다. 기본 색상 ID는 `orange`, `blue`, `green`, `purple`입니다.
- 두 포털에 같은 ID를 지정하면 서로 연결됩니다.

```json
{
  "version": 1,
  "name": "포털 한 쌍",
  "objects": [
    { "type": "portal", "x": 0.25, "y": 0.5, "width": 0.025, "height": 0.12, "portalId": "orange" },
    { "type": "portal", "x": 0.75, "y": 0.5, "width": 0.025, "height": 0.12, "portalId": "orange" }
  ]
}
```

### 선분 (`segment`)

- `x1`, `y1`, `x2`, `y2`: 정규화된 양 끝점 좌표

```js
{ type: "segment", x1: 0.2, y1: 0.6, x2: 0.8, y2: 0.6 }
```

맵 메이커에서 첫 점에서 다음 점까지 드래그해 선분을 그립니다.

### 텍스트 (`text`)

- `x`, `y`: 정규화된 위치
- `text`: 표시할 문자열
- `fontSize`: 화면 높이 기준 비율 또는 1보다 큰 픽셀 값
- `color`, `fontFamily`: 선택 속성
- 기본값: 크기 `0.04`, 색상 `#4f3b24`, 글꼴 `MyeongjoFont, serif`

```js
{ type: "text", x: 0.7, y: 0.2, text: "안녕하세요", fontSize: 0.03, color: "#4f3b24" }
```

### 다각형·꺾은선 (`poly`, `complex`)

- `points`: 정규화 좌표 배열 `[{x:..., y:...}, ...]`
- `closed`: 마지막 점과 첫 점을 연결할지 여부
- `isStatic`: 정적 여부. 기본값은 `true`입니다.

```js
{
  type: "complex",
  closed: true,
  points: [{ x: 0.2, y: 0.6 }, { x: 0.5, y: 0.2 }, { x: 0.8, y: 0.6 }]
}
```

열린 도형은 `closed: false`로 설정합니다.

### 회전 발판 (`rotor`)

`rotor`는 축을 중심으로 회전하는 도형입니다.

- `points`: 사용자 정의 회전 발판의 정규화 좌표 배열
- `x`, `y`, `radius`: 원형 회전 발판의 중심과 반지름
- `pointCount`: 원을 근사하는 점의 개수. 기본값은 `24`입니다.
- `closed`: 도형을 닫을지 여부. 기본값은 `false`이며 `radius` 사용 시 자동으로 `true`가 됩니다.
- `axisX`, `axisY`: 회전축 위치. 기본값은 발판의 중심입니다.
- `spinMode`: `free` 또는 `auto`. 기본값은 `free`입니다.
- `motorSpeed`: 회전 속도. 양수와 음수로 방향을 정합니다.
- `maxMotorTorque`: 최대 모터 토크
- `isStatic`: 정적 여부. 기본값은 `false`입니다.

```js
{
  type: "rotor",
  points: [{ x: 0.3, y: 0.4 }, { x: 0.7, y: 0.4 }, { x: 0.75, y: 0.5 }],
  closed: true,
  axisX: 0.5,
  axisY: 0.5,
  spinMode: "auto",
  motorSpeed: -2,
  maxMotorTorque: 400
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
