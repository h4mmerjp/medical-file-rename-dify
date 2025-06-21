export interface DifyResponse {
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
  error?: string;
}

export async function processFileWithDify(
  file: File,
  userId: string = "user-12345"
): Promise<DifyResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("userId", userId);

  try {
    const response = await fetch("/api/dify-process", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Dify処理エラー:", error);
    throw error;
  }
}