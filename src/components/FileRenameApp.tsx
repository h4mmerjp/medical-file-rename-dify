"use client";

import React, { useState, useRef } from 'react';
import { Upload, File, X, Download, AlertCircle, CheckCircle, Clock, Loader2 } from 'lucide-react';

// 型定義
interface ProcessedFile {
  id: string;
  name: string;
  file: File;
  status: 'pending' | 'processing' | 'completed' | 'error';
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

interface DifyConfig {
  apiUrl: string;
  apiKey: string;
  userId: string;
}

// Dify API レスポンス型
interface DifyApiResponse {
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

const FileRenameApp = () => {
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [config, setConfig] = useState<DifyConfig>({
    apiUrl: 'https://api.dify.ai/v1/workflows/run',
    apiKey: '',
    userId: 'user-12345'
  });
  const [showConfig, setShowConfig] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ファイルドラッグ&ドロップ処理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
    handleFiles(selectedFiles);
  };

  const handleFiles = (selectedFiles: File[]) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    const validFiles = selectedFiles.filter(file => 
      allowedTypes.includes(file.type) && file.size <= 15 * 1024 * 1024
    );

    const newFiles: ProcessedFile[] = validFiles.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      name: file.name,
      file,
      status: 'pending',
      progress: 0
    }));

    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearAllFiles = () => {
    setFiles([]);
  };

  // Dify API処理 - エラーハンドリング強化版
  const processFileWithDify = async (file: File): Promise<DifyApiResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', config.userId);

    try {
      console.log('Sending file to API:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });

      const response = await fetch('/api/dify-process', {
        method: 'POST',
        body: formData
      });

      console.log('API Response status:', response.status);
      console.log('API Response headers:', Object.fromEntries(response.headers.entries()));

      // レスポンステキストを直接取得
      const responseText = await response.text();
      console.log('Raw response text:', responseText);

      // 空のレスポンスチェック
      if (!responseText) {
        throw new Error('空のレスポンスが返されました');
      }

      // HTMLエラーページのチェック
      if (responseText.includes('<html>') || responseText.includes('<!DOCTYPE')) {
        throw new Error(`サーバーエラー: HTML応答が返されました (Status: ${response.status})`);
      }

      // JSONパース試行
      let jsonData;
      try {
        jsonData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON Parse error:', parseError);
        throw new Error(`JSON解析エラー: ${responseText.substring(0, 100)}...`);
      }

      console.log('Parsed JSON:', jsonData);

      // エラーレスポンスの場合
      if (!response.ok) {
        const errorMessage = jsonData.error || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      // 成功レスポンスの検証
      if (!jsonData.success) {
        throw new Error(jsonData.error || 'API処理が失敗しました');
      }

      return jsonData as DifyApiResponse;

    } catch (error) {
      console.error('processFileWithDify error:', error);
      
      // ネットワークエラー
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error('ネットワークエラー: サーバーに接続できません');
      }
      
      // その他のエラー
      throw error;
    }
  };

  // 一括処理開始
  const startProcessing = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);

    for (const fileObj of files) {
      if (fileObj.status !== 'pending') continue;

      try {
        // 処理中ステータスに更新
        setFiles(prev => prev.map(f => 
          f.id === fileObj.id 
            ? { ...f, status: 'processing', progress: 50 }
            : f
        ));

        const result = await processFileWithDify(fileObj.file);

        // 成功時の更新
        setFiles(prev => prev.map(f => 
          f.id === fileObj.id 
            ? { ...f, status: 'completed', progress: 100, result: {
                renamed_filename: result.renamed_filename,
                company: result.company,
                date: result.date,
                amount: result.amount,
                description: result.description
              }}
            : f
        ));

      } catch (error) {
        // エラー時の更新
        setFiles(prev => prev.map(f => 
          f.id === fileObj.id 
            ? { 
                ...f, 
                status: 'error', 
                progress: 0, 
                error: error instanceof Error ? error.message : 'Unknown error' 
              }
            : f
        ));
      }

      // 短い間隔を空ける
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsProcessing(false);
  };

  // 単一ファイルダウンロード
  const downloadSingleFile = (fileObj: ProcessedFile) => {
    if (fileObj.status !== 'completed' || !fileObj.result) return;

    const url = URL.createObjectURL(fileObj.file);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileObj.result.renamed_filename;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  // 全ファイル一括ダウンロード
  const downloadAllFiles = () => {
    const completedFiles = files.filter(f => f.status === 'completed');
    
    completedFiles.forEach((fileObj, index) => {
      setTimeout(() => {
        downloadSingleFile(fileObj);
      }, index * 100);
    });
  };

  // ステータスアイコン
  const getStatusIcon = (status: ProcessedFile['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'processing':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  // 統計情報
  const stats = {
    total: files.length,
    processed: files.filter(f => f.status !== 'pending').length,
    completed: files.filter(f => f.status === 'completed').length,
    errors: files.filter(f => f.status === 'error').length
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🤖 領収書ファイル一括リネームアプリ
          </h1>
          <p className="text-lg text-gray-600">
            複数の領収書ファイルを一度にアップロードして、自動でリネーム・ダウンロードします
          </p>
        </div>

        {/* API設定セクション */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">⚙️ API設定</h2>
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              {showConfig ? '隠す' : '設定'}
            </button>
          </div>
          
          {showConfig && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dify API URL
                </label>
                <input
                  type="text"
                  value={config.apiUrl}
                  onChange={(e) => setConfig({...config, apiUrl: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://api.dify.ai/v1/workflows/run"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API Key
                </label>
                <input
                  type="password"
                  value={config.apiKey}
                  onChange={(e) => setConfig({...config, apiKey: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="app-xxxxxxxxxxxxxxxxx"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  User ID
                </label>
                <input
                  type="text"
                  value={config.userId}
                  onChange={(e) => setConfig({...config, userId: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="user-12345"
                />
              </div>
            </div>
          )}
        </div>

        {/* 統計カード */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 text-center shadow-lg">
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-gray-600">総ファイル数</div>
          </div>
          <div className="bg-white rounded-xl p-4 text-center shadow-lg">
            <div className="text-2xl font-bold text-orange-600">{stats.processed}</div>
            <div className="text-sm text-gray-600">処理済み</div>
          </div>
          <div className="bg-white rounded-xl p-4 text-center shadow-lg">
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <div className="text-sm text-gray-600">成功</div>
          </div>
          <div className="bg-white rounded-xl p-4 text-center shadow-lg">
            <div className="text-2xl font-bold text-red-600">{stats.errors}</div>
            <div className="text-sm text-gray-600">エラー</div>
          </div>
        </div>

        {/* ファイルアップロードエリア */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
              dragOver 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-blue-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">
              ファイルをドラッグ&ドロップ または クリックして選択
            </h3>
            <p className="text-gray-600">
              PDF, JPG, PNG, JPEG, GIF, WEBP, SVG (最大15MB)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.svg"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* 操作ボタン */}
          <div className="flex gap-4 mt-6">
            <button
              onClick={startProcessing}
              disabled={files.length === 0 || isProcessing}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  処理中...
                </>
              ) : (
                <>
                  🚀 一括処理開始
                </>
              )}
            </button>
            <button
              onClick={clearAllFiles}
              disabled={isProcessing}
              className="px-6 py-3 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 text-white rounded-lg transition-colors"
            >
              🗑️ クリア
            </button>
            <button
              onClick={downloadAllFiles}
              disabled={stats.completed === 0}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Download className="w-5 h-5" />
              全てDL
            </button>
          </div>
        </div>

        {/* ファイル一覧 */}
        {files.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">ファイル一覧</h2>
            <div className="space-y-3">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-1">
                    {getStatusIcon(file.status)}
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{file.name}</div>
                      <div className="text-sm text-gray-500">
                        {(file.file.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                      {file.result && (
                        <div className="text-sm text-green-600 mt-1">
                          → {file.result.renamed_filename}
                        </div>
                      )}
                      {file.error && (
                        <div className="text-sm text-red-600 mt-1">
                          エラー: {file.error}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {file.status === 'completed' && (
                      <button
                        onClick={() => downloadSingleFile(file)}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Download className="w-4 h-4" />
                        DL
                      </button>
                    )}
                    <button
                      onClick={() => removeFile(file.id)}
                      disabled={isProcessing}
                      className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-50 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* デバッグ情報表示エリア */}
        {process.env.NODE_ENV === 'development' && (
          <div className="bg-gray-900 text-green-400 rounded-xl p-4 mt-6 font-mono text-sm">
            <div className="mb-2 font-bold">🐛 デバッグ情報</div>
            <div>Files: {files.length}</div>
            <div>Processing: {isProcessing ? 'Yes' : 'No'}</div>
            <div>Config: {JSON.stringify(config, null, 2)}</div>
          </div>
        )}

        {/* フッター */}
        <div className="text-center mt-8 text-gray-600">
          <p>Powered by Dify API | Next.js + Vercel</p>
        </div>
      </div>
    </div>
  );
};

export default FileRenameApp;
