import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, User, Copy, Check, AlertTriangle, RotateCcw } from "lucide-react";
import { MessageItem } from "../services/chatApi";

interface ChatMessageProps {
  message: MessageItem;
  onRetry?: () => void;
  isLatest?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, onRetry, isLatest }) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className={`message-row ${isUser ? "user" : "assistant"} ${message.isError ? "has-error" : ""}`}>
      <div className={`avatar-wrapper ${isUser ? "user" : "assistant"}`}>
        {isUser ? <User size={18} /> : <Bot size={18} />}
      </div>

      <div className={`message-container ${isUser ? "user" : "assistant"}`}>
        <div className="message-header">
          <span className="sender-name">{isUser ? "You" : "Farmer AI"}</span>
          <span className="timestamp">{message.timestamp}</span>
        </div>

        <div className={`message-bubble ${isUser ? "user" : "assistant"}`}>
          {message.isError ? (
            <div className="error-content">
              <div className="error-title">
                <AlertTriangle size={16} className="error-icon" />
                <span>Error processing request</span>
              </div>
              <p className="error-message">{message.content}</p>
              {onRetry && isLatest && (
                <button type="button" className="retry-btn" onClick={onRetry}>
                  <RotateCcw size={14} />
                  <span>Retry Question</span>
                </button>
              )}
            </div>
          ) : isUser ? (
            <div className="user-text">{message.content}</div>
          ) : (
            <div className="markdown-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {!isUser && !message.isError && (
          <div className="message-actions">
            <button
              type="button"
              className="action-btn"
              onClick={handleCopy}
              title={copied ? "Copied!" : "Copy response"}
              aria-label="Copy response"
            >
              {copied ? <Check size={14} className="copied-icon" /> : <Copy size={14} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
