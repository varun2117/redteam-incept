import { PrismaClient } from '@prisma/client'

// Global singleton for development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Create a function to instantiate Prisma with proper configuration
function createPrismaClient() {
  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
  })
}

// Main function to get Prisma client
export function getPrisma() {
  // Always use singleton approach to avoid prepared statement conflicts
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient()
  }
  
  return globalForPrisma.prisma
}

// Function to safely execute database operations with error handling
export async function executePrismaOperation<T>(
  operation: (prisma: PrismaClient) => Promise<T>
): Promise<T> {
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

// Export default instance for backwards compatibility
export const prisma = getPrisma()