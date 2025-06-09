const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function fixExistingUsers() {
  try {
    console.log('🔧 Fixing existing users without passwords...')
    
    // Find users without passwords
    const usersWithoutPasswords = await prisma.user.findMany({
      where: {
        password: null
      }
    })
    
    console.log(`Found ${usersWithoutPasswords.length} users without passwords`)
    
    // Update each user with a default password
    for (const user of usersWithoutPasswords) {
      const defaultPassword = 'password123' // Default password for existing users
      const hashedPassword = await bcrypt.hash(defaultPassword, 12)
      
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
      })
      
      console.log(`✅ Updated user: ${user.email} with default password`)
    }
    
    console.log('🎉 All existing users updated with hashed passwords!')
    console.log('📋 Default password for existing users: password123')
    console.log('⚠️  Please tell users to change their passwords!')
    
  } catch (error) {
    console.error('❌ Error fixing users:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixExistingUsers()