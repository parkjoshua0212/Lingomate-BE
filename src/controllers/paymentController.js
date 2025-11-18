import prisma from '../lib/prisma.js';
import { google } from 'googleapis';

export default (wss) => {
    const controller = {};

    // --- GOOGLE PLAY CONFIGURATION ---
    // 1. You must download the Service Account JSON Key from Google Cloud Console
    // 2. Place it in your backend root folder as 'service-account.json'
    // 3. Add ANDROID_PACKAGE_NAME to your .env file (e.g. com.lingomate.app)
    const SERVICE_ACCOUNT_KEY_FILE = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || './service-account.json';
    const PACKAGE_NAME = process.env.ANDROID_PACKAGE_NAME || 'com.lingomate.app';

    // Authenticate with Google
    const auth = new google.auth.GoogleAuth({
        keyFile: SERVICE_ACCOUNT_KEY_FILE,
        scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });

    const androidPublisher = google.androidpublisher({
        version: 'v3',
        auth: auth,
    });

    /**
     * VERIFY GOOGLE PLAY PURCHASE
     * Endpoint: POST /api/payments/verify-google
     * Called by: Mobile App (React Native/Android) after a successful purchase.
     */
    controller.verifyGooglePurchase = async (req, res) => {
        // The frontend sends us the receipt details
        const { userId, purchaseToken, productId, orderId } = req.body;

        if (!userId || !purchaseToken || !productId) {
            return res.status(400).json({ error: "Missing required fields (userId, purchaseToken, productId)" });
        }

        try {
            console.log(`[Payment] Verifying purchase for User ${userId}...`);

            // Step A: Ask Google Servers if this token is valid
            const response = await androidPublisher.purchases.subscriptions.get({
                packageName: PACKAGE_NAME,
                subscriptionId: productId,
                token: purchaseToken,
            });

            const purchaseData = response.data;

            // Step B: Check if the subscription is active
            // paymentState = 1 means "Payment Received"
            // expiryTimeMillis checks if it hasn't expired yet
            const isValid = purchaseData.paymentState === 1 || parseInt(purchaseData.expiryTimeMillis) > Date.now();

            if (isValid) {
                // Step C: Success! Record everything in our Database
                
                // 1. Record the Payment Transaction
                await prisma.payment.create({
                    data: {
                        userId: parseInt(userId),
                        amount: 12900, // You might want to fetch the real price based on productId
                        currency: 'KRW',
                        status: 'SUCCESS',
                        platform: 'GOOGLE_PLAY',
                        purchaseToken: purchaseToken,
                        orderId: orderId || purchaseData.orderId,
                        productId: productId
                    }
                });

                // 2. Update User Role to PREMIUM
                await prisma.user.update({
                    where: { id: parseInt(userId) },
                    data: { role: 'PREMIUM' }
                });

                // 3. Update or Create Subscription Record
                const expiryDate = new Date(parseInt(purchaseData.expiryTimeMillis));
                
                await prisma.subscription.upsert({
                    where: { userId: parseInt(userId) },
                    update: { 
                        isActive: true, 
                        planName: 'Premium',
                        expiresAt: expiryDate
                    },
                    create: { 
                        userId: parseInt(userId), 
                        planName: 'Premium',
                        expiresAt: expiryDate
                    }
                });

                console.log(`[Payment] Success! User ${userId} is now Premium.`);
                return res.status(200).json({ 
                    success: true, 
                    message: "Subscription Verified", 
                    expiryDate: expiryDate 
                });

            } else {
                console.warn(`[Payment] Invalid/Expired token for User ${userId}`);
                return res.status(400).json({ 
                    success: false, 
                    error: "Purchase invalid or expired",
                    details: purchaseData
                });
            }

        } catch (err) {
            console.error("Google Verify Error:", err.message);
            res.status(500).json({ error: "Verification failed", details: err.message });
        }
    };

    return controller;
};