'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Shield, Target, Activity, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { ThemeToggle } from '@/components/theme-toggle'

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/signin')
    }
  }, [session, status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loader"></div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <Shield className="h-8 w-8 text-red-600" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">LLM Red Team Agent</h1>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <span className="text-sm text-gray-600 dark:text-gray-300">
                Welcome, {session.user?.name || session.user?.email}
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
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Autonomous LLM Security Testing
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Comprehensive vulnerability assessment and red team testing for AI systems using advanced attack vectors and dynamic threat modeling.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md hover:shadow-lg transition-all border border-gray-200 dark:border-gray-700">
            <div className="flex items-center mb-4">
              <Target className="h-8 w-8 text-red-600 mr-3" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Target Discovery</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300">
              Automatically analyze and understand target systems to identify potential attack surfaces and vulnerabilities.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md hover:shadow-lg transition-all border border-gray-200 dark:border-gray-700">
            <div className="flex items-center mb-4">
              <Activity className="h-8 w-8 text-red-600 mr-3" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Dynamic Testing</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300">
              Generate and execute sophisticated attack vectors dynamically based on target system analysis.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md hover:shadow-lg transition-all border border-gray-200 dark:border-gray-700">
            <div className="flex items-center mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600 mr-3" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Vulnerability Analysis</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300">
              Comprehensive reporting and analysis of discovered vulnerabilities with actionable recommendations.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="text-center space-y-4">
          <Link
            href="/assessment/new"
            className="inline-flex items-center px-8 py-4 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors shadow-lg"
          >
            <Shield className="mr-2 h-5 w-5" />
            Start New Assessment
          </Link>
          
          <div className="mt-4">
            <Link
              href="/assessments"
              className="inline-flex items-center px-6 py-3 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
            >
              View Previous Assessments
            </Link>
          </div>
        </div>

        {/* Stats Section */}
        <div className="mt-16 bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 border border-gray-200 dark:border-gray-700 transition-colors">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 text-center mb-8">
            Security Testing Capabilities
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-red-600 mb-2">8+</div>
              <div className="text-gray-600 dark:text-gray-300">Attack Vectors</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-red-600 mb-2">100+</div>
              <div className="text-gray-600 dark:text-gray-300">Test Techniques</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-red-600 mb-2">Real-time</div>
              <div className="text-gray-600 dark:text-gray-300">Analysis</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-red-600 mb-2">Detailed</div>
              <div className="text-gray-600 dark:text-gray-300">Reporting</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}