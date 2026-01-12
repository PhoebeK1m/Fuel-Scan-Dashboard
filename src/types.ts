
export enum ParseStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface FuelRow {
  date: string;
  address: string;
  length: string;
  plus_r: string;
  minus_r: string;
  bow: string;
  delta_bow: string;
  delta_length: string;
  go_no_go: string;
  notes: string;
}

export interface ParsedFile {
  id: string;
  fileName: string;
  elementNumber: string;
  status: ParseStatus;
  notes: string;
  checkedByPhoebe: boolean;
  checkedByJay: boolean;
  rows: FuelRow[];
  timestamp: number;
  imageUrl?: string;
  error?: string;
}

export interface OCRResult {
  elementNumber: string;
  rows: FuelRow[];
  outliers: string;
}
