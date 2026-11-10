import { useState, useRef, useEffect } from "react";

const WHATSAPP_LINK = "https://wa.me/2349162029201?text=Hello%20BizaDesk%20Team%2C%20I%20have%20an%20inquiry%20about%20your%20IT%20support%20services.";
const MAX_AI_QUERIES = 5;

const PROBLEM_TOPICS = [
  {
    id: "wifi",
    icon: "📶",
    label: "Slow Wi-Fi & Network Drops",
    response: `📶 **Slow Wi-Fi & Network Outages**\n\n• **Immediate Diagnosis:** Our AI Virtual IT Assistant tests your DNS, IP configurations, and adapter state to resolve drops.\n• **Technician Escalation:** If router or ISP hardware fails, our network engineers remotely assist or dispatch an on-site technician.\n• **Pricing:** Included free in Business plans (from ₦45,000/mo) or ₦3,500 flat for individual incidents with a 100% money-back guarantee.`
  },
  {
    id: "printer",
    icon: "🖨️",
    label: "Printer / Scanner Offline",
    response: `🖨️ **Printer & Scanner Offline**\n\n• **Instant Resolution:** We fix stuck print spoolers, driver corruptions, and missing network IP mapping.\n• **Remote Quick Assist:** A technician connects in seconds via a 6-digit Windows Quick Assist code directly inside the ticket chat — nothing extra to install!\n• **Pricing:** Flat ₦3,500 for individuals or unlimited for business workspaces.`
  },
  {
    id: "email",
    icon: "🔐",
    label: "Email & Password Lockouts",
    response: `🔐 **Email, Outlook & Password Lockouts**\n\n• **Rapid Recovery:** Fix recurring Outlook password prompts, MFA synchronization, and Microsoft 365 / Google Workspace connectivity.\n• **Business Dashboard:** Admins can reset user passwords and manage team permissions with 1 click.\n• **Guaranteed:** 100% money-back if we cannot restore your access.`
  },
  {
    id: "pc",
    icon: "🖥️",
    label: "Freezing PC & Virus Removal",
    response: `🖥️ **Freezing PC, Malware & Virus Removal**\n\n• **Hands-on Remote Tuning:** A technician securely connects to clean bloatware, remove spyware/viruses, and fix blue-screen crashes.\n• **Hardware Guidance:** If hardware (RAM/SSD) needs replacement, we provide clear upgrade recommendations or on-site support.`
  },
  {
    id: "business",
    icon: "🏢",
    label: "Need IT Support for My Business",
    response: `🏢 **IT Support for Small & Medium Businesses (SMBs)**\n\n• **Save 80% on IT Costs:** Instead of paying ₦300k–₦500k/month for full-time staff, BizaDesk provides a complete IT team in a box starting at **₦45,000/month**.\n• **Included:** 24/7 AI Virtual IT, smart ticketing, incident escalation, service monitoring, and 30-day free trial (no credit card required).`
  },
  {
    id: "server",
    icon: "⚡",
    label: "Server & Website Downtime",
    response: `⚡ **Server & Website Downtime Monitoring**\n\n• **24/7 Sentinel Monitoring:** BizaDesk pings your email servers, web apps, and VPNs every 60 seconds.\n• **Automated Incident Escalation:** Auto-triggers email/SMS alerts to staff and leadership when SLA timers are breached.`
  },
  {
    id: "personal",
    icon: "🏠",
    label: "Home / Personal Help (₦3,500 Fix)",
    response: `🏠 **Home & Personal Tech Support**\n\n• **Only ₦3,500 Flat:** Fast help for your personal laptop, Wi-Fi, or software.\n• **100% Money-Back Guarantee:** If our certified technician cannot solve your issue, your payment is automatically refunded.\n• **On-Site Option:** Physical technician visits available from ₦10,000 in key metro areas.`
  }
];

function matchKeywordRule(text) {
  const lower = text.toLowerCase();

  if (/price|pricing|cost|how much|fee|charge|naira|plan|subscription/i.test(lower)) {
    return `💰 **BizaDesk Pricing Plans:**\n\n• **Standard Office (SMBs up to 50 staff):** ₦45,000/month (or ₦36,000/mo billed annually).\n• **Enterprise Fleet (Unlimited users):** ₦120,000/month (or ₦96,000/mo billed annually).\n• **Individual Support:** ₦3,500 flat per incident with a 100% money-back guarantee (On-site visits from ₦10,000).\n\nAll business plans come with a 30-day free trial without a credit card!`;
  }

  if (/whatsapp|phone|call|number|contact|reach|hotline|support email/i.test(lower)) {
    return `📞 **Contact BizaDesk Directly:**\n\n• **WhatsApp / Hotline:** +234 916 202 9201 (24/7 assistance)\n• **Email:** helpdesk@bizadoc.com\n• **Office Hours:** Mon–Fri, 8:00 AM – 6:00 PM WAT\n• **WhatsApp Support:** 24/7 for emergency incidents.`;
  }

  if (/refund|guarantee|money back|money-back|fail/i.test(lower)) {
    return `🛡️ **100% Money-Back Guarantee:**\n\nFor individual support tickets (₦3,500), if our technicians cannot resolve your issue, your payment is automatically refunded in full directly to your original payment method. Zero risk.`;
  }

  if (/location|lagos|abuja|nigeria|office|visit|physical|on-site|onsite/i.test(lower)) {
    return `📍 **Service Availability & On-Site Visits:**\n\n• **Remote Support:** Available nationwide across Nigeria and internationally (via Windows Quick Assist and chat).\n• **On-Site Physical Visits:** Available across Lagos, Abuja, and major metropolitan centres starting from ₦10,000.`;
  }

  if (/trial|free|test/i.test(lower)) {
    return `🎉 **30-Day Free Trial:**\n\nEvery business workspace starts with a 30-day full-featured free trial. You get full access to AI Virtual IT Support, incident command, smart tickets, and service monitoring with no credit card required!`;
  }

  return null;
}

export default function LandingChatbot({ onGoToApp }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: "bot",
      text: "Hello! 👋 I'm your BizaDesk IT Assistant. What tech problem can I help you solve today? Click an issue below or type any question:"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiQueriesCount, setAiQueriesCount] = useState(0);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleTopicClick = (topic) => {
    const userMsg = { sender: "user", text: topic.label };
    const botMsg = { sender: "bot", text: topic.response, showCta: true };
    setMessages((prev) => [...prev, userMsg, botMsg]);
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    const query = input.trim();
    if (!query || loading) return;

    setInput("");
    const userMsg = { sender: "user", text: query };
    setMessages((prev) => [...prev, userMsg]);

    // 1. Check rule-based keyword match first (0 latency, 0 cost)
    const ruleAnswer = matchKeywordRule(query);
    if (ruleAnswer) {
      setMessages((prev) => [...prev, { sender: "bot", text: ruleAnswer, showCta: true }]);
      return;
    }

    // 2. Check AI query rate limit
    if (aiQueriesCount >= MAX_AI_QUERIES) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: `You've reached the free demo limit. For dedicated assistance, you can chat with our team directly on WhatsApp (+234 916 202 9201) or start your free trial!`,
          showCta: true
        }
      ]);
      return;
    }

    // 3. Fallback to OpenRouter AI
    const openRouterKey = import.meta.env.VITE_OPENROUTER_KEY;
    if (!openRouterKey) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: `BizaDesk resolves IT issues with 24/7 AI troubleshooting and expert remote/on-site technicians. Connect with us directly on WhatsApp (+234 916 202 9201) or start your 30-day free trial.`,
          showCta: true
        }
      ]);
      return;
    }

    setLoading(true);
    try {
      setAiQueriesCount((c) => c + 1);
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openRouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://desk.bizadoc.com",
          "X-Title": "BizaDesk Public Assistant"
        },
        body: JSON.stringify({
          model: "mistralai/mistral-7b-instruct",
          messages: [
            {
              role: "system",
              content: `You are the friendly, professional presales AI assistant for BizaDesk (built by BizaDoc Services in Nigeria).
BizaDesk is an autonomous multi-tenant IT helpdesk and incident management platform.
Key facts:
- Standard Office plan: ₦45,000/month (SMBs up to 50 staff).
- Enterprise Fleet plan: ₦120,000/month (unlimited users).
- Individual Support: ₦3,500/incident with 100% money-back guarantee if unresolved.
- On-site physical technician visits from ₦10,000 in key Nigerian metro areas (Lagos, Abuja).
- Features: 24/7 Virtual IT Assistant, Windows Quick Assist remote sessions, ticket tracking, service monitoring, knowledge base.
- Contact: WhatsApp/Hotline +234 916 202 9201, Email helpdesk@bizadoc.com.
- Free trial: 30 days free, no credit card required.
Keep answers concise (2-4 sentences max), clear, and encourage the visitor to start a free trial or contact on WhatsApp.`
            },
            { role: "user", content: query }
          ],
          max_tokens: 220,
          temperature: 0.3
        })
      });

      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content?.trim();

      if (reply) {
        setMessages((prev) => [...prev, { sender: "bot", text: reply, showCta: true }]);
      } else {
        throw new Error("Empty response");
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: `I'd love to help with that! You can connect immediately with our engineering team on WhatsApp at +234 916 202 9201 or start your 30-day free trial.`,
          showCta: true
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bd-chat-root">
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          type="button"
          className="bd-chat-pill-btn"
          onClick={() => setIsOpen(true)}
          aria-label="Open BizaDesk Support Chat"
        >
          <span className="bd-chat-pulse" />
          <span className="bd-chat-pill-icon">⚡</span>
          <span className="bd-chat-pill-text">Ask BizaDesk AI</span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="bd-chat-modal">
          {/* Header */}
          <div className="bd-chat-header">
            <div className="bd-chat-header-info">
              <div className="bd-chat-avatar">⚡</div>
              <div>
                <div className="bd-chat-title">BizaDesk Assistant</div>
                <div className="bd-chat-status">
                  <span className="bd-chat-status-dot" /> Online (24/7 AI &amp; Support)
                </div>
              </div>
            </div>
            <button
              type="button"
              className="bd-chat-close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Close Chat"
            >
              ✕
            </button>
          </div>

          {/* Messages Body */}
          <div className="bd-chat-body">
            {messages.map((m, idx) => (
              <div key={idx} className={`bd-chat-msg-row ${m.sender === "user" ? "user" : "bot"}`}>
                {m.sender === "bot" && <div className="bd-chat-msg-avatar">⚡</div>}
                <div className={`bd-chat-bubble ${m.sender === "user" ? "user" : "bot"}`}>
                  <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>

                  {/* Optional Action CTAs */}
                  {m.showCta && (
                    <div className="bd-chat-cta-group">
                      <button
                        type="button"
                        className="bd-chat-cta-trial"
                        onClick={() => {
                          setIsOpen(false);
                          if (onGoToApp) onGoToApp();
                        }}
                      >
                        🚀 Start Free Trial →
                      </button>
                      <a
                        href={WHATSAPP_LINK}
                        target="_blank"
                        rel="noreferrer"
                        className="bd-chat-cta-wa"
                      >
                        💬 Chat on WhatsApp
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="bd-chat-msg-row bot">
                <div className="bd-chat-msg-avatar">⚡</div>
                <div className="bd-chat-bubble bot bd-chat-typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}

            {/* Problem Quick-Topic Chips (Shown after greeting) */}
            <div className="bd-chat-chips-container">
              <div className="bd-chat-chips-label">Common Problems We Solve:</div>
              <div className="bd-chat-chips-grid">
                {PROBLEM_TOPICS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="bd-chat-chip"
                    onClick={() => handleTopicClick(t)}
                  >
                    <span>{t.icon}</span> {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <form onSubmit={handleSend} className="bd-chat-input-bar">
            <input
              type="text"
              placeholder="Ask anything about BizaDesk..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              className="bd-chat-input"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bd-chat-send-btn"
              aria-label="Send message"
            >
              ➤
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

