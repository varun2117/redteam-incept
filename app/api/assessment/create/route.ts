import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getPrisma, executePrismaOperation } from '@/lib/prisma'

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

    // Create assessment record using safe operation wrapper
    console.log('Creating assessment record...')
    const assessment = await executePrismaOperation(async (prisma) => {
      return await prisma.assessment.create({
        data: {
          userId: session.user.id,
          targetName,
          targetDescription: targetDescription || '',
          status: 'running'
        }
      })
    })
    console.log('Assessment created with ID:', assessment.id)

    // Start assessment directly (no separate API call needed)
    console.log('Starting assessment directly...')
    startLocalAssessment(
      assessment.id,
      targetName, 
      targetDescription || '', 
      targetUrl, 
      openrouterApiKey, 
      selectedModel
    ).catch(error => {
      console.error('Assessment error:', error)
      // Update assessment to failed status using safe operation
      executePrismaOperation(async (prisma) => {
        return await prisma.assessment.update({
          where: { id: assessment.id },
          data: { status: 'failed' }
        })
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
  const MAX_ASSESSMENT_TIME = 45 * 60 * 1000 // 45 minutes timeout
  const assessmentStartTime = Date.now()
  
  // Set up timeout to prevent stuck assessments
  const assessmentTimeout = setTimeout(async () => {
    console.error(`⏰ Assessment ${assessmentId} timed out after 45 minutes`)
    try {
      await executePrismaOperation(async (prisma) => {
        return await prisma.assessment.update({
          where: { id: assessmentId },
          data: { 
            status: 'failed',
            systemAnalysis: JSON.stringify({ error: 'Assessment timed out after 45 minutes' })
          }
        })
      })
    } catch (error) {
      console.error(`Failed to mark timed out assessment as failed:`, error)
    }
  }, MAX_ASSESSMENT_TIME)

  // Declare interval variable outside try block for proper cleanup
  let heartbeatInterval: NodeJS.Timeout | null = null

  try {
    console.log(`Starting assessment for ${assessmentId} with ${MAX_ASSESSMENT_TIME/60000}min timeout`)
    
    // Import the required modules
    const { RedTeamAgent } = await import('@/lib/RedTeamAgent')
    const { ChatAgentConnector } = await import('@/lib/ChatAgentConnector')
    
    // Validate chat agent URL
    if (!ChatAgentConnector.validateUrl(targetUrl)) {
      throw new Error('Invalid chat agent URL format')
    }
    
    // Create chat agent connector
    const defaultConfig = {
      url: targetUrl,
      method: 'POST' as const,
      timeout: 30000,
      retries: 3,
      requestFormat: 'json' as const,
      responseFormat: 'json' as const,
      messageField: 'message',
      responseField: 'message'
    }
    
    const chatConnector = new ChatAgentConnector(defaultConfig)
    
    // Test connection to chat agent
    console.log(`Testing connection to chat agent: ${targetUrl}`)
    const connectionTest = await chatConnector.testConnection()
    
    if (!connectionTest.success) {
      throw new Error(`Failed to connect to chat agent: ${connectionTest.error}`)
    }
    
    console.log(`✅ Chat agent connection successful (${connectionTest.responseTime}ms)`)
    
    // Initialize red team agent
    const redTeamAgent = new RedTeamAgent(openrouterApiKey, selectedModel)
    redTeamAgent.setTargetInfo(targetName, targetDescription)
    
    // Update assessment status to running
    await executePrismaOperation(async (prisma) => {
      return await prisma.assessment.update({
        where: { id: assessmentId },
        data: { status: 'running' }
      })
    })
    
    // Set up heartbeat updates during assessment
    heartbeatInterval = setInterval(async () => {
      try {
        await executePrismaOperation(async (prisma) => {
          return await prisma.assessment.update({
            where: { id: assessmentId },
            data: { 
              updatedAt: new Date(),
              systemAnalysis: JSON.stringify({ 
                status: 'in_progress', 
                lastHeartbeat: new Date().toISOString(),
                elapsedTime: Date.now() - assessmentStartTime
              })
            }
          })
        })
        console.log(`💓 Heartbeat sent for assessment ${assessmentId}`)
      } catch (error) {
        console.error(`Heartbeat failed for assessment ${assessmentId}:`, error)
      }
    }, 30000) // Every 30 seconds
    
    // Set up progress callback
    redTeamAgent.setProgressCallback((progress: any) => {
      console.log(`Assessment ${assessmentId} progress:`, progress)
    })
    
    // Run the assessment
    const results = await redTeamAgent.runSecurityAssessment(
      chatConnector,
      targetName,
      assessmentId
    )
    
    // Clear timeout and heartbeat on successful completion
    clearTimeout(assessmentTimeout)
    if (heartbeatInterval) clearInterval(heartbeatInterval)
    
    console.log(`✅ Assessment ${assessmentId} completed successfully`)
    console.log(`📊 Results: ${results.summary.vulnerabilities}/${results.summary.totalTests} vulnerabilities found`)
    
    // Save results to database with transaction safety
    await executePrismaOperation(async (prisma) => {
      // First check if assessment is still in running state
      const currentAssessment = await prisma.assessment.findUnique({
        where: { id: assessmentId },
        select: { status: true }
      })
      
      if (currentAssessment?.status !== 'running') {
        console.warn(`Assessment ${assessmentId} status changed to ${currentAssessment?.status}, skipping completion update`)
        return false
      }
      
      await prisma.assessment.update({
        where: { id: assessmentId },
        data: {
          status: 'completed',
          totalTests: results.summary.totalTests,
          vulnerabilities: results.summary.vulnerabilities,
          securityScore: results.summary.securityScore,
          systemAnalysis: JSON.stringify(results.systemAnalysis),
          vulnerabilityReport: JSON.stringify(results.vulnerabilityReport),
          riskLevel: results.vulnerabilityReport?.executiveSummary?.riskLevel,
          executionTime: results.vulnerabilityReport?.executionTime
        }
      })
      
      // Save findings
      if (results.findings && results.findings.length > 0) {
        const findingData = results.findings.map((finding: any) => ({
          assessmentId,
          vector: finding.vector,
          prompt: finding.test_case.prompt,
          response: finding.response,
          technique: finding.test_case.technique,
          vulnerable: finding.analysis.vulnerable,
          vulnerabilityType: finding.analysis.vulnerability_type,
          severity: finding.analysis.severity,
          explanation: finding.analysis.explanation,
          recommendations: finding.analysis.recommendations
        }))
        
        await prisma.finding.createMany({ data: findingData })
      }
      
      return true
    })
    
    console.log(`💾 Saved assessment results to database`)
    
  } catch (error) {
    console.error(`Error starting assessment for ${assessmentId}:`, error)
    
    // Clear timeout and heartbeat on error
    clearTimeout(assessmentTimeout)
    if (heartbeatInterval) clearInterval(heartbeatInterval)
    
    // Mark assessment as failed using safe operation
    await executePrismaOperation(async (prisma) => {
      return await prisma.assessment.update({
        where: { id: assessmentId },
        data: {
          status: 'failed',
          systemAnalysis: JSON.stringify({ 
            error: error instanceof Error ? error.message : 'Unknown error',
            failedAt: new Date().toISOString(),
            elapsedTime: Date.now() - assessmentStartTime
          })
        }
      })
    }).catch(console.error)
  }
}

// Remove polling function since we now run assessment directly