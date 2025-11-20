// src/server.js

// 1. .env 파일 로더
import 'dotenv/config';

// 2. 라이브러리 수입
import express from 'express';
import http from 'http'; 
import { WebSocketServer } from 'ws'; 
import { auth } from 'express-oauth2-jwt-bearer'; 
import bodyParser from 'body-parser'; 
import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';

// 3. 라우터 및 서비스 수입 (★ 충돌 해결: 둘 다 남김 ★)
import authRoutes from './routes/auth.routes.js';
import convRoutes from './routes/convRoutes.js';
import model from './lib/gemini.js'; // (너의 Gemini)
import apiRoutes from './routes/apiRoutes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// 4. Auth0 설정
const auth0Domain = process.env.AUTH0_DOMAIN;
const auth0Audience = process.env.AUTH0_AUDIENCE; 

if (!auth0Domain || !auth0Audience) {
  throw new Error('AUTH0_DOMAIN 또는 AUTH0_AUDIENCE가 .env 파일에 없습니다!');
}

// 5. 경비원 설정
const checkJwt = auth({
  issuerBaseURL: `https://${auth0Domain}`, 
  audience: auth0Audience,               
});

// 6. 미들웨어 설정
app.use(express.json());
app.use(bodyParser.json());

// 7. 라우터 등록
app.get("/", (req, res) => res.send("Hello from Docker!")); 
app.use('/auth', authRoutes); 
app.use('/api/conversations', checkJwt, convRoutes);

// (조원이 추가한 apiRoutes도 등록해줘야 함 - 보통 /api 경로를 씀)
// 만약 조원이 아래쪽에 app.use 코드를 안 짰다면 이 줄이 필요해:
app.use('/api', apiRoutes); 

// Swagger 설정
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
  apis: ['./src/routes/*.js'], 
};
const specs = swaggerJSDoc(options);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs)); 

// 보호된 라우트 테스트
app.get('/api/protected', checkJwt, (req, res) => {
  res.json({
    message: '축하합니다! "출입증"이 확인됐습니다!',
    authInfo: req.auth 
  });
});


// --- 8. WebSocket 서버 설정 ---
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('[WebSocket] 클라이언트가 연결되었습니다.');

  ws.on('message', async (message) => {
    try {
      const userPrompt = message.toString();
      console.log(`[WebSocket] 메시지 수신: ${userPrompt}`);
      
      // --- Gemini API 호출 ---
      const result = await model.generateContent(userPrompt);
      const response = result.response;
      const aiText = response.text();
      // ---------------------

      console.log(`[Gemini] 응답: ${aiText}`);
      ws.send(aiText); 
      
    } catch (error) {
      console.error('[Gemini] 에러:', error);
      ws.send('AI 응답 생성에 실패했습니다.');
    }
  });

  ws.on('close', () => {
    console.log('[WebSocket] 클라이언트 연결이 끊겼습니다.');
  });

  ws.on('error', (error) => {
    console.error('[WebSocket] 에러 발생:', error);
  });
});


// --- 9. 서버 실행 ---
server.listen(PORT, () => {
  console.log(`[V5] HTTP + WebSocket + Gemini 서버가 ${PORT}에서 실행 중입니다!`);
  console.log("AUTH0_DOMAIN (for check):", process.env.AUTH0_DOMAIN);
  console.log(`Swagger Docs: http://localhost:${PORT}/api-docs`);
});