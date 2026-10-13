import React from "react";
import { Sparkles, TrendingUp, Wallet, Wheat, MapPin, ArrowUpRight } from "lucide-react";

interface WelcomeScreenProps {
  onSelectPrompt: (prompt: string) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onSelectPrompt }) => {
  const suggestions = [
    {
      title: "Highest Pending Payment",
      description: "Find the farmer with the largest outstanding balance due",
      prompt: "Which farmer has the highest pending amount?",
      icon: <Wallet size={20} className="card-icon wallet" />,
    },
    {
      title: "Total Amount Paid",
      description: "Calculate overall payment disbursements across all farmers",
      prompt: "What is the total amount paid across all farmers?",
      icon: <TrendingUp size={20} className="card-icon trend" />,
    },
    {
      title: "Highest Sugarcane Supply",
      description: "Discover top sugarcane producers by tonnage supplied",
      prompt: "Which farmer supplied the most sugarcane?",
      icon: <Wheat size={20} className="card-icon wheat" />,
    },
    {
      title: "Farmers by Village",
      description: "Compare sugarcane supply and pending payments by village",
      prompt: "Compare the sugarcane supply of farmers from different villages.",
      icon: <MapPin size={20} className="card-icon pin" />,
    },
  ];

  return (
    <div className="welcome-container">
      <div className="welcome-hero">
        <div className="hero-badge">
          <Sparkles size={14} className="badge-sparkle" />
          <span>Real-time MySQL Analytics via MCP</span>
        </div>
        <h2 className="welcome-title">Your Farmer Data, Simplified.</h2>
        <p className="welcome-subtitle">
          Ask questions about sugarcane supply, farmer payments, pending amounts and village-wise records.
        </p>
      </div>

      <div className="suggestion-grid">
        {suggestions.map((item, index) => (
          <button
            key={index}
            type="button"
            className="suggestion-card"
            onClick={() => onSelectPrompt(item.prompt)}
          >
            <div className="card-top">
              <div className="card-icon-box">{item.icon}</div>
              <ArrowUpRight size={16} className="card-arrow" />
            </div>
            <div className="card-body">
              <h3 className="card-title">{item.title}</h3>
              <p className="card-desc">{item.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
