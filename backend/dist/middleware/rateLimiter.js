"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimiterMiddleware = void 0;
const rate_limiter_flexible_1 = require("rate-limiter-flexible");
// Create rate limiter instance
const rateLimiter = new rate_limiter_flexible_1.RateLimiterMemory({
    keyPrefix: 'redteam_backend',
    points: 100, // Number of requests
    duration: 60, // Per 60 seconds
    blockDuration: 60, // Block for 60 seconds if limit exceeded
});
// Stricter rate limiting for assessment endpoints
const assessmentRateLimiter = new rate_limiter_flexible_1.RateLimiterMemory({
    keyPrefix: 'redteam_assessment',
    points: 5, // Only 5 assessments
    duration: 300, // Per 5 minutes
    blockDuration: 300, // Block for 5 minutes
});
const rateLimiterMiddleware = async (req, res, next) => {
    try {
        const key = req.ip || req.connection.remoteAddress || 'unknown';
        // Use stricter rate limiting for assessment endpoints
        const limiter = req.path.startsWith('/api/assessment/start')
            ? assessmentRateLimiter
            : rateLimiter;
        await limiter.consume(key);
        next();
    }
    catch (rejRes) {
        const remainingPoints = rejRes?.remainingPoints || 0;
        const msBeforeNext = rejRes?.msBeforeNext || 0;
        const totalHits = rejRes?.totalHits || 0;
        res.set({
            'Retry-After': Math.round(msBeforeNext / 1000) || 1,
            'X-RateLimit-Limit': rejRes?.totalLimit || 100,
            'X-RateLimit-Remaining': remainingPoints,
            'X-RateLimit-Reset': new Date(Date.now() + msBeforeNext).toISOString(),
        });
        res.status(429).json({
            success: false,
            message: 'Too many requests',
            details: {
                limit: rejRes?.totalLimit || 100,
                remaining: remainingPoints,
                resetTime: new Date(Date.now() + msBeforeNext).toISOString(),
                retryAfter: Math.round(msBeforeNext / 1000) || 1
            }
        });
    }
};
exports.rateLimiterMiddleware = rateLimiterMiddleware;
// Export as default for easy import
exports.default = exports.rateLimiterMiddleware;
//# sourceMappingURL=rateLimiter.js.map