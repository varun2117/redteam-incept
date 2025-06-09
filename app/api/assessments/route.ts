import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    console.log('GET /api/assessments called')
    
    const session = await getServerSession(authOptions)
    console.log('Session:', session ? `User ID: ${session.user?.id}` : 'No session')
    
    if (!session || !session.user?.id) {
      console.log('No valid session, returning 401')
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    console.log('Querying assessments for user:', session.user.id)
    const assessments = await prisma.assessment.findMany({
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