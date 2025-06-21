"use client";

import React, { useState, useRef } from 'react';
import { Upload, File, X, Download, AlertCircle, CheckCircle, Clock, Loader2, Bug, Terminal } from 'lucide-react';

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

interface DebugLog {
  timestamp: string;
  level: 'info' | 'error' | 'warning';
  message: string;
  data?: unknown;
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
  const [showDebug, setShowDebug] = useState(true); // デフォルトで表示
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // デバッグログ追加関数
  const addDebugLog = (level: 'info' | 'error' | 'warning', message: string, data?: unknown) => {
    const log: DebugLog = {
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      data
    };
    setDebugLogs(prev => [...prev, log].slice(-50)); // 最新50件のみ保持
    
    // コンソールにも出力
    const consoleMethod = level === 'error' ? console.error : level === 'warning' ? console.warn : console.log;
    consoleMethod(`[${log.timestamp}] ${message}`, data || '');
  };

  // デバッグログクリア
  const clearDebugLogs = () => setDebugLogs([]);

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
    addDebugLog('info', `ドロップされたファイル数: ${droppedFiles.length}`);
    handleFiles(droppedFiles);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
    addDebugLog('info', `選択されたファイル数: ${selectedFiles.length}`);
    handleFiles(selectedFiles);
  };

  const handleFiles = (selectedFiles: File[]) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    
    addDebugLog('info', 'ファイル検証開始', {
      totalFiles: selectedFiles.length,
      allowedTypes
    });

    const validFiles = selectedFiles.filter(file => {
      const isValidType = allowedTypes.includes(file.type);
      const isValidSize = file.size <= 15 * 1024 * 1024;
      
      if (!isValidType) {
        addDebugLog('warning', `無効なファイル形式: ${file.name} (${file.type})`);
      }
      if (!isValidSize) {
        addDebugLog('warning', `ファイルサイズ過大: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      }
      
      return isValidType && isValidSize;
    });

    addDebugLog('info', `有効なファイル: ${validFiles.length}/${selectedFiles.length}`);

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
    addDebugLog('info', `ファイル削除: ${id}`);
  };

  const clearAllFiles = () => {
    setFiles([]);
    addDebugLog('info', 'すべてのファイルをクリア');
  };

  // Dify API処理 - デバッグ強化版
  const processFileWithDify = async (file: File): Promise<DifyApiResponse> => {
    addDebugLog('info', `API処理開始: ${file.name}`, {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      userId: config.userId
    });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', config.userId);

    // FormDataの内容をデバッグ
    const formDataEntries: Record<string, unknown> = {};
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        formDataEntries[key] = {
          name: value.name,
          size: value.size,
          type: value.type
        };
      } else {
        formDataEntries[key] = value;
      }
    }
    addDebugLog('info', 'FormData内容', formDataEntries);

    try {
      addDebugLog('info', 'fetch開始', {
        url: '/api/dify-process',
        method: 'POST'
      });

      const response = await fetch('/api/dify-process', {
        method: 'POST',
        body: formData
      });

      addDebugLog('info', 'レスポンス受信', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      // 415エラーの特別処理
      if (response.status === 415) {
        addDebugLog('error', '415 Unsupported Media Type エラー', {
          message: 'サーバーがリクエストのメディアタイプを処理できません',
          contentType: response.headers.get('content-type'),
          possibleCauses: [
            'API Routeでファイルアップロードが正しく設定されていない',
            'Content-Typeヘッダーの問題',
            'FormDataの形式が正しくない'
          ]
        });
      }

      // レスポンステキストを直接取得
      const responseText = await response.text();
      addDebugLog('info', 'レスポンステキスト取得', {
        length: responseText.length,
        preview: responseText.substring(0, 200) + (responseText.length > 200 ? '...' : '')
      });

      // 空のレスポンスチェック
      if (!responseText) {
        const error = '空のレスポンスが返されました';
        addDebugLog('error', error);
        throw new Error(error);
      }

      // HTMLエラーページのチェック
      if (responseText.includes('<html>') || responseText.includes('<!DOCTYPE')) {
        const error = `サーバーエラー: HTML応答が返されました (Status: ${response.status})`;
        addDebugLog('error', error, { responsePreview: responseText.substring(0, 500) });
        throw new Error(error);
      }

      // JSONパース試行
      let jsonData;
      try {
        jsonData = JSON.parse(responseText);
        addDebugLog('info', 'JSON解析成功', jsonData);
      } catch (parseError) {
        addDebugLog('error', 'JSON解析エラー', {
          error: parseError,
          responseText: responseText.substring(0, 500)
        });
        throw new Error(`JSON解析エラー: ${responseText.substring(0, 100)}...`);
      }

      // エラーレスポンスの場合
      if (!response.ok) {
        const errorMessage = jsonData.error || `HTTP error! status: ${response.status}`;
        addDebugLog('error', 'APIエラーレスポンス', {
          status: response.status,
          error: errorMessage,
          fullResponse: jsonData
        });
        throw new Error(errorMessage);
      }

      // 成功レスポンスの検証
      if (!jsonData.success) {
        const error = jsonData.error || 'API処理が失敗しました';
        addDebugLog('error', 'API処理失敗', jsonData);
        throw new Error(error);
      }

      addDebugLog('info', 'API処理成功', jsonData);
      return jsonData as DifyApiResponse;

    } catch (error) {
      addDebugLog('error', 'processFileWithDify例外', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // ネットワークエラー
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        const networkError = 'ネットワークエラー: サーバーに接続できません';
        addDebugLog('error', networkError);
        throw new Error(networkError);
      }
      
      // その他のエラー
      throw error;
    }
  };

  // 一括処理開始
  const startProcessing = async () => {
    if (files.length === 0) return;

    addDebugLog('info', '一括処理開始', { fileCount: files.length });
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

        addDebugLog('info', `ファイル処理完了: ${fileObj.name}`, result);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // エラー時の更新
        setFiles(prev => prev.map(f => 
          f.id === fileObj.id 
            ? { 
                ...f, 
                status: 'error', 
                progress: 0, 
                error: errorMessage
              }
            : f
        ));

        addDebugLog('error', `ファイル処理失敗: ${fileObj.name}`, { error: errorMessage });
      }

      // 短い間隔を空ける
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsProcessing(false);
    addDebugLog('info', '一括処理完了');
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
    
    addDebugLog('info', `ファイルダウンロード: ${fileObj.result.renamed_filename}`);
  };

  // 全ファイル一括ダウンロード
  const downloadAllFiles = () => {
    const completedFiles = files.filter(f => f.status === 'completed');
    
    addDebugLog('info', `一括ダウンロード開始: ${completedFiles.length}ファイル`);
    
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

        {/* デバッグパネル */}
        <div className="bg-gray-900 text-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bug className="w-5 h-5 text-green-400" />
              <h2 className="text-xl font-semibold text-green-400">🐛 デバッグ情報</h2>
            </div>
            <div className="flex gap-2">
              <button
                onClick={clearDebugLogs}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
              >
                ログクリア
              </button>
              <button
                onClick={() => setShowDebug(!showDebug)}
                className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded transition-colors"
              >
                {showDebug ? '隠す' : '表示'}
              </button>
            </div>
          </div>
          
          {showDebug && (
            <div className="space-y-4">
              {/* 現在の状態 */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-green-400 font-semibold mb-2 flex items-center gap-2">
                  <Terminal className="w-4 h-4" />
                  現在の状態
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>Files: <span className="text-blue-400">{files.length}</span></div>
                  <div>Processing: <span className="text-yellow-400">{isProcessing ? 'Yes' : 'No'}</span></div>
                  <div>Errors: <span className="text-red-400">{stats.errors}</span></div>
                  <div>Completed: <span className="text-green-400">{stats.completed}</span></div>
                </div>
              </div>

              {/* ログ表示 */}
              <div className="bg-gray-800 rounded-lg p-4 max-h-60 overflow-y-auto">
                <h3 className="text-green-400 font-semibold mb-2">ログ ({debugLogs.length})</h3>
                {debugLogs.length === 0 ? (
                  <div className="text-gray-400 text-sm">ログはありません</div>
                ) : (
                  <div className="space-y-1 text-xs font-mono">
                    {debugLogs.map((log, index) => (
                      <div key={index} className={`
                        ${log.level === 'error' ? 'text-red-400' : 
                          log.level === 'warning' ? 'text-yellow-400' : 'text-gray-300'}
                      `}>
                        <span className="text-gray-500">[{log.timestamp}]</span>
                        <span className={`ml-2 ${
                          log.level === 'error' ? 'text-red-400' : 
                          log.level === 'warning' ? 'text-yellow-400' : 'text-green-400'
                        }`}>
                          {log.level.toUpperCase()}
                        </span>
                        <span className="ml-2">{log.message}</span>
                        {log.data && (
                          <details className="ml-4 mt-1">
                            <summary className="cursor-pointer text-blue-400">詳細</summary>
                            <pre className="mt-1 text-gray-400 bg-gray-900 p-2 rounded text-xs overflow-x-auto">
                              {JSON.stringify(log.data, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
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

        {/* フッター */}
        <div className="text-center mt-8 text-gray-600">
          <p>Powered by Dify API | Next.js + Vercel</p>
        </div>
      </div>
    </div>
  );
};

export default FileRenameApp;
