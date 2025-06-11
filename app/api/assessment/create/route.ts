import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getPrisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  let prisma: any = null
  
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

    // Create assessment record with proper client management
    console.log('Creating assessment record...')
    prisma = getPrisma()
    const assessment = await prisma.assessment.create({
      data: {
        userId: session.user.id,
        targetName,
        targetDescription: targetDescription || '',
        status: 'running'
      }
    })
    console.log('Assessment created with ID:', assessment.id)

    // Disconnect Prisma client after creation
    await prisma.$disconnect()

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
      // Update assessment to failed status with new client
      const errorPrisma = getPrisma()
      errorPrisma.assessment.update({
        where: { id: assessment.id },
        data: { status: 'failed' }
      }).then(() => errorPrisma.$disconnect()).catch(console.error)
    })

    return NextResponse.json({ 
      assessmentId: assessment.id,
      message: 'Assessment started successfully' 
    })
    
  } catch (error) {
    console.error('Create assessment error:', error)
    
    // Ensure client is disconnected on error
    if (prisma) {
      try {
        await prisma.$disconnect()
      } catch (disconnectError) {
        console.warn('Error disconnecting Prisma client:', disconnectError)
      }
    }
    
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
    const prisma = getPrisma()
    await prisma.assessment.update({
      where: { id: assessmentId },
      data: { status: 'running' }
    })
    await prisma.$disconnect()
    
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
    
    console.log(`✅ Assessment ${assessmentId} completed successfully`)
    console.log(`📊 Results: ${results.summary.vulnerabilities}/${results.summary.totalTests} vulnerabilities found`)
    
    // Save results to database
    const resultsPrisma = getPrisma()
    await resultsPrisma.assessment.update({
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
      
      await resultsPrisma.finding.createMany({ data: findingData })
    }
    
    await resultsPrisma.$disconnect()
    
    console.log(`💾 Saved assessment results to database`)
    
  } catch (error) {
    console.error(`Error starting assessment for ${assessmentId}:`, error)
    
    // Mark assessment as failed
    const prismaForError = getPrisma()
    await prismaForError.assessment.update({
      where: { id: assessmentId },
      data: {
        status: 'failed'
      }
    })
    await prismaForError.$disconnect()
  }
}

// Remove polling function since we now run assessment directly