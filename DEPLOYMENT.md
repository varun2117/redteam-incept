# Deployment Guide

This guide covers deploying your LLM Red Team Agent to Vercel and setting up a production database.

## Prerequisites

- Vercel account
- OpenRouter API key
- Git repository with your code

## Vercel Deployment

### 1. Install Vercel CLI

```bash
npm i -g vercel
```

### 2. Login to Vercel

```bash
vercel login
```

### 3. Deploy

From your project directory:

```bash
vercel --prod
```

### 4. Set Environment Variables

In the Vercel dashboard, go to your project settings and add these environment variables:

```env
NEXTAUTH_SECRET=your-super-secret-jwt-key-here
NEXTAUTH_URL=https://your-app.vercel.app
OPENROUTER_API_KEY=sk-or-your-openrouter-key-here
DATABASE_URL=your-production-database-url
```

## Database Setup

### Option 1: PlanetScale (Recommended)

1. Sign up at [planetscale.com](https://planetscale.com)
2. Create a new database
3. Get the connection string
4. Update your `DATABASE_URL` environment variable
5. Update `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
  relationMode = "prisma"
}
```

6. Deploy schema:

```bash
npx prisma db push
```

### Option 2: Supabase

1. Sign up at [supabase.com](https://supabase.com)
2. Create a new project
3. Get the PostgreSQL connection string
4. Update your `DATABASE_URL` environment variable
5. Update `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

6. Deploy schema:

```bash
npx prisma db push
```

### Option 3: Railway

1. Sign up at [railway.app](https://railway.app)
2. Create a new PostgreSQL database
3. Get the connection string
4. Follow steps similar to Supabase

## Environment Variables Explained

- **NEXTAUTH_SECRET**: Random string for JWT encryption. Generate with `openssl rand -base64 32`
- **NEXTAUTH_URL**: Your production URL (e.g., https://your-app.vercel.app)
- **OPENROUTER_API_KEY**: Your OpenRouter API key for accessing LLM models
- **DATABASE_URL**: Connection string for your production database

## Post-Deployment Setup

### 1. Test Authentication

- Create a test account
- Verify login/logout works
- Check session persistence

### 2. Test Assessment Creation

- Start a new assessment
- Monitor database records
- Verify background processing

### 3. Monitor Performance

- Check Vercel function logs
- Monitor API response times
- Watch for rate limit issues

## Security Considerations

### Production Checklist

- [ ] All environment variables set correctly
- [ ] Database access restricted to your app
- [ ] HTTPS enforced (automatic with Vercel)
- [ ] Rate limiting enabled
- [ ] Security headers configured
- [ ] Error logging set up
- [ ] API key rotation plan in place

### Monitoring

Set up monitoring for:

- API error rates
- Database connection issues
- OpenRouter API quota usage
- Unusual assessment patterns
- Failed authentication attempts

## Scaling Considerations

### Database

- Monitor connection pool usage
- Set up read replicas if needed
- Enable query performance monitoring
- Plan for data archival

### API Limits

- Monitor OpenRouter usage
- Implement usage quotas per user
- Cache expensive operations
- Optimize prompt lengths

### Storage

- Clean up old assessment data
- Implement data retention policies
- Monitor database size growth

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Check DATABASE_URL format
   - Verify network access
   - Check connection limits

2. **Authentication Issues**
   - Verify NEXTAUTH_SECRET is set
   - Check NEXTAUTH_URL matches domain
   - Ensure cookies are enabled

3. **OpenRouter API Errors**
   - Verify API key is correct
   - Check quota limits
   - Monitor rate limits

4. **Build Failures**
   - Check TypeScript errors
   - Verify all dependencies installed
   - Review build logs

### Debugging Steps

1. Check Vercel function logs
2. Verify environment variables
3. Test API endpoints individually
4. Review database query logs
5. Check external service status

## Maintenance

### Regular Tasks

- Monitor error rates weekly
- Review security logs monthly
- Update dependencies quarterly
- Rotate API keys annually

### Backup Strategy

- Database: Enable automated backups
- Code: Use Git with multiple remotes
- Environment: Document all configurations

## Support

For deployment issues:

1. Check Vercel documentation
2. Review database provider docs
3. Search existing GitHub issues
4. Create new issue with:
   - Deployment logs
   - Error messages
   - Environment details
   - Steps to reproduce