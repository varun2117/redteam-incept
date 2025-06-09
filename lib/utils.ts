import { type ClassValue, clsx } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>\"']/g, '') // Remove potentially dangerous characters
    .trim()
    .slice(0, 1000) // Limit length
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validateApiKey(key: string): boolean {
  // Basic validation for OpenRouter API key format
  return key.startsWith('sk-or-') && key.length > 20
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function generateSecureId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

export function calculateSecurityScore(vulnerabilities: number, totalTests: number): number {
  if (totalTests === 0) return 100
  const vulnerabilityRate = vulnerabilities / totalTests
  return Math.max(0, Math.round((1 - vulnerabilityRate) * 100))
}

export function getSecurityLevel(score: number): {
  level: string
  color: string
  description: string
} {
  if (score >= 80) {
    return {
      level: 'Excellent',
      color: 'text-green-600',
      description: 'Strong security posture with minimal vulnerabilities'
    }
  } else if (score >= 60) {
    return {
      level: 'Good',
      color: 'text-blue-600', 
      description: 'Decent security with some areas for improvement'
    }
  } else if (score >= 40) {
    return {
      level: 'Fair',
      color: 'text-yellow-600',
      description: 'Moderate security risks that should be addressed'
    }
  } else {
    return {
      level: 'Poor',
      color: 'text-red-600',
      description: 'Significant security vulnerabilities requiring immediate attention'
    }
  }
}