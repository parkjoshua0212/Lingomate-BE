import { successResponse, errorResponse } from '../utils/response.js';

export default () => {
  const controller = {};

  // 3.1 Subscription Options — GET /api/subscription/options
  // For now we hard-code the plans to match the v2.1 API spec.
  controller.getOptions = (req, res) => {
    res.json(
      successResponse({
        basic: {
          callMinutes: 10,
          scriptLimit: 3,
          price: 0,
        },
        premium: {
          callMinutes: '∞',
          scriptLimit: '∞',
          price: 12900,
        },
      })
    );
  };

  // 3.2 Subscribe — POST /api/subscription/subscribe
  // Spec: { plan: "basic" | "premium" }
  // For backwards compatibility we also accept purchaseToken/productId,
  // but the simple LingoMate spec uses only `plan`.
  controller.subscribe = async (req, res) => {
    const { plan, purchaseToken, productId } = req.body || {};

    if (!plan && (!purchaseToken || !productId)) {
      return res
        .status(400)
        .json(
          errorResponse(
            'BAD_REQ',
            'Provide `plan` or `purchaseToken` + `productId`',
            400
          )
        );
    }

    // In a real app you would:
    // 1. Verify the purchase with Google/Apple if using IAP.
    // 2. Persist the subscription to the database for the current user.
    // For now we just mock a successful activation that matches the spec.
    const startedAt = new Date();

    res.json(
      successResponse({
        plan: plan || productId,
        startedAt,
      })
    );
  };

  // 3.3 Cancel Subscription — POST /api/subscription/cancel
  controller.cancel = (req, res) => {
    const canceledAt = new Date();
    // Real implementation would update DB, notify billing provider, etc.
    res.json(
      successResponse({
        canceledAt,
      })
    );
  };

  return controller;
};
