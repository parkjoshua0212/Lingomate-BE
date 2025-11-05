# LingoMate API 명세서 (v1.0)

본 문서는 백엔드의 REST + WebSocket API 명세서이며, 사람이 읽는 요약/가이드입니다.

- Base URL
    - 개발:
    - 운영:
- Format
    - 요청: 'application/json'
    - 응답: 'application/json'
- Auth
    - 방식: Bearer JWT (Access/Refresh 권장)


## 0. 공통 정책

### 0.1 공통 응답 포맷

성공:
{ 
    "success": true, 
    "data": {}, 
    "message": "ok", 
    "meta": { "requestId": "a1b2c3", "durationMs": 123 } 
}

오류:
{
  "success": false,
  "code": "AUTH_001",
  "message": "잘못된 인증 토큰입니다.",
  "traceId": "a1b2c3"
}


### 0.2 상태 코드

200	성공
201	생성됨
204	본문 없는 성공
400	잘못된 요청(유효성 실패)
401	인증 실패
403	권한 없음
404	리소스 없음
409	충돌(중복 등)
422	처리 불가(스키마는 맞지만 도메인 제약 위반)
429	요청 과다(레이트리밋)
500	서버 오류

### 0.3 페이지네이션/정렬

쿼리: ?page=1&limit=20&sort=-createdAt
응답 meta:

{
  "meta": { "page": 1, "limit": 20, "total": 135 }
}

⸻

## 1. 사용자 인증 및 프로필 (Auth & Profile)

### 1.1 회원가입 — POST /api/auth/register

요청

{ "email":"user@example.com", "password":"Passw0rd!", "nickname":"JY" }

응답(201)

{ "success": true, "data": { "userId":"u_123", "email":"user@example.com" } }

오류 400(필드누락), 409(이미 존재)

### 1.2 로그인 — POST /api/auth/login

요청

{ "email":"user@example.com", "password":"Passw0rd!" }

응답(200)

{
  "success": true,
  "data": {
    "userId":"u_123",
    "accessToken":"<JWT>",
    "refreshToken":"<JWT>",
    "expiresIn":3600
  }
}

오류 401(자격증명 오류)

### 1.3 토큰 재발급 — POST /api/auth/refresh

요청 { "refreshToken":"<JWT>" }
응답 { "accessToken":"<JWT>", "expiresIn":3600 }

### 1.4 로그아웃 — POST /api/auth/logout

리프레시 토큰 블랙리스트 처리. 응답 204.

### 1.5 프로필 조회 — GET /api/user/profile (보호)

응답

{
  "success": true,
  "data": {
    "userId":"u_123","email":"user@example.com","nickname":"JY",
    "language":"en","level":"intermediate","avatarUrl":null
  }
}

### 1.6 프로필 수정 — PUT /api/user/profile (보호)

요청 { "nickname":"Jiyun", "language":"ja", "level":"beginner", "avatarUrl":null }
응답 200 수정된 프로필 반환

⸻

## 2. 대화 관리 (Conversation)

### 2.1 세션 생성 — POST /api/conversation/start (보호)

요청

{ "language":"en", "scenario":"restaurant", "level":"beginner" }

응답

{ "success": true, "data": { "sessionId":"s_abc123", "startTime":"2025-10-06T11:00:00Z" } }

### 2.2 메시지 전송 — POST /api/conversation/send (보호)

요청

{
  "sessionId":"s_abc123",
  "message":"How much is this?",
  "meta": { "source":"text", "locale":"en-US" }
}

응답

{
  "success": true,
  "data": {
    "user": { "text":"How much is this?" },
    "ai": { "text":"It costs three dollars.", "emotion":"smile" },
    "sttConfidence": null
  }
}

### 2.3 대화 내역 — GET /api/conversation/history (보호)

쿼리: ?sessionId=s_abc123&page=1&limit=20
응답 items[] + meta

### 2.4 대화 삭제 — DELETE /api/conversation/delete (보호)

바디: { "sessionId":"s_abc123" } 또는 { "all": true }

DB 필드 권장: id, session_id, user_id, role(user/ai), text, stt_conf, created_at

⸻

## 3. 포인트 / 마일리지 (Points)

### 3.1 포인트 추가 — POST /api/points/add (보호)

요청 { "points": 10, "reason":"daily_login" }
응답 { "balance": 120 }

### 3.2 포인트 차감 — POST /api/points/deduct (보호)

요청 { "points": 20, "reason":"premium_feature" }
응답 { "balance": 100 }

### 3.3 변동 내역 — GET /api/points/history (보호)

쿼리: ?page=1&limit=20
응답 items[] + meta

SQL 예시: user_points(user_id, delta, reason, balance_after, created_at)

⸻

## 4. AI & 음성 (AI / NLP / Speech)

### 4.1 응답 생성 — POST /api/ai/respond (보호)

요청 { "sessionId":"s_abc123", "message":"I goed to school." }
응답 { "ai": { "text":"I went to school." , "emotion":"neutral" } }

### 4.2 번역 — POST /api/ai/translate (보호)

요청 { "text":"안녕", "source":"ko", "target":"en" }
응답 { "text":"Hello" }

### 4.3 음성 변환 — POST /api/ai/voice (보호)

요청(택1)

{ "text":"Nice to meet you.", "voice":"female_1", "rate":1.0 }

또는 STT:

{ "audio":"<base64-wav>", "sampleRate":16000 }

응답 { "audio":"<base64-wav>", "mime":"audio/wav" } 또는 { "text":"recognized text", "sttConfidence":0.92 }

⸻

## 5. 아바타 / 3D (Avatar)

### 5.1 업로드 — POST /api/avatar/upload (보호)

multipart/form-data — file(glb/vrm 등)
응답 { "avatarId":"av_123", "modelUrl":"https://.../av_123.glb" }

### 5.2 설정 조회 — GET /api/avatar/config (보호)

응답 { "voice":"female_1", "style":"casual", "emoteMap":{ "smile":"anim_01" } }

### 5.3 설정 수정 — PUT /api/avatar/update (보호)

바디: { "voice":"male_2", "style":"formal" }

메타데이터 권장: model_url, voice_type, style, emote_map(json)

⸻

## 6. 알림 (Notifications)

### 6.1 목록 — GET /api/notifications (보호)

쿼리: ?page=1&limit=20
응답 items[] + meta

### 6.2 읽음 — PUT /api/notifications/read (보호)

바디: { "ids":["n_1","n_2"] } → 응답 204

⸻

## 7. 실시간(WebSocket) — /realtime
	•	URL: wss://api.lingomate.dev/realtime
	•	인증: 연결 직후 메시지 { "type":"auth", "token":"<JWT>", "sessionId":"s_abc123" }
	•	오디오: 16kHz PCM
