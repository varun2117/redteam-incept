import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { executePrismaOperation } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('🔍 Getting assessment for ID:', params.id)
    
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user?.id) {
      console.log('No valid session, returning 401')
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    // Get backend URL from environment
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://redteam-incept-backend.vercel.app'
    
    console.log(`🧠 First trying intelligent backend: ${backendUrl}`)

    try {
      // First try intelligent adaptive backend for new assessments
      const backendResponse = await fetch(`${backendUrl}/api/assessment/${params.id}/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (backendResponse.ok) {
        const backendData = await backendResponse.json()
        console.log('✅ Found assessment in intelligent backend')
        
        // Enhance the response with frontend-compatible data structure
        const assessmentData = backendData.assessment || backendData

        return NextResponse.json({
          id: assessmentData.id || params.id,
          status: assessmentData.status || 'unknown',
          targetName: assessmentData.targetName || 'Unknown Target',
          targetDescription: assessmentData.targetDescription || '',
          totalTests: assessmentData.totalTests || 0,
          vulnerabilities: assessmentData.vulnerabilities || 0,
          securityScore: assessmentData.securityScore,
          systemAnalysis: assessmentData.systemAnalysis,
          findings: assessmentData.findings || [],
          exploitResults: assessmentData.exploitResults || [],
          vulnerabilityReport: assessmentData.results?.vulnerabilityReport,
          riskLevel: assessmentData.results?.vulnerabilityReport?.executiveSummary?.riskLevel,
          executionTime: assessmentData.results?.vulnerabilityReport?.executionTime,
          createdAt: assessmentData.startTime || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          progress: assessmentData.progress,
          intelligentFeatures: assessmentData.intelligentFeatures || {
            customAttackVectors: 0,
            roleSpecificTests: 0,
            adaptiveAnalysis: false
          },
          // Mark as intelligent assessment
          isIntelligentAssessment: true,
          backend: 'intelligent-adaptive'
        })
      } else if (backendResponse.status === 404) {
        console.log('⚠️ Assessment not found in intelligent backend, checking local database...')
        // Fall through to local database check
      } else {
        console.error('Backend error:', await backendResponse.text())
        // Fall through to local database check
      }
    } catch (fetchError) {
      console.error('Error connecting to intelligent backend:', fetchError)
      console.log('🔄 Falling back to local database...')
      // Fall through to local database check
    }

    // Fallback: Check local database for older assessments
    console.log('🗄️ Checking local database for assessment:', params.id)
    
    const { assessmentExists, assessment } = await executePrismaOperation(async (prisma) => {
      const assessmentExists = await prisma.assessment.findFirst({
        where: { id: params.id },
        select: { id: true, userId: true, targetName: true }
      })
      
      const assessment = await prisma.assessment.findFirst({
        where: {
          id: params.id,
          userId: session.user.id
        },
        include: {
          findings: true,
          exploitResults: true
        }
      })
      
      return { assessmentExists, assessment }
    })
    
    console.log('Assessment exists (any user):', assessmentExists)
    console.log('Assessment found for current user:', assessment ? 'Yes' : 'No')
    
    if (!assessment && assessmentExists) {
      console.log('Assessment exists but belongs to different user')
      return NextResponse.json({ message: 'Assessment not found' }, { status: 404 })
    }
    
    if (!assessment) {
      console.log('Assessment not found in local database either')
      return NextResponse.json({ 
        message: 'Assessment not found',
        note: 'Assessment not found in either intelligent backend or local database',
        suggestion: 'This assessment may have expired or been completed on the intelligent backend'
      }, { status: 404 })
    }

    console.log('✅ Found assessment in local database')

    // Parse system analysis if it exists
    let systemAnalysis = null
    if (assessment.systemAnalysis) {
      try {
        systemAnalysis = JSON.parse(assessment.systemAnalysis)
      } catch (e) {
        console.error('Error parsing system analysis:', e)
      }
    }

    // Return local database assessment with indication it's from local storage
    return NextResponse.json({
      ...assessment,
      systemAnalysis,
      intelligentFeatures: {
        customAttackVectors: 0,
        roleSpecificTests: 0,
        adaptiveAnalysis: false
      },
      isIntelligentAssessment: false,
      backend: 'local-database',
      note: 'This is a legacy assessment from local database'
    })

  } catch (error) {
    console.error('Error getting assessment:', error)
    return NextResponse.json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
      assessmentId: params.id
    }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    if (action === 'stop') {
      // Try to stop intelligent assessment first, then fall back to local
      const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://redteam-incept-backend.vercel.app'
      
      try {
        // Intelligent assessments auto-complete, so just return success
        return NextResponse.json({ 
          success: true,
          message: 'Intelligent assessment will complete or timeout automatically',
          note: 'Intelligent assessments include built-in timeout protection and complete within 50-60 seconds'
        })
      } catch (error) {
        // Fall back to local database stop
        const assessment = await executePrismaOperation(async (prisma) => {
          const assessment = await prisma.assessment.findFirst({
            where: {
              id: params.id,
              userId: session.user.id,
              status: 'running'
            }
          })

          if (!assessment) {
            return null
          }

          return await prisma.assessment.update({
            where: { id: params.id },
            data: {
              status: 'failed',
              systemAnalysis: JSON.stringify({
                error: 'Assessment stopped by user',
                stoppedAt: new Date().toISOString(),
                stoppedBy: session.user.id
              })
            }
          })
        })

        if (!assessment) {
          return NextResponse.json({ message: 'Assessment not found or not running' }, { status: 404 })
        }

        return NextResponse.json({ 
          success: true,
          message: 'Local assessment stopped successfully' 
        })
      }
    }

    return NextResponse.json({ message: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('Patch assessment error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const assessmentId = params.id

    // For intelligent assessments, they auto-cleanup, so we just remove from local if exists
    const result = await executePrismaOperation(async (prisma) => {
      const assessment = await prisma.assessment.findFirst({
        where: {
          id: assessmentId,
          userId: session.user.id
        }
      })

      if (!assessment) {
        return null
      }

      // Delete the assessment (this will cascade delete findings and exploitResults)
      await prisma.assessment.delete({
        where: { id: assessmentId }
      })

      return true
    })

    return NextResponse.json({ 
      success: true,
      message: result ? 'Assessment deleted successfully' : 'Assessment reference removed',
      note: 'Intelligent assessments auto-cleanup, local assessments are permanently deleted'
    })

  } catch (error) {
    console.error('Delete assessment error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}