// src/routes/auth.routes.js

import express from 'express';
import prisma from '../lib/prisma.js'; // 싱글톤 prisma '수입'
import { auth } from 'express-oauth2-jwt-bearer';

const router = express.Router();

// --- '경비원' 설정 (라우트 파일 내에서) ---
const auth0Domain = process.env.AUTH0_DOMAIN;
const auth0Audience = process.env.AUTH0_AUDIENCE;

if (!auth0Domain || !auth0Audience) {
  throw new Error('AUTH0_DOMAIN 또는 AUTH0_AUDIENCE가 .env 파일에 없습니다!');
}

const checkJwt = auth({
  issuerBaseURL: `https://${auth0Domain}`,
  audience: auth0Audience,
});

// --- ★★★ 핵심 API ★★★ ---
// "Auth0 로그인 성공 후, 우리 DB에 유저 등록/확인" API
// (POST /auth/register-if-needed)
router.post('/register-if-needed', checkJwt, async (req, res) => {
  try {
    // 1. '경비원(checkJwt)'이 검증한 '출입증'에서 유저 ID(sub)를 꺼냄
    const auth0Sub = req.auth.payload.sub;
    if (!auth0Sub) {
      return res.status(400).json({ message: 'Auth0 sub(ID)가 없습니다.' });
    }

    // 2. Postman(프론트엔드)이 보낸 'username'을 꺼냄
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ message: 'username이 없습니다.' });
    }

    // 3. DB에서 "이 Auth0 ID를 가진 유저가 이미 있나?" 확인
    let user = await prisma.user.findUnique({
      where: {
        auth0Sub: auth0Sub,
      },
    });

    // 4. [시나리오 1: 이미 있는 유저 (재로그인)]
    if (user) {
      console.log('기존 유저 로그인:', user.username);
      return res.status(200).json({ message: '기존 유저 로그인 성공', user: user });
    }

    // 5. [시나리오 2: 새로 가입한 유저]
    //    DB에 없으면 -> "새 유저"로 생성!
    user = await prisma.user.create({
      data: {
        auth0Sub: auth0Sub,   // Auth0 ID 저장
        username: username, // Auth0 프로필의 'nickname' 저장
      },
    });

    console.log('신규 유저 생성:', user.username);
    res.status(201).json({ message: '신규 유저 생성 성공!', user: user });

  } catch (error) {
    console.error('DB 등록 에러:', error);
    res.status(500).json({ message: '서버 에러', error: error.message });
  }
});

// 이 파일을 다른 곳에서 '수입'할 수 있게 '수출'
export default router;