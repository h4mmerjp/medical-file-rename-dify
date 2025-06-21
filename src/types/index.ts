export interface ProcessedFile {
  id: string;
  name: string;
  file: File;
  status: "pending" | "processing" | "completed" | "error";
  progress: number;
  result?: {
    renamed_filename: string;
    company: string;
    date: string;
    amount: number;
    description: string;
  };
  error?: string;
}

export interface DifyWorkflowResponse {
  success: boolean;
  filename: string;
  renamed_filename: string;
  company: string;
  date: string;
  amount: number;
  description: string;
  workflow_run_id?: string;
  elapsed_time?: number;
  total_tokens?: number;
}