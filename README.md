# LLM Red Team Agent

A comprehensive web application for autonomous LLM security testing and vulnerability assessment. This tool helps security researchers and developers identify potential vulnerabilities in AI systems using advanced attack vectors and dynamic threat modeling.

## Features

- **Autonomous Security Testing**: AI-powered red team agent that dynamically generates and executes attack vectors
- **Multiple Attack Vectors**: Tests for prompt injection, jailbreaking, information disclosure, unauthorized access, and more
- **OpenRouter Integration**: Supports latest AI models including Claude Sonnet 4, GPT-4o Mini, Llama 4 Scout, and more
- **Real-time Assessment**: Live monitoring and reporting of security tests
- **Detailed Reporting**: Comprehensive vulnerability reports with severity analysis and recommendations
- **User Authentication**: Secure user management with NextAuth.js
- **Export Capabilities**: Export assessment results for further analysis

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes, Prisma ORM
- **Database**: SQLite (configurable to PostgreSQL/MySQL)
- **Authentication**: NextAuth.js
- **AI Integration**: OpenRouter API
- **Deployment**: Vercel-ready

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- OpenRouter API key

### Installation

1. **Clone the repository**
   ```bash

   cd Red_agent
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` with your configuration:
   ```env
   NEXTAUTH_SECRET=your-secret-key-here
   NEXTAUTH_URL=http://localhost:3000
   OPENROUTER_API_KEY=your-openrouter-api-key-here
   DATABASE_URL="file:./dev.db"
   ```

4. **Set up the database**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

### Creating an Account

1. Navigate to the signup page
2. Create an account with your email and password
3. Sign in to access the dashboard

### Running a Security Assessment

1. Click "Start New Assessment" from the dashboard
2. Fill in target information:
   - **Target Name**: Name of the system you're testing
   - **Target Description**: Brief description of the target
   - **Target URL**: (Optional) API endpoint if testing a specific service
3. Configure the red team agent:
   - **OpenRouter API Key**: Your API key for accessing LLM models
   - **Red Team Model**: Choose the AI model for generating attacks
4. Click "Start Security Assessment"
5. Monitor the assessment progress in real-time
6. Review detailed results when complete

### Understanding Results

- **Security Score**: Overall security rating (0-100)
- **Vulnerability Breakdown**: Categorized by severity (High/Medium/Low)
- **Attack Vectors**: Different types of attacks tested
- **Detailed Findings**: Individual vulnerability reports with recommendations

## Supported AI Models

The application integrates with the latest AI models via OpenRouter:

### Recommended Models
- **Claude Sonnet 4** (Anthropic) - State-of-the-art reasoning and security analysis
- **GPT-4o Mini** (OpenAI) - Fast and cost-effective variant of GPT-4o  
- **Llama 4 Scout** (Meta) - Latest open-source model with enhanced capabilities

### Additional Models
- **Hermes 3 Llama 3.1 70B** (Nous Research) - Enhanced instruction following
- **Gemma 3 27B/12B IT** (Google) - Optimized for instruction tuning
- **Qwen 2.5 Coder 7B** (Alibaba) - Specialized for coding and technical tasks

Each model provides different strengths for security testing, from advanced reasoning to cost efficiency.

## Attack Vectors

The red team agent tests for various security vulnerabilities:

- **Prompt Injection**: Attempts to override system instructions
- **Jailbreaking**: Bypass safety guidelines and content filters
- **Information Disclosure**: Extract sensitive system information
- **Unauthorized Access**: Gain access beyond intended permissions
- **Data Extraction**: Retrieve protected or sensitive data
- **Social Engineering**: Psychological manipulation techniques
- **Privacy Violation**: Test data handling and privacy controls
- **Policy Circumvention**: Bypass usage policies and restrictions

## Deployment

### Vercel Deployment

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Deploy to Vercel**
   ```bash
   vercel --prod
   ```

3. **Set environment variables in Vercel dashboard**
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL` 
   - `OPENROUTER_API_KEY`
   - `DATABASE_URL`

### Database Setup for Production

For production, consider using a managed database:

- **PostgreSQL**: Update `DATABASE_URL` to PostgreSQL connection string
- **PlanetScale**: MySQL-compatible serverless database
- **Supabase**: PostgreSQL with additional features

## Security Considerations

- **API Keys**: Never commit API keys to version control
- **Rate Limiting**: Implement rate limiting for production use
- **Audit Logging**: Enable comprehensive logging for security monitoring
- **Access Control**: Ensure proper user authentication and authorization
- **Target Consent**: Only test systems you own or have explicit permission to test

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Disclaimer

This tool is intended for security research and authorized testing only. Users are responsible for ensuring they have proper authorization before testing any systems. The developers are not responsible for any misuse of this tool.

## Support

For support and questions:
- Create an issue on GitHub
- Review the documentation
- Check existing issues for solutions

---

**Warning**: This tool performs security testing that may trigger security alerts or be considered suspicious activity. Only use on systems you own or have explicit written permission to test.
