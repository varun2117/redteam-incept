import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('🔥 TEST ROUTE - Assessment ID:', params.id)
  return NextResponse.json({ 
    message: 'Test route working', 
    id: params.id,
    timestamp: new Date().toISOString()
  })
}