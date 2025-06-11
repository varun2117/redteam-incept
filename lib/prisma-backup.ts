import { PrismaClient } from '@prisma/client'

// Global singleton for development only
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Create a function to instantiate Prisma with proper configuration
function createPrismaClient() {
  let databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || ''
  
  // Detect serverless environment
  const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY)
  
  // Only modify URL for PostgreSQL connections to avoid prepared statement conflicts
  if (databaseUrl && (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'))) {
    try {
      const url = new URL(databaseUrl)
      // Always disable prepared statements for PostgreSQL to avoid conflicts
      url.searchParams.set('prepared_statements', 'false')
      url.searchParams.set('connection_limit', '1')
      
      if (isServerless) {
        // Optimized settings for serverless environments
        url.searchParams.set('pool_timeout', '10')
        url.searchParams.set('connect_timeout', '30')
        url.searchParams.set('pgbouncer', 'true')
      } else {
        url.searchParams.set('pool_timeout', '20')
        url.searchParams.set('connect_timeout', '60')
      }
      
      databaseUrl = url.toString()
      console.log(`PostgreSQL connection configured with prepared_statements=false for ${isServerless ? 'serverless' : 'standard'} environment`)
    } catch (error) {
      console.warn('Failed to modify PostgreSQL URL:', error)
    }
  }
  
  const client = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl
      }
    },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error']
  })

  // Auto-disconnect in serverless environments
  if (isServerless) {
    // Set up auto-disconnect for serverless
    process.on('beforeExit', async () => {
      try {
        await client.$disconnect()
      } catch (error) {
        console.warn('Error during client disconnect:', error)
      }
    })
  }

  return client
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
  const maxRetries = 3
  
  while (retryCount <= maxRetries) {
    // For each retry, use a completely fresh client to avoid any prepared statement issues
    const client = retryCount > 0 ? getFreshPrismaClient() : getPrisma()
    
    try {
      const result = await operation(client)
      
      // If we used a fresh client, disconnect it
      if (retryCount > 0) {
        try {
          await client.$disconnect()
        } catch (disconnectError) {
          console.warn('Error disconnecting fresh client:', disconnectError)
        }
      }
      
      return result
    } catch (error: any) {
      console.error(`Prisma operation error (attempt ${retryCount + 1}/${maxRetries + 1}):`, error?.message || error)
      
      // If we used a fresh client, disconnect it
      if (retryCount > 0) {
        try {
          await client.$disconnect()
        } catch (disconnectError) {
          console.warn('Error disconnecting fresh client after error:', disconnectError)
        }
      }
      
      // Check for prepared statement or connection errors
      const isRetryableError = error?.message?.includes('prepared statement') ||
                             error?.message?.includes('connection') ||
                             error?.code === 'P1001' || // Connection error
                             error?.code === 'P2024'    // Timed out
      
      if (isRetryableError && retryCount < maxRetries) {
        console.log('Retryable error detected, resetting connection and retrying')
        
        try {
          await globalForPrisma.prisma?.$disconnect()
          globalForPrisma.prisma = undefined
        } catch (disconnectError) {
          console.warn('Error disconnecting global client:', disconnectError)
        }
        
        retryCount++
        // Exponential backoff
        const delay = Math.pow(2, retryCount) * 100
        console.log(`Waiting ${delay}ms before retry ${retryCount + 1}`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      
      // If not retryable or max retries reached, throw
      throw error
    }
  }
  
  throw new Error('Max retries exceeded')
}

// Export default instance for backwards compatibility
export const prisma = getPrisma()