import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('🧠 Getting intelligent assessment status for ID:', params.id)
    
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user?.id) {
      console.log('No valid session, returning 401')
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    // Get backend URL from environment
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://redteam-incept-backend.vercel.app'
    
    console.log(`🔄 Proxying status request to intelligent backend: ${backendUrl}`)

    // Proxy request to intelligent adaptive backend
    const backendResponse = await fetch(`${backendUrl}/api/assessment/${params.id}/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text()
      console.error('Backend status error:', errorText)
      
      // Handle specific error cases
      if (backendResponse.status === 404) {
        return NextResponse.json({
          message: 'Assessment not found',
          assessmentId: params.id,
          intelligentBackend: true,
          suggestion: 'The assessment may have completed or been lost due to serverless restart. Try starting a new intelligent assessment.'
        }, { status: 404 })
      }
      
      return NextResponse.json({
        success: false,
        message: 'Failed to get assessment status from intelligent backend',
        error: errorText,
        backendUrl
      }, { status: backendResponse.status })
    }

    const backendData = await backendResponse.json()
    
    console.log('✅ Received assessment status from intelligent backend')

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

  } catch (error) {
    console.error('Error getting intelligent assessment status:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to connect to intelligent backend',
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
      // For intelligent assessments, we just return success since they auto-complete
      // or timeout gracefully
      return NextResponse.json({ 
        success: true,
        message: 'Intelligent assessment will complete or timeout automatically',
        note: 'Intelligent assessments include built-in timeout protection and complete within 50-60 seconds'
      })
    }

    return NextResponse.json({ message: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('Patch intelligent assessment error:', error)
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

    // For intelligent assessments, we don't delete from backend (they auto-cleanup)
    // Just return success
    return NextResponse.json({ 
      success: true,
      message: 'Intelligent assessment reference removed',
      note: 'Intelligent assessments auto-cleanup after completion or timeout'
    })

  } catch (error) {
    console.error('Delete intelligent assessment error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}