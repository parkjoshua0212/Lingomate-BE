import prisma from '../lib/prisma.js';

export default (wss) => {
    const controller = {};

    // 5. Mock Checkout (POST /api/payments/checkout)
    controller.createCheckoutSession = async (req, res) => {
        const { plan } = req.body; // e.g., "premium_monthly"
        
        // In real code: Call Stripe/PortOne API to get a paymentId
        res.status(200).json({ 
            paymentId: "pay_mock_12345", 
            url: "https://mock-payment-gateway.com/pay" 
        });
    };

    // Webhook: Receive success from Payment Gateway
    controller.handleWebhook = async (req, res) => {
        const { userId, status } = req.body; // Mock payload

        if (status === 'SUCCESS') {
            // Upgrade User
            await prisma.user.update({
                where: { id: parseInt(userId) },
                data: { role: 'PREMIUM' }
            });

            // Create Subscription Record
            await prisma.subscription.upsert({
                where: { userId: parseInt(userId) },
                update: { isActive: true, planName: 'Premium' },
                create: { userId: parseInt(userId), planName: 'Premium' }
            });

            res.status(200).json({ success: true });
        } else {
            res.status(400).json({ success: false });
        }
    };

    return controller;
};