import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getPrisma } from '@/lib/prisma'
import { RedTeamAgent } from '@/lib/RedTeamAgent'
import { ChatAgentConnector } from '@/lib/ChatAgentConnector'
import { v4 as uuidv4 } from 'uuid'

// Store active assessments in memory
const activeAssessments = new Map<string, any>()

export async function POST(request: NextRequest) {
  try {
    console.log('Starting new assessment...')
    
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { targetName, targetDescription, chatAgentUrl, openrouterApiKey, selectedModel, chatAgentConfig } = body

    // Validate required fields
    if (!targetName || !chatAgentUrl || !openrouterApiKey || !selectedModel) {
      return NextResponse.json({ 
        success: false,
        message: 'Missing required fields: targetName, chatAgentUrl, openrouterApiKey, selectedModel' 
      }, { status: 400 })
    }

    // Validate chat agent URL
    if (!ChatAgentConnector.validateUrl(chatAgentUrl)) {
      return NextResponse.json({
        success: false,
        message: 'Invalid chat agent URL format'
      }, { status: 400 })
    }

    const assessmentId = uuidv4()

    // Create chat agent connector with Test Agents compatibility
    const defaultConfig = {
      url: chatAgentUrl,
      method: 'POST' as const,
      timeout: 30000,
      retries: 3,
      requestFormat: 'json' as const,
      responseFormat: 'json' as const,
      messageField: 'message',
      responseField: 'message',
      ...chatAgentConfig
    }

    const chatConnector = new ChatAgentConnector(defaultConfig)

    // Test connection to chat agent
    console.log(`Testing connection to chat agent: ${chatAgentUrl}`)
    const connectionTest = await chatConnector.testConnection()

    if (!connectionTest.success) {
      return NextResponse.json({
        success: false,
        message: `Failed to connect to chat agent: ${connectionTest.error}`,
        details: {
          url: chatAgentUrl,
          responseTime: connectionTest.responseTime
        }
      }, { status: 400 })
    }

    console.log(`✅ Chat agent connection successful (${connectionTest.responseTime}ms)`)

    // Initialize red team agent
    const redTeamAgent = new RedTeamAgent(openrouterApiKey, selectedModel)
    redTeamAgent.setTargetInfo(targetName, targetDescription)

    // Create assessment record in database
    const prisma = getPrisma()
    const assessment = await prisma.assessment.create({
      data: {
        id: assessmentId,
        userId: session.user.id,
        targetName,
        targetDescription: targetDescription || '',
        status: 'running'
      }
    })

    // Store assessment in memory for progress tracking
    const assessmentData = {
      id: assessmentId,
      agent: redTeamAgent,
      connector: chatConnector,
      status: 'running',
      startTime: new Date(),
      progress: {
        phase: 'discovery',
        progress: 0,
        tests_completed: 0,
        vulnerabilities_found: 0,
        message: 'Initializing assessment...'
      }
    }

    activeAssessments.set(assessmentId, assessmentData)

    // Start assessment in background
    runAssessmentBackground(assessmentId).catch(error => {
      console.error(`Assessment ${assessmentId} failed:`, error)
      // Update assessment status to failed
      prisma.assessment.update({
        where: { id: assessmentId },
        data: { status: 'failed' }
      }).catch(console.error)
    })

    return NextResponse.json({
      success: true,
      assessmentId,
      message: 'Assessment started successfully',
      chatAgentConnection: {
        url: chatAgentUrl,
        responseTime: connectionTest.responseTime,
        status: 'connected'
      }
    })

  } catch (error) {
    console.error('Error starting assessment:', error)
    return NextResponse.json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function runAssessmentBackground(assessmentId: string) {
  const assessmentData = activeAssessments.get(assessmentId)
  if (!assessmentData) return

  try {
    console.log(`🔍 Starting assessment ${assessmentId}`)

    // Set up progress callback
    assessmentData.agent.setProgressCallback((progress: any) => {
      assessmentData.progress = progress
      console.log(`Assessment ${assessmentId} progress:`, progress)
    })

    // Run the assessment
    const results = await assessmentData.agent.runSecurityAssessment(
      assessmentData.connector,
      undefined,
      assessmentId
    )

    assessmentData.status = 'completed'
    assessmentData.results = results

    console.log(`✅ Assessment ${assessmentId} completed successfully`)
    console.log(`📊 Results: ${results.summary.vulnerabilities}/${results.summary.totalTests} vulnerabilities found`)

    // Save results to database
    const prismaForBackground = getPrisma()
    await prismaForBackground.assessment.update({
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

      await prismaForBackground.finding.createMany({ data: findingData })
    }

    console.log(`💾 Saved assessment results to database`)

  } catch (error) {
    console.error(`❌ Assessment ${assessmentId} failed:`, error)
    assessmentData.status = 'failed'
    assessmentData.progress.message = `Assessment failed: ${error instanceof Error ? error.message : 'Unknown error'}`

    // Update database
    const prismaForError = getPrisma()
    await prismaForError.assessment.update({
      where: { id: assessmentId },
      data: { status: 'failed' }
    }).catch(console.error)
  }
}

// Get assessment status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({
        success: false,
        message: 'Assessment ID required'
      }, { status: 400 })
    }

    const assessment = activeAssessments.get(id)
    if (!assessment) {
      // Try to get from database
      const prismaForGet = getPrisma()
      const dbAssessment = await prismaForGet.assessment.findUnique({
        where: { id },
        include: {
          findings: true
        }
      })

      if (!dbAssessment) {
        return NextResponse.json({
          success: false,
          message: 'Assessment not found'
        }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        assessment: {
          id: dbAssessment.id,
          status: dbAssessment.status,
          startTime: dbAssessment.createdAt,
          totalTests: dbAssessment.totalTests,
          vulnerabilities: dbAssessment.vulnerabilities,
          securityScore: dbAssessment.securityScore,
          findings: dbAssessment.findings
        }
      })
    }

    // Return live assessment data
    return NextResponse.json({
      success: true,
      assessment: {
        id: assessment.id,
        status: assessment.status,
        startTime: assessment.startTime,
        progress: assessment.progress,
        results: assessment.results
      }
    })

  } catch (error) {
    console.error('Error getting assessment status:', error)
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 })
  }
}