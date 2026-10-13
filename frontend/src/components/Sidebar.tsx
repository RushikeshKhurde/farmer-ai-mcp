import React, { useState } from "react";
import {
  Sprout,
  Plus,
  MessageSquare,
  Trash2,
  Database,
  CheckCircle2,
  AlertCircle,
  X,
  HelpCircle,
} from "lucide-react";
import { Conversation, HealthResponse } from "../services/chatApi";

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  health: HealthResponse | null;
  healthError: string | null;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  health,
  healthError,
  isMobileOpen,
  onCloseMobile,
}) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirmDeleteId === id) {
      onDeleteConversation(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
      // Auto-cancel confirmation after 4 seconds
      setTimeout(() => {
        setConfirmDeleteId((prev) => (prev === id ? null : prev));
      }, 4000);
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div className="sidebar-backdrop" onClick={onCloseMobile} />
      )}

      <aside className={`sidebar-container ${isMobileOpen ? "open" : ""}`}>
        {/* Header */}
        <div className="sidebar-header">
          <div className="brand-group">
            <div className="brand-icon-box">
              <Sprout size={22} className="brand-icon" />
            </div>
            <div className="brand-text">
              <h1 className="brand-title">Farmer AI</h1>
              <p className="brand-subtitle">MCP-powered farmer assistant</p>
            </div>
          </div>
          <button
            type="button"
            className="mobile-close-btn"
            onClick={onCloseMobile}
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="sidebar-action-area">
          <button
            type="button"
            className="new-chat-btn"
            onClick={() => {
              onNewChat();
              onCloseMobile();
            }}
          >
            <Plus size={18} />
            <span>New Chat</span>
          </button>
        </div>

        {/* Purpose Description */}
        <div className="sidebar-info-card">
          <div className="info-header">
            <HelpCircle size={14} />
            <span>About this assistant</span>
          </div>
          <p className="info-text">
            Answers natural-language inquiries about sugarcane deliveries, pending balances, and farmer settlements using live MySQL data via MCP.
          </p>
        </div>

        {/* History Section */}
        <div className="sidebar-history-section">
          <div className="history-header">
            <span>Recent Conversations</span>
            <span className="history-count">{conversations.length}</span>
          </div>

          <div className="history-list">
            {conversations.length === 0 ? (
              <div className="history-empty">
                <MessageSquare size={20} className="empty-icon" />
                <p>No conversations yet</p>
              </div>
            ) : (
              conversations.map((conv) => {
                const isActive = conv.id === activeConversationId;
                const isConfirming = confirmDeleteId === conv.id;

                return (
                  <div
                    key={conv.id}
                    className={`history-item ${isActive ? "active" : ""}`}
                    onClick={() => {
                      onSelectConversation(conv.id);
                      onCloseMobile();
                    }}
                  >
                    <MessageSquare size={16} className="history-item-icon" />
                    <span className="history-item-title" title={conv.title}>
                      {conv.title}
                    </span>

                    <button
                      type="button"
                      className={`delete-btn ${isConfirming ? "confirm" : ""}`}
                      onClick={(e) => handleDeleteClick(e, conv.id)}
                      title={isConfirming ? "Click again to confirm delete" : "Delete conversation"}
                      aria-label="Delete conversation"
                    >
                      {isConfirming ? "Delete?" : <Trash2 size={14} />}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Status / Health */}
        <div className="sidebar-status-box">
          <div className="status-item">
            <div className="status-label">
              <Database size={14} />
              <span>System Status</span>
            </div>
            {health?.backend ? (
              <div className="status-badge online">
                <CheckCircle2 size={13} />
                <span>Backend Online</span>
              </div>
            ) : healthError ? (
              <div className="status-badge offline" title={healthError}>
                <AlertCircle size={13} />
                <span>Backend Offline</span>
              </div>
            ) : (
              <div className="status-badge checking">
                <span className="pulse-dot"></span>
                <span>Connecting...</span>
              </div>
            )}
          </div>
          <div className="status-detail">
            {health?.mcpConnected ? (
              <span className="detail-success">MCP tool get_farmer_records ready</span>
            ) : (
              <span className="detail-muted">MySQL: sanjivani_farmers (3307)</span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          <p>
            Connected to <strong>MySQL</strong> via <strong>Model Context Protocol</strong>
          </p>
        </div>
      </aside>
    </>
  );
};
