import { useState, useEffect, useRef } from "react";
import { 
  Bot, Mic, MicOff, Volume2, VolumeX, Send, Phone, Monitor, 
  HelpCircle, ChevronRight, CheckCircle2, AlertCircle, Activity,
  Sparkles, Wrench, ShieldAlert, MessageCircle, ExternalLink, Ticket
} from "lucide-react";
import { matchQuery } from "../engine/ruleEngine";
import { VoiceHandler } from "../engine/voiceHandler";
import StepCardModal from "./StepCardModal";
import RemoteSessionModal from "./RemoteSessionModal";
import IndividualCheckoutModal from "./IndividualCheckoutModal";

export default function VirtualITSupport({ 
  incidents = [], 
  services = [], 
  customArticles = [], 
  orgConfig = {},
  userRole = "user",
  accountType = "business",
  currentUser,
  currentUserProfile,
  onSubmitTicket,
  onLogAudit
}) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      type: "welcome",
      content: "Hello! I am your BizaDesk Virtual IT Assistant. How can I help you today?",
      suggestions: [
        "No internet connection",
        "Wi-Fi slow or dropping",
        "Printer offline / jammed",
        "Audio or microphone not working",
        "Email not syncing / Outlook error",
        "Computer running very slow / frozen"
      ]
    }
  ]);
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [activeStepArticle, setActiveStepArticle] = useState(null);
  const [voiceSessionActive, setVoiceSessionActive] = useState(false);
  const [showRemoteModal, setShowRemoteModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  // Individual Paystack Checkout Modal state
  const [checkoutModal, setCheckoutModal] = useState(null); // { option: 'whatsapp' | 'call' | 'ticket' | 'quick_assist', context }

  // Active Paid Session State (Service-Tier Gated: 'REMOTE' unlocks WhatsApp, Call IT & Quick Assist. 'PHYSICAL_VISIT' locks remote tools)
  const sessionKey = `bizadesk_paid_session_${orgConfig?.id || "master"}_${currentUser?.email || "guest"}`;
  const [activePaidSession, setActivePaidSession] = useState(() => {
    try {
      const saved = sessionStorage.getItem(sessionKey);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const bottomRef = useRef(null);
  const recognizerRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle voice speech-to-text
  const toggleListening = () => {
    if (isListening) {
      recognizerRef.current?.stop();
      setIsListening(false);
      return;
    }

    if (!VoiceHandler.isRecognitionSupported()) {
      setVoiceError("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
      setTimeout(() => setVoiceError(""), 5000);
      return;
    }

    const rec = VoiceHandler.createRecognizer({
      onResult: (transcript) => {
        setIsListening(false);
        if (transcript.trim()) {
          handleSend(transcript.trim());
        }
      },
      onError: () => setIsListening(false),
      onEnd: () => setIsListening(false)
    });

    if (rec) {
      recognizerRef.current = rec;
      rec.start();
      setIsListening(true);
      setVoiceSessionActive(true);
    }
  };

  const handleSend = (textToSend) => {
    const query = (textToSend || input).trim();
    if (!query) return;

    setInput("");
    const newMsgs = [...messages, { role: "user", content: query }];
    setMessages(newMsgs);

    // Run Rule Engine (passing userRole so technical outage queries are restricted to admins/technicians)
    const result = matchQuery(query, {
      incidents,
      services,
      customArticles,
      orgConfig,
      userRole
    });

    let assistantMsg = { role: "assistant", result };

    if (result.type === "troubleshooting_article") {
      assistantMsg.content = `I found a matching guide: "${result.article.title}". Would you like to walk through the step-by-step resolution cards?`;
      if (voiceEnabled) {
        VoiceHandler.speak(`I found a matching guide for ${result.article.title}. Click Start Guided Steps to begin.`, { enabled: true });
      }
    } else if (result.type === "outage_report") {
      assistantMsg.content = result.title + "\n" + result.message;
      if (voiceEnabled) {
        VoiceHandler.speak(result.title + ". " + result.message, { enabled: true });
      }
    } else if (result.type === "escalate_direct") {
      assistantMsg.content = result.message;
      if (voiceEnabled) {
        VoiceHandler.speak(`Our technical support team is available at ${orgConfig.support_phone || "your internal hotline"}.`, { enabled: true });
      }
    } else {
      // No KB match found!
      if (accountType === "individual") {
        assistantMsg = {
          role: "assistant",
          type: "three_way_escalation",
          content: `I could not find a self-service solution for "${query}" in our knowledge base.\n\nDon't worry — our IT support team is standing by to resolve this. Choose how you would like to proceed:`,
          context: {
            title: query,
            category: "General IT",
            priority: "HIGH",
            steps: ["No automated KB article matched user query."]
          }
        };
        if (voiceEnabled) {
          VoiceHandler.speak("I couldn't find a solution in the knowledge base, but our IT team is available. Select an option below.", { enabled: true });
        }
      } else {
        assistantMsg.content = result.message || "I could not find a troubleshooting article matching your query. Please contact your company's IT helpdesk or raise a ticket.";
      }
    }

    setMessages(prev => [...prev, assistantMsg]);
  };

  // Handles the 3 escalation options (Ticket Only, WhatsApp, Direct Call, Quick Assist)
  // Strict Service Tier Gate:
  // - Enterprise: Free internal support
  // - Paid Session Active with 'REMOTE' tier: Unlocks WhatsApp, Call IT, and Quick Assist for the duration of the session!
  // - Paid Session with 'PHYSICAL_VISIT' tier: Only Physical On-Site Visit dispatch is active; remote tools remain locked.
  // - Unpaid: Opens IndividualCheckoutModal with pricing and conditions.
  const handleSelectThreeWayOption = async (optionType, context) => {
    const isEnterprise = orgConfig?.workspace_mode === "ENTERPRISE";

    // 1. Enterprise internal IT is strictly free
    if (isEnterprise) {
      if (optionType === "quick_assist") {
        setShowRemoteModal(true);
        return;
      }
      if (optionType === "call") {
        setShowContactModal(true);
        return;
      }
      await processTicketDispatch(optionType, context, {
        paymentStatus: "FREE",
        paymentAmount: 0,
        supportType: "REMOTE"
      });
      return;
    }

    // 2. Individual or Commercial Portal client: Check active session tier
    if (activePaidSession) {
      // If user paid for REMOTE, ALL 3 remote channels (WhatsApp, Call IT, Quick Assist) are UNLOCKED!
      if (activePaidSession.tier === "REMOTE") {
        if (optionType === "quick_assist") {
          setShowRemoteModal(true);
          return;
        }

        const hotline = orgConfig?.support_phone || "+2349162029201";
        const cleanHotline = hotline.replace(/\s+/g, "");
        const rawWa = (orgConfig?.support_whatsapp || "2349162029201").replace(/\D/g, "");

        if (optionType === "whatsapp") {
          const waMsg = encodeURIComponent(
            `🎫 *BizaDesk Support (Active Ticket: ${activePaidSession.ticketId || "TKT-ACTIVE"})*\n\n` +
            `*Issue:* ${context?.summary || context?.title || "IT Assistance"}\n` +
            `*Service:* Remote IT Assist (Paid Session)\n` +
            `*Payment Ref:* ${activePaidSession.reference || "N/A"}\n\n` +
            `Connecting to support team.`
          );
          window.open(`https://wa.me/${rawWa}?text=${waMsg}`, "_blank");
          return;
        }

        if (optionType === "call") {
          window.open(`tel:${cleanHotline}`, "_self");
          return;
        }

        // Direct ticket dispatch under active remote session
        await processTicketDispatch(optionType, context, {
          paymentStatus: "PAID",
          paymentAmount: activePaidSession.amount || 0,
          reference: activePaidSession.reference,
          supportType: "REMOTE"
        });
        return;
      }

      // If user paid for PHYSICAL_VISIT only: Remote channels remain locked!
      if (activePaidSession.tier === "PHYSICAL_VISIT") {
        setMessages(prev => [
          ...prev,
          {
            role: "assistant",
            content: `🔒 Remote IT Channels Locked: You currently have an active Physical On-Site Visit dispatch scheduled (Ticket ${activePaidSession.ticketId || "Pending"}). Remote screen assist and priority WhatsApp support require a Remote IT Assist session.`
          }
        ]);
        // Offer to initiate a Remote Assist session if needed
        setCheckoutModal({ option: optionType, context, defaultTier: "REMOTE" });
        return;
      }
    }

    // 3. FREE TICKET ESCALATION: "Create Ticket Only" is 100% Free for all users!
    if (optionType === "ticket") {
      await processTicketDispatch("ticket", context, {
        paymentStatus: "FREE",
        paymentAmount: 0,
        supportType: "REMOTE"
      });
      return;
    }

    // 4. Live Channels (WhatsApp, Call IT, Quick Assist) require payment if not yet in paid session
    setCheckoutModal({ option: optionType, context });
  };

  // Called after payment is verified (for individual/commercial) or directly (for enterprise)
  const processTicketDispatch = async (optionType, context, paymentInfo = {}) => {
    const issueTitle = context?.summary || context?.title || "IT Assistance Request via Virtual IT";
    const categoryTag = context?.category || "General IT";
    const priorityTag = context?.priority || "HIGH";
    const stepsLog = context?.steps?.length
      ? context.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")
      : "No automated KB steps available.";

    let createdTicket = null;
    if (onSubmitTicket) {
      createdTicket = await onSubmitTicket({
        title: `[${optionType.toUpperCase()}] ${issueTitle}`,
        ticket_type: categoryTag === "Network" ? "Network Issue" : "Software Issue",
        priority: priorityTag,
        desc: `Resolution route: ${optionType.toUpperCase()}\nIssue: ${issueTitle}\nCategory: ${categoryTag}\nPre-steps:\n${stepsLog}${
          paymentInfo.supportType === "PHYSICAL_VISIT"
            ? `\n\n🚗 PHYSICAL VISIT DISPATCH:\nAddress: ${paymentInfo.address}\nCity: ${paymentInfo.city}\nSchedule: ${paymentInfo.visitSchedule}\nContact: ${paymentInfo.contactPhone}`
            : ""
        }`,
        submitter: currentUserProfile?.full_name || currentUser?.email || "Customer",
        payment_status: paymentInfo.paymentStatus || "FREE",
        payment_amount: paymentInfo.paymentAmount || 0,
        paystack_ref: paymentInfo.reference || null,
        support_type: paymentInfo.supportType || "REMOTE",
        visit_address: paymentInfo.address || null,
        visit_city: paymentInfo.city || null
      });
    }

    const ticketId = createdTicket?.id || "TKT-101";

    // If paid session, persist active session state with service tier
    if (paymentInfo.paymentStatus === "PAID") {
      const newSession = {
        tier: paymentInfo.supportType === "PHYSICAL_VISIT" ? "PHYSICAL_VISIT" : "REMOTE",
        ticketId,
        reference: paymentInfo.reference,
        amount: paymentInfo.paymentAmount,
        dispatchDetails: paymentInfo.supportType === "PHYSICAL_VISIT" ? {
          address: paymentInfo.address,
          city: paymentInfo.city,
          visitSchedule: paymentInfo.visitSchedule,
          contactPhone: paymentInfo.contactPhone
        } : null,
        timestamp: Date.now()
      };
      setActivePaidSession(newSession);
      try {
        sessionStorage.setItem(sessionKey, JSON.stringify(newSession));
      } catch (err) {
        console.warn("Could not save session:", err);
      }
    }

    const hotline = orgConfig?.support_phone || "+2349162029201";
    const cleanHotline = hotline.replace(/\s+/g, "");
    const rawWa = (orgConfig?.support_whatsapp || "2349162029201").replace(/\D/g, "");

    if (paymentInfo.supportType === "PHYSICAL_VISIT") {
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: `✅ Physical On-Site Visit Confirmed!\n\nTicket ${ticketId} logged with our dispatch team. An IT Field Technician has been scheduled for ${paymentInfo.city} (${paymentInfo.address}).\n\n📅 Scheduled Window: ${paymentInfo.visitSchedule || "Standard Next-Day"}\n📞 Technician Contact Hotline: ${hotline}\n\nNote: Physical visit covers on-site resolution. Remote screen assist remains locked under this tier.`
        }
      ]);
      return;
    }

    // Remote IT Assist Tier Unlocked
    if (optionType === "whatsapp") {
      const waMessage = encodeURIComponent(
        `🎫 *BizaDesk Support Ticket: ${ticketId}*\n\n` +
        `*Issue:* ${issueTitle}\n` +
        `*Category:* ${categoryTag}\n` +
        `*Priority:* ${priorityTag}\n` +
        `*Service:* Remote IT Assist (Paid Session)\n` +
        `*Payment Ref:* ${paymentInfo.reference || "N/A"}\n\n` +
        `*Context / Pre-steps attempted:*\n${stepsLog}\n\n` +
        `I have completed payment and need immediate assistance from an IT technician.`
      );
      window.open(`https://wa.me/${rawWa}?text=${waMessage}`, "_blank");

      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: `✅ Payment verified & Ticket ${ticketId} logged into your support queue. Opening WhatsApp chat with our technical support team now...\n\n🎉 All Remote Channels Unlocked: You can now also use Call IT (${hotline}) and Quick Assist screen share freely during this session without paying again!`
        }
      ]);
    } else if (optionType === "call") {
      window.open(`tel:${cleanHotline}`, "_self");

      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: `✅ Payment verified & Ticket ${ticketId} logged into your support queue. Connecting call to our IT Hotline (${hotline})...\n\n🎉 All Remote Channels Unlocked: You can now also use WhatsApp and Quick Assist screen share freely during this session without paying again!`
        }
      ]);
    } else if (optionType === "quick_assist") {
      setShowRemoteModal(true);
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: `✅ Payment verified & Ticket ${ticketId} logged into your support queue. Launching Quick Assist remote screen share...\n\n🎉 All Remote Channels Unlocked: You can now also use WhatsApp and Call IT freely during this session without paying again!`
        }
      ]);
    } else {
      // Option: ticket only (Free standard support queue or paid ticket)
      const isPaid = paymentInfo.paymentStatus === "PAID";
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: isPaid
            ? `✅ Payment verified! Ticket ${ticketId} has been raised with ${priorityTag} priority and assigned to our on-duty IT team. You can view progress anytime in the "My Tickets" tab.`
            : `✅ Ticket ${ticketId} logged into your support queue with Standard Queue (Free) priority. Our IT support team will review and attend to it. You can track progress anytime in the "My Tickets" tab.\n\nNeed immediate 1-on-1 assistance right now? Use WhatsApp, Call IT, or Quick Assist at the top.`
        }
      ]);
    }
  };

  const handleEscalateToTicket = (article) => {
    setActiveStepArticle(null);

    const isEnterprise = orgConfig?.workspace_mode === "ENTERPRISE";

    // Non-Enterprise (Public Individuals and Commercial Clients) always see the 3-Way Escalation Choice Card!
    if (!isEnterprise) {
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          type: "three_way_escalation",
          content: `Since the guided steps for "${article?.title || "your issue"}" did not resolve the problem, how would you like our IT team to assist you?`,
          context: article
        }
      ]);
      return;
    }

    // Enterprise users default to standard internal corporate ticket submission
    const ticketPayload = {
      title: article ? `Unresolved: ${article.title}` : "User requested IT Assistance via Virtual Support",
      ticket_type: article?.category === "Network" ? "Network Issue" : "Software Issue",
      priority: article?.priority || "HIGH",
      desc: `Automated Virtual IT Support troubleshooting completed without resolution.\nArticle Attempted: ${article?.title || "None"}\nCategory: ${article?.category || "General"}\nSteps attempted on user device.`,
      submitter: "Virtual IT Chat Assistant"
    };

    if (onSubmitTicket) {
      onSubmitTicket(ticketPayload);
    }

    setMessages(prev => [
      ...prev,
      {
        role: "assistant",
        content: `✅ I have escalated this issue directly to your company's ${article?.escalateTo || "Service Desk"} as a high-priority ticket. A technician will contact you shortly.`
      }
    ]);
  };

  const handleArticleResolved = (article) => {
    setActiveStepArticle(null);
    if (onLogAudit) {
      onLogAudit({
        action: `Resolved issue via KB: ${article.title}`,
        result: "SUCCESS"
      });
    }
    setMessages(prev => [
      ...prev,
      {
        role: "assistant",
        content: `🎉 Awesome! I'm glad "${article.title}" solved the issue. Your resolution has been logged. Let me know if you need anything else!`
      }
    ]);
  };

  // Called when a user completes or exits the KB card modal to ask if it solved the problem
  const handleArticleFinished = (article, solved) => {
    setActiveStepArticle(null);
    if (solved) {
      handleArticleResolved(article);
    } else {
      const isEnterprise = orgConfig?.workspace_mode === "ENTERPRISE";
      if (!isEnterprise) {
        setMessages(prev => [
          ...prev,
          {
            role: "assistant",
            type: "three_way_escalation",
            content: `Understood! Since "${article.title}" did not solve the issue, how would you like our IT support team to assist you?`,
            context: article
          }
        ]);
      } else {
        handleEscalateToTicket(article);
      }
    }
  };

  return (
    <div className="flex flex-col h-[750px] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
      {/* Top Header */}
      <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              Virtual IT Support Desk
              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Zero-Token Engine
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">Attended diagnostics, guided fixes & live outages</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Voice Speaker Toggle */}
          <button
            onClick={() => setVoiceEnabled(v => !v)}
            title={voiceEnabled ? "Voice Output Active" : "Voice Output Muted"}
            className={`p-2 rounded-lg text-xs flex items-center gap-1.5 transition-colors border ${
              voiceEnabled 
                ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/30" 
                : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
            }`}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Remote Assist Button (Shown to all users in Virtual IT) */}
          <button
            onClick={() => {
              if (orgConfig?.workspace_mode === "ENTERPRISE") {
                // Enterprise internal staff: free immediate remote session
                setShowRemoteModal(true);
              } else {
                // Commercial client / Individual: Gated by Paystack checkout (or unlocked via active REMOTE session)
                handleSelectThreeWayOption("quick_assist", { summary: "Remote Screen Diagnostics & Quick Assist" });
              }
            }}
            className="hidden sm:flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
          >
            <Monitor className="w-3.5 h-3.5 text-indigo-400" />
            Quick Assist
          </button>

          {/* WhatsApp Button: Shown on Commercial workspaces and Individual accounts. NOT on Enterprise internal workspaces */}
          {orgConfig?.workspace_mode !== "ENTERPRISE" && (
            <button
              onClick={() => {
                // Commercial or Individual support: opens Paystack checkout modal before connecting
                handleSelectThreeWayOption("whatsapp", { summary: "WhatsApp Priority IT Assistance" });
              }}
              className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-medium text-xs px-3 py-1.5 rounded-lg transition-all shadow-md shadow-emerald-950 border border-emerald-600"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>
          )}

          {/* Call IT Button */}
          <button
            onClick={() => {
              if (orgConfig?.workspace_mode === "ENTERPRISE") {
                // Enterprise internal staff: opens internal IT contact modal (Phone, Helpdesk Email, and Teams/Slack link)
                setShowContactModal(true);
              } else {
                // Commercial client / Individual: Gated by Paystack checkout
                handleSelectThreeWayOption("call", { summary: "Direct Phone Call IT Support" });
              }
            }}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs px-3 py-1.5 rounded-lg transition-all border border-slate-700"
          >
            <Phone className="w-3.5 h-3.5 text-emerald-400" />
            Call IT
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-6 overflow-y-auto space-y-4">
        {messages.map((m, i) => {
          const isUser = m.role === "user";
          const res = m.result;

          return (
            <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed ${
                isUser 
                  ? "bg-indigo-600 text-white rounded-tr-none shadow-lg shadow-indigo-950/40" 
                  : "bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-none shadow-sm"
              }`}>
                {!isUser && (
                  <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-800/80">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-[10px] font-semibold tracking-wider uppercase text-indigo-400">
                      BizaDesk Assistant
                    </span>
                  </div>
                )}

                <div className="whitespace-pre-wrap">{m.content}</div>

                {/* Render Outage Cards if returned */}
                {res?.type === "outage_report" && res.items?.length > 0 && (
                  <div className="mt-3 space-y-2 pt-2 border-t border-slate-800">
                    {res.items.map(inc => (
                      <div key={inc.id} className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-100">{inc.id}</span>
                            <span className="text-amber-400 font-semibold">{inc.title}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            App: {inc.app} • Team: {inc.team} • Open: {inc.ageMinutes}m
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          {inc.severity}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Render Troubleshooting Guide Action Card */}
                {res?.type === "troubleshooting_article" && (
                  <div className="mt-3.5 bg-slate-900 border border-indigo-500/30 rounded-xl p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-slate-100">{res.article.title}</span>
                      <span className="text-[10px] font-medium text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                        {res.article.steps?.length} steps
                      </span>
                    </div>

                    <button
                      onClick={() => setActiveStepArticle(res.article)}
                      className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all text-xs shadow-md shadow-indigo-950"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      Start Guided Troubleshooting Cards
                    </button>
                  </div>
                )}

                {/* WhatsApp CTA — shown after ticket is raised (individual users) */}
                {m.type === "ticket_raised" && m.waUrl && (
                  <div className="mt-3.5 pt-3 border-t border-slate-800 space-y-2">
                    <a
                      href={m.waUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 w-full bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold py-2.5 rounded-lg transition-colors border border-emerald-600 shadow-md shadow-emerald-950"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Immediate WhatsApp Assist — Send Ticket Details
                    </a>
                    <p className="text-[10px] text-slate-500 text-center">
                      Your issue summary is pre-loaded — no need to repeat yourself
                    </p>
                  </div>
                )}

                {/* 3-Way Escalation Choice Card: Chat WhatsApp vs Call Hotline vs Create Ticket */}
                {m.type === "three_way_escalation" && (
                  <div className="mt-3.5 pt-3 border-t border-slate-800 space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* 1. Chat on WhatsApp */}
                      <button
                        onClick={() => handleSelectThreeWayOption("whatsapp", m.context)}
                        className="flex flex-col items-center justify-center gap-1 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold py-2.5 px-2 rounded-lg border border-emerald-600 shadow-md shadow-emerald-950 transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Chat on WhatsApp</span>
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-200 bg-emerald-800/80 px-1.5 py-0.2 rounded">
                          Live Assist
                        </span>
                      </button>

                      {/* 2. Direct Call */}
                      <button
                        onClick={() => handleSelectThreeWayOption("call", m.context)}
                        className="flex flex-col items-center justify-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold py-2.5 px-2 rounded-lg border border-slate-700 transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Direct Call IT</span>
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-300 bg-slate-900 px-1.5 py-0.2 rounded border border-emerald-500/30">
                          Live Assist
                        </span>
                      </button>

                      {/* 3. Create Ticket Only (Free) */}
                      <button
                        onClick={() => handleSelectThreeWayOption("ticket", m.context)}
                        className="flex flex-col items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2.5 px-2 rounded-lg shadow-md shadow-indigo-950 transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          <Ticket className="w-3.5 h-3.5" />
                          <span>Create Ticket</span>
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-100 bg-indigo-700/90 px-1.5 py-0.2 rounded border border-indigo-400/30">
                          100% Free
                        </span>
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 text-center">
                      💡 <strong>Create Ticket is 100% Free</strong>. WhatsApp &amp; Call IT connect to instant live human technicians.
                    </p>
                  </div>
                )}

                {/* Render Suggestions Chips */}
                {m.suggestions && (
                  <div className="mt-3 flex flex-wrap gap-1.5 pt-2 border-t border-slate-800/80">
                    {m.suggestions.map((sug, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSend(sug)}
                        className="text-[11px] bg-slate-900 hover:bg-slate-800 hover:text-indigo-300 text-slate-300 px-2.5 py-1 rounded-full border border-slate-700/80 transition-colors flex items-center gap-1"
                      >
                        {sug}
                        <ChevronRight className="w-3 h-3 text-slate-500" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input Bar */}
      <div className="p-4 bg-slate-950 border-t border-slate-800">
        {voiceError && (
          <div className="mb-2 px-3 py-1.5 rounded-lg bg-rose-950/70 border border-rose-900/80 text-rose-300 text-[11px] flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>{voiceError}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          {/* Mic Button */}
          <button
            type="button"
            onClick={toggleListening}
            className={`p-3 rounded-xl transition-all border shrink-0 ${
              isListening
                ? "bg-rose-600 text-white border-rose-500 animate-pulse shadow-lg shadow-rose-950"
                : "bg-slate-900 text-slate-400 hover:text-slate-100 border-slate-800 hover:border-slate-700"
            }`}
            title={isListening ? "Listening... Speak now" : "Click to speak your issue"}
          >
            {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder={isListening ? "Listening... Speak your issue..." : "Describe your computer, internet, or app issue..."}
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />

          {/* Send Button */}
          <button
            type="button"
            disabled={!input.trim()}
            onClick={() => handleSend()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white font-medium p-3 rounded-xl transition-all shrink-0 shadow-lg shadow-indigo-950"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Step Cards Modal */}
      {activeStepArticle && (
        <StepCardModal
          article={activeStepArticle}
          defaultAutoRead={voiceSessionActive}
          onClose={() => { setActiveStepArticle(null); setVoiceSessionActive(false); }}
          onResolved={(art) => { setActiveStepArticle(null); setVoiceSessionActive(false); handleArticleFinished(art, true); }}
          onEscalate={(art) => { setActiveStepArticle(null); setVoiceSessionActive(false); handleArticleFinished(art, false); }}
        />
      )}

      {/* Remote Quick Assist Modal */}
      {showRemoteModal && (
        <RemoteSessionModal
          orgConfig={orgConfig}
          onClose={() => setShowRemoteModal(false)}
          onConfirmSession={(details) => {
            if (onLogAudit) {
              onLogAudit({
                action: "Attended Quick Assist Session Initiated",
                result: `Code: ${details.code}`
              });
            }
          }}
        />
      )}

      {/* Contact IT Modal */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-sm w-full p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
              <Phone className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-100">Contact IT Support</h3>
            <p className="text-xs text-slate-400">
              {accountType === "individual"
                ? "Need immediate assistance? Call our hotline or chat on WhatsApp — available 24/7."
                : "Reach your organization's internal IT department using the channels configured below."}
            </p>

            {accountType === "individual" ? (
              <>
                {/* Individual User Hotline (Platform Owner) */}
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
                  <span className="text-xs text-slate-400 block">📞 Support Hotline</span>
                  <a
                    href="tel:+2349162029201"
                    className="text-base font-mono font-bold text-emerald-400 hover:underline block"
                  >
                    +234 916 202 9201
                  </a>
                  <span className="text-[11px] text-slate-500 block">
                    {orgConfig.support_email || "helpdesk@bizadoc.com"}
                  </span>
                </div>

                {/* Individual WhatsApp Button */}
                <a
                  href="https://wa.me/2349162029201?text=Hello%20BizaDesk%20Support%2C%20I%20need%20IT%20assistance."
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold py-2.5 rounded-lg transition-colors border border-emerald-600 shadow-md shadow-emerald-950"
                >
                  <MessageCircle className="w-4 h-4" />
                  Chat on WhatsApp
                </a>
              </>
            ) : (
              <>
                {/* Business Staff Contact Options - Configured by Admin */}
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-left space-y-3">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">IT Hotline / Phone</span>
                    {orgConfig.support_phone ? (
                      <a
                        href={`tel:${orgConfig.support_phone.replace(/\s+/g, "")}`}
                        className="text-sm font-mono font-bold text-emerald-400 hover:underline block"
                      >
                        {orgConfig.support_phone}
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400 italic">No hotline configured by admin</span>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">IT Helpdesk Email</span>
                    <a
                      href={`mailto:${orgConfig.support_email || "it-support@company.com"}`}
                      className="text-xs text-indigo-400 hover:underline block truncate"
                    >
                      {orgConfig.support_email || "it-support@company.com"}
                    </a>
                  </div>

                  {/* Optional Teams / Slack / Chat Link configured by Business Admin */}
                  {orgConfig.support_chat_link && (
                    <div className="pt-2 border-t border-slate-800/80">
                      <a
                        href={orgConfig.support_chat_link}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium py-2 rounded-lg transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open Teams / Slack IT Chat
                      </a>
                    </div>
                  )}

                  {/* Optional Internal Company IT WhatsApp configured by Business Admin */}
                  {orgConfig.support_whatsapp && (
                    <div className="pt-1">
                      <a
                        href={
                          orgConfig.support_whatsapp.startsWith("http")
                            ? orgConfig.support_whatsapp
                            : `https://wa.me/${orgConfig.support_whatsapp.replace(/\D/g, "")}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-2 w-full bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium py-2 rounded-lg transition-colors border border-emerald-600"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Company IT WhatsApp
                      </a>
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setShowContactModal(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2 rounded-lg border border-slate-700"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowContactModal(false);
                  handleEscalateToTicket(null);
                }}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium py-2 rounded-lg"
              >
                Request Callback
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Individual Paystack Checkout Modal */}
      {checkoutModal && (
        <IndividualCheckoutModal
          user={currentUser}
          userProfile={currentUserProfile}
          pendingContext={checkoutModal.context}
          selectedOption={checkoutModal.option}
          orgPricing={orgConfig}
          onClose={() => {
            const context = checkoutModal.context;
            setCheckoutModal(null);
            // Friendly prompt offering free ticket submission if user cancels payment
            setMessages(prev => [
              ...prev,
              {
                role: "assistant",
                content: `💡 Prefer not to pay for instant live dispatch? No problem! You can always select Create Ticket below for free, and our IT team will attend to it in the standard queue.`,
                type: "three_way_escalation",
                context: context
              }
            ]);
          }}
          onPaymentSuccess={(paymentInfo) => {
            const { option, context } = checkoutModal;
            setCheckoutModal(null);
            processTicketDispatch(option, context, {
              ...paymentInfo,
              paymentStatus: "PAID",
              paymentAmount: paymentInfo.amount
            });
          }}
        />
      )}
    </div>
  );
}
