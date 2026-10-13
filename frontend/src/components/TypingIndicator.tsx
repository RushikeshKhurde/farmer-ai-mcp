import React from "react";
import { Bot, Database } from "lucide-react";

export const TypingIndicator: React.FC = () => {
  return (
    <div className="message-row assistant">
      <div className="avatar-wrapper assistant">
        <Bot size={18} className="avatar-icon" />
      </div>
      <div className="message-bubble assistant typing-bubble">
        <div className="typing-header">
          <Database size={13} className="typing-db-icon" />
          <span>Querying MySQL via MCP...</span>
        </div>
        <div className="typing-dots">
          <span className="dot dot-1"></span>
          <span className="dot dot-2"></span>
          <span className="dot dot-3"></span>
        </div>
      </div>
    </div>
  );
};
