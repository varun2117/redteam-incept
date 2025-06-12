import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    console.log('Starting new intelligent assessment...')
    
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { targetName, targetDescription, chatAgentUrl, openrouterApiKey, selectedModel } = body

    // Validate required fields
    if (!targetName || !chatAgentUrl || !openrouterApiKey || !selectedModel) {
      return NextResponse.json({ 
        success: false,
        message: 'Missing required fields: targetName, chatAgentUrl, openrouterApiKey, selectedModel' 
      }, { status: 400 })
    }

    // Get backend URL from environment
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://redteam-incept-backend.vercel.app'
    
    console.log(`🧠 Proxying to intelligent backend: ${backendUrl}`)

    // Proxy request to intelligent adaptive backend
    const backendResponse = await fetch(`${backendUrl}/api/assessment/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetName,
        targetDescription,
        chatAgentUrl,
        openrouterApiKey,
        selectedModel,
        userId: session.user.id
      })
    })

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text()
      console.error('Backend error:', errorText)
      return NextResponse.json({
        success: false,
        message: 'Failed to start intelligent assessment',
        error: errorText
      }, { status: backendResponse.status })
    }

    const backendData = await backendResponse.json()
    
    console.log('✅ Intelligent assessment started:', backendData.assessmentId)

    // Return the response from intelligent backend
    return NextResponse.json({
      success: true,
      assessmentId: backendData.assessmentId,
      message: backendData.message || 'Intelligent adaptive assessment started',
      features: backendData.features || {
        customAttackGeneration: true,
        roleSpecificTesting: true,
        adaptiveTargeting: true,
        timeoutOptimization: true
      },
      estimatedDuration: backendData.estimatedDuration || '45-55 seconds',
      testPlan: backendData.testPlan || {
        phases: ['discovery', 'custom_attack_generation', 'adaptive_testing', 'intelligent_analysis'],
        customVectors: 'Generated based on target analysis',
        aiAnalysis: true
      }
    })

  } catch (error) {
    console.error('Error starting intelligent assessment:', error)
    return NextResponse.json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Health check for the proxy
export async function GET() {
  try {
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://redteam-incept-backend.vercel.app'
    
    const healthResponse = await fetch(`${backendUrl}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })

    if (!healthResponse.ok) {
      return NextResponse.json({
        success: false,
        message: 'Intelligent backend not available',
        backendUrl
      }, { status: 503 })
    }

    const healthData = await healthResponse.json()

    return NextResponse.json({
      success: true,
      message: 'Frontend proxy to intelligent backend is working',
      backendUrl,
      backendHealth: healthData,
      intelligentFeatures: {
        adaptiveTargeting: true,
        customAttackGeneration: true,
        roleSpecificTesting: true,
        langfuseIntegration: healthData.dependencies?.langfuse || false
      }
    })

  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to connect to intelligent backend',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}