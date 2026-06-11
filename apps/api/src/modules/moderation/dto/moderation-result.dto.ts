export interface ModerationResult {
  verdict:       'CLEAN' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  categories:    string[];
  confidence:    number;
  reasoning:     string | null;
  sellerMessage: string | null;
  language?:     string;
  latencyMs:     number;
  modelVersion:  string;
}
