import { supabase } from "../supabase";

const APP_URL = import.meta.env.VITE_APP_URL || "https://desk.bizadoc.com";

export const DEFAULT_INCIDENT_TEMPLATES = {
  initial: {
    subject: `[{{severity}}] Incident Alert: {{title}} — {{application}}`,
    body: `Dear {{team}},\n\nAn automated incident has been detected on {{application}}.\n\nINCIDENT ID: {{incident_id}}\nTITLE: {{title}}\nAPPLICATION: {{application}}\nSEVERITY: {{severity}}\nDETECTED AT: {{time_detected}}\n\nDESCRIPTION:\n{{description}}\n\nPLEASE TAKE IMMEDIATE ACTION.\n\nRegards,\n{{company_name}} IT Operations`
  },
  manager_escalation: {
    subject: `[TIER 2 ESCALATION] Unresolved {{severity}} Incident: {{title}}`,
    body: `Dear IT Leadership / Support Manager,\n\nIncident {{incident_id}} has remained UNRESOLVED for {{time_open}} minutes.\n\nTITLE: {{title}}\nAPPLICATION: {{application}}\nSEVERITY: {{severity}}\nASSIGNED TEAM: {{team}}\n\nPlease step in or re-assign immediately.\n\nRegards,\n{{company_name}} Incident Command`
  },
  allstaff: {
    subject: `[URGENT ALL-STAFF OUTAGE] {{title}} — {{application}}`,
    body: `URGENT NOTICE:\n\nIncident {{incident_id}} is still open after {{time_open}} minutes.\nAPPLICATION: {{application}}\nSEVERITY: {{severity}}\nSTATUS: MAXIMUM ESCALATION\n\nAll company staff are being notified of this service disruption.\n\n{{company_name}} IT Support`
  },
  resolution: {
    subject: `[RESOLVED] {{title}} — {{incident_id}}`,
    body: `Dear All,\n\nThe following incident has been RESOLVED.\n\nINCIDENT: {{incident_id}}\nTITLE: {{title}}\nAPPLICATION: {{application}}\nRESOLVED BY: {{resolved_by}}\nTIME TO RESOLVE: {{time_open}} minutes\n\nAll systems are now operating normally.\n\nRegards,\n{{company_name}} IT Operations`
  }
};

export const DEFAULT_TICKET_TEMPLATES = {
  ticket_created: {
    subject: `[{{ticket_id}}] Support Request Received: {{title}}`,
    body: `Dear {{submitter}},\n\nThank you for reaching out to IT Support. Your ticket has been logged and assigned to our queue.\n\nTICKET DETAILS:\n• Ticket ID: {{ticket_id}}\n• Subject: {{title}}\n• Category: {{category}}\n• Priority: {{priority}}\n• Status: {{status}}\n\nOur team is reviewing your request. You can track progress or reply directly anytime at {{portal_url}}.\n\nBest regards,\n{{team}}\n{{company_name}}`
  },
  ticket_assigned: {
    subject: `[{{ticket_id}}] Assigned: {{title}}`,
    body: `Hello {{assigned_to}},\n\nYou have been assigned to handle IT Ticket {{ticket_id}}.\n\nTICKET DETAILS:\n• Title: {{title}}\n• Submitter: {{submitter}}\n• Priority: {{priority}}\n• Category: {{category}}\n\nPlease review the issue and initiate work within the SLA window.\n\nHelpdesk Portal: {{portal_url}}\n\nRegards,\n{{company_name}} IT Dispatch`
  },
  ticket_updated: {
    subject: `[{{ticket_id}}] Update on your ticket: {{title}}`,
    body: `Dear {{submitter}},\n\nAn update has been posted to your support ticket {{ticket_id}}.\n\nSTATUS: {{status}}\nASSIGNED TECHNICIAN: {{assigned_to}}\n\nLATEST NOTE:\n{{update_note}}\n\nTo view full history or reply, please visit: {{portal_url}}\n\nBest regards,\n{{team}}\n{{company_name}}`
  },
  ticket_resolved: {
    subject: `[{{ticket_id}}] RESOLVED: {{title}}`,
    body: `Dear {{submitter}},\n\nYour IT support ticket {{ticket_id}} has been marked as RESOLVED by {{assigned_to}}.\n\nRESOLUTION SUMMARY:\n• Ticket ID: {{ticket_id}}\n• Subject: {{title}}\n• Resolution Note: {{resolution_note}}\n\nIf everything is working properly, no further action is required. If you still need help, you can reopen this ticket anytime at {{portal_url}}.\n\nThank you for your patience!\n\nWarm regards,\n{{team}}\n{{company_name}}`
  }
};

export const DEFAULT_FOOTER_CONFIG = {
  team_name: "IT Operations & Helpdesk Team",
  contact_info: "+1 (800) 555-0199 / WhatsApp Support",
  support_email: "helpdesk@bizadoc.com",
  portal_url: APP_URL,
  address: "Corporate IT Support Command Center",
  disclaimer: "CONFIDENTIALITY NOTICE: This transmission is intended only for the designated recipient and may contain confidential or legally privileged IT communications. If you are not the intended recipient, any disclosure, copying, distribution, or action taken in reliance on the contents is strictly prohibited."
};

/**
 * Safely replaces {{placeholder}} in template strings
 */
export function fillTemplate(templateStr, data = {}) {
  if (!templateStr) return "";
  return templateStr.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    return data[key] !== undefined && data[key] !== null ? String(data[key]) : `{{${key}}}`;
  });
}

/**
 * Generates an email-safe, crisp white HTML template with corporate branding:
 * - Branded Header Banner or Logo
 * - Pure White Card (#ffffff) with high-contrast, readable dark text (#0f172a / #334155)
 * - Optional subtle centered watermark logo behind text (5% opacity via Outlook VML + CSS)
 * - Brand Accent Color for borders & buttons
 * - Structured Company Footer: Sending Team, Hotline/Contact, Portal link, Address, & Legal/Cogent Disclaimer
 */
export function generateBrandedHtmlEmail({
  title,
  bodyText,
  badgeText = "",
  badgeColor = "#2563eb",
  badgeBg = "#eff6ff",
  badgeBorder = "#bfdbfe",
  actionUrl = APP_URL,
  actionText = "Open BizaDesk Portal →",
  orgConfig = {},
  details = []
}) {
  const orgName = orgConfig?.name || "BizaDesk IT Support";
  const branding = orgConfig?.email_branding || {};
  const logoUrl = branding.logo_url || orgConfig?.logo_url || "";
  const headerBannerUrl = branding.header_banner_url || "";
  const showWatermark = Boolean(branding.show_watermark);
  const watermarkUrl = branding.watermark_url || logoUrl;
  const accentColor = branding.accent_color || "#2563eb";
  
  const footer = {
    ...DEFAULT_FOOTER_CONFIG,
    ...(orgConfig?.email_footer || {})
  };

  if (orgConfig?.email_footer?.include_disclaimer === false) {
    footer.disclaimer = "";
  }

  // Convert plain text newlines into HTML paragraphs/breaks safely
  const formattedBody = (bodyText || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n\n/g, "</p><p style=\"margin:0 0 14px;\">")
    .replace(/\n/g, "<br/>");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${title || orgName}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:36px 12px;margin:0;width:100%;">
    <tr>
      <td align="center">
        <!-- Main White Card Container -->
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 16px rgba(15,23,42,0.06);">
          
          <!-- Header Banner or Logo -->
          ${headerBannerUrl ? `
          <tr>
            <td style="padding:0;background-color:#ffffff;border-bottom:2px solid ${accentColor};">
              <img src="${headerBannerUrl}" alt="${orgName}" style="width:100%;max-width:600px;height:auto;display:block;" />
            </td>
          </tr>
          ` : logoUrl ? `
          <tr>
            <td align="center" style="padding:26px 36px 20px;background-color:#ffffff;border-bottom:2px solid ${accentColor};">
              <img src="${logoUrl}" alt="${orgName}" style="max-height:56px;max-width:280px;height:auto;display:block;margin:0 auto;" />
            </td>
          </tr>
          ` : `
          <tr>
            <td align="center" style="padding:24px 36px;background:linear-gradient(135deg,${accentColor} 0%,#1d4ed8 100%);">
              <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.4px;">${orgName}</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.85);letter-spacing:0.8px;margin-top:4px;text-transform:uppercase;">IT Service Desk & Incident Command</div>
            </td>
          </tr>
          `}

          <!-- Body Card (Pure White with Optional Watermark) -->
          <tr>
            <td style="padding:32px 36px;background-color:#ffffff;position:relative;">
              
              ${showWatermark && watermarkUrl ? `
              <!-- Watermark Centered Behind Text (Email-Safe Opacity) -->
              <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);opacity:0.05;pointer-events:none;z-index:0;text-align:center;">
                <img src="${watermarkUrl}" alt="" style="max-width:240px;max-height:240px;display:block;margin:0 auto;filter:grayscale(100%);" />
              </div>
              ` : ''}

              <div style="position:relative;z-index:1;">
                ${badgeText ? `
                <div style="display:inline-block;padding:4px 12px;border-radius:9999px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;background-color:${badgeBg};color:${badgeColor};border:1px solid ${badgeBorder};margin-bottom:16px;">
                  ${badgeText}
                </div>
                ` : ''}

                <h1 style="color:#0f172a;font-size:20px;font-weight:700;margin:0 0 16px;line-height:1.4;">${title}</h1>

                <div style="color:#334155;font-size:14px;line-height:1.65;">
                  <p style="margin:0 0 14px;">${formattedBody}</p>
                </div>

                ${details && details.length > 0 ? `
                <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
                  ${details.map(d => `
                  <tr>
                    <td style="padding:10px 14px;font-size:12px;font-weight:600;color:#64748b;border-bottom:1px solid #e2e8f0;width:35%;">${d.label}</td>
                    <td style="padding:10px 14px;font-size:13px;font-weight:600;color:#0f172a;border-bottom:1px solid #e2e8f0;">${d.value}</td>
                  </tr>
                  `).join("")}
                </table>
                ` : ''}

                ${actionUrl ? `
                <div style="text-align:center;margin:28px 0 12px;">
                  <a href="${actionUrl}" style="display:inline-block;background-color:${accentColor};color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;padding:12px 28px;border-radius:8px;letter-spacing:0.3px;box-shadow:0 2px 8px rgba(37,99,235,0.25);">
                    ${actionText}
                  </a>
                </div>
                ` : ''}
              </div>

            </td>
          </tr>

          <!-- Global Branded Email Footer -->
          <tr>
            <td style="padding:24px 36px 30px;background-color:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#1e293b;">
                ${footer.team_name || orgName}
              </p>
              ${footer.contact_info ? `<p style="margin:0 0 4px;font-size:12px;color:#64748b;"><strong>Support Contact / Hotline:</strong> ${footer.contact_info}</p>` : ''}
              ${footer.support_email ? `<p style="margin:0 0 4px;font-size:12px;color:#64748b;"><strong>Support Email:</strong> <a href="mailto:${footer.support_email}" style="color:${accentColor};text-decoration:none;">${footer.support_email}</a></p>` : ''}
              ${footer.portal_url ? `<p style="margin:0 0 6px;font-size:12px;color:#64748b;"><strong>Portal:</strong> <a href="${footer.portal_url}" style="color:${accentColor};text-decoration:none;">${footer.portal_url}</a></p>` : ''}
              ${footer.address ? `<p style="margin:6px 0 0;font-size:11px;color:#94a3b8;">${footer.address}</p>` : ''}
              ${footer.disclaimer ? `<p style="margin:12px 0 0;font-size:10px;color:#94a3b8;line-height:1.5;border-top:1px dashed #cbd5e1;padding-top:10px;font-style:italic;">${footer.disclaimer}</p>` : ''}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Dispatches an email via the Supabase Edge Function 'send-email' (backed by Resend).
 */
export async function sendEmailViaResend({ to, subject, body, html, apiKey, fromEmail, orgId }) {
  try {
    const { data, error } = await supabase.functions.invoke("send-email", {
      body: {
        to,
        subject,
        body,
        html,
        apiKey: apiKey?.trim() || undefined,
        fromEmail: fromEmail?.trim() || undefined,
        orgId
      }
    });

    if (error) {
      return { success: false, error: error.message || "Edge function failed" };
    }

    if (data && !data.success) {
      return { success: false, error: data.error || "Resend failed to deliver email" };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    return { success: false, error: err.message || "Network error calling email service" };
  }
}

/**
 * Sends a branded welcome email to a newly registered user.
 */
export async function sendWelcomeEmail(user, org) {
  const fullName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there";
  const accountType = user?.user_metadata?.account_type || (org?.domain ? "business" : "individual");
  const isIndividual = accountType === "individual";
  const companyName = org?.name || (isIndividual ? "Personal IT Support" : "Your Organization");
  const workspaceUrl = APP_URL;

  const businessChecklist = [
    ["👥", "Invite your IT team", "Go to Settings → User Management → Add Member"],
    ["📧", "Configure email settings", "Settings → Email Settings → Enter your Resend API key"],
    ["📚", "Add knowledge base articles", "Settings → Company Settings → Knowledge Base Manager"],
    ["🌐", "Set up monitored services", "Monitored Apps tab → Add your critical services"],
    ["⚙️", "Customize team routing rules", "Settings → Team Management → Configure routing"],
  ];

  const individualChecklist = [
    ["🤖", "Virtual IT Assistant", "Describe any issue (Wi-Fi, printer, VPN, slow PC) for instant guided fixes"],
    ["💬", "24/7 WhatsApp Hotline", "Need human help? Connect with a technician instantly on +234 916 202 9201"],
    ["🖥️", "Remote & On-Site Support", "Get hands-on technician remote sessions or schedule an in-person physical visit"],
    ["🛡️", "100% Money-Back Guarantee", "If our technicians cannot resolve your issue, you get a full automatic refund"],
  ];

  const activeChecklist = isIndividual ? individualChecklist : businessChecklist;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;max-width:600px;width:100%;box-shadow:0 4px 16px rgba(15,23,42,0.06);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);padding:36px 40px;text-align:center;">
              <div style="display:inline-flex;align-items:center;gap:10px;">
                <div style="width:44px;height:44px;background:rgba(255,255,255,0.2);border-radius:12px;display:inline-block;line-height:44px;text-align:center;font-size:24px;">⚡</div>
                <span style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">BizaDesk</span>
              </div>
              <p style="color:rgba(255,255,255,0.85);font-size:12px;margin:8px 0 0;letter-spacing:0.5px;">AUTONOMOUS IT SUPPORT & INCIDENT COMMAND</p>
            </td>
          </tr>
          <!-- Welcome Body -->
          <tr>
            <td style="padding:36px 40px;">
              <h1 style="color:#0f172a;font-size:22px;margin:0 0 8px;font-weight:700;">Welcome to BizaDesk, ${fullName}! 🎉</h1>
              <p style="color:#475569;font-size:14px;margin:0 0 24px;line-height:1.6;">
                ${isIndividual 
                  ? "Your personal IT support account is officially active. You now have 24/7 on-demand access to our AI Virtual IT Assistant, remote technician sessions, and on-site visits." 
                  : `Your <strong style="color:#0f172a;">${companyName}</strong> IT workspace is live on BizaDesk. Your 30-day free trial starts today — full access to all features, no credit card required.`
                }
              </p>
              <!-- Status Badge -->
              <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px 20px;margin-bottom:28px;display:flex;align-items:center;gap:12px;">
                <span style="font-size:28px;">${isIndividual ? "🛡️" : "⏱️"}</span>
                <div>
                  <div style="color:#2563eb;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">
                    ${isIndividual ? "Active Support Account" : "30-Day Free Trial"}
                  </div>
                  <div style="color:#0f172a;font-size:14px;font-weight:600;margin-top:2px;">
                    ${isIndividual ? "100% Refund Policy Guaranteed" : "Full access — expires in 30 days"}
                  </div>
                </div>
              </div>
              <!-- Quick-Start Checklist -->
              <h2 style="color:#0f172a;font-size:15px;font-weight:700;margin:0 0 16px;">
                ${isIndividual ? "🚀 How to Get Help" : "🚀 Quick-Start Checklist"}
              </h2>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${activeChecklist.map(([icon, title, desc]) => `
                <tr>
                  <td style="padding:0 0 12px 0;">
                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;display:flex;gap:12px;align-items:flex-start;">
                      <span style="font-size:18px;line-height:1;">${icon}</span>
                      <div>
                        <div style="color:#0f172a;font-size:13px;font-weight:600;">${title}</div>
                        <div style="color:#64748b;font-size:12px;margin-top:2px;">${desc}</div>
                      </div>
                    </div>
                  </td>
                </tr>`).join("")}
              </table>
              <!-- CTA Button -->
              <div style="text-align:center;margin:28px 0 8px;">
                <a href="${workspaceUrl}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 36px;border-radius:12px;letter-spacing:0.3px;box-shadow:0 4px 24px rgba(37,99,235,0.3);">
                  ${isIndividual ? "Get IT Help Now →" : "Open My Workspace →"}
                </a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid #e2e8f0;background-color:#f8fafc;">
              <p style="color:#64748b;font-size:11px;margin:0;text-align:center;line-height:1.6;">
                You're receiving this email because you registered at BizaDesk (BizaDoc Services).<br>
                Questions? WhatsApp: <a href="https://wa.me/2349162029201" style="color:#2563eb;text-decoration:none;">+234 916 202 9201</a> | Email:
                <a href="mailto:helpdesk@bizadoc.com" style="color:#2563eb;text-decoration:none;">helpdesk@bizadoc.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const plainText = isIndividual
    ? `Welcome to BizaDesk, ${fullName}!\n\nYour personal IT support account is active. You have 24/7 access to our AI Virtual IT Assistant, remote technician sessions, and on-site visits with a 100% money-back guarantee.\n\nOpen BizaDesk: ${workspaceUrl}\nWhatsApp Support: +234 916 202 9201\nEmail: helpdesk@bizadoc.com\n\n— The BizaDesk Team`
    : `Welcome to BizaDesk, ${fullName}!\n\nYour ${companyName} workspace is live. Your 30-day free trial starts today.\n\nQuick-Start Checklist:\n- Invite your IT team (Settings → User Management)\n- Configure email settings (Settings → Email Settings)\n- Add knowledge base articles (Settings → Company Settings)\n- Set up monitored services (Monitored Apps tab)\n- Customize team routing (Settings → Team Management)\n\nOpen your workspace: ${workspaceUrl}\n\nQuestions? Email helpdesk@bizadoc.com\n\n— The BizaDesk Team`;

  return sendEmailViaResend({
    to: user.email,
    subject: isIndividual 
      ? `Welcome to BizaDesk! Your IT support account is active 🛡️`
      : `Welcome to BizaDesk, ${companyName}! Your workspace is ready 🚀`,
    body: plainText,
    html,
    fromEmail: "BizaDesk <helpdesk@bizadoc.com>"
  });
}
