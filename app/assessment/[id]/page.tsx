'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { 
  Shield, 
  Target, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Download,
  Eye,
  ArrowLeft,
  TrendingUp,
  TrendingDown
} from 'lucide-react'
import toast from 'react-hot-toast'
import { ThemeToggle } from '@/components/theme-toggle'

interface Assessment {
  id: string
  targetName: string
  targetDescription: string
  status: string
  totalTests: number
  vulnerabilities: number
  securityScore: number
  systemAnalysis: any
  findings: Finding[]
  exploitResults: any[]
  vulnerabilityReport?: VulnerabilityReport
  riskLevel?: string
  executionTime?: string
  createdAt: string
  updatedAt: string
}

interface VulnerabilityReport {
  assessmentId: string
  targetName: string
  targetDescription?: string
  executionDate: Date
  executionTime: string
  systemAnalysis: any
  executiveSummary: {
    totalTests: number
    vulnerabilities: number
    securityScore: number
    riskLevel: 'Low' | 'Medium' | 'High' | 'Critical'
    keyFindings: string[]
  }
  detailedFindings: {
    vector: string
    findings: any[]
    summary: string
  }[]
  recommendations: string[]
  methodology: string
  disclaimer: string
}

interface Finding {
  id: string
  vector: string
  prompt: string
  response: string
  technique: string
  vulnerable: boolean
  vulnerabilityType: string
  severity: string
  explanation: string
  recommendations: string
  createdAt: string
}

export default function AssessmentDetails() {
  const { data: session } = useSession()
  const router = useRouter()
  const params = useParams()
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null)
  const [vulnerabilityReport, setVulnerabilityReport] = useState<VulnerabilityReport | null>(null)
  const [reportLoading, setReportLoading] = useState(false)

  useEffect(() => {
    if (session && params.id) {
      fetchAssessment()
      // Poll for updates if assessment is running
      const interval = setInterval(() => {
        if (assessment?.status === 'running') {
          fetchAssessment()
        }
      }, 5000)

      return () => clearInterval(interval)
    }
  }, [session, params.id, assessment?.status])

  const fetchAssessment = async () => {
    try {
      console.log('Fetching assessment:', params.id)
      const response = await fetch(`/api/assessment/${params.id}`)
      console.log('Assessment response status:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('Raw assessment data:', data)
        
        // Frontend API returns assessment directly
        const assessmentData = {
          findings: [],
          totalTests: 0,
          vulnerabilities: 0,
          securityScore: null,
          exploitResults: [],
          systemAnalysis: null,
          ...data
        }
        console.log('Processed assessment data:', assessmentData)
        setAssessment(assessmentData)
        
        // Load vulnerability report if assessment is completed
        if (assessmentData.status === 'completed') {
          loadVulnerabilityReport()
        }
      } else {
        const errorText = await response.text()
        console.error('Failed to load assessment:', response.status, errorText)
        toast.error('Failed to load assessment')
        router.push('/assessments')
      }
    } catch (error) {
      console.error('Error loading assessment:', error)
      toast.error('Error loading assessment')
    } finally {
      setLoading(false)
    }
  }

  const loadVulnerabilityReport = async () => {
    try {
      setReportLoading(true)
      const response = await fetch(`/api/assessment/${params.id}/report?format=json`)
      if (response.ok) {
        const data = await response.json()
        setVulnerabilityReport(data.report)
      }
    } catch (error) {
      console.error('Error loading vulnerability report:', error)
    } finally {
      setReportLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Clock className="h-5 w-5 text-yellow-600 animate-spin" />
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'failed':
        return <AlertTriangle className="h-5 w-5 text-red-600" />
      default:
        return <Activity className="h-5 w-5 text-gray-600" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'low':
        return 'bg-green-100 text-green-800 border-green-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel?.toLowerCase()) {
      case 'critical':
        return 'bg-red-600 text-white'
      case 'high':
        return 'bg-red-500 text-white'
      case 'medium':
        return 'bg-yellow-500 text-white'
      case 'low':
        return 'bg-green-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  const exportResults = async (format: 'json' | 'html' | 'text' = 'json') => {
    if (!assessment) return
    
    try {
      if (format === 'json') {
        // For JSON, fetch and download as before
        const reportResponse = await fetch(`/api/assessment/${assessment.id}/report?format=json`)
        
        if (reportResponse.ok) {
          const reportData = await reportResponse.json()
          const dataStr = JSON.stringify(reportData.report, null, 2)
          const dataBlob = new Blob([dataStr], { type: 'application/json' })
          const url = URL.createObjectURL(dataBlob)
          const link = document.createElement('a')
          link.href = url
          link.download = `vulnerability-report-${assessment.id}.json`
          link.click()
          URL.revokeObjectURL(url)
          toast.success('Report exported as JSON')
        } else {
          throw new Error('Failed to get JSON report')
        }
      } else {
        // For HTML and text, download the file directly
        console.log(`Attempting to export ${format} report for assessment ${assessment.id}`)
        const reportResponse = await fetch(`/api/assessment/${assessment.id}/report?format=${format}`)
        
        if (reportResponse.ok) {
          // Check content type to ensure we got the right format
          const contentType = reportResponse.headers.get('content-type')
          console.log(`Response content type: ${contentType}`)
          
          const blob = await reportResponse.blob()
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = `vulnerability-report-${assessment.id}.${format === 'html' ? 'html' : 'txt'}`
          document.body.appendChild(link) // Ensure link is in DOM
          link.click()
          document.body.removeChild(link) // Clean up
          URL.revokeObjectURL(url)
          toast.success(`Report exported as ${format.toUpperCase()}`)
        } else {
          const errorText = await reportResponse.text()
          console.error(`Export failed for ${format}:`, errorText)
          throw new Error(`Failed to get ${format} report: ${errorText}`)
        }
      }
    } catch (error) {
      console.error('Export error:', error)
      // Fallback to basic export
      const exportData = {
        assessment: {
          id: assessment.id,
          targetName: assessment.targetName,
          status: assessment.status,
          totalTests: assessment.totalTests,
          vulnerabilities: assessment.vulnerabilities,
          securityScore: assessment.securityScore,
          createdAt: assessment.createdAt
        },
        findings: assessment.findings,
        systemAnalysis: assessment.systemAnalysis
      }
      
      const dataStr = JSON.stringify(exportData, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `assessment-${assessment.id}-basic.json`
      link.click()
      URL.revokeObjectURL(url)
      toast.success('Basic results exported')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loader"></div>
      </div>
    )
  }

  if (!assessment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Assessment not found</h2>
        </div>
      </div>
    )
  }

  // Safety check for findings array
  const findings = assessment.findings || []
  const vulnerableFindings = findings.filter(f => f.vulnerable)
  const severityCounts = {
    high: vulnerableFindings.filter(f => f.severity?.toLowerCase() === 'high').length,
    medium: vulnerableFindings.filter(f => f.severity?.toLowerCase() === 'medium').length,
    low: vulnerableFindings.filter(f => f.severity?.toLowerCase() === 'low').length
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <Link href="/" className="flex items-center space-x-3 hover:opacity-80">
                <Shield className="h-8 w-8 text-red-600" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">LLM Red Team Agent</h1>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {session?.user?.name || session?.user?.email}
              </span>
              <Link
                href="/api/auth/signout"
                className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Sign Out
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 mb-6">
          <Link href="/" className="hover:text-gray-900 dark:hover:text-gray-100">Home</Link>
          <span>/</span>
          <Link href="/assessments" className="hover:text-gray-900 dark:hover:text-gray-100">Assessments</Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-gray-100">{assessment.targetName}</span>
        </div>

        {/* Assessment Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8 border border-gray-200 dark:border-gray-700 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Target className="h-8 w-8 text-red-600" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{assessment.targetName}</h2>
                <p className="text-gray-600 dark:text-gray-300">{assessment.targetDescription}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                {getStatusIcon(assessment.status)}
                <span className="capitalize font-medium">{assessment.status}</span>
              </div>
              {assessment.status === 'completed' && (
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <button
                      onClick={() => document.getElementById('export-dropdown')?.classList.toggle('hidden')}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      <span>Export Report</span>
                      <svg className="h-4 w-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <div id="export-dropdown" className="hidden absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg z-10 border border-gray-200 dark:border-gray-700">
                      <div className="py-1">
                        <button
                          onClick={() => {
                            exportResults('html')
                            document.getElementById('export-dropdown')?.classList.add('hidden')
                          }}
                          className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left"
                        >
                          Export as HTML
                        </button>
                        <button
                          onClick={() => {
                            exportResults('text')
                            document.getElementById('export-dropdown')?.classList.add('hidden')
                          }}
                          className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left"
                        >
                          Export as Text
                        </button>
                        <button
                          onClick={() => {
                            exportResults('json')
                            document.getElementById('export-dropdown')?.classList.add('hidden')
                          }}
                          className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left"
                        >
                          Export as JSON
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Assessment Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{assessment.totalTests}</div>
              <div className="text-sm text-gray-600 dark:text-gray-300">Total Tests</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors">
              <div className="text-2xl font-bold text-red-600">{assessment.vulnerabilities}</div>
              <div className="text-sm text-gray-600 dark:text-gray-300">Vulnerabilities</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors">
              <div className="flex items-center space-x-2">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {assessment.securityScore?.toFixed(1) || 'N/A'}
                </div>
                {assessment.securityScore !== null && (
                  assessment.securityScore >= 70 ? 
                    <TrendingUp className="h-5 w-5 text-green-600" /> :
                    <TrendingDown className="h-5 w-5 text-red-600" />
                )}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">Security Score</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors">
              <div className="text-2xl font-bold text-blue-600">
                {new Date(assessment.createdAt).toLocaleDateString()}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">Created</div>
            </div>
          </div>
        </div>

        {/* Severity Distribution */}
        {assessment.status === 'completed' && vulnerableFindings.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Vulnerability Breakdown</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">{severityCounts.high}</div>
                <div className="text-sm text-gray-600 dark:text-gray-300">High Severity</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600">{severityCounts.medium}</div>
                <div className="text-sm text-gray-600 dark:text-gray-300">Medium Severity</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{severityCounts.low}</div>
                <div className="text-sm text-gray-600 dark:text-gray-300">Low Severity</div>
              </div>
            </div>
          </div>
        )}

        {/* Vulnerability Report Section */}
        {assessment.status === 'completed' && vulnerabilityReport && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Comprehensive Security Report</h3>
            
            {/* Executive Summary */}
            <div className="mb-6">
              <h4 className="text-md font-medium text-gray-900 mb-3">Executive Summary</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <div className="text-sm text-gray-600 mb-1">Risk Level</div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskLevelColor(vulnerabilityReport.executiveSummary.riskLevel)}`}>
                    {vulnerabilityReport.executiveSummary.riskLevel}
                  </span>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-600">{Math.round(vulnerabilityReport.executiveSummary.securityScore)}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">Security Score</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{vulnerabilityReport.executiveSummary.totalTests}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">Tests Executed</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-red-600">{vulnerabilityReport.executiveSummary.vulnerabilities}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">Vulnerabilities</div>
                </div>
              </div>

              {vulnerabilityReport.executiveSummary.keyFindings.length > 0 && (
                <div className="mt-4">
                  <h5 className="text-sm font-medium text-gray-900 mb-2">Key Findings</h5>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {vulnerabilityReport.executiveSummary.keyFindings.map((finding, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-red-500 mr-2">•</span>
                        <span>{finding}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* System Analysis */}
            <div className="mb-6">
              <h4 className="text-md font-medium text-gray-900 mb-3">System Analysis</h4>
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors">
                <p className="text-sm text-gray-700"><strong>Purpose:</strong> {vulnerabilityReport.systemAnalysis.system_purpose}</p>
                {vulnerabilityReport.systemAnalysis.system_constraints?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-gray-700 mb-1">System Constraints:</p>
                    <ul className="text-sm text-gray-600 ml-4">
                      {vulnerabilityReport.systemAnalysis.system_constraints.map((constraint: string, index: number) => (
                        <li key={index} className="list-disc">{constraint}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Attack Vector Summaries */}
            <div className="mb-6">
              <h4 className="text-md font-medium text-gray-900 mb-3">Attack Vector Analysis</h4>
              <div className="space-y-3">
                {vulnerabilityReport.detailedFindings.map((vectorData, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-medium text-gray-900 capitalize">
                        {vectorData.vector.replace(/_/g, ' ')}
                      </h5>
                      <span className="text-sm text-gray-500">
                        {vectorData.findings.filter(f => f.analysis?.vulnerable).length} / {vectorData.findings.length} vulnerable
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{vectorData.summary}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendations */}
            {vulnerabilityReport.recommendations.length > 0 && (
              <div className="mb-6">
                <h4 className="text-md font-medium text-gray-900 mb-3">Security Recommendations</h4>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <ol className="text-sm text-gray-700 space-y-2">
                    {vulnerabilityReport.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-blue-600 mr-2 font-medium">{index + 1}.</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}

            {/* Methodology & Disclaimer */}
            <div className="border-t pt-4">
              <details className="mb-3">
                <summary className="text-sm font-medium text-gray-700 cursor-pointer hover:text-gray-900">
                  Assessment Methodology
                </summary>
                <p className="mt-2 text-sm text-gray-600">{vulnerabilityReport.methodology}</p>
              </details>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-800"><strong>Disclaimer:</strong> {vulnerabilityReport.disclaimer}</p>
              </div>
            </div>
          </div>
        )}

        {/* Report Loading State */}
        {assessment.status === 'completed' && reportLoading && !vulnerabilityReport && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8 text-center">
            <div className="loader mx-auto mb-4"></div>
            <p className="text-gray-600">Loading comprehensive security report...</p>
          </div>
        )}

        {/* Findings */}
        {assessment.status === 'completed' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Security Findings ({vulnerableFindings.length} vulnerabilities found)
            </h3>
            
            {vulnerableFindings.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900">No vulnerabilities found</h4>
                <p className="text-gray-600">The target system appears to be secure against the tested attack vectors.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {vulnerableFindings.map((finding) => (
                  <div
                    key={finding.id}
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setSelectedFinding(finding)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(finding.severity)}`}>
                          {finding.severity}
                        </span>
                        <span className="font-medium text-gray-900">{finding.vulnerabilityType}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-500">{finding.vector}</span>
                        <Eye className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 truncate">{finding.explanation}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Running Status */}
        {assessment.status === 'running' && (
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="loader mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Assessment in Progress</h3>
            <p className="text-gray-600">
              The red team agent is analyzing your target system. This may take several minutes.
            </p>
          </div>
        )}
      </main>

      {/* Finding Detail Modal */}
      {selectedFinding && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">Vulnerability Details</h3>
                <button
                  onClick={() => setSelectedFinding(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vulnerability Type</label>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(selectedFinding.severity)}`}>
                      {selectedFinding.severity}
                    </span>
                    <span className="font-medium">{selectedFinding.vulnerabilityType}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Attack Vector</label>
                  <p className="text-sm text-gray-900">{selectedFinding.vector}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Technique</label>
                  <p className="text-sm text-gray-900">{selectedFinding.technique}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Test Prompt</label>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedFinding.prompt}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">System Response</label>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedFinding.response}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Analysis</label>
                  <p className="text-sm text-gray-900">{selectedFinding.explanation}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Recommendations</label>
                  <p className="text-sm text-gray-900">{selectedFinding.recommendations}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}