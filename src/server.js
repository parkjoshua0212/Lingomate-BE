// src/server.js

import express from 'express';
import authRoutes from './routes/auth.routes.js'; // <-라우터 수입

const app = express();
const PORT = process.env.PORT || 3000;

// Postman이 보낸 JSON을 서버가 읽을 수 있게 함
// 이거 없으면 authRoutes에서 req.body가 undefined가 됨
app.use(express.json()); 

// '/auth'로 시작하는 모든 요청을 authRoutes 파일로 보냄
app.use('/auth', authRoutes);

app.listen(PORT, () => {
  console.log(`Server has started on port ${PORT}`);
});