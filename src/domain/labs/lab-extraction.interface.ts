import { LabResultStatus, LabResultType } from '../common/enums/domain.enums';

export interface ExtractedLabItem {
  name: string;
  normalizedName: string;
  type: LabResultType;
  value: number;
  unit: string;
  referenceRange?: {
    low?: number;
    high?: number;
    text?: string;
  };
  status: LabResultStatus;
  confidence: number;
  measuredAt?: string;
}

export interface LabDocumentExtractionResult {
  summary: string;
  rawText: string;
  observedAt?: string;
  items: ExtractedLabItem[];
}
