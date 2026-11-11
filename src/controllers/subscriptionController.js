// src/controllers/subscriptionController.js
import axios from 'axios';
import prisma from '../lib/prisma.js';
import { successResponse, errorResponse } from '../utils/response.js';

const IMP_KEY = process.env.IMP_KEY;
const IMP_SECRET = process.env.IMP_SECRET;

export default () => {
  const controller = {};

  // Subscription plans shown to the client
  controller.getOptions = (req, res) => {
    res.json(successResponse({
        basic: { callMinutes: 10, scriptLimit: 3, price: 0 },
        premium: { callMinutes: '∞', scriptLimit: '∞', price: 12900 },
    }));
  };

  // Verify a PortOne (iamport) payment, then upgrade the user to premium
  controller.subscribe = async (req, res) => {
    const { imp_uid } = req.body;
    const auth0Sub = req.auth?.payload?.sub;

    if (!auth0Sub) {
        return res.status(401).json(errorResponse('AUTH_ERR', '로그인 정보가 없습니다.', 401));
    }

    // Demo mode: without imp_uid, respond with success and skip verification
    if (!imp_uid) {
         return res.json(successResponse({ plan: 'premium', startedAt: new Date() }));
    }

    try {
      // (1) Get a PortOne access token
      const getToken = await axios.post('https://api.iamport.kr/users/getToken', {
        imp_key: IMP_KEY,
        imp_secret: IMP_SECRET,
      });

      const { access_token } = getToken.data.response;

      // (2) Look up the payment
      const getPaymentData = await axios.get(`https://api.iamport.kr/payments/${imp_uid}`, {
        headers: { Authorization: access_token }
      });

      const paymentData = getPaymentData.data.response;

      // (3) Verify amount (100 KRW test payment) and status
      if (paymentData.amount === 100 && paymentData.status === 'paid') {
        // Subscription expires 30 days from now
        const nextMonth = new Date();
        nextMonth.setDate(nextMonth.getDate() + 30);

        // Upgrade role + upsert subscription + record payment in one transaction
        await prisma.$transaction(async (tx) => {
            const user = await tx.user.findUnique({
                where: { auth0Sub: auth0Sub }
            });

            if (!user) throw new Error("DB에서 유저를 찾을 수 없습니다.");

            await tx.user.update({
                where: { id: user.id },
                data: { role: 'PREMIUM' }
            });

            await tx.subscription.upsert({
                where: { userId: user.id },
                update: {
                    planName: 'premium',
                    isActive: true,
                    expiresAt: nextMonth
                },
                create: {
                    userId: user.id,
                    planName: 'premium',
                    isActive: true,
                    expiresAt: nextMonth
                }
            });

            await tx.payment.create({
                data: {
                    userId: user.id,
                    amount: paymentData.amount,
                    currency: paymentData.currency,
                    status: paymentData.status,
                    platform: 'PORTONE_KAKAO',
                    purchaseToken: imp_uid,
                    orderId: paymentData.merchant_uid,
                    productId: 'premium_monthly_test'
                }
            });
        });

        return res.json(successResponse({
            status: "success",
            plan: "premium",
            startedAt: new Date(),
            message: "프리미엄 구독이 적용되었습니다."
        }));

      } else {
        return res.status(400).json(errorResponse('PAYMENT_ERR', '검증 실패', 400));
      }

    } catch (error) {
      console.error("[Subscription] payment processing error:", error);
      return res.status(500).json(errorResponse('SERVER_ERR', '서버 에러 발생', 500));
    }
  };

  controller.cancel = (req, res) => {
    res.json(successResponse({ canceledAt: new Date() }));
  };

  return controller;
};
