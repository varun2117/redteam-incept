import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'
    const assessmentId = params.id

    // Forward the request to the backend
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001'
    const backendResponse = await fetch(`${backendUrl}/api/assessment/${assessmentId}/report?format=${format}`)

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text()
      return NextResponse.json(
        { success: false, message: errorText || 'Failed to get report from backend' },
        { status: backendResponse.status }
      )
    }

    // For JSON format, return as JSON
    if (format === 'json') {
      const reportData = await backendResponse.json()
      return NextResponse.json(reportData)
    }

    // For HTML and text formats, return the content directly with appropriate headers
    const content = await backendResponse.text()
    const contentType = format === 'html' ? 'text/html' : 'text/plain'
    const filename = `vulnerability-report-${assessmentId}.${format === 'html' ? 'html' : 'txt'}`

    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })

  } catch (error) {
    console.error('Report API error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}