import React, { useState, useEffect, useRef } from "react";
import { Menu, Sprout, Database } from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { ChatMessage } from "./components/ChatMessage";
import { ChatInput } from "./components/ChatInput";
import { TypingIndicator } from "./components/TypingIndicator";
import { WelcomeScreen } from "./components/WelcomeScreen";
import {
  ChatApiService,
  Conversation,
  MessageItem,
  HealthResponse,
} from "./services/chatApi";

const STORAGE_KEY = "farmer_ai_conversations";

export const App: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Save conversations to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch {
      // Storage error
    }
  }, [conversations]);

  // Health check on mount and every 30s
  useEffect(() => {
    let mounted = true;

    const runHealthCheck = async () => {
      try {
        const data = await ChatApiService.checkHealth();
        if (mounted) {
          setHealth(data);
          setHealthError(null);
        }
      } catch (err) {
        if (mounted) {
          setHealth(null);
          setHealthError(err instanceof Error ? err.message : "Backend unavailable");
        }
      }
    };

    runHealthCheck();
    const interval = setInterval(runHealthCheck, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Auto-scroll to bottom of messages
  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Load conversation when selected
  const handleSelectConversation = (id: string) => {
    const found = conversations.find((c) => c.id === id);
    if (found) {
      setActiveConversationId(id);
      setMessages(found.messages);
    }
  };

  // Start a new chat
  const handleNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
  };

  // Delete conversation
  const handleDeleteConversation = (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConversationId === id) {
      handleNewChat();
    }
  };

  // Send message
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: MessageItem = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      role: "user",
      content: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      const response = await ChatApiService.sendMessage(userMessage.content);

      const assistantMessage: MessageItem = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        role: "assistant",
        content: response.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);

      // Persist to conversation history
      if (activeConversationId) {
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === activeConversationId
              ? { ...conv, messages: finalMessages }
              : conv
          )
        );
      } else {
        // Create new conversation
        const newConvId = `conv-${Date.now()}`;
        const newConversation: Conversation = {
          id: newConvId,
          title: text.length > 36 ? text.substring(0, 36) + "..." : text,
          createdAt: new Date().toISOString(),
          messages: finalMessages,
        };
        setActiveConversationId(newConvId);
        setConversations((prev) => [newConversation, ...prev]);
      }
    } catch (err) {
      const errorMessage: MessageItem = {
        id: `msg-err-${Date.now()}`,
        role: "assistant",
        content: err instanceof Error ? err.message : "Failed to obtain answer from Farmer AI.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isError: true,
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Retry the last failed user question
  const handleRetryLast = () => {
    // Find last user message
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        const textToRetry = messages[i].content;
        // Remove trailing error message if any
        setMessages((prev) => prev.slice(0, i));
        handleSendMessage(textToRetry);
        return;
      }
    }
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        health={health}
        healthError={healthError}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main chat viewport */}
      <div className="chat-viewport">
        {/* Top Navbar */}
        <header className="chat-navbar">
          <div className="navbar-left">
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>
            <div className="navbar-brand">
              <Sprout size={20} className="nav-brand-icon" />
              <div className="nav-title-group">
                <span className="nav-title">Farmer Analytics AI</span>
                <span className="nav-badge">MCP + MySQL</span>
              </div>
            </div>
          </div>

          <div className="navbar-right">
            <div className="nav-db-indicator">
              <Database size={14} className="nav-db-icon" />
              <span>sanjivani_farmers</span>
            </div>
          </div>
        </header>

        {/* Message Area */}
        <main className="chat-messages-container">
          {messages.length === 0 ? (
            <WelcomeScreen onSelectPrompt={handleSendMessage} />
          ) : (
            <div className="messages-scroll-area">
              {messages.map((msg, index) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  isLatest={index === messages.length - 1}
                  onRetry={handleRetryLast}
                />
              ))}

              {isLoading && <TypingIndicator />}

              <div ref={messagesEndRef} className="messages-end-anchor" />
            </div>
          )}
        </main>

        {/* Input Composer */}
        <footer className="chat-input-area">
          <ChatInput
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            disabled={!health?.backend && healthError !== null}
          />
        </footer>
      </div>
    </div>
  );
};

export default App;
