import starterKb from "../data/starter-kb.json";

function normalize(str) {
  return (str || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordOverlapScore(queryWords, keywordWords) {
  if (!queryWords.length || !keywordWords.length) return 0;
  let matches = 0;
  for (const q of queryWords) {
    if (keywordWords.some(k => k === q || (k.length > 3 && (k.includes(q) || q.includes(k))))) {
      matches++;
    }
  }
  return matches / Math.max(queryWords.length, keywordWords.length);
}

export function formatArticleContent(text, orgConfig = {}) {
  if (!text || typeof text !== "string") return text;
  return text
    .replace(/\{\{HELPDESK_PHONE\}\}/g, orgConfig.support_phone || "+234 916 202 9201")
    .replace(/\{\{SECURITY_EMAIL\}\}/g, orgConfig.support_email || "it-support@company.com")
    .replace(/\{\{SUPPORT_EMAIL\}\}/g, orgConfig.support_email || "it-support@company.com")
    .replace(/\{\{VPN_GATEWAY\}\}/g, orgConfig.vpn_gateway || "vpn.company.com")
    .replace(/\{\{WIFI_NAME\}\}/g, orgConfig.wifi_name || "Company-Secure-WiFi")
    .replace(/\{\{PING_TARGET\}\}/g, "8.8.8.8");
}

export function matchQuery(query, { incidents = [], services: _services = [], customArticles = [], orgConfig = {}, userRole = "user" }) {
  const qClean = normalize(query);
  const qWords = qClean.split(" ").filter(w => w.length > 1);

  if (!qClean) {
    return { type: "empty", message: "Please enter or speak your issue." };
  }

  // 1. Live Outage Queries (Restricted to IT Admins and Technicians only)
  const outageKeywords = [
    "which issue is on", "what issue is on", "active issue", "active incident",
    "is system down", "system status", "any outage", "outage", "is network down",
    "is server down", "current issue", "ongoing problem", "what is broken"
  ];
  const isOutageQuery = outageKeywords.some(k => qClean.includes(k)) || 
    (qWords.includes("issue") && (qWords.includes("active") || qWords.includes("on") || qWords.includes("current")));

  if (isOutageQuery) {
    const isTechStaff = userRole === "admin" || userRole === "technician";
    
    // For end-users, individuals, and commercial clients: do not expose technical incident reports
    if (!isTechStaff) {
      return {
        type: "general_support",
        title: "Technical Support Assistance",
        message: "Internal server diagnostics and incident command are managed directly by IT administrators.\n\nIf you are experiencing network disruptions, computer issues, or cannot access your tools, please follow the guided troubleshooting steps or connect with a support technician below.",
        suggestions: [
          "No internet connection",
          "Wi-Fi slow or dropping",
          "Printer offline or not printing",
          "Computer slow or frozen",
          "Email not syncing / Outlook error"
        ]
      };
    }

    const active = incidents.filter(i => !i.resolved);
    if (active.length === 0) {
      return {
        type: "outage_report",
        status: "HEALTHY",
        title: "All Systems Operational",
        message: "Great news! There are currently no active incidents or outages reported across company services.",
        items: []
      };
    }

    return {
      type: "outage_report",
      status: "INCIDENTS_ACTIVE",
      title: `${active.length} Active Incident(s) Detected`,
      message: `The following systems are currently experiencing disruptions:`,
      items: active.map(inc => ({
        id: inc.id,
        title: inc.title,
        severity: inc.severity,
        status: inc.status,
        team: inc.team,
        app: inc.app,
        ageMinutes: Math.floor((Date.now() - inc.opened_at) / 60000)
      }))
    };
  }

  // 2. Direct Human IT Escalation Requests
  const humanKeywords = ["talk to person", "talk to human", "human technician", "speak to agent", "call it", "it phone number", "escalate"];
  if (humanKeywords.some(k => qClean.includes(k))) {
    return {
      type: "escalate_direct",
      title: "Direct IT Support Contact",
      message: `Our technical support team is available via Phone and WhatsApp at ${orgConfig.support_phone || "+234 916 202 9201"}. Click below to chat on WhatsApp or request a priority callback.`,
      phone: orgConfig.support_phone || "+234 916 202 9201",
      email: orgConfig.support_email || "helpdesk@bizadoc.com"
    };
  }

  // 3. Search Knowledge Base (respecting tenant setting for global baseline articles; defaults to OFF)
  const includeGlobalKb = orgConfig.enable_global_kb === true;
  const allArticles = includeGlobalKb 
    ? [...(customArticles || []), ...(starterKb.articles || [])]
    : [...(customArticles || [])];

  let bestMatch = null;
  let highestScore = 0;

  for (const article of allArticles) {
    const titleClean = normalize(article.title);
    if (qClean === titleClean || qClean.includes(titleClean)) {
      highestScore = 1.0;
      bestMatch = article;
      break;
    }

    for (const kw of article.keywords || []) {
      const kwClean = normalize(kw);
      if (qClean === kwClean || qClean.includes(kwClean)) {
        if (1.0 > highestScore) {
          highestScore = 1.0;
          bestMatch = article;
        }
      } else {
        const score = wordOverlapScore(qWords, kwClean.split(" "));
        if (score > highestScore) {
          highestScore = score;
          bestMatch = article;
        }
      }
    }
  }

  if (bestMatch && highestScore >= 0.35) {
    return {
      type: "troubleshooting_article",
      article: {
        id: bestMatch.id,
        title: bestMatch.title,
        category: bestMatch.category,
        os: bestMatch.os,
        checks: bestMatch.checks || [],
        steps: (bestMatch.steps || []).map(step => formatArticleContent(step, orgConfig)),
        escalateTo: bestMatch.escalateTo || "Service Desk",
        priority: bestMatch.priority || "MEDIUM"
      },
      confidence: highestScore
    };
  }

  return {
    type: "fallback",
    title: "Need more details",
    message: "I couldn't find an exact troubleshooting guide for that phrase. Please choose a common topic below or connect with human IT support directly.",
    suggestions: [
      "No internet connection",
      "Wi-Fi slow or dropping",
      "Printer offline or not printing",
      "Audio or microphone not working",
      "Email not syncing / Outlook error",
      "Computer slow or frozen",
      "Request remote assistance"
    ]
  };
}
