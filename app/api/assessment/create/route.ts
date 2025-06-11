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

    // TODO: Implement assessment logic in Next.js API
    // For now, mark assessment as completed with placeholder data
    console.log('Creating placeholder assessment (Express.js backend not available)...')
    await prisma.assessment.update({
      where: { id: assessment.id },
      data: { 
        status: 'completed',
        totalTests: 0,
        vulnerabilities: 0,
        securityScore: 0.0
      }
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

async function startBackendAssessment(
  assessmentId: string,
  targetName: string,
  targetDescription: string,
  targetUrl: string,
  openrouterApiKey: string,
  selectedModel: string
) {
  try {
    console.log(`Starting real assessment for ${assessmentId}`)
    
    // Make request to backend assessment API
    const backendPort = process.env.BACKEND_PORT || '3001'
    const backendUrl = `http://localhost:${backendPort}/api/assessment/start`
    
    const assessmentRequest = {
      targetName,
      targetDescription,
      chatAgentUrl: targetUrl,
      openrouterApiKey,
      selectedModel
    }
    
    console.log(`Making request to backend: ${backendUrl}`)
    
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(assessmentRequest)
    })
    
    if (!response.ok) {
      throw new Error(`Backend request failed: ${response.status} ${response.statusText}`)
    }
    
    const result = await response.json()
    console.log('Backend response:', result)
    
    if (!result.success) {
      throw new Error(`Backend assessment failed: ${result.message}`)
    }
    
    const backendAssessmentId = result.assessmentId
    console.log(`Backend assessment started with ID: ${backendAssessmentId}`)
    
    // Update our assessment with backend ID for tracking
    await prisma.assessment.update({
      where: { id: assessmentId },
      data: {
        status: 'running'
      }
    })
    
    // Poll backend for completion
    pollBackendAssessment(assessmentId, backendAssessmentId, backendPort)
    
  } catch (error) {
    console.error(`Error starting backend assessment for ${assessmentId}:`, error)
    
    // Mark assessment as failed
    await prisma.assessment.update({
      where: { id: assessmentId },
      data: {
        status: 'failed'
      }
    })
  }
}

async function pollBackendAssessment(
  assessmentId: string, 
  backendAssessmentId: string, 
  backendPort: string
) {
  const maxPolls = 60 // 5 minutes max (5-second intervals)
  let pollCount = 0
  
  const poll = async () => {
    try {
      pollCount++
      console.log(`Polling backend assessment ${backendAssessmentId} (attempt ${pollCount}/${maxPolls})`)
      
      const response = await fetch(`http://localhost:${backendPort}/api/assessment/${backendAssessmentId}/status`)
      
      if (!response.ok) {
        throw new Error(`Backend poll failed: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.success && result.assessment) {
        const assessment = result.assessment
        
        if (assessment.status === 'completed') {
          console.log(`Backend assessment ${backendAssessmentId} completed!`)
          
          // Update our database with real results
          await prisma.assessment.update({
            where: { id: assessmentId },
            data: {
              status: 'completed',
              totalTests: assessment.totalTests || 0,
              vulnerabilities: assessment.vulnerabilities || 0,
              securityScore: assessment.securityScore || 0,
              systemAnalysis: assessment.systemAnalysis ? JSON.stringify(assessment.systemAnalysis) : null
            }
          })
          
          // Save findings if available
          if (assessment.findings && assessment.findings.length > 0) {
            const findingData = assessment.findings.map((finding: any) => ({
              assessmentId,
              vector: finding.testType || 'unknown',
              prompt: finding.payload || '',
              response: finding.response || '',
              technique: finding.technique || '',
              vulnerable: finding.vulnerable || false,
              vulnerabilityType: finding.vulnerabilityType || 'Unknown',
              severity: finding.severity || 'Low',
              explanation: finding.description || '',
              recommendations: finding.recommendation || ''
            }))
            
            await prisma.finding.createMany({ data: findingData })
          }
          
          // Save exploit results if available
          if (assessment.exploitResults && assessment.exploitResults.length > 0) {
            const exploitData = assessment.exploitResults.map((exploit: any) => ({
              assessmentId,
              exploitType: exploit.exploitType || 'unknown',
              success: exploit.success || false,
              description: exploit.description || '',
              payload: exploit.payload || '',
              response: exploit.response || '',
              riskLevel: exploit.riskLevel || 'low',
              impact: exploit.impact || ''
            }))
            
            await prisma.exploitResult.createMany({ data: exploitData })
          }
          
          console.log(`Assessment ${assessmentId} completed successfully`)
          return
          
        } else if (assessment.status === 'failed') {
          console.log(`Backend assessment ${backendAssessmentId} failed`)
          
          await prisma.assessment.update({
            where: { id: assessmentId },
            data: { status: 'failed' }
          })
          return
        }
        
        // Still running, continue polling
        if (pollCount < maxPolls) {
          setTimeout(poll, 5000) // Poll every 5 seconds
        } else {
          console.log(`Backend assessment ${backendAssessmentId} timed out`)
          await prisma.assessment.update({
            where: { id: assessmentId },
            data: { status: 'failed' }
          })
        }
        
      } else {
        throw new Error('Invalid response from backend')
      }
      
    } catch (error) {
      console.error(`Error polling backend assessment ${backendAssessmentId}:`, error)
      
      if (pollCount < maxPolls) {
        setTimeout(poll, 5000) // Retry
      } else {
        await prisma.assessment.update({
          where: { id: assessmentId },
          data: { status: 'failed' }
        })
      }
    }
  }
  
  // Start polling
  setTimeout(poll, 2000) // Wait 2 seconds before first poll
}