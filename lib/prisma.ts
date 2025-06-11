import { PrismaClient } from '@prisma/client'

// Store client instances to properly manage connections
const clientMap = new Map<string, PrismaClient>()

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

// Enhanced Prisma client for serverless with proper cleanup
export async function getPrismaWithCleanup() {
  const client = createPrismaClient()
  
  // Auto-disconnect after request
  const originalDisconnect = client.$disconnect.bind(client)
  client.$disconnect = async () => {
    try {
      await originalDisconnect()
    } catch (error) {
      console.warn('Prisma disconnect warning:', error)
    }
  }
  
  return client
}

// For serverless environments, create a new client for each request
// to avoid connection pooling issues
export function getPrisma() {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    // In production/serverless, create fresh client each time
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