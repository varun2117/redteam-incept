import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  console.log('🚀 TEST ENDPOINT HIT!')
  return NextResponse.json({ message: 'Test endpoint working' })
}