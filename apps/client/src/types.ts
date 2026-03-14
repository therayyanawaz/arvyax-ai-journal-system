export type Analysis = {
  emotion: string;
  keywords: string[];
  summary: string;
};

export type JournalEntry = {
  id: string;
  userId: string;
  ambience: string;
  text: string;
  createdAt: string;
  analysis: (Analysis & {
    id: string;
    createdAt: string;
    textHash: string;
  }) | null;
};

export type Insights = {
  totalEntries: number;
  topEmotion: string | null;
  mostUsedAmbience: string | null;
  recentKeywords: string[];
};

export type ProviderStatus = {
  name: 'openaiApi' | 'codexChatgpt';
  label: string;
  selected: boolean;
  available: boolean;
  ready: boolean;
  reason: string | null;
};

export type ProviderState = {
  activeProvider: ProviderStatus['name'];
  providers: ProviderStatus[];
};

export type CodexAccountStatus = {
  enabled: boolean;
  available: boolean;
  ready: boolean;
  authStatus: 'unavailable' | 'signed-out' | 'signing-in' | 'signed-in' | 'error';
  authMode: 'apikey' | 'chatgpt' | 'chatgptAuthTokens' | null;
  email: string | null;
  planType: string | null;
  requiresOpenaiAuth: boolean | null;
  rateLimits: {
    primary?: {
      usedPercent?: number | null;
      windowDurationMins?: number | null;
      resetsAt?: number | null;
    } | null;
  } | null;
  availabilityReason: string | null;
  activeLoginId: string | null;
};

export type LoginStatus = {
  loginId: string;
  status: 'pending' | 'success' | 'error';
  error: string | null;
  authUrl: string | null;
};
