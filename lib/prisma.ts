import { PrismaClient } from '@prisma/client'

// Track connection count for unique naming in serverless
let connectionCount = 0

// Global singleton for development only
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Create a function to instantiate Prisma with proper configuration
function createPrismaClient() {
  const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NODE_ENV === 'production'
  
  let databaseUrl = process.env.DATABASE_URL || ''
  
  // In serverless environments, modify connection string to disable prepared statements
  if (isServerless) {
    connectionCount++
    const url = new URL(databaseUrl)
    url.searchParams.set('prepared_statements', 'false')
    url.searchParams.set('connection_limit', '1')
    url.searchParams.set('pool_timeout', '20')
    url.searchParams.set('connect_timeout', '60')
    databaseUrl = url.toString()
  }
  
  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl
      }
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
  })
}

// Function to create a fresh client for operations that need it
export function getFreshPrismaClient() {
  return createPrismaClient()
}

// Main function to get Prisma client
export function getPrisma() {
  const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NODE_ENV === 'production'
  
  if (isServerless) {
    // In serverless, always create fresh clients to avoid prepared statement conflicts
    return createPrismaClient()
  } else {
    // In development, use singleton
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = createPrismaClient()
    }
    return globalForPrisma.prisma
  }
}

// Function to safely execute database operations with fresh connections
export async function executePrismaOperation<T>(
  operation: (prisma: PrismaClient) => Promise<T>
): Promise<T> {
  const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NODE_ENV === 'production'
  
  if (isServerless) {
    // In serverless, use fresh client for each operation
    const freshClient = getFreshPrismaClient()
    try {
      const result = await operation(freshClient)
      await freshClient.$disconnect()
      return result
    } catch (error) {
      await freshClient.$disconnect()
      throw error
    }
  } else {
    // In development, use singleton with error recovery
    const prisma = getPrisma()
    
    try {
      return await operation(prisma)
    } catch (error) {
      console.error('Prisma operation error:', error)
      
      // If we get a prepared statement error, try to reset the connection
      if (error instanceof Error && error.message.includes('prepared statement')) {
        console.log('Resetting Prisma connection due to prepared statement error')
        
        try {
          await globalForPrisma.prisma?.$disconnect()
          globalForPrisma.prisma = undefined
          
          // Retry with new connection
          const newPrisma = getPrisma()
          return await operation(newPrisma)
        } catch (retryError) {
          console.error('Retry failed:', retryError)
          throw retryError
        }
      }
      
      throw error
    }
  }
}

// Export default instance for backwards compatibility
export const prisma = getPrisma()