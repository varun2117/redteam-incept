const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function regenerateReports() {
  try {
    console.log('🔧 Regenerating vulnerability reports with correct data...')
    
    // Clear existing vulnerability reports to force regeneration
    const assessments = await prisma.assessment.findMany({
      where: {
        status: 'completed',
        vulnerabilityReport: { not: null }
      }
    })
    
    console.log(`Found ${assessments.length} completed assessments with reports`)
    
    for (const assessment of assessments) {
      console.log(`🔄 Clearing cached report for: ${assessment.targetName} (${assessment.id})`)
      
      await prisma.assessment.update({
        where: { id: assessment.id },
        data: {
          vulnerabilityReport: null // This will force regeneration
        }
      })
      
      console.log(`✅ Cleared report for ${assessment.targetName}`)
    }
    
    console.log('\n🎉 All vulnerability reports cleared!')
    console.log('📋 Reports will be regenerated automatically when accessed next time.')
    console.log('🔄 Please refresh the assessment page to see updated reports.')
    
  } catch (error) {
    console.error('❌ Error regenerating reports:', error)
  } finally {
    await prisma.$disconnect()
  }
}

regenerateReports()