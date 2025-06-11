import { PrismaClient } from '@prisma/client'

// More aggressive fix for prepared statement conflicts
function createFreshPrismaClient() {
  // Try multiple database URL sources
  let databaseUrl = process.env.DATABASE_URL || 
                   process.env.POSTGRES_PRISMA_URL || 
                   process.env.POSTGRES_URL || ''
  
  // For direct connections (non-pooling) - preferred for serverless
  const directUrl = process.env.DATABASE_URL_NON_POOLING || 
                   process.env.POSTGRES_URL_NON_POOLING || 
                   process.env.DIRECT_URL || ''

  // Detect serverless environment
  const isServerless = !!(process.env.VERCEL || process.env.VERCEL_ENV)
  
  // Use direct URL for serverless to avoid connection pooling issues
  if (isServerless && directUrl) {
    databaseUrl = directUrl
    console.log('Using direct connection URL for serverless environment')
  }

  // Only modify URL for PostgreSQL connections
  if (databaseUrl && (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'))) {
    try {
      const url = new URL(databaseUrl)
      
      // Very aggressive settings to prevent prepared statement conflicts
      url.searchParams.set('prepared_statements', 'false')
      url.searchParams.set('statement_cache_size', '0')
      url.searchParams.set('connection_limit', '1')
      url.searchParams.set('pool_size', '1')
      url.searchParams.set('pool_timeout', '5')
      url.searchParams.set('connect_timeout', '10')
      
      // Remove any pgbouncer settings that might interfere
      url.searchParams.delete('pgbouncer')
      
      databaseUrl = url.toString()
      console.log('PostgreSQL configured with aggressive anti-prepared-statement settings')
    } catch (error) {
      console.warn('Failed to modify PostgreSQL URL:', error)
    }
  }

  return new PrismaClient({
    datasources: { db: { url: databaseUrl } },
    log: ['error']
  })
}

// Always use fresh clients in serverless environments
export async function executePrismaOperation<T>(
  operation: (prisma: PrismaClient) => Promise<T>
): Promise<T> {
  const maxRetries = 5
  let lastError: any
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Create completely fresh client for each attempt
    const client = createFreshPrismaClient()
    
    try {
      console.log(`Fresh Prisma client attempt ${attempt + 1}/${maxRetries}`)
      
      // Execute operation
      const result = await operation(client)
      
      // Immediately disconnect
      await client.$disconnect()
      
      return result
      
    } catch (error: any) {
      lastError = error
      console.error(`Attempt ${attempt + 1} failed:`, error?.message || error)
      
      // Force disconnect
      try {
        await client.$disconnect()
      } catch {}
      
      // Check if it's a retryable error
      const isRetryable = error?.message?.includes('prepared statement') ||
                         error?.message?.includes('connection') ||
                         error?.code === '42P05'
      
      if (isRetryable && attempt < maxRetries - 1) {
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 300 + Math.random() * 200
        console.log(`Retrying in ${Math.round(delay)}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      
      break
    }
  }
  
  throw lastError
}

// Legacy exports for compatibility
export const prisma = createFreshPrismaClient()
export function getPrisma() { return createFreshPrismaClient() }
export function getFreshPrismaClient() { return createFreshPrismaClient() }
export default prisma