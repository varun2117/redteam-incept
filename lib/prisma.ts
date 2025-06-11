import { PrismaClient } from '@prisma/client'

// Global singleton for development only
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Create a function to instantiate Prisma with proper configuration
function createPrismaClient() {
  let databaseUrl = process.env.DATABASE_URL || ''
  
  // Only modify URL for PostgreSQL connections to avoid prepared statement conflicts
  if (databaseUrl && (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'))) {
    try {
      const url = new URL(databaseUrl)
      url.searchParams.set('prepared_statements', 'false')
      url.searchParams.set('connection_limit', '1')
      url.searchParams.set('pool_timeout', '20')
      url.searchParams.set('connect_timeout', '60')
      databaseUrl = url.toString()
      console.log('PostgreSQL connection configured with prepared_statements=false')
    } catch (error) {
      console.warn('Failed to modify PostgreSQL URL:', error)
    }
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
  // Use singleton approach with prepared statements disabled
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient()
  }
  return globalForPrisma.prisma
}

// Function to safely execute database operations with error recovery
export async function executePrismaOperation<T>(
  operation: (prisma: PrismaClient) => Promise<T>
): Promise<T> {
  let retryCount = 0
  const maxRetries = 2
  
  while (retryCount <= maxRetries) {
    // For each retry, use a completely fresh client to avoid any prepared statement issues
    const client = retryCount > 0 ? getFreshPrismaClient() : getPrisma()
    
    try {
      const result = await operation(client)
      
      // If we used a fresh client, disconnect it
      if (retryCount > 0) {
        await client.$disconnect()
      }
      
      return result
    } catch (error) {
      console.error(`Prisma operation error (attempt ${retryCount + 1}):`, error)
      
      // If we used a fresh client, disconnect it
      if (retryCount > 0) {
        await client.$disconnect()
      }
      
      // If we get a prepared statement error, reset the global connection and retry
      if (error instanceof Error && error.message.includes('prepared statement')) {
        console.log('Prepared statement error detected, resetting connection')
        
        try {
          await globalForPrisma.prisma?.$disconnect()
          globalForPrisma.prisma = undefined
        } catch (disconnectError) {
          console.warn('Error disconnecting:', disconnectError)
        }
        
        retryCount++
        if (retryCount <= maxRetries) {
          console.log(`Retrying operation (attempt ${retryCount + 1})`)
          continue
        }
      }
      
      throw error
    }
  }
  
  throw new Error('Max retries exceeded')
}

// Export default instance for backwards compatibility
export const prisma = getPrisma()