import React, { useCallback, useRef, useState } from 'react';
import { useChapters } from '../../hooks/useChapters';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function estimateChapters(fileSize: number): number {
  // Rough estimate: ~3000 Chinese characters per chapter, ~3 bytes per char in UTF-8
  const estimatedChars = fileSize / 3;
  return Math.max(1, Math.round(estimatedChars / 3000));
}

export default function Uploader() {
  const {
    uploading,
    uploadProgress,
    uploadError,
    uploadErrorType,
    uploadFile,
    loadChapters,
  } = useChapters();
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      // Validate extension
      if (!file.name.toLowerCase().endsWith('.txt')) {
        return;
      }
      setSelectedFile(file);
    },
    [],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;
    await uploadFile(selectedFile);
    setSelectedFile(null);
  }, [selectedFile, uploadFile]);

  const handleClear = useCallback(() => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <div className="mb-6">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors
          ${dragOver
            ? 'border-indigo-400 bg-indigo-50'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt"
          onChange={handleInputChange}
          className="hidden"
        />

        {uploading ? (
          <div>
            <div className="mb-2 text-sm text-gray-600">
              正在上传并拆分...
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <div className="mt-1 text-xs text-gray-400">{uploadProgress}%</div>
          </div>
        ) : selectedFile ? (
          <div>
            <div className="text-lg mb-1">📄 {selectedFile.name}</div>
            <div className="text-sm text-gray-500 space-y-1">
              <p>大小：{formatFileSize(selectedFile.size)}</p>
              <p>预估章节数：约 {estimateChapters(selectedFile.size)} 章</p>
            </div>
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleUpload();
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
              >
                开始拆分
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="text-3xl mb-2">📂</div>
            <p className="text-gray-600 mb-1">
              拖拽 .txt 文件到此处，或点击选择文件
            </p>
            <p className="text-xs text-gray-400">支持 UTF-8 / GBK 编码</p>
          </div>
        )}
      </div>

      {/* Error / warning message */}
      {uploadError && (
        <div
          className={`mt-3 p-3 border rounded-md ${
            uploadErrorType === 'duplicate'
              ? 'bg-amber-50 border-amber-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <p
            className={`text-sm ${
              uploadErrorType === 'duplicate' ? 'text-amber-800' : 'text-red-700'
            }`}
          >
            {uploadError}
          </p>
          {uploadErrorType === 'duplicate' && (
            <button
              onClick={() => {
                loadChapters();
                useChapters.setState({
                  uploadError: null,
                  uploadErrorType: null,
                });
              }}
              className="mt-2 text-sm text-amber-700 underline hover:text-amber-900"
            >
              刷新章节列表，查看已有数据
            </button>
          )}
        </div>
      )}
    </div>
  );
}
