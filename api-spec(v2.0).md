# LingoMate API 명세서 (v2.0)

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

### 1.0 Auth0 사용 원칙
	•	회원가입, 로그인, 비밀번호 변경, 계정 삭제는 모두 Auth0에서 처리
	•	백엔드는 JWT 검증 + 유저 DB 관리 + 구독/설정/통계만 담당
	•	JWT의 sub 필드를 auth0Id로 사용

### 1.1 내 인증 정보 조회 — GET /api/auth/me (보호)

현재 토큰 기준 Auth0 계정 + 내부 유저 매핑 정보 조회.

응답(200)

{
  "success": true,
  "data": {
    "auth0Id": "auth0|abc123",
    "userId": "u_123",
    "email": "user@example.com",
    "name": "JY",
    "subscription": "premium"
  }
}

### 1.2 프로필 조회 — GET /api/user/profile (보호)

응답(200)

{
  "success": true,
  "data": {
    "userId": "u_123",
    "email": "user@example.com",
    "name": "JY",
    "avatarUrl": null,
    "subscription": "premium",

    "country": "us",       // us / uk / aus
    "style": "casual",     // casual / formal
    "gender": "female",    // male / female
    "streak": 12
  }
}

### 1.3 프로필 수정 — PUT /api/user/profile (보호)

요청 

{
  "name": "Jiyun",
  "avatarUrl": null,
  "country": "uk",
  "style": "formal",
  "gender": "female"
}

응답 (200)

{
  "success": true,
  "data": {
    "userId": "u_123",
    "name": "Jiyun",
    "avatarUrl": null,
    "country": "uk",
    "style": "formal",
    "gender": "female"
  }
}

⸻

## 2. 대화 관리 (Conversation)

### 2.1 세션 생성 — POST /api/conversation/start (보호)

{ "success": true, 
  "data": { 
    "sessionId": "s_abc123", 
    "startTime": "2025-10-06T11:00:00Z" 
  } 
}

### 2.2 메시지 전송 — POST /api/conversation/send (보호)

요청

{
  "sessionId":"s_abc123",
  "message":"How much is this?",
}

응답

{
  "success": true,
  "data": {
    "user": { "text":"How much is this?" },
    "ai": { "text":"It costs three dollars." },
    "sttConfidence": null
  }
}

### 2.3 대화 내역 — GET /api/conversation/history (보호)

{
  "success": true,
  "data": [
    {
      "sessionId": "s_abc123",
      "title": "In the public places",
      "messageCount": 13,
      "createdAt": "2025-11-19T09:00:00Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1 }
}

### 2.4 특정 대화 조회 — GET /api/conversation/:sessionId (보호)

{
  "success": true,
  "data": {
    "sessionId": "s_abc123",
    "title": "In the public places",
    "messages": [
      {
        "id": "m_1",
        "from": "user",
        "text": "Hello",
        "createdAt": "2025-11-18T09:01:00Z"
      },
      {
        "id": "m_2",
        "from": "ai",
        "text": "Hi there!",
        "createdAt": "2025-11-18T09:01:01Z"
      }
    ]
  }
}

### 2.5 대화 삭제 — DELETE /api/conversation/delete (보호)

바디: { "sessionId":"s_abc123" } 또는 { "all": true }

DB 필드 권장: id, session_id, user_id, role(user/ai), text, stt_conf, created_at

⸻

## 3. 구독

### 3.1 구독 옵션 조회 - GET /api/subscription/options

응답 (200)

{
  "success": true,
  "data": {
    "basic": { "callMinutes": 10, "scriptLimit": 3, "price": 0 },
    "premium": { "callMinutes": "∞", "scriptLimit": "∞", "price": 12900 }
  }
}

### 3.2 구독 시작/변경 — POST /api/subscription/subscribe (보호)

요청 

{ "plan": "premium" }

응답 (200)

{
  "success": true,
  "data": {
    "plan": "premium",
    "startedAt": "2025-11-19T12:00:00Z"
  }
}

### 3.3 구독 취소 — POST /api/subscription/cancel (보호)

{
  "success": true,
  "data": {
    "canceledAt": "2025-11-19T12:00:00Z"
  }
}

⸻

## 4. AI & 음성 (AI / NLP / Speech)

### 4.1 텍스트 기반 AI 응답

#### 4.1.1 텍스트 메시지 -> AI 응답 생성 - POST /api/ai/chat (보호)

요청 

{
  "sessionId": "s_abc123",
  "text": "Hello, can you help me practice English?"
}

응답 
{
  "success": true,
  "data": {
    "user": { "text": "Hello, can you help me practice English?" },
    "ai": {
      "text": "Of course! What would you like to practice today?"
    }
  }
}

### 4.2 음성 기반 실시간 응답 (WebSocket)

#### 4.2.1 클라이언트 -> 서버 (음성 업로드)

{
  "type": "audio",
  "audio": "<base64 PCM 16kHz>"
}

#### 4.2.2 서버 -> 클라이언트 (STT 결과)

{
  "type": "stt_result",
  "text": "How much is this?",
  "confidence": 0.92
}

#### 4.2.3 서버 -> 클라이언트 (AI 텍스트 응답)

{
  "type": "ai_text",
  "text": "It costs three dollars."
}

#### 4.2.4 서버 -> 클라이언트 (AI 음성 응답)

{
  "type": "ai_audio",
  "audio": "<base64 wav>",
  "mime": "audio/wav"
}

### 4.3 문장 교정 (Grammar Correction) - POST /api/ai/correct

요청
{
  "text": "I goed to school yesterday."
}

응답
{
  "success": true,
  "data": {
    "corrected": "I went to school yesterday.",
    "explanation": "The past tense of 'go' is 'went', not 'goed'."
  }
}

### 4.4 표현 학습 (Phrases / Sentence Expansion)

#### 4.4.1 표현 설명 및 파생 문장 - POST /api/ai/explain
{
  "sentence": "Way to go."
}

응답
{
  "success": true,
  "data": {
    "meaning": "Great job. Used to praise someone.",
    "variations": [
      "Nice job!",
      "Great work!",
      "Good going!"
    ]
  }
}

### 4.5 표현 모음 - GET /api/phrases
[
  { "id": 1, "en": "Way to go.", "kr": "잘했어" },
  { "id": 2, "en": "Time flies.", "kr": "시간 빠르다" }
]

⸻

## 5. 회화 설정 (Conversation Settings)

### 5.1 설정 조회 — GET /api/conversation/settings (보호)

응답 (200) 

{
  "success": true,
  "data": {
    "country": "us",      // us / uk / aus
    "style": "casual",    // casual / formal
    "gender": "female"    // male / female
  }
}
 
### 설정 변경 — PUT /api/conversation/settings (보호)

요청 

{
  "country": "uk",
  "style": "formal",
  "gender": "male"
}

응답 (200)

{
  "success": true,
  "data": {
    "country": "uk",
    "style": "formal",
    "gender": "male"
  }
}

⸻

## 6. 학습 통계 (Stats)

### 6.1 통계 조회 — GET /api/stats (보호)

응답 (200)

{
  "success": true,
  "data": {
    "totalSessions": 127,
    "totalMinutes": 1260,
    "avgScore": 83,
    "bestScore": 97,
    "streak": 15,
    "newWordsLearned": 53,
    "progress": [1,1,1,0,0,0,0,0,0]
  }
}

⸻

## 7. 스크립트(암기 문장) — Phrases

### 7.1 기본 문장 조회 — GET /api/phrases

[
  { "id": 1, "en": "Way to go.", "kr": "잘했어" },
  { "id": 2, "en": "Time flies.", "kr": "시간 빠르다" }
]

⸻

## 8. 푸시 알림 — Notifications

### 8.1 알림 설정 조회 — GET /api/notifications/settings

{ "success": true, "data": { "enabled": true } }

### 8.2 알림 설정 변경 — PUT /api/notifications/settings

{ "enabled": false }

⸻

## 9. 실시간(WebSocket) — /realtime
	•	URL: wss://api.lingomate.dev/realtime
	•	인증: 연결 직후 메시지 { "type":"auth", "token":"<JWT>", "sessionId":"s_abc123" }
	•	오디오: 16kHz PCM
