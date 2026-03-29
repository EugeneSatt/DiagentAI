export interface ExtractedMedicationItem {
  name: string;
  dosage: string;
  schedule: string;
  duration: string;
  purpose: string;
}

export interface DoctorNoteExtractionResult {
  title: string;
  summary: string;
  rawText: string;
  visitDate: string;
  doctorName: string;
  specialty: string;
  clinicName: string;
  complaints: string[];
  diagnoses: string[];
  medications: ExtractedMedicationItem[];
  recommendations: string[];
  followUpActions: string[];
  nextVisitDate: string;
  confidence: number;
}
