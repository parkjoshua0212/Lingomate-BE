import { successResponse, errorResponse } from '../utils/response.js';

export default () => {
    const controller = {};

    // 3.1 Subscription Options — GET /api/subscription/options
    // Returns the available subscription plans and their details
    controller.getOptions = (req, res) => {
        // In a real app, these prices/plans might be fetched from the database
        res.json(successResponse({
            basic: { 
                callMinutes: 10, 
                scriptLimit: 3, 
                price: 0 
            },
            premium: { 
                callMinutes: "∞", 
                scriptLimit: "∞", 
                price: 12900 
            }
        }));
    };

    // 3.2 Subscribe (Verify Google Play Purchase) — POST /api/subscription/subscribe
    // Verifies the purchase token from Google Play and activates the subscription
    controller.subscribe = async (req, res) => {
        const { purchaseToken, productId } = req.body;
        
        // Note: Since Google Play Verification requires a Service Account Key and setup,
        // we are mocking the success response here for development.
        // To implement real verification, you would import 'googleapis' and use the androidpublisher API.
        
        if (!purchaseToken || !productId) {
             return res.status(400).json(errorResponse("BAD_REQ", "Missing purchaseToken or productId", 400));
        }

        // --- Real Logic Placeholder ---
        // 1. const auth = new google.auth.GoogleAuth({ ... });
        // 2. const service = google.androidpublisher({ version: 'v3', auth });
        // 3. const purchase = await service.purchases.subscriptions.get({ ... });
        // 4. if (purchase.paymentState === 1) { ... update DB ... }

        // Mock Response
        res.json(successResponse({ 
            plan: "premium", 
            startedAt: new Date() 
        }));
    };

    // 3.3 Cancel Subscription — POST /api/subscription/cancel
    // Handles cancellation of the subscription
    controller.cancel = (req, res) => {
        // In a real app, you might update the DB status to 'canceled' or 'expired'
        // and potentially notify Google Play via API if needed (though usually users cancel via Play Store)
        
        res.json(successResponse({ 
            canceledAt: new Date() 
        }));
    };

    return controller;
};