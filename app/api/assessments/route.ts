import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getPrisma, executePrismaOperation } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Check for and cleanup stale assessments
async function cleanupStaleAssessments() {
  try {
    const STALE_THRESHOLD = 60 * 60 * 1000 // 1 hour
    const now = new Date()
    const staleTime = new Date(now.getTime() - STALE_THRESHOLD)
    
    // Find running assessments that haven't been updated in over 1 hour
    const staleAssessments = await executePrismaOperation(async (prisma) => {
      return await prisma.assessment.findMany({
        where: {
          status: 'running',
          updatedAt: { lt: staleTime }
        },
        select: { id: true, targetName: true, createdAt: true, updatedAt: true }
      })
    })
    
    if (staleAssessments.length > 0) {
      console.log(`🧹 Found ${staleAssessments.length} stale assessments to cleanup`)
      
      // Mark them as failed
      await executePrismaOperation(async (prisma) => {
        return await prisma.assessment.updateMany({
          where: {
            id: { in: staleAssessments.map(a => a.id) },
            status: 'running' // Double-check they're still running
          },
          data: {
            status: 'failed',
            systemAnalysis: JSON.stringify({
              error: 'Assessment marked as stale and cleaned up',
              cleanedUpAt: now.toISOString(),
              reason: 'No activity for over 1 hour'
            })
          }
        })
      })
      
      console.log(`✅ Cleaned up ${staleAssessments.length} stale assessments`)
    }
    
    return staleAssessments.length
  } catch (error) {
    console.error('Error during stale assessment cleanup:', error)
    return 0
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('GET /api/assessments called')
    
    const session = await getServerSession(authOptions)
    console.log('Session:', session ? `User ID: ${session.user?.id}` : 'No session')
    
    if (!session || !session.user?.id) {
      console.log('No valid session, returning 401')
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    // Check for stale assessments on every request (lightweight operation)
    const cleanedCount = await cleanupStaleAssessments()
    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} stale assessments`)
    }

    console.log('Querying assessments for user:', session.user.id)
    const assessments = await executePrismaOperation(async (prisma) => {
      return await prisma.assessment.findMany({
        where: {
          userId: session.user.id
        },
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true,
          targetName: true,
          targetDescription: true,
          status: true,
          totalTests: true,
          vulnerabilities: true,
          securityScore: true,
          createdAt: true,
          updatedAt: true
        }
      })
    })

    console.log(`Found ${assessments.length} assessments`)
    return NextResponse.json(assessments)
  } catch (error) {
    console.error('Get assessments error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}