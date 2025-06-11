import { PrismaClient } from '@prisma/client'

// Create a function to instantiate Prisma with proper serverless configuration
function createPrismaClient() {
  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  })
}

// For serverless environments, create a new client for each request
// to avoid connection pooling issues
export function getPrisma() {
  if (process.env.NODE_ENV === 'production') {
    // In production (serverless), create fresh client each time
    return createPrismaClient()
  } else {
    // In development, use global singleton
    const globalForPrisma = globalThis as unknown as {
      prisma: PrismaClient | undefined
    }
    
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = createPrismaClient()
    }
    
    return globalForPrisma.prisma
  }
}

// Export default instance for backwards compatibility
export const prisma = getPrisma()