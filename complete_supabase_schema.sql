-- Red Team Assessment Platform - Complete Supabase SQL Schema
-- Production-ready with performance optimizations and security

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tables with your existing structure
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "Account_provider_providerAccountId_key" UNIQUE ("provider", "providerAccountId")
);

CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "sessionToken" TEXT NOT NULL UNIQUE,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "name" TEXT,
    "email" TEXT NOT NULL UNIQUE,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL UNIQUE,
    "expires" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VerificationToken_identifier_token_key" UNIQUE ("identifier", "token")
);

CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    "targetName" TEXT NOT NULL,
    "targetDescription" TEXT,
    "status" TEXT NOT NULL DEFAULT 'running',
    "systemAnalysis" TEXT,
    "totalTests" INTEGER NOT NULL DEFAULT 0,
    "vulnerabilities" INTEGER NOT NULL DEFAULT 0,
    "securityScore" DOUBLE PRECISION,
    "vulnerabilityReport" TEXT,
    "riskLevel" TEXT,
    "executionTime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Finding" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "assessmentId" TEXT NOT NULL,
    "vector" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "technique" TEXT,
    "vulnerable" BOOLEAN NOT NULL DEFAULT false,
    "vulnerabilityType" TEXT,
    "severity" TEXT,
    "explanation" TEXT,
    "recommendations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ExploitResult" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "assessmentId" TEXT NOT NULL,
    "exploitName" TEXT NOT NULL,
    "description" TEXT,
    "stageNumber" INTEGER NOT NULL,
    "stagePurpose" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "vulnerabilityFound" BOOLEAN NOT NULL DEFAULT false,
    "vulnerabilityType" TEXT,
    "severity" TEXT,
    "keyInformation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key constraints
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExploitResult" ADD CONSTRAINT "ExploitResult_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ========================================
-- PERFORMANCE OPTIMIZATIONS
-- ========================================

-- Create indexes for better query performance
CREATE INDEX "Account_userId_idx" ON "Account"("userId");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_sessionToken_idx" ON "Session"("sessionToken");
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE INDEX "Assessment_userId_idx" ON "Assessment"("userId");
CREATE INDEX "Assessment_status_idx" ON "Assessment"("status");
CREATE INDEX "Assessment_createdAt_idx" ON "Assessment"("createdAt");
CREATE INDEX "Assessment_userId_status_idx" ON "Assessment"("userId", "status");
CREATE INDEX "Finding_assessmentId_idx" ON "Finding"("assessmentId");
CREATE INDEX "Finding_vulnerable_idx" ON "Finding"("vulnerable");
CREATE INDEX "Finding_severity_idx" ON "Finding"("severity");
CREATE INDEX "Finding_assessmentId_vulnerable_idx" ON "Finding"("assessmentId", "vulnerable");
CREATE INDEX "ExploitResult_assessmentId_idx" ON "ExploitResult"("assessmentId");
CREATE INDEX "ExploitResult_vulnerabilityFound_idx" ON "ExploitResult"("vulnerabilityFound");
CREATE INDEX "ExploitResult_assessmentId_stage_idx" ON "ExploitResult"("assessmentId", "stageNumber");

-- ========================================
-- AUTO-UPDATING TIMESTAMPS
-- ========================================

-- Create trigger function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_user_updated_at 
    BEFORE UPDATE ON "User"
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assessment_updated_at 
    BEFORE UPDATE ON "Assessment"
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- ROW LEVEL SECURITY (RLS)
-- ========================================

-- Enable Row Level Security for multi-tenant data isolation
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Assessment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Finding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExploitResult" ENABLE ROW LEVEL SECURITY;

-- ========================================
-- RLS POLICIES - Users can only access their own data
-- ========================================

-- User policies
CREATE POLICY "Users can view own profile" ON "User"
    FOR ALL USING (auth.uid()::text = "id");

-- Account policies  
CREATE POLICY "Users can view own accounts" ON "Account"
    FOR ALL USING (auth.uid()::text = "userId");

-- Session policies
CREATE POLICY "Users can view own sessions" ON "Session"
    FOR ALL USING (auth.uid()::text = "userId");

-- Assessment policies
CREATE POLICY "Users can view own assessments" ON "Assessment"
    FOR ALL USING (auth.uid()::text = "userId");

CREATE POLICY "Users can insert own assessments" ON "Assessment"
    FOR INSERT WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "Users can update own assessments" ON "Assessment"
    FOR UPDATE USING (auth.uid()::text = "userId");

CREATE POLICY "Users can delete own assessments" ON "Assessment"
    FOR DELETE USING (auth.uid()::text = "userId");

-- Finding policies
CREATE POLICY "Users can view findings for own assessments" ON "Finding"
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM "Assessment" 
            WHERE "Assessment"."id" = "Finding"."assessmentId" 
            AND "Assessment"."userId" = auth.uid()::text
        )
    );

CREATE POLICY "Users can insert findings for own assessments" ON "Finding"
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM "Assessment" 
            WHERE "Assessment"."id" = "Finding"."assessmentId" 
            AND "Assessment"."userId" = auth.uid()::text
        )
    );

-- ExploitResult policies
CREATE POLICY "Users can view exploit results for own assessments" ON "ExploitResult"
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM "Assessment" 
            WHERE "Assessment"."id" = "ExploitResult"."assessmentId" 
            AND "Assessment"."userId" = auth.uid()::text
        )
    );

CREATE POLICY "Users can insert exploit results for own assessments" ON "ExploitResult"
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM "Assessment" 
            WHERE "Assessment"."id" = "ExploitResult"."assessmentId" 
            AND "Assessment"."userId" = auth.uid()::text
        )
    );

-- ========================================
-- PERMISSIONS
-- ========================================

-- Grant necessary permissions for Supabase
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- ========================================
-- HELPFUL VIEWS FOR ANALYTICS
-- ========================================

-- View for assessment statistics
CREATE OR REPLACE VIEW assessment_stats AS
SELECT 
    u."email",
    u."name",
    COUNT(a."id") as total_assessments,
    COUNT(CASE WHEN a."status" = 'completed' THEN 1 END) as completed_assessments,
    COUNT(CASE WHEN a."status" = 'running' THEN 1 END) as running_assessments,
    COUNT(CASE WHEN a."status" = 'failed' THEN 1 END) as failed_assessments,
    AVG(a."securityScore") as avg_security_score,
    SUM(a."vulnerabilities") as total_vulnerabilities_found
FROM "User" u
LEFT JOIN "Assessment" a ON u."id" = a."userId"
GROUP BY u."id", u."email", u."name";

-- View for vulnerability summary
CREATE OR REPLACE VIEW vulnerability_summary AS
SELECT 
    a."id" as assessment_id,
    a."targetName",
    a."status",
    a."riskLevel",
    COUNT(f."id") as total_findings,
    COUNT(CASE WHEN f."vulnerable" = true THEN 1 END) as vulnerable_findings,
    COUNT(CASE WHEN f."severity" = 'High' THEN 1 END) as high_severity_findings,
    COUNT(CASE WHEN f."severity" = 'Medium' THEN 1 END) as medium_severity_findings,
    COUNT(CASE WHEN f."severity" = 'Low' THEN 1 END) as low_severity_findings,
    COUNT(er."id") as total_exploit_attempts,
    COUNT(CASE WHEN er."vulnerabilityFound" = true THEN 1 END) as successful_exploits
FROM "Assessment" a
LEFT JOIN "Finding" f ON a."id" = f."assessmentId"
LEFT JOIN "ExploitResult" er ON a."id" = er."assessmentId"
GROUP BY a."id", a."targetName", a."status", a."riskLevel";

-- Grant permissions on views
GRANT SELECT ON assessment_stats TO authenticated;
GRANT SELECT ON vulnerability_summary TO authenticated;

-- ========================================
-- COMPLETION MESSAGE
-- ========================================

-- Insert a test comment to verify everything worked
-- SELECT 'Red Team Assessment Platform database schema created successfully!' as status;