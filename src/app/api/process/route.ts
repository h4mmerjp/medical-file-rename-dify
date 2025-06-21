import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "ファイルが見つかりません" },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "PDFファイルのみ対応しています" },
        { status: 400 }
      );
    }

    // 1. まずDifyにファイルをアップロード
    const uploadFormData = new FormData();
    uploadFormData.append("file", file);
    uploadFormData.append("user", "medical-app-user");

    const uploadResponse = await fetch("https://api.dify.ai/v1/files/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.DIFY_API_KEY}`,
      },
      body: uploadFormData,
    });

    if (!uploadResponse.ok) {
      throw new Error(`File upload error: ${uploadResponse.status}`);
    }

    const uploadResult = await uploadResponse.json();
    const fileId = uploadResult.id;

    // 2. ワークフローを実行
    const workflowResponse = await fetch(process.env.DIFY_API_URL!, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.DIFY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: {
          file: [
            {
              transfer_method: "local_file",
              upload_file_id: fileId,
              type: "document",
            },
          ],
        },
        response_mode: "blocking",
        user: "medical-app-user",
      }),
    });

    if (!workflowResponse.ok) {
      throw new Error(`Workflow error: ${workflowResponse.status}`);
    }

    const result = await workflowResponse.json();

    return NextResponse.json({
      success: true,
      filename: file.name,
      dify_result: result,
    });
  } catch (error) {
    console.error("Processing error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "処理に失敗しました",
      },
      { status: 500 }
    );
  }
}
