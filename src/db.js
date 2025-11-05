// src/db.js
//prisma 사용시 필요없음
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config(); // .env 불러오기

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
});

// 접속 테스트
try {
  await connection.connect();
  console.log('✅ MySQL 연결 성공');
} catch (err) {
  console.error('❌ MySQL 연결 실패:', err);
}


export default connection;

//result
//[dotenv@17.2.3] injecting env (5) from .env -- tip: ⚙️  specify custom .env file path with { path: '/custom/path/.env' }
//✅ MySQL 연결 성공
//mysql datebase : lingomate

//.env
//DB_HOST=***REMOVED_DB_HOST***
//DB_USER=admin
//DB_PORT=3306
//DB_PASSWORD=***REMOVED_DB_PASSWORD***
//DB_NAME=lingomate
//PORT=3000

//DATABASE_URL="mysql://admin:***REMOVED_DB_PASSWORD***@***REMOVED_DB_HOST***/lingomate"