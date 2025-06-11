import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

    // Get report from database
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        findings: true,
        exploitResults: true
      }
    })

    if (!assessment) {
      return NextResponse.json({
        success: false,
        message: 'Assessment not found'
      }, { status: 404 })
    }

    if (assessment.status !== 'completed') {
      return NextResponse.json({
        success: false,
        message: 'Assessment not completed yet'
      }, { status: 400 })
    }

    let report = null;
    
    if (assessment.vulnerabilityReport) {
      try {
        report = JSON.parse(assessment.vulnerabilityReport)
      } catch (error) {
        console.error('Error parsing vulnerability report:', error)
        return NextResponse.json({
          success: false,
          message: 'Error parsing vulnerability report'
        }, { status: 500 })
      }
    } else {
      return NextResponse.json({
        success: false,
        message: 'Vulnerability report not available'
      }, { status: 400 })
    }

    // Return based on format
    switch (format) {
      case 'json':
        return NextResponse.json({
          success: true,
          report
        })
        
      case 'html':
        const htmlReport = generateHtmlReport(report)
        return new NextResponse(htmlReport, {
          headers: {
            'Content-Type': 'text/html',
            'Content-Disposition': `attachment; filename="vulnerability-report-${assessmentId}.html"`
          }
        })
        
      case 'text':
        const textReport = generateTextReport(report)
        return new NextResponse(textReport, {
          headers: {
            'Content-Type': 'text/plain',
            'Content-Disposition': `attachment; filename="vulnerability-report-${assessmentId}.txt"`
          }
        })
        
      default:
        return NextResponse.json({
          success: false,
          message: 'Invalid format. Supported formats: json, html, text'
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Report API error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

function generateHtmlReport(report: any): string {
  const { executiveSummary, systemAnalysis, detailedFindings, recommendations } = report
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Assessment Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        h1, h2, h3 { color: #333; }
        .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 30px; }
        .summary { background: #f4f4f4; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .risk-low { color: #28a745; }
        .risk-medium { color: #ffc107; }
        .risk-high { color: #fd7e14; }
        .risk-critical { color: #dc3545; }
        .finding { border-left: 4px solid #007bff; padding-left: 15px; margin: 15px 0; }
        .vulnerable { border-left-color: #dc3545; }
        .safe { border-left-color: #28a745; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f2f2f2; }
        .recommendations { background: #e7f3ff; padding: 20px; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Security Assessment Report</h1>
        <p><strong>Target:</strong> ${report.targetName}</p>
        <p><strong>Assessment ID:</strong> ${report.assessmentId}</p>
        <p><strong>Date:</strong> ${new Date(report.executionDate).toLocaleDateString()}</p>
    </div>

    <div class="summary">
        <h2>Executive Summary</h2>
        <p><strong>Risk Level:</strong> <span class="risk-${executiveSummary.riskLevel.toLowerCase()}">${executiveSummary.riskLevel}</span></p>
        <p><strong>Security Score:</strong> ${executiveSummary.securityScore}/100</p>
        <p><strong>Total Tests:</strong> ${executiveSummary.totalTests}</p>
        <p><strong>Vulnerabilities Found:</strong> ${executiveSummary.vulnerabilities}</p>
        ${executiveSummary.keyFindings.length > 0 ? `
        <p><strong>Key Findings:</strong></p>
        <ul>
            ${executiveSummary.keyFindings.map((finding: string) => `<li>${finding}</li>`).join('')}
        </ul>
        ` : ''}
    </div>

    <h2>System Analysis</h2>
    <p><strong>Purpose:</strong> ${systemAnalysis.system_purpose}</p>
    <p><strong>Constraints:</strong> ${systemAnalysis.system_constraints.join(', ')}</p>
    <p><strong>Content Policies:</strong> ${systemAnalysis.content_policies.join(', ')}</p>

    <h2>Detailed Findings</h2>
    ${detailedFindings.map((vectorResult: any) => `
        <div class="finding">
            <h3>${vectorResult.vector.replace('_', ' ').toUpperCase()}</h3>
            <p>${vectorResult.summary}</p>
            ${vectorResult.findings.map((finding: any) => `
                <div class="${finding.analysis.vulnerable ? 'vulnerable' : 'safe'}" style="margin: 10px 0; padding: 10px; border: 1px solid #ddd;">
                    <p><strong>Test:</strong> ${finding.test_case.technique}</p>
                    <p><strong>Vulnerable:</strong> ${finding.analysis.vulnerable ? 'Yes' : 'No'}</p>
                    ${finding.analysis.vulnerable ? `
                        <p><strong>Severity:</strong> ${finding.analysis.severity}</p>
                        <p><strong>Explanation:</strong> ${finding.analysis.explanation}</p>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    `).join('')}

    <div class="recommendations">
        <h2>Recommendations</h2>
        <ul>
            ${recommendations.map((rec: string) => `<li>${rec}</li>`).join('')}
        </ul>
    </div>

    <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 0.9em; color: #666;">
        <p><strong>Methodology:</strong> ${report.methodology}</p>
        <p><strong>Disclaimer:</strong> ${report.disclaimer}</p>
    </footer>
</body>
</html>
  `.trim()
}

function generateTextReport(report: any): string {
  const { executiveSummary, systemAnalysis, detailedFindings, recommendations } = report
  
  return `
SECURITY ASSESSMENT REPORT
==========================

Target: ${report.targetName}
Assessment ID: ${report.assessmentId}
Date: ${new Date(report.executionDate).toLocaleDateString()}

EXECUTIVE SUMMARY
-----------------
Risk Level: ${executiveSummary.riskLevel}
Security Score: ${executiveSummary.securityScore}/100
Total Tests: ${executiveSummary.totalTests}
Vulnerabilities Found: ${executiveSummary.vulnerabilities}

${executiveSummary.keyFindings.length > 0 ? `Key Findings:
${executiveSummary.keyFindings.map((finding: string) => `- ${finding}`).join('\n')}
` : ''}

SYSTEM ANALYSIS
---------------
Purpose: ${systemAnalysis.system_purpose}
Constraints: ${systemAnalysis.system_constraints.join(', ')}
Content Policies: ${systemAnalysis.content_policies.join(', ')}

DETAILED FINDINGS
-----------------
${detailedFindings.map((vectorResult: any) => `
${vectorResult.vector.replace('_', ' ').toUpperCase()}
${'='.repeat(vectorResult.vector.length)}
${vectorResult.summary}

${vectorResult.findings.map((finding: any) => `
  Test: ${finding.test_case.technique}
  Vulnerable: ${finding.analysis.vulnerable ? 'Yes' : 'No'}
  ${finding.analysis.vulnerable ? `Severity: ${finding.analysis.severity}
  Explanation: ${finding.analysis.explanation}` : ''}
  ---
`).join('')}
`).join('')}

RECOMMENDATIONS
---------------
${recommendations.map((rec: string, index: number) => `${index + 1}. ${rec}`).join('\n')}

METHODOLOGY
-----------
${report.methodology}

DISCLAIMER
----------
${report.disclaimer}
  `.trim()
}