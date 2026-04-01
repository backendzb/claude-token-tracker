export interface UsageRecord {
  timestamp: string;
  session_id: string;
  request_id: string;
  message_id: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  speed: string;
  cost_usd: number;
  content: string;
  content_preview: string;
  user_query: string;
  project: string;
  cwd: string;
}

export interface UsageOptions {
  since?: string;
  until?: string;
  project?: string;
  sessionId?: string;
}

export interface Settings {
  dailyBudget: number;
  monthlyBudget: number;
  requestThreshold: number;
  shortcut: string;
  floatShortcut: string;
  theme: 'dark' | 'light';
  floatOpacity: number;
}

export interface BucketData {
  id: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
  requestCount: number;
  totalTokens: number;
  costUSD: number;
  burnRate: number;
  models: string[];
  projection: { totalCost: number; remainingMinutes: number } | null;
}

export interface SessionSummary {
  sessionId: string;
  project: string;
  requestCount: number;
  totalTokens: number;
  totalCost: number;
  models: string[];
  firstTimestamp: string;
  lastTimestamp: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}
