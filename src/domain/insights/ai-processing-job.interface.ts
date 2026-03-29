export interface AiProcessingJob {
  userId: string;
  trigger: 'document-processed' | 'manual-request' | 'meal-analyzed';
}
