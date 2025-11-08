// src/server.js

import express from 'express';
// --- 1. '경비원' 라이브러리 '수입' ---
// (아까 npm install 한 녀석)
import { auth } from 'express-oauth2-jwt-bearer'; 

// --- 2. 라우터들도 '수입' ---
import authRoutes from './routes/auth.routes.js'; 
// (!!중요: 나중에 '채팅' API 만들면 그것도 수입해야 해)
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
  issuerBaseURL: `https://${auth0Domain}`, // '출입증' 발급자 (우리 Auth0 도메인)
  audience: auth0Audience,               // '출입증' 대상자 (우리 API ID)
});

// --- 5. 서버에 '미들웨어' 등록하기 ---
// (1) Postman이 보낸 JSON을 서버가 읽을 수 있게 함 (필수!)
app.use(express.json()); 

// (2) '/auth'로 시작하는 주소는 *경비원 검사 없이* 통과시킴
//     (왜? '출입증' 받으러 온 사람(로그인/회원가입)까지 막으면 안 되니까!)
app.use('/auth', authRoutes);

// (3) ★★★ 이게 핵심 ★★★
//     '/api'로 시작하는 *모든* 주소는,
//     무조건 '경비원(checkJwt)'이 '출입증'을 검사하게 만듦!
//     (나중에 채팅 API 같은 건 '/api/chat'으로 만들 거야)
// app.use('/api', checkJwt, chatRoutes); // <-- 나중에 이렇게 쓸 거야

// (4) 테스트용: 경비원이 잘 작동하는지 '보호된' 주소 만들어보기
app.get('/api/protected', checkJwt, (req, res) => {
  // checkJwt를 통과했다는 건, '출입증'이 유효하다는 뜻!
  // '출입증' 안에 숨겨진 유저 정보(auth0Sub)도 req.auth가 꺼내줌
  res.json({ 
    message: '축하합니다! "출입증"이 확인됐습니다!',
    authInfo: req.auth // <-- 여기 유저 정보(sub)가 들어있음
  });
});


// --- 6. 서버 실행 ---
app.listen(PORT, () => {
  console.log(`[V3] Auth0 경비원이 배치된 서버가 ${PORT}에서 실행 중입니다!`);
});