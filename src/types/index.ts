export interface ProcessedFile {
  id: string;
  name: string;
  status: "pending" | "processing" | "completed" | "error";
  progress: number;
  result?: DifyWorkflowResponse; // any を具体的な型に変更
  error?: string;
}

export interface DifyWorkflowResponse {
  success: boolean;
  filename: string;
  dify_result: {
    workflow_run_id: string;
    task_id: string;
    data: {
      id: string;
      workflow_id: string;
      status: string;
      outputs: Record<string, unknown>;
      error?: string;
      elapsed_time: number;
      total_tokens: number;
      total_steps: number;
      created_at: number;
      finished_at: number;
    };
  };
}
