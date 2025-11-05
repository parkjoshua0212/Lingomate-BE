// src/routes/auth.routes.js

import express from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const router = express.Router();
const prisma = new PrismaClient(); //##싱글톤패턴으로 수정?

//--- 테스트용: /auth/ (GET) ---
//나중에 Postman으로 http://localhost:3000/auth/ 쳐서 "여기는..." 메시지 뜨는지 확인용
router.get('/', (req, res) => {
  res.send('여기는 Auth 라우터입니다!');
});

// --- /auth/signup (POST)  --- 회원가입 API (POST /auth/signup)
router.post('/signup', async (req, res) => {
  // 요청이 잘 왔는지 터미널에 로그 찍기
  console.log('회원가입 요청 받음:', req.body); 

  try {
    // Postman이 보낸 email, name을 꺼냄
    const { email, name } = req.body; // Postman에서 email, name을 받기 ##Checking this part: prisma email, username field

    if (!email || !name) {
      return res.status(400).json({ message: 'Email과 Name은 필수입니다.' });
    }

    // Prisma를 사용해서 DB에 "user" 생성
    const newUser = await prisma.user.create({
      data: {  
        // User 모델에 있는 필드들만 정확히 넣어준다
        username: name, // Postman의 'name' 값을 DB의 'username' 필드에 넣음
        passwordHash: 'dummy-password-123', // User 모델의 'passwordHash' 필드 

        // role: 은 schema에서 @default(USER)가 처리
        // createdAt: 은 schema에서 @default(now())가 처리
      },
    });

    // 5. 성공 응답 보내기
    res.status(201).json({ message: '가짜 회원가입 성공!', user: newUser });

  } catch (error) {
    // 6. 실패 응답
    console.error('Prisma 에러:', error);
    res.status(500).json({ message: '서버 에러', error: error.message });
  }
});

// --- 로그인 API (POST /auth/login) ---
router.post('/login', async (req, res) => {
  // Postman에서 보낸 { "username": "...", "passwordHash": "..." } 받기
  console.log('로그인 요청 받음:', req.body);

  try {
    const { username, passwordHash } = req.body; //##prisma 해시값 말고 비밀번호로

    // 필수 값 검사
    if (!username || !passwordHash) {
      return res.status(400).json({ message: 'Username과 PasswordHash는 필수입니다.' });
    }

    // DB에서 유저 찾기 (username으로)
    const user = await prisma.user.findFirst({ //##findUnique 로 수정 @unique 주입하면
      where: {
        username: username,
      },
    });

    // 유저가 없거나, 가짜 비밀번호가 틀리면 에러
    // (!!나중에 진짜 암호화(bcrypt) 쓸 땐 이 로직 바꿔야 해!!)
    if (!user || user.passwordHash !== passwordHash) {
      return res.status(401).json({ message: '해당 유저를 찾을 수 없거나 비밀번호가 틀렸습니다.' });
    }

    // 4. 로그인 성공! "출입증(JWT)" 발급
    
    // !!주의: 이 비밀 키는 절대 코드에 박아두면 안 돼!
    // (나중에 팀원한테 'JWT_SECRET' 받아서 process.env.JWT_SECRET으로 바꿔야 해!)
    const JWT_SECRET = 'my-temp-secret-key-for-testing'; 

    const token = jwt.sign(
      { userId: user.id, role: user.role }, // 출입증에 담을 정보
      JWT_SECRET,                          // 비밀 키로 서명
      { expiresIn: '1h' }                 // 유효기간 (1시간)
    );

    // 5. 성공! (토큰을 클라이언트에게 전달)
    res.status(200).json({ 
      message: '로그인 성공!', 
      token: token, // <-- 발급된 출입증(토큰)
      user: {
        id: user.id,
        username: user.username,
      }
    });

  } catch (error) {
    // 6. 서버 에러
    console.error('로그인 에러:', error);
    res.status(500).json({ message: '서버 에러', error: error.message });
  }
});

// 이 파일을 다른 곳에서 수입할 수 있게 수출
export default router;