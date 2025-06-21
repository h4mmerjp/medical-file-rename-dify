import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    console.log("=== API Route Start ===");
    
    // 環境変数チェック
    const difyApiUrl = process.env.DIFY_API_URL;
    const difyApiKey = process.env.DIFY_API_KEY;
    
    console.log("Environment check:", {
      hasApiUrl: !!difyApiUrl,
      hasApiKey: !!difyApiKey,
      apiUrl: difyApiUrl
    });

    if (!difyApiUrl || !difyApiKey) {
      console.error("Missing environment variables");
      return NextResponse.json(
        { 
          success: false,
          error: "サーバー設定エラー: API URLまたはAPI Keyが設定されていません" 
        },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const userId = formData.get("userId") as string || "user-12345";

    console.log("Request data:", {
      hasFile: !!file,
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
      userId
    });

    if (!file) {
      return NextResponse.json(
        { 
          success: false,
          error: "ファイルが見つかりません" 
        },
        { status: 400 }
      );
    }

    // ファイルサイズチェック (15MB)
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json(
        { 
          success: false,
          error: "ファイルサイズが大きすぎます (最大15MB)" 
        },
        { status: 400 }
      );
    }

    // サポートされているファイル形式チェック
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml'
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { 
          success: false,
          error: `サポートされていないファイル形式です: ${file.type}` 
        },
        { status: 400 }
      );
    }

    // Dify APIにリクエスト送信
    const difyFormData = new FormData();
    difyFormData.append('inputs', JSON.stringify({}));
    difyFormData.append('response_mode', 'blocking');
    difyFormData.append('user', userId);
    difyFormData.append('files', file);

    console.log('Sending request to Dify API...');
    console.log('Dify URL:', difyApiUrl);
    
    const difyResponse = await fetch(difyApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${difyApiKey}`,
      },
      body: difyFormData,
    });

    console.log('Dify response status:', difyResponse.status);
    console.log('Dify response headers:', Object.fromEntries(difyResponse.headers.entries()));

    if (!difyResponse.ok) {
      const errorText = await difyResponse.text();
      console.error('Dify API error response:', errorText);
      
      // HTMLエラーページが返された場合の処理
      if (errorText.includes('<html>') || errorText.includes('<!DOCTYPE')) {
        return NextResponse.json(
          {
            success: false,
            error: `Dify API エラー (${difyResponse.status}): サーバーエラーが発生しました。API URLとKeyを確認してください。`
          },
          { status: 500 }
        );
      }
      
      // JSON形式のエラーの場合
      try {
        const errorJson = JSON.parse(errorText);
        return NextResponse.json(
          {
            success: false,
            error: `Dify API エラー: ${errorJson.message || errorText}`
          },
          { status: difyResponse.status }
        );
      } catch {
        return NextResponse.json(
          {
            success: false,
            error: `Dify API エラー (${difyResponse.status}): ${errorText}`
          },
          { status: difyResponse.status }
        );
      }
    }

    // レスポンステキストを取得
    const responseText = await difyResponse.text();
    console.log('Dify raw response:', responseText);

    // JSONパース試行
    let result;
    try {
      result = JSON.parse(responseText);
      console.log('Dify parsed response:', result);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Response text:', responseText);
      return NextResponse.json(
        {
          success: false,
          error: `レスポンス解析エラー: 無効なJSON形式です。レスポンス: ${responseText.substring(0, 200)}...`
        },
        { status: 500 }
      );
    }

    // レスポンスデータの検証と整形
    if (result.data && result.data.outputs) {
      const outputs = result.data.outputs;
      return NextResponse.json({
        success: true,
        filename: file.name,
        renamed_filename: outputs.renamed_filename || 'renamed_file.pdf',
        company: outputs.company || '',
        date: outputs.date || '',
        amount: Number(outputs.amount) || 0,
        description: outputs.description || '',
        workflow_run_id: result.data.workflow_run_id,
        elapsed_time: result.data.elapsed_time,
        total_tokens: result.data.total_tokens
      });
    } else {
      console.error('Invalid response structure:', result);
      return NextResponse.json(
        {
          success: false,
          error: `無効なレスポンス形式: ${JSON.stringify(result)}`
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error("=== API処理エラー ===", error);
    
    // ネットワークエラーの場合
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        {
          success: false,
          error: "ネットワークエラー: Dify APIに接続できません。URL設定を確認してください。",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "処理に失敗しました",
        details: error instanceof Error ? error.stack : String(error)
      },
      { status: 500 }
    );
  }
}
