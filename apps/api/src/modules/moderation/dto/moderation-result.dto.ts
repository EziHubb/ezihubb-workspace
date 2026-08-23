export interface ModerationResult {
  verdict:       'CLEAN' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  categories:    string[];
  confidence:    number;
  reasoning:     string | null;
  sellerMessage: string | null;
  language?:     string;
  latencyMs:     number;
  modelVersion:  string;
  /**
   * What this check actually cost, from the token counts the API reported.
   *
   * Carried on the result rather than guessed by the caller: an image check
   * costs several times a text one, and the daily budget is only a budget if
   * it is charged the real amount. Absent when the verdict came from local
   * rules or a cache hit, which cost nothing.
   */
  costUsd?:      number;
}
