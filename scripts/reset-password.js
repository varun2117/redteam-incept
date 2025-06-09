const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function resetPassword() {
  const email = 'varunkaleeswaran@gmail.com'
  
  console.log('🔧 Resetting password for:', email)
  console.log('Enter your desired password when prompted...')
  
  // You can change this to whatever password you want
  const newPassword = process.argv[2] || 'password123'
  
  if (!newPassword) {
    console.log('❌ Please provide a password as an argument')
    console.log('Usage: node reset-password.js YOUR_NEW_PASSWORD')
    return
  }
  
  try {
    const hashedPassword = await bcrypt.hash(newPassword, 12)
    
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword }
    })
    
    console.log('✅ Password updated successfully!')
    console.log(`📧 Email: ${email}`)
    console.log(`🔐 New Password: ${newPassword}`)
    
  } catch (error) {
    console.error('❌ Error updating password:', error)
  } finally {
    await prisma.$disconnect()
  }
}

resetPassword()