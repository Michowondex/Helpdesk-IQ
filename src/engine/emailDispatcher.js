import { supabase } from "../supabase";

const APP_URL = import.meta.env.VITE_APP_URL || "https://desk.bizadoc.com";

/**
 * Dispatches an email via the Supabase Edge Function 'send-email' (backed by Resend).
 *
 * @param {Object} options
 * @param {string|string[]} options.to - Recipient email(s)
 * @param {string} options.subject - Email subject
 * @param {string} options.body - Plain-text body
 * @param {string} [options.html] - Optional HTML formatted body
 * @param {string} [options.apiKey] - Optional explicit Resend API key
 * @param {string} [options.fromEmail] - Sender email
 * @param {string} [options.orgId] - Organization ID to lookup credentials from DB
 * @returns {Promise<{ success: boolean, id?: string, error?: string }>}
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
 * Sends a branded welcome email to a newly registered user (both business workspaces and individual users).
 * Triggered once when a new account confirmation is finalized.
 *
 * @param {Object} user - Supabase auth user object
 * @param {Object} [org] - Newly created organization row from DB (if business workspace)
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
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;max-width:600px;width:100%;">

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
              <h1 style="color:#f1f5f9;font-size:22px;margin:0 0 8px;font-weight:700;">Welcome to BizaDesk, ${fullName}! 🎉</h1>
              <p style="color:#94a3b8;font-size:14px;margin:0 0 24px;line-height:1.6;">
                ${isIndividual 
                  ? "Your personal IT support account is officially active. You now have 24/7 on-demand access to our AI Virtual IT Assistant, remote technician sessions, and on-site visits." 
                  : `Your <strong style="color:#e2e8f0;">${companyName}</strong> IT workspace is live on BizaDesk. Your 30-day free trial starts today — full access to all features, no credit card required.`
                }
              </p>

              <!-- Status Badge -->
              <div style="background:linear-gradient(135deg,#1d2d4f,#1e293b);border:1px solid #3b4f7a;border-radius:12px;padding:16px 20px;margin-bottom:28px;display:flex;align-items:center;gap:12px;">
                <span style="font-size:28px;">${isIndividual ? "🛡️" : "⏱️"}</span>
                <div>
                  <div style="color:#60a5fa;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">
                    ${isIndividual ? "Active Support Account" : "30-Day Free Trial"}
                  </div>
                  <div style="color:#e2e8f0;font-size:14px;font-weight:600;margin-top:2px;">
                    ${isIndividual ? "100% Refund Policy Guaranteed" : "Full access — expires in 30 days"}
                  </div>
                </div>
              </div>

              <!-- Quick-Start Checklist -->
              <h2 style="color:#e2e8f0;font-size:15px;font-weight:700;margin:0 0 16px;">
                ${isIndividual ? "🚀 How to Get Help" : "🚀 Quick-Start Checklist"}
              </h2>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${activeChecklist.map(([icon, title, desc]) => `
                <tr>
                  <td style="padding:0 0 12px 0;">
                    <div style="background:#0f172a;border:1px solid #334155;border-radius:10px;padding:12px 16px;display:flex;gap:12px;align-items:flex-start;">
                      <span style="font-size:18px;line-height:1;">${icon}</span>
                      <div>
                        <div style="color:#e2e8f0;font-size:13px;font-weight:600;">${title}</div>
                        <div style="color:#64748b;font-size:12px;margin-top:2px;">${desc}</div>
                      </div>
                    </div>
                  </td>
                </tr>`).join("")}
              </table>

              <!-- CTA Button -->
              <div style="text-align:center;margin:28px 0 8px;">
                <a href="${workspaceUrl}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 36px;border-radius:12px;letter-spacing:0.3px;box-shadow:0 4px 24px rgba(37,99,235,0.4);">
                  ${isIndividual ? "Get IT Help Now →" : "Open My Workspace →"}
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid #334155;">
              <p style="color:#475569;font-size:11px;margin:0;text-align:center;line-height:1.6;">
                You're receiving this email because you registered at BizaDesk (BizaDoc Services).<br>
                Questions? WhatsApp: <a href="https://wa.me/2349162029201" style="color:#38bdf8;text-decoration:none;">+234 916 202 9201</a> | Email:
                <a href="mailto:helpdesk@bizadoc.com" style="color:#38bdf8;text-decoration:none;">helpdesk@bizadoc.com</a>
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
