"use client";

import { useState } from "react";
import FileUploader from "@/components/FileUploader";
import ProcessingResults from "@/components/ProcessingResults";
import { ProcessedFile } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { sendFileToDify } from "@/lib/dify";

export default function Home() {
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFilesSelected = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const newFiles: ProcessedFile[] = Array.from(selectedFiles).map(
      (file, index) => ({
        id: `${Date.now()}-${index}`,
        name: file.name,
        status: "pending",
        progress: 0,
      })
    );
    setFiles(newFiles);
  };

  const startProcessing = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);

    // ファイル取得
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const selectedFiles = fileInput?.files;

    if (!selectedFiles) {
      setIsProcessing(false);
      return;
    }

    // 各ファイルを順番に処理
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const fileRecord = files[i];

      // 処理中ステータスに更新
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileRecord.id
            ? { ...f, status: "processing", progress: 50 }
            : f
        )
      );

      try {
        const result = await sendFileToDify(file);

        // 成功時の更新
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileRecord.id
              ? {
                  ...f,
                  status: "completed",
                  progress: 100,
                  result,
                }
              : f
          )
        );
      } catch (error) {
        // エラー時の更新
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileRecord.id
              ? {
                  ...f,
                  status: "error",
                  progress: 0,
                  error:
                    error instanceof Error ? error.message : "Unknown error",
                }
              : f
          )
        );
      }
    }

    setIsProcessing(false);
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📋 医療書類管理システム（シンプル版）
          </CardTitle>
          <CardDescription>
            複数のPDFファイルを一括でアップロードし、Difyで自動処理します
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUploader
            onFilesSelected={handleFilesSelected}
            isProcessing={isProcessing}
            onStartProcessing={startProcessing}
            hasFiles={files.length > 0}
          />
        </CardContent>
      </Card>

      {files.length > 0 && <ProcessingResults files={files} />}
    </div>
  );
}
