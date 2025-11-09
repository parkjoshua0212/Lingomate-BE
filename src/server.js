// src/server.js
//To update EC2 server files with local files, use the following command in the terminal with path set to BackEnd directory:
// rsync -avz --exclude 'node_modules' --exclude '.git' --exclude '.env' \-e "ssh -i ~/.ssh/LingomateEC2key.pem" \. ubuntu@ec2-16-184-11-218.ap-northeast-2.compute.amazonaws.com:~/app

// 1. .env 파일 로더 (가장 먼저 실행)
import 'dotenv/config';

// 2. 모든 라이브러리 '수입'
import express from 'express';
import http from 'http'; // (웹소켓용)
import { WebSocketServer } from 'ws'; // (웹소켓용)
import { auth } from 'express-oauth2-jwt-bearer'; // (Auth0 경비원)
import bodyParser from 'body-parser'; // (JSON 파싱용)

import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';

// 3. 모든 라우터 '수입'
import authRoutes from './routes/auth.routes.js';
import convRoutes from './routes/convRoutes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// 4. .env 파일에서 Auth0 키 값 불러오기
const auth0Domain = process.env.AUTH0_DOMAIN;
const auth0Audience = process.env.AUDIENCE; // (팀원이 AUDIENCE로 썼을 수도 있으니 확인)
// 만약 AUDIENCE가 안되면 이걸로 다시 바꿔: const auth0Audience = process.env.AUTH0_AUDIENCE;


if (!auth0Domain || !auth0Audience) {
  throw new Error('AUTH0_DOMAIN 또는 AUTH0_AUDIENCE가 .env 파일에 없습니다!');
}

// 5. '경비원( 미들웨어)' 설정하기
const checkJwt = auth({
  issuerBaseURL: `https://${auth0Domain}`, // '출입증' 발급자
  audience: auth0Audience,               // '출입증' 대상자
});

// 6. 서버에 '미들웨어' 등록하기
app.use(express.json());
app.use(bodyParser.json());

// 7. REST API 라우터 등록
app.get("/", (req, res) => res.send("Hello from Docker!")); // Docker 테스트용
app.use('/auth', authRoutes); // Auth0 로그인/등록 (경비원 없음)

// '/api/conversations' 경로도 '출입증(checkJwt)'이 있어야만 접근하게 수정!
app.use('/api/conversations', checkJwt, convRoutes);

// (팀원이 추가한 Swagger 옵션)
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'LingoMate API 문서',
      version: '1.0.0',
      description: '백엔드 Auth 관련 API 명세서입니다.',
    },
    servers: [{ url: `http://localhost:${PORT}` }],
  },
  apis: ['./src/routes/*.js'], // routes 폴더의 모든 .js 파일을 읽어서 API 문서를 만듦
};

const specs = swaggerJSDoc(options);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs)); // Swagger UI 경로


// 테스트용: 경비원이 잘 작동하는지 '보호된' 주소
app.get('/api/protected', checkJwt, (req, res) => {
  res.json({
    message: '축하합니다! "출입증"이 확인됐습니다!',
    authInfo: req.auth // <-- 여기 유저 정보(sub)가 들어있음
  });
});


// --- 8. WebSocket 서버 설정 (HTTP 서버에 연결) ---

// (1) Express 앱으로 'http' 서버 생성
const server = http.createServer(app);

// (2) WebSocket 서버 생성 및 'http' 서버에 연결
const wss = new WebSocketServer({ server });

// (3) WebSocket 연결 처리 로직
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


// --- 9. 통합 서버 실행 ---
// (app.listen이 아닌 'server.listen'을 사용해야 함)
server.listen(PORT, () => {
  console.log(`[V4] HTTP 서버 및 WebSocket 서버가 ${PORT}에서 실행 중입니다!`);
  
  console.log("AUTH0_DOMAIN (for check):", process.env.AUTH0_DOMAIN);
  console.log(`Swagger Docs: http://localhost:${PORT}/api-docs`);
});