import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { chatAgentUrl } = await request.json()

    if (!chatAgentUrl) {
      return NextResponse.json(
        { success: false, message: 'Chat agent URL is required' },
        { status: 400 }
      )
    }

    // Test connection to the chat agent
    const testMessage = "Hello! This is a connection test from Red Team Agent."
    const startTime = Date.now()

    try {
      const response = await fetch(chatAgentUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'RedTeam-Agent/1.0'
        },
        body: JSON.stringify({
          message: testMessage,
          conversation: [],
          model: 'meta-llama/llama-4-scout'
        }),
        signal: AbortSignal.timeout(30000) // 30 second timeout
      })

      const responseTime = Date.now() - startTime
      
      if (!response.ok) {
        return NextResponse.json({
          success: false,
          message: `HTTP ${response.status}: ${response.statusText}`,
          details: {
            url: chatAgentUrl,
            responseTime,
            status: response.status
          }
        })
      }

      const data = await response.json()
      
      // Check if the response has the expected structure
      if (!data.success && !data.message) {
        return NextResponse.json({
          success: false,
          message: 'Invalid response format from chat agent',
          details: {
            url: chatAgentUrl,
            responseTime,
            receivedData: data
          }
        })
      }

      return NextResponse.json({
        success: true,
        message: 'Connection successful',
        details: {
          url: chatAgentUrl,
          responseTime,
          agentResponse: data.message || data.choices?.[0]?.message?.content || 'Response received',
          agent: data.agent || null
        }
      })

    } catch (error) {
      const responseTime = Date.now() - startTime
      
      return NextResponse.json({
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: {
          url: chatAgentUrl,
          responseTime,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      })
    }

  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Test connection endpoint is available',
    usage: 'POST to this endpoint with {"chatAgentUrl": "http://your-agent-url"}'
  })
}