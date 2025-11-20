// src/lib/gemini.js
// "Gemini 통역사"를 딱 한 번만 만들어서 보관하는 '보관함'

import { GoogleGenerativeAI } from '@google/generative-ai';

// .env 파일에서 키를 읽어옴 (server.js가 dotenv를 이미 실행했으므로 가능)
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error('GEMINI_API_KEY가 .env 파일에 없습니다!');
}

const genAI = new GoogleGenerativeAI(apiKey);

// 'gemini-pro' 모델을 사용하는 '통역사'
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// 이 '통역사(model)'를 꺼내갈 수 있게 '수출'
export default model;