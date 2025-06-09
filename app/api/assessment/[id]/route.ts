import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('🚀 UPDATED API ENDPOINT - GET /api/assessment/[id] called with ID:', params.id)
    console.log('🔍 Route is working! Params received:', params)
    
    const session = await getServerSession(authOptions)
    console.log('Session:', session ? `User ID: ${session.user?.id}` : 'No session')
    
    if (!session || !session.user?.id) {
      console.log('No valid session, returning 401')
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    console.log('Querying assessment:', params.id, 'for user:', session.user.id)
    
    // First check if assessment exists at all
    const assessmentExists = await prisma.assessment.findFirst({
      where: { id: params.id },
      select: { id: true, userId: true, targetName: true }
    })
    console.log('Assessment exists (any user):', assessmentExists)
    
    // Then check for user-specific assessment
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

    console.log('Assessment found for current user:', assessment ? 'Yes' : 'No')
    if (!assessment && assessmentExists) {
      console.log('Assessment exists but belongs to different user. Assessment userId:', assessmentExists.userId, 'Session userId:', session.user.id)
    }
    
    if (!assessment) {
      console.log('Assessment not found, returning 404')
      return NextResponse.json({ message: 'Assessment not found' }, { status: 404 })
    }

    // Parse system analysis if it exists
    let systemAnalysis = null
    if (assessment.systemAnalysis) {
      try {
        systemAnalysis = JSON.parse(assessment.systemAnalysis)
      } catch (e) {
        console.error('Error parsing system analysis:', e)
      }
    }

    return NextResponse.json({
      ...assessment,
      systemAnalysis
    })
  } catch (error) {
    console.error('Get assessment error:', error)
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

    // First check if assessment exists and belongs to the user
    const assessment = await prisma.assessment.findFirst({
      where: {
        id: assessmentId,
        userId: session.user.id
      }
    })

    if (!assessment) {
      return NextResponse.json({ message: 'Assessment not found' }, { status: 404 })
    }

    // Delete the assessment (this will cascade delete findings and exploitResults)
    await prisma.assessment.delete({
      where: { id: assessmentId }
    })

    return NextResponse.json({ 
      success: true,
      message: 'Assessment deleted successfully' 
    })

  } catch (error) {
    console.error('Delete assessment error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}