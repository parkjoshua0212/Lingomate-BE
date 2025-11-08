// src/server.js

import express from 'express';
// --- (수정 1) 'http'와 'ws' 라이브러리 '수입' ---
import http from 'http';
import { WebSocketServer } from 'ws';

// --- 1. '경비원' 라이브러리 '수입' ---
import { auth } from 'express-oauth2-jwt-bearer'; 

// --- 2. 라우터들도 '수입' ---
import authRoutes from './routes/auth.routes.js'; 
// import chatRoutes from './routes/chat.routes.js'; 

const app = express();
const PORT = process.env.PORT || 3000;

// --- 3. '.env' 파일에서 Auth0 키 값들 불러오기 ---
const auth0Domain = process.env.AUTH0_DOMAIN;
const auth0Audience = process.env.AUTH0_AUDIENCE;

if (!auth0Domain || !auth0Audience) {
  throw new Error('AUTH0_DOMAIN 또는 AUTH0_AUDIENCE가 .env 파일에 없습니다!');
}

// --- 4. '경비원( 미들웨어)' 설정하기 ---
const checkJwt = auth({
  issuerBaseURL: `https://${auth0Domain}`, // '출입증' 발급자
  audience: auth0Audience,               // '출입증' 대상자
});

// --- 5. 서버에 '미들웨어' 등록하기 ---
app.use(express.json()); 
app.use('/auth', authRoutes);
// app.use('/api', checkJwt, chatRoutes); // <-- 나중에 이렇게 쓸 거야

app.get('/api/protected', checkJwt, (req, res) => {
  res.json({ 
    message: '축하합니다! "출입증"이 확인됐습니다!',
    authInfo: req.auth 
  });
});

// --- (수정 2) Express 앱으로 'http' 서버 생성 ---
// (app.listen() 대신 이 서버를 사용할 거야)
const server = http.createServer(app);

// --- (수정 3) WebSocket 서버 생성 및 'http' 서버에 연결 ---
const wss = new WebSocketServer({ server });

// --- (수정 4) WebSocket 연결 처리 로직 (기본) ---
// (제안서 의 "실시간 전송 구현"의 시작점)
wss.on('connection', (ws) => {
  console.log('[WebSocket] 클라이언트가 연결되었습니다.');

  // 클라이언트로부터 메시지를 받았을 때
  ws.on('message', (message) => {
    console.log(`[WebSocket] 메시지 수신: ${message}`);
    
    // (테스트용) 일단 받은 메시지를 그대로 다시 보냄 (Echo)
    ws.send(`서버가 받은 메시지: ${message}`); 
  });

  // 클라이언트 연결이 끊겼을 때
  ws.on('close', () => {
    console.log('[WebSocket] 클라이언트 연결이 끊겼습니다.');
  });

  // 에러 처리
  ws.on('error', (error) => {
    console.error('[WebSocket] 에러 발생:', error);
  });
});


// --- (수정 5) 'app.listen' 대신 'server.listen'으로 서버 실행 ---
server.listen(PORT, () => {
  console.log(`[V4] HTTP 서버 및 WebSocket 서버가 ${PORT}에서 실행 중입니다!`);
});