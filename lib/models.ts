export interface ModelInfo {
  id: string
  name: string
  provider: string
  category: string
  description: string
  strengths: string[]
  contextWindow: number
  pricing: {
    input: number // per 1M tokens
    output: number // per 1M tokens
  }
  recommended: boolean
}

export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: 'anthropic/claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'Anthropic',
    category: 'Latest Generation',
    description: 'State-of-the-art reasoning and analysis capabilities',
    strengths: ['Advanced reasoning', 'Security analysis', 'Code understanding'],
    contextWindow: 200000,
    pricing: { input: 3.0, output: 15.0 },
    recommended: true
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    category: 'Efficient',
    description: 'Fast and cost-effective variant of GPT-4o',
    strengths: ['Speed', 'Cost efficiency', 'General purpose'],
    contextWindow: 128000,
    pricing: { input: 0.15, output: 0.6 },
    recommended: true
  },
  {
    id: 'meta-llama/llama-4-scout',
    name: 'Llama 4 Scout',
    provider: 'Meta',
    category: 'Open Source',
    description: 'Meta\'s latest open-source model with enhanced capabilities',
    strengths: ['Open source', 'Multilingual', 'Research-friendly'],
    contextWindow: 128000,
    pricing: { input: 0.2, output: 0.8 },
    recommended: true
  },
  {
    id: 'nousresearch/hermes-3-llama-3.1-70b',
    name: 'Hermes 3 Llama 3.1 70B',
    provider: 'Nous Research',
    category: 'Fine-tuned',
    description: 'Enhanced Llama model fine-tuned for instruction following',
    strengths: ['Instruction following', 'Creative tasks', 'Technical analysis'],
    contextWindow: 128000,
    pricing: { input: 0.9, output: 0.9 },
    recommended: false
  },
  {
    id: 'google/gemma-3-27b-it',
    name: 'Gemma 3 27B IT',
    provider: 'Google',
    category: 'Google AI',
    description: 'Google\'s latest Gemma model optimized for instruction tuning',
    strengths: ['Instruction tuning', 'Safety', 'Efficiency'],
    contextWindow: 8192,
    pricing: { input: 0.27, output: 0.27 },
    recommended: false
  },
  {
    id: 'google/gemma-3-12b-it',
    name: 'Gemma 3 12B IT',
    provider: 'Google',
    category: 'Google AI',
    description: 'Smaller variant of Gemma 3 with good performance',
    strengths: ['Compact size', 'Good performance', 'Cost effective'],
    contextWindow: 8192,
    pricing: { input: 0.12, output: 0.12 },
    recommended: false
  },
  {
    id: 'qwen/qwen2.5-coder-7b-instruct',
    name: 'Qwen 2.5 Coder 7B',
    provider: 'Alibaba',
    category: 'Code Specialized',
    description: 'Specialized model for coding and technical tasks',
    strengths: ['Code generation', 'Technical analysis', 'Programming'],
    contextWindow: 32768,
    pricing: { input: 0.07, output: 0.07 },
    recommended: false
  }
]

export const getModelById = (id: string): ModelInfo | undefined => {
  return AVAILABLE_MODELS.find(model => model.id === id)
}

export const getRecommendedModels = (): ModelInfo[] => {
  return AVAILABLE_MODELS.filter(model => model.recommended)
}

export const getModelsByProvider = (provider: string): ModelInfo[] => {
  return AVAILABLE_MODELS.filter(model => model.provider === provider)
}

export const getModelsByCategory = (category: string): ModelInfo[] => {
  return AVAILABLE_MODELS.filter(model => model.category === category)
}