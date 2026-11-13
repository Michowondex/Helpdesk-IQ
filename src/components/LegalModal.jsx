import { useState } from "react";
import { ArrowLeft, Shield, FileText, CheckCircle2, X } from "lucide-react";

export default function LegalModal({ initialTab = "privacy", isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full h-[88vh] max-h-[850px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Bar (Pinned) */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">BizaDesk Legal Center</span>
              <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20 font-mono hidden sm:inline-block">
                desk.bizadoc.com
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab Switcher */}
            <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab("privacy")}
                className={`px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1.5 transition-all ${
                  activeTab === "privacy"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                Privacy
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("terms")}
                className={`px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1.5 transition-all ${
                  activeTab === "terms"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Terms
              </button>
            </div>

            {/* Quick Top Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Close Legal Center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body (Strictly bounded flex-1 min-h-0 with smooth touch scroll) */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 space-y-6 text-slate-300 text-xs leading-relaxed font-sans scroll-smooth">
          {activeTab === "privacy" ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-white">Privacy Policy for BizaDesk</h2>
                <p className="text-[11px] text-slate-500">Last updated: August 8, 2026</p>
              </div>

              <p>
                <strong>BizAdoc Technologies</strong> ("BizAdoc," "we," "us," or "our") respects your privacy. This Privacy Policy explains what information we collect, how we use it, and the choices you have when you use the <strong>BizaDesk Autonomous IT Helpdesk</strong> application, website (<strong>desk.bizadoc.com</strong>), and related IT support services (collectively, the "Service").
              </p>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white">1. Information We Collect</h3>
                <p><strong>Information you provide directly:</strong></p>
                <ul className="list-disc pl-5 space-y-1 text-slate-400">
                  <li>Corporate or business email address, full name, and password (for account registration and authentication).</li>
                  <li>Organization details (company name, department, workspace configuration, support hotlines).</li>
                  <li>IT incident and support data, such as support tickets, technical queries, device details, and resolution logs.</li>
                  <li>Contact details for on-site physical dispatch (city, address, contact phone number).</li>
                </ul>

                <p className="pt-2"><strong>Information collected automatically:</strong></p>
                <ul className="list-disc pl-5 space-y-1 text-slate-400">
                  <li>Device and browser telemetry necessary for diagnostic troubleshooting and security session tracking.</li>
                  <li>Audit logs of administrative actions, ticket lifecycle events, and security authentications.</li>
                </ul>

                <p className="pt-2"><strong>Information from third parties:</strong></p>
                <ul className="list-disc pl-5 space-y-1 text-slate-400">
                  <li><strong>Google Sign-In:</strong> If you choose to sign in with Google, we receive your verified name, email address, and profile photo.</li>
                  <li><strong>Paystack:</strong> When you subscribe to a workspace plan or pay for an on-demand IT dispatch, we receive transaction confirmation and reference codes. We do not store or process payment card details directly.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white">2. How We Use Your Information</h3>
                <p>We use collected data solely to:</p>
                <ul className="list-disc pl-5 space-y-1 text-slate-400">
                  <li>Operate and provision your corporate or commercial IT helpdesk workspace.</li>
                  <li>Facilitate automated virtual troubleshooting, live dispatch (WhatsApp, hotline, remote assist), and field technician visits.</li>
                  <li>Process workspace subscriptions and ticket service payments via Paystack.</li>
                  <li>Send security notifications, ticket status updates, and session expiration alerts.</li>
                  <li>Maintain audit logs and protect system integrity against unauthorized access.</li>
                </ul>
                <p className="font-semibold text-emerald-400">We do not sell, rent, or monetize your personal or business data to third parties.</p>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white">3. How We Store and Protect Your Information</h3>
                <p>
                  Your data is protected by enterprise-grade <strong>Supabase Row Level Security (RLS)</strong>, ensuring that corporate workspace records and ticket queues are strictly isolated to authenticated members of your organization.
                </p>
                <p>
                  We enforce mandatory Two-Factor Authentication (2FA/TOTP) for administrative and technician accounts and apply industry-standard encryption for data in transit (TLS/HTTPS) and at rest.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white">4. Third-Party Service Providers</h3>
                <p>We work with trusted infrastructure providers:</p>
                <ul className="list-disc pl-5 space-y-1 text-slate-400">
                  <li><strong>Supabase:</strong> Database infrastructure, authentication, and 2FA.</li>
                  <li><strong>Paystack:</strong> PCI-DSS compliant payment gateway.</li>
                  <li><strong>Google:</strong> Optional OAuth 2.0 single sign-on.</li>
                  <li><strong>Resend / Email infrastructure:</strong> Transactional email alerts and ticket dispatches.</li>
                  <li><strong>Netlify:</strong> Application hosting and content delivery.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white">5. Your Rights and Contact</h3>
                <p>
                  You have the right to request access to, correction of, or permanent deletion of your account and ticket history. To exercise your data rights, contact us at:
                </p>
                <p className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-indigo-300">
                  Email: desk@bizadoc.com / info@bizadoc.com<br />
                  Hotline / WhatsApp: +234 916 202 9201
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-white">Terms of Service for BizaDesk</h2>
                <p className="text-[11px] text-slate-500">Last updated: August 8, 2026</p>
              </div>

              <p>
                Welcome to <strong>BizaDesk</strong>, a product of <strong>BizAdoc Technologies</strong> ("BizAdoc," "we," "us," or "our"). These Terms of Service ("Terms") govern your access to and use of the BizaDesk autonomous helpdesk platform (<strong>desk.bizadoc.com</strong>) and related services (collectively, the "Service"). By creating an account or accessing the Service, you agree to be bound by these Terms.
              </p>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white">1. Eligibility and Accounts</h3>
                <p>
                  You must be at least 18 years of age and possess the legal authority to bind the organization or business entity you represent. You agree to provide accurate registration information and keep your credentials, Two-Factor Authentication (2FA) devices, and session keys confidential.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white">2. Description of the Service</h3>
                <p>
                  BizaDesk provides autonomous IT service desk management, self-service troubleshooting, live incident reporting, attended remote screen assistance, and physical technician dispatch coordination across two workspace models:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-slate-400">
                  <li><strong>Enterprise Workspace:</strong> Internal corporate IT operations for company employees.</li>
                  <li><strong>Commercial Workspace:</strong> MSP and IT consulting operations providing client portals, billable live dispatch, and client ticket queues.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white">3. Subscriptions, Trials, and Service Payments</h3>
                <ul className="list-disc pl-5 space-y-1 text-slate-400">
                  <li><strong>30-Day Free Trial:</strong> Business workspaces receive a 30-day trial upon registration with no payment card required upfront.</li>
                  <li><strong>Subscription Renewal:</strong> Following the trial period, continuous workspace access requires an active plan billed securely via Paystack.</li>
                  <li><strong>Live Dispatch Fees:</strong> Commercial client support options (Remote Support sessions and On-Site Physical Visits) are billed per incident or ticket as configured by the workspace administrator.</li>
                  <li><strong>Platform Master Workspace:</strong> The core platform owner account (desk@bizadoc.com) is exempted from recurring workspace subscription billing.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white">4. Acceptable Use and Security</h3>
                <p>You agree not to:</p>
                <ul className="list-disc pl-5 space-y-1 text-slate-400">
                  <li>Use the Service to transmit malicious code, fraudulent requests, or unauthorized diagnostic probes.</li>
                  <li>Attempt to bypass Row Level Security (RLS) boundaries or tamper with multi-tenant workspace isolation.</li>
                  <li>Resell, sublicense, or reverse-engineer the BizaDesk autonomous engine without prior written permission.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white">5. Governing Law</h3>
                <p>
                  These Terms are governed by and construed in accordance with the laws of the Federal Republic of Nigeria.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white">6. Inquiries and Contact</h3>
                <p className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-indigo-300">
                  BizAdoc Technologies<br />
                  Support Email: desk@bizadoc.com<br />
                  Corporate Inquiries: info@bizadoc.com
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500">
            © {new Date().getFullYear()} BizAdoc Technologies. All rights reserved.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}

