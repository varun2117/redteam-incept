-- Red Team Assessment Platform - Supabase SQL Schema
-- Generated from Prisma schema for PostgreSQL

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom function for generating CUID-like IDs
CREATE OR REPLACE FUNCTION generate_cuid() RETURNS TEXT AS $$
BEGIN
    RETURN 'c' || encode(gen_random_bytes(12), 'base64')::text;
END;
$$ LANGUAGE plpgsql;

-- Users table (NextAuth.js compatible)
CREATE TABLE "User" (
    id TEXT PRIMARY KEY DEFAULT generate_cuid(),
    name TEXT,
    email TEXT UNIQUE NOT NULL,
    "emailVerified" TIMESTAMP,
    image TEXT,
    password TEXT, -- Hashed password for credential-based auth
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Accounts table (NextAuth.js OAuth accounts)
CREATE TABLE "Account" (
    id TEXT PRIMARY KEY DEFAULT generate_cuid(),
    "userId" TEXT NOT NULL,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at INTEGER,
    token_type TEXT,
    scope TEXT,
    id_token TEXT,
    session_state TEXT,
    
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE,
    UNIQUE(provider, "providerAccountId")
);

-- Sessions table (NextAuth.js sessions)
CREATE TABLE "Session" (
    id TEXT PRIMARY KEY DEFAULT generate_cuid(),
    "sessionToken" TEXT UNIQUE NOT NULL,
    "userId" TEXT NOT NULL,
    expires TIMESTAMP NOT NULL,
    
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

-- Verification tokens table (NextAuth.js email verification)
CREATE TABLE "VerificationToken" (
    identifier TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires TIMESTAMP NOT NULL,
    
    UNIQUE(identifier, token)
);

-- Assessments table (Red team security assessments)
CREATE TABLE "Assessment" (
    id TEXT PRIMARY KEY DEFAULT generate_cuid(),
    "userId" TEXT NOT NULL,
    "targetName" TEXT NOT NULL,
    "targetDescription" TEXT,
    status TEXT DEFAULT 'running', -- running, completed, failed
    "systemAnalysis" TEXT, -- JSON string
    "totalTests" INTEGER DEFAULT 0,
    vulnerabilities INTEGER DEFAULT 0,
    "securityScore" DECIMAL,
    "vulnerabilityReport" TEXT, -- JSON string of complete vulnerability report
    "riskLevel" TEXT, -- Low, Medium, High, Critical
    "executionTime" TEXT,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT "Assessment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

-- Findings table (Individual test results)
CREATE TABLE "Finding" (
    id TEXT PRIMARY KEY DEFAULT generate_cuid(),
    "assessmentId" TEXT NOT NULL,
    vector TEXT NOT NULL,
    prompt TEXT NOT NULL,
    response TEXT NOT NULL,
    technique TEXT,
    vulnerable BOOLEAN DEFAULT FALSE,
    "vulnerabilityType" TEXT,
    severity TEXT, -- Low, Medium, High
    explanation TEXT,
    recommendations TEXT,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT "Finding_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"(id) ON DELETE CASCADE
);

-- Exploit Results table (Multi-stage exploit attempts)
CREATE TABLE "ExploitResult" (
    id TEXT PRIMARY KEY DEFAULT generate_cuid(),
    "assessmentId" TEXT NOT NULL,
    "exploitName" TEXT NOT NULL,
    description TEXT,
    "stageNumber" INTEGER NOT NULL,
    "stagePurpose" TEXT NOT NULL,
    prompt TEXT NOT NULL,
    response TEXT NOT NULL,
    "vulnerabilityFound" BOOLEAN DEFAULT FALSE,
    "vulnerabilityType" TEXT,
    severity TEXT,
    "keyInformation" TEXT,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT "ExploitResult_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX "Account_userId_idx" ON "Account"("userId");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Assessment_userId_idx" ON "Assessment"("userId");
CREATE INDEX "Assessment_status_idx" ON "Assessment"(status);
CREATE INDEX "Assessment_createdAt_idx" ON "Assessment"("createdAt");
CREATE INDEX "Finding_assessmentId_idx" ON "Finding"("assessmentId");
CREATE INDEX "Finding_vulnerable_idx" ON "Finding"(vulnerable);
CREATE INDEX "ExploitResult_assessmentId_idx" ON "ExploitResult"("assessmentId");

-- Create trigger function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_user_updated_at BEFORE UPDATE ON "User"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assessment_updated_at BEFORE UPDATE ON "Assessment"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) for multi-tenant security
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Assessment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Finding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExploitResult" ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user data isolation
-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON "User"
    FOR ALL USING (auth.uid()::text = id);

CREATE POLICY "Users can view own accounts" ON "Account"
    FOR ALL USING (auth.uid()::text = "userId");

CREATE POLICY "Users can view own sessions" ON "Session"
    FOR ALL USING (auth.uid()::text = "userId");

CREATE POLICY "Users can view own assessments" ON "Assessment"
    FOR ALL USING (auth.uid()::text = "userId");

CREATE POLICY "Users can view own findings" ON "Finding"
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM "Assessment" 
            WHERE "Assessment".id = "Finding"."assessmentId" 
            AND "Assessment"."userId" = auth.uid()::text
        )
    );

CREATE POLICY "Users can view own exploit results" ON "ExploitResult"
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM "Assessment" 
            WHERE "Assessment".id = "ExploitResult"."assessmentId" 
            AND "Assessment"."userId" = auth.uid()::text
        )
    );

-- Insert policies for creating new records
CREATE POLICY "Users can insert own assessments" ON "Assessment"
    FOR INSERT WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "Users can insert findings for own assessments" ON "Finding"
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM "Assessment" 
            WHERE "Assessment".id = "Finding"."assessmentId" 
            AND "Assessment"."userId" = auth.uid()::text
        )
    );

CREATE POLICY "Users can insert exploit results for own assessments" ON "ExploitResult"
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM "Assessment" 
            WHERE "Assessment".id = "ExploitResult"."assessmentId" 
            AND "Assessment"."userId" = auth.uid()::text
        )
    );

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;