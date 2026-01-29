"use client";

import { useState, useCallback } from "react";
import {
  importWhatsApp,
  importFacebook,
  importInstagram,
  ImportResult,
} from "@/actions/import.actions";

type ImportSource = "whatsapp" | "facebook" | "instagram";

interface SourceConfig {
  name: string;
  icon: string;
  description: string;
  allowedExtensions: string[];
  instructions: string;
  acceptInput: string;
}

const SOURCE_CONFIG: Record<ImportSource, SourceConfig> = {
  whatsapp: {
    name: "WhatsApp",
    icon: "📱",
    description: "Import chat exports from WhatsApp",
    allowedExtensions: [".txt", ".zip"],
    instructions: "Settings > Chats > Export Chat > Without Media",
    acceptInput: ".txt,.zip",
  },
  facebook: {
    name: "Facebook Messenger",
    icon: "👤",
    description: "Import message history from Facebook",
    allowedExtensions: [".json", ".zip"],
    instructions:
      "Settings > Your Facebook Information > Download Your Information > Messages (JSON)",
    acceptInput: ".json,.zip",
  },
  instagram: {
    name: "Instagram DMs",
    icon: "📷",
    description: "Import direct messages from Instagram",
    allowedExtensions: [".json", ".zip"],
    instructions:
      "Settings > Privacy and Security > Data Download > Request Download (JSON)",
    acceptInput: ".json,.zip",
  },
};

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: (result: ImportResult) => void;
}

export function ImportDialog({
  isOpen,
  onClose,
  onImportComplete,
}: ImportDialogProps) {
  const [selectedSource, setSelectedSource] = useState<ImportSource | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [userName, setUserName] = useState("");
  const [chatName, setChatName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      // Use filename as default chat name for WhatsApp
      if (selectedSource === "whatsapp" && !chatName) {
        setChatName(selectedFile.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile && selectedSource) {
        const config = SOURCE_CONFIG[selectedSource];
        const ext = "." + droppedFile.name.split(".").pop()?.toLowerCase();
        if (config.allowedExtensions.includes(ext)) {
          setFile(droppedFile);
          if (selectedSource === "whatsapp" && !chatName) {
            setChatName(droppedFile.name.replace(/\.[^/.]+$/, ""));
          }
        }
      }
    },
    [selectedSource, chatName]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleImport = async () => {
    if (!selectedSource || !file) return;

    setIsImporting(true);
    setProgress("Uploading file...");
    setResult(null);

    try {
      // Upload file first
      const formData = new FormData();
      formData.append("file", file);
      formData.append("source", selectedSource);
      if (userName) formData.append("userName", userName);
      if (chatName) formData.append("chatName", chatName);

      const uploadResponse = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        throw new Error(error.error || "Upload failed");
      }

      const uploadResult = await uploadResponse.json();
      setProgress("Processing import...");

      // Process the import based on source
      let importResult: ImportResult;

      switch (selectedSource) {
        case "whatsapp":
          importResult = await importWhatsApp(
            uploadResult.filePath,
            chatName || file.name.replace(/\.[^/.]+$/, ""),
            userName || undefined
          );
          break;
        case "facebook":
          importResult = await importFacebook(
            uploadResult.filePath,
            userName || undefined
          );
          break;
        case "instagram":
          importResult = await importInstagram(
            uploadResult.filePath,
            userName || undefined
          );
          break;
        default:
          throw new Error("Unknown source");
      }

      setResult(importResult);
      setProgress("");

      if (importResult.success) {
        onImportComplete?.(importResult);
      }
    } catch (error) {
      setResult({
        success: false,
        messagesImported: 0,
        contactsCreated: 0,
        error: error instanceof Error ? error.message : String(error),
      });
      setProgress("");
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setSelectedSource(null);
    setFile(null);
    setUserName("");
    setChatName("");
    setResult(null);
    setProgress("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-warmGray-200">
          <h2 className="text-lg font-semibold text-warmGray-900">
            Import Messages
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-warmGray-500 hover:text-warmGray-700 rounded"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {!selectedSource && !result ? (
            // Source Selection
            <div className="space-y-3">
              <p className="text-sm text-warmGray-600 mb-4">
                Select a platform to import messages from:
              </p>
              {(Object.entries(SOURCE_CONFIG) as [ImportSource, SourceConfig][]).map(
                ([key, config]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedSource(key)}
                    className="w-full p-4 text-left border border-warmGray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{config.icon}</span>
                      <div>
                        <div className="font-medium text-warmGray-900">
                          {config.name}
                        </div>
                        <div className="text-sm text-warmGray-500">
                          {config.description}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              )}
            </div>
          ) : result ? (
            // Result
            <div className="text-center py-6">
              {result.success ? (
                <>
                  <div className="text-4xl mb-4">✅</div>
                  <h3 className="text-lg font-semibold text-warmGray-900 mb-2">
                    Import Complete!
                  </h3>
                  <p className="text-warmGray-600">
                    Imported {result.messagesImported} messages and created{" "}
                    {result.contactsCreated} contacts.
                  </p>
                </>
              ) : (
                <>
                  <div className="text-4xl mb-4">❌</div>
                  <h3 className="text-lg font-semibold text-warmGray-900 mb-2">
                    Import Failed
                  </h3>
                  <p className="text-red-600">{result.error}</p>
                </>
              )}
              <div className="flex gap-3 justify-center mt-6">
                <button onClick={handleReset} className="btn-secondary">
                  Import Another
                </button>
                <button onClick={onClose} className="btn-primary">
                  Done
                </button>
              </div>
            </div>
          ) : (
            // File Upload Form
            selectedSource && (
            <div className="space-y-4">
              <button
                onClick={handleReset}
                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Back to sources
              </button>

              <div className="flex items-center gap-3 p-3 bg-warmGray-50 rounded-lg">
                <span className="text-2xl">
                  {SOURCE_CONFIG[selectedSource].icon}
                </span>
                <div>
                  <div className="font-medium text-warmGray-900">
                    {SOURCE_CONFIG[selectedSource].name}
                  </div>
                  <div className="text-xs text-warmGray-500">
                    {SOURCE_CONFIG[selectedSource].instructions}
                  </div>
                </div>
              </div>

              {/* File Drop Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  isDragging
                    ? "border-primary-400 bg-primary-50"
                    : file
                    ? "border-green-400 bg-green-50"
                    : "border-warmGray-300 hover:border-warmGray-400"
                }`}
              >
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-green-600">✓</span>
                    <span className="text-warmGray-700 font-medium">
                      {file.name}
                    </span>
                    <button
                      onClick={() => setFile(null)}
                      className="text-warmGray-400 hover:text-warmGray-600"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="text-warmGray-400 mb-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="40"
                        height="40"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mx-auto"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </div>
                    <p className="text-warmGray-600 mb-1">
                      Drop your file here or click to browse
                    </p>
                    <p className="text-xs text-warmGray-400">
                      Accepts:{" "}
                      {SOURCE_CONFIG[selectedSource].allowedExtensions.join(", ")}
                    </p>
                  </>
                )}
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept={SOURCE_CONFIG[selectedSource].acceptInput}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  style={{ position: "absolute" }}
                />
              </div>

              {/* Optional Fields */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-warmGray-700 mb-1">
                    Your Name/Username (optional)
                  </label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Used to identify which messages are yours"
                    className="w-full px-3 py-2 border border-warmGray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                {selectedSource === "whatsapp" && (
                  <div>
                    <label className="block text-sm font-medium text-warmGray-700 mb-1">
                      Chat Name (optional)
                    </label>
                    <input
                      type="text"
                      value={chatName}
                      onChange={(e) => setChatName(e.target.value)}
                      placeholder="Name of the conversation"
                      className="w-full px-3 py-2 border border-warmGray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>

              {/* Progress */}
              {progress && (
                <div className="flex items-center gap-2 text-sm text-warmGray-600">
                  <div className="animate-spin w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full" />
                  {progress}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  disabled={isImporting}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={!file || isImporting}
                  className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isImporting ? "Importing..." : "Import"}
                </button>
              </div>
            </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
