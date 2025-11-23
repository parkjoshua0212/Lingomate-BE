import crypto from 'crypto';

export const successResponse = (data, message = "ok") => {
    return {
        success: true,
        data: data,
        message: message,
        meta: {
            requestId: crypto.randomUUID(),
            durationMs: 0 // Placeholder for middleware execution time
        }
    };
};

export const errorResponse = (code, message, status = 500) => {
    return {
        success: false,
        code: code,
        message: message,
        traceId: crypto.randomUUID()
    };
};