import { PrismaClient } from '@prisma/client'

// Global singleton for development only
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Create a function to instantiate Prisma with aggressive serverless configuration
function createPrismaClient() {
  // Try multiple database URL sources
  let databaseUrl = process.env.DATABASE_URL || 
                   process.env.POSTGRES_PRISMA_URL || 
                   process.env.POSTGRES_URL || ''
  
  // For direct connections (non-pooling)
  const directUrl = process.env.DATABASE_URL_NON_POOLING || 
                   process.env.POSTGRES_URL_NON_POOLING || 
                   process.env.DIRECT_URL || ''

  console.log('Database URLs available:', {
    DATABASE_URL: !!process.env.DATABASE_URL,
    POSTGRES_PRISMA_URL: !!process.env.POSTGRES_PRISMA_URL,
    DATABASE_URL_NON_POOLING: !!process.env.DATABASE_URL_NON_POOLING,
    POSTGRES_URL_NON_POOLING: !!process.env.POSTGRES_URL_NON_POOLING
  })

  // Detect serverless environment
  const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY || process.env.VERCEL_ENV)
  
  // Use direct URL for serverless to avoid connection pooling issues
  if (isServerless && directUrl) {
    databaseUrl = directUrl
    console.log('Using direct connection URL for serverless environment')
  }

  // Only modify URL for PostgreSQL connections
  if (databaseUrl && (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'))) {
    try {
      const url = new URL(databaseUrl)
      
      // Aggressive settings to prevent prepared statement conflicts
      url.searchParams.set('prepared_statements', 'false')
      url.searchParams.set('statement_cache_size', '0')
      url.searchParams.set('connection_limit', '1')
      url.searchParams.set('pool_size', '1')
      
      if (isServerless) {
        // Even more aggressive serverless settings
        url.searchParams.set('pool_timeout', '5')
        url.searchParams.set('connect_timeout', '10')
        url.searchParams.set('socket_timeout', '10')
        url.searchParams.set('pool_recycle', '300')
        // Remove pgbouncer if it's causing issues
        url.searchParams.delete('pgbouncer')
      } else {
        url.searchParams.set('pool_timeout', '20')
        url.searchParams.set('connect_timeout', '60')
      }
      
      databaseUrl = url.toString()
      console.log(`PostgreSQL configured for ${isServerless ? 'serverless' : 'standard'} with aggressive anti-prepared-statement settings`)
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
    log: ['error', 'warn'],
    // Disable query engine optimizations that might cause prepared statements
    __internal: {
      useUds: false,
    }
  } as any)

  return client
}

// Function to create a fresh client for operations that need it
export function getFreshPrismaClient() {
  return createPrismaClient()
}

// Main function to get Prisma client - always create fresh in serverless
export function getPrisma() {
  const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY || process.env.VERCEL_ENV)
  
  if (isServerless) {
    // Always use fresh clients in serverless to avoid any state issues
    return createPrismaClient()
  }
  
  // Use singleton approach for non-serverless
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient()
  }
  return globalForPrisma.prisma
}

// Function to safely execute database operations with error recovery
export async function executePrismaOperation<T>(
  operation: (prisma: PrismaClient) => Promise<T>
): Promise<T> {
  const maxRetries = 5 // Increased retries
  let lastError: any
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Always create a completely fresh client for each attempt in serverless
    const client = getFreshPrismaClient()
    
    try {
      console.log(`Attempt ${attempt + 1}/${maxRetries} - Creating fresh Prisma client`)
      
      // Test the connection first
      await client.$connect()
      
      const result = await operation(client)
      
      // Disconnect immediately after operation
      await client.$disconnect()
      
      console.log(`Operation succeeded on attempt ${attempt + 1}`)
      return result
      
    } catch (error: any) {
      lastError = error
      console.error(`Prisma operation failed (attempt ${attempt + 1}/${maxRetries}):`, error?.message || error)
      
      // Always disconnect after error
      try {
        await client.$disconnect()
      } catch (disconnectError) {
        console.warn('Error disconnecting after failed operation:', disconnectError)
      }
      
      // Check for prepared statement or connection errors
      const isRetryableError = error?.message?.includes('prepared statement') ||
                             error?.message?.includes('connection') ||
                             error?.message?.includes('pool') ||
                             error?.code === 'P1001' ||
                             error?.code === 'P2024' ||
                             error?.code === '42P05' // PostgreSQL prepared statement error
      
      if (isRetryableError && attempt < maxRetries - 1) {
        // Exponential backoff with jitter
        const baseDelay = Math.pow(2, attempt) * 200
        const jitter = Math.random() * 100
        const delay = baseDelay + jitter
        
        console.log(`Retryable error detected. Waiting ${Math.round(delay)}ms before retry ${attempt + 2}`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      
      // If not retryable or max retries reached, break
      break
    }
  }
  
  console.error('All retry attempts exhausted')
  throw lastError || new Error('Operation failed after all retries')
}

// Export default instance for backwards compatibility
export const prisma = getPrisma()