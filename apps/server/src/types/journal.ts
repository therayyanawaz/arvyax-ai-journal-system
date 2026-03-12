export type AnalysisResponse = {
  emotion: string;
  keywords: string[];
  summary: string;
};

export type EntryResponse = {
  id: string;
  userId: string;
  ambience: string;
  text: string;
  createdAt: string;
  analysis: (AnalysisResponse & { id: string; textHash: string; createdAt: string }) | null;
};

export type InsightsResponse = {
  totalEntries: number;
  topEmotion: string | null;
  mostUsedAmbience: string | null;
  recentKeywords: string[];
};

