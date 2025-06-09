import { NextRequest } from 'next/server'

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

const store: RateLimitStore = {}

export function rateLimit(request: NextRequest, limit: number = 10, window: number = 60000) {
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown'
  const key = `${ip}:${request.nextUrl.pathname}`
  const now = Date.now()
  
  // Clean up expired entries
  const expired = Object.keys(store).filter(k => store[k].resetTime < now)
  expired.forEach(k => delete store[k])
  
  if (!store[key]) {
    store[key] = {
      count: 1,
      resetTime: now + window
    }
    return { success: true, remaining: limit - 1 }
  }
  
  if (store[key].resetTime < now) {
    store[key] = {
      count: 1,
      resetTime: now + window
    }
    return { success: true, remaining: limit - 1 }
  }
  
  if (store[key].count >= limit) {
    return { 
      success: false, 
      remaining: 0,
      resetTime: store[key].resetTime 
    }
  }
  
  store[key].count++
  return { 
    success: true, 
    remaining: limit - store[key].count 
  }
}

export function withRateLimit(
  handler: (request: NextRequest) => Promise<Response>,
  limit: number = 10,
  window: number = 60000
) {
  return async (request: NextRequest) => {
    const rateLimitResult = rateLimit(request, limit, window)
    
    if (!rateLimitResult.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded',
          resetTime: rateLimitResult.resetTime 
        }),
        { 
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.resetTime?.toString() || ''
          }
        }
      )
    }
    
    const response = await handler(request)
    
    // Add rate limit headers to successful responses
    response.headers.set('X-RateLimit-Limit', limit.toString())
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
    
    return response
  }
}