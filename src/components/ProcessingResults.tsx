"use client";

import { ProcessedFile } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, Clock, Loader2 } from "lucide-react";

interface ProcessingResultsProps {
  files: ProcessedFile[];
}

export default function ProcessingResults({ files }: ProcessingResultsProps) {
  const getStatusIcon = (status: ProcessedFile["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "processing":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: ProcessedFile["status"]) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "error":
        return "bg-red-100 text-red-800";
      case "processing":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dify処理結果</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {files.map((file) => (
          <div key={file.id} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {getStatusIcon(file.status)}
                <span className="font-medium">{file.name}</span>
              </div>
              <Badge className={getStatusColor(file.status)}>
                {file.status === "pending" && "待機中"}
                {file.status === "processing" && "Dify処理中"}
                {file.status === "completed" && "完了"}
                {file.status === "error" && "エラー"}
              </Badge>
            </div>

            {file.status === "processing" && (
              <Progress value={file.progress} className="mb-2" />
            )}

            {file.result && (
              <div className="text-sm text-gray-600 space-y-1">
                <p>
                  <strong>処理結果:</strong>
                </p>
                <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
                  {JSON.stringify(file.result, null, 2)}
                </pre>
              </div>
            )}

            {file.error && (
              <div className="text-sm text-red-600">
                <p>
                  <strong>エラー:</strong> {file.error}
                </p>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
