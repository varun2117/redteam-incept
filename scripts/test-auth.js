const fetch = require('node-fetch')

async function testAuthentication() {
  const baseUrl = 'http://localhost:3003'
  
  console.log('🔐 Testing Authentication Security...\n')
  
  // Test 1: Try to login with wrong password
  console.log('Test 1: Login with WRONG password')
  try {
    const response = await fetch(`${baseUrl}/api/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'varunkaleeswaran@gmail.com',
        password: 'wrongpassword'
      })
    })
    const result = await response.text()
    console.log('❌ Response:', response.status, result.substring(0, 100))
  } catch (error) {
    console.log('❌ Error (expected):', error.message)
  }
  
  // Test 2: Try to login with correct password
  console.log('\nTest 2: Login with CORRECT password')
  try {
    const response = await fetch(`${baseUrl}/api/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'varunkaleeswaran@gmail.com',
        password: 'password123'
      })
    })
    const result = await response.text()
    console.log('✅ Response:', response.status, result.substring(0, 100))
  } catch (error) {
    console.log('Response:', error.message)
  }
  
  // Test 3: Try to login with non-existent user
  console.log('\nTest 3: Login with NON-EXISTENT user')
  try {
    const response = await fetch(`${baseUrl}/api/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent@test.com',
        password: 'anypassword'
      })
    })
    const result = await response.text()
    console.log('❌ Response:', response.status, result.substring(0, 100))
  } catch (error) {
    console.log('❌ Error (expected):', error.message)
  }
  
  console.log('\n🎉 Authentication testing completed!')
  console.log('✅ If wrong passwords are rejected, the vulnerability is FIXED!')
}

testAuthentication().catch(console.error)