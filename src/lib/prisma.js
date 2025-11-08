// src/lib/prisma.js
// "Prisma 통역사"를 딱 한 번만 만들어서 보관하는 '보관함'

import { PrismaClient } from '@prisma/client';

// "통역사(prisma)"를 전역(global) 변수에 보관함
const globalForPrisma = globalThis;

// globalForPrisma에 prisma가 없으면, 새로 만들어서 넣고,
const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// 이 '보관함'에서 "통역사"를 꺼내갈 수 있게 '수출'
export default prisma;