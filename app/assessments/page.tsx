'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { 
  Shield, 
  Target, 
  Plus,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Trash2
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
  createdAt: string
  updatedAt: string
}

export default function Assessments() {
  const { data: session } = useSession()
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (session) {
      fetchAssessments()
    }
  }, [session])

  // Memoize running count to prevent unnecessary re-renders
  const runningCount = useMemo(() => {
    return assessments.filter(a => a.status === 'running').length
  }, [assessments])

  // Separate effect for auto-refresh (only when there are running assessments)
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    
    if (session && runningCount > 0) {
      console.log('Setting up auto-refresh for', runningCount, 'running assessments')
      interval = setInterval(() => {
        console.log('Auto-refreshing assessments...')
        fetchAssessments()
      }, 5000)
    } else {
      console.log('No running assessments, auto-refresh disabled')
    }
    
    return () => {
      if (interval) {
        console.log('Clearing auto-refresh interval')
        clearInterval(interval)
      }
    }
  }, [session, runningCount])

  // Show info about running assessments when page loads
  useEffect(() => {
    if (assessments.length > 0 && runningCount > 0) {
      toast(`${runningCount} assessment${runningCount > 1 ? 's' : ''} currently running.`, {
        icon: '⏳',
        duration: 3000
      })
    }
  }, [runningCount]) // Only trigger when running count changes

  const fetchAssessments = async () => {
    try {
      console.log('Fetching assessments...')
      const response = await fetch('/api/assessments')
      console.log('Response status:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('Assessments data:', data)
        console.log('Data type:', typeof data)
        console.log('Is array:', Array.isArray(data))
        console.log('Data length:', data?.length)
        setAssessments(data)
        console.log('Assessments state set to:', data)
      } else {
        const errorText = await response.text()
        console.error('Failed to load assessments:', response.status, errorText)
        toast.error('Failed to load assessments')
      }
    } catch (error) {
      console.error('Error loading assessments:', error)
      toast.error('Error loading assessments')
    } finally {
      setLoading(false)
    }
  }

  const deleteAssessment = async (assessmentId: string, assessmentName: string) => {
    if (!confirm(`Are you sure you want to delete the assessment "${assessmentName}"? This action cannot be undone.`)) {
      return
    }

    setDeletingId(assessmentId)
    
    try {
      const response = await fetch(`/api/assessment/${assessmentId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // Remove from local state
        setAssessments(prev => prev.filter(a => a.id !== assessmentId))
        toast.success(`Assessment "${assessmentName}" deleted successfully`)
      } else {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to delete assessment')
      }
    } catch (error) {
      console.error('Error deleting assessment:', error)
      toast.error('Failed to delete assessment: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setDeletingId(null)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Clock className="h-5 w-5 text-yellow-600" />
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'failed':
        return <AlertTriangle className="h-5 w-5 text-red-600" />
      default:
        return <Clock className="h-5 w-5 text-gray-600" />
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loader"></div>
      </div>
    )
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
                {session.user?.name || session.user?.email}
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
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Security Assessments</h2>
            <p className="text-gray-600 dark:text-gray-300 mt-1">View and manage your red team assessments</p>
          </div>
          <Link
            href="/assessment/new"
            className="inline-flex items-center px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            <Plus className="h-5 w-5 mr-2" />
            New Assessment
          </Link>
        </div>

        {/* Assessments List */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="loader"></div>
          </div>
        ) : assessments.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center border border-gray-200 dark:border-gray-700 transition-colors">
            <Target className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">No assessments yet</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Start your first security assessment to identify vulnerabilities in your target system.
            </p>
            <Link
              href="/assessment/new"
              className="inline-flex items-center px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
            >
              <Plus className="h-5 w-5 mr-2" />
              Start First Assessment
            </Link>
          </div>
        ) : (
          <div className="grid gap-6">
            {assessments.map((assessment) => (
              <div key={assessment.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-all border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <Link href={`/assessment/${assessment.id}`} className="flex items-center space-x-3 flex-1 hover:opacity-80">
                    <Target className="h-6 w-6 text-red-600" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{assessment.targetName}</h3>
                  </Link>
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(assessment.status)}
                      <span className="text-sm font-medium capitalize">{assessment.status}</span>
                      {assessment.status === 'running' && (
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                          <span className="text-xs text-yellow-600">In Progress</span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        deleteAssessment(assessment.id, assessment.targetName)
                      }}
                      disabled={deletingId === assessment.id}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Delete assessment"
                    >
                      {deletingId === assessment.id ? (
                        <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <Link href={`/assessment/${assessment.id}`} className="block hover:opacity-95 cursor-pointer">
                  {assessment.targetDescription && (
                    <p className="text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">{assessment.targetDescription}</p>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{assessment.totalTests}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Tests</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{assessment.vulnerabilities}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Vulnerabilities</div>
                    </div>
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${getScoreColor(assessment.securityScore || 0)}`}>
                        {assessment.securityScore?.toFixed(1) || 'N/A'}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Score</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {new Date(assessment.createdAt).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Created</div>
                    </div>
                  </div>

                  {assessment.status === 'completed' && assessment.securityScore !== null && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-300">Security Status:</span>
                      <div className="flex items-center space-x-1">
                        {assessment.securityScore >= 70 ? (
                          <>
                            <TrendingUp className="h-4 w-4 text-green-600" />
                            <span className="text-green-600 font-medium">Good</span>
                          </>
                        ) : assessment.securityScore >= 40 ? (
                          <>
                            <span className="text-yellow-600 font-medium">Moderate</span>
                          </>
                        ) : (
                          <>
                            <TrendingDown className="h-4 w-4 text-red-600" />
                            <span className="text-red-600 font-medium">Poor</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}