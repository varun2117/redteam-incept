import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    console.log('Starting assessment creation...')
    
    // Check authentication
    const session = await getServerSession(authOptions)
    console.log('Session:', session ? 'Found' : 'Not found')
    
    if (!session || !session.user?.id) {
      console.log('Authentication failed')
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    console.log('Request body received:', Object.keys(body))
    
    const { targetName, targetDescription, targetUrl, openrouterApiKey, selectedModel } = body

    // Validate required fields
    if (!targetName || !targetUrl || !openrouterApiKey || !selectedModel) {
      console.log('Missing required fields:', { targetName: !!targetName, targetUrl: !!targetUrl, openrouterApiKey: !!openrouterApiKey, selectedModel: !!selectedModel })
      return NextResponse.json({ 
        message: 'Missing required fields: targetName, targetUrl, openrouterApiKey, selectedModel' 
      }, { status: 400 })
    }

    // Create assessment record
    console.log('Creating assessment record...')
    const assessment = await prisma.assessment.create({
      data: {
        userId: session.user.id,
        targetName,
        targetDescription: targetDescription || '',
        status: 'running'
      }
    })
    console.log('Assessment created with ID:', assessment.id)

    // Start assessment via local API
    console.log('Starting assessment via local API...')
    startLocalAssessment(
      assessment.id,
      targetName, 
      targetDescription || '', 
      targetUrl, 
      openrouterApiKey, 
      selectedModel
    ).catch(error => {
      console.error('Assessment error:', error)
      // Update assessment to failed status
      prisma.assessment.update({
        where: { id: assessment.id },
        data: { status: 'failed' }
      }).catch(console.error)
    })

    return NextResponse.json({ 
      assessmentId: assessment.id,
      message: 'Assessment started successfully' 
    })
    
  } catch (error) {
    console.error('Create assessment error:', error)
    return NextResponse.json(
      { message: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

async function startLocalAssessment(
  assessmentId: string,
  targetName: string,
  targetDescription: string,
  targetUrl: string,
  openrouterApiKey: string,
  selectedModel: string
) {
  try {
    console.log(`Starting assessment for ${assessmentId}`)
    
    // Make request to local assessment API
    const assessmentRequest = {
      targetName,
      targetDescription,
      chatAgentUrl: targetUrl,
      openrouterApiKey,
      selectedModel
    }
    
    console.log(`Making request to local assessment API`)
    
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/assessment/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(assessmentRequest)
    })
    
    if (!response.ok) {
      throw new Error(`Assessment request failed: ${response.status} ${response.statusText}`)
    }
    
    const result = await response.json()
    console.log('Assessment response:', result)
    
    if (!result.success) {
      throw new Error(`Assessment failed: ${result.message}`)
    }
    
    const localAssessmentId = result.assessmentId
    console.log(`Assessment started with ID: ${localAssessmentId}`)
    
    // Update our assessment with the correct ID
    await prisma.assessment.update({
      where: { id: assessmentId },
      data: {
        id: localAssessmentId,
        status: 'running'
      }
    })
    
    // Poll for completion
    pollLocalAssessment(localAssessmentId)
    
  } catch (error) {
    console.error(`Error starting assessment for ${assessmentId}:`, error)
    
    // Mark assessment as failed
    await prisma.assessment.update({
      where: { id: assessmentId },
      data: {
        status: 'failed'
      }
    })
  }
}

async function pollLocalAssessment(assessmentId: string) {
  const maxPolls = 120 // 10 minutes max (5-second intervals)
  let pollCount = 0
  
  const poll = async () => {
    try {
      pollCount++
      console.log(`Polling assessment ${assessmentId} (attempt ${pollCount}/${maxPolls})`)
      
      const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/assessment/start?id=${assessmentId}`)
      
      if (!response.ok) {
        throw new Error(`Assessment poll failed: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.success && result.assessment) {
        const assessment = result.assessment
        
        if (assessment.status === 'completed') {
          console.log(`Assessment ${assessmentId} completed!`)
          return
          
        } else if (assessment.status === 'failed') {
          console.log(`Assessment ${assessmentId} failed`)
          return
        }
        
        // Still running, continue polling
        if (pollCount < maxPolls) {
          setTimeout(poll, 5000) // Poll every 5 seconds
        } else {
          console.log(`Assessment ${assessmentId} timed out`)
          await prisma.assessment.update({
            where: { id: assessmentId },
            data: { status: 'failed' }
          }).catch(console.error)
        }
        
      } else {
        throw new Error('Invalid response from assessment API')
      }
      
    } catch (error) {
      console.error(`Error polling assessment ${assessmentId}:`, error)
      
      if (pollCount < maxPolls) {
        setTimeout(poll, 5000) // Retry
      } else {
        await prisma.assessment.update({
          where: { id: assessmentId },
          data: { status: 'failed' }
        }).catch(console.error)
      }
    }
  }
  
  // Start polling
  setTimeout(poll, 2000) // Wait 2 seconds before first poll
}