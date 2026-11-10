import { useState } from "react";
import { CreditCard, Check, Zap, Sparkles, Shield, Clock, Phone, MessageCircle, Mail, Headphones } from "lucide-react";

export default function BillingSubscription({ subscription = {}, onUpgradePlan }) {
  const [billingCycle, setBillingCycle] = useState("monthly"); // 'monthly' | 'yearly'
  const [processing, setProcessing] = useState(false);

  // Calculate days left in 30-day trial
  const trialEnd = subscription?.trial_end ? new Date(subscription.trial_end) : new Date(Date.now() + 28 * 86400000);
  const daysLeft = Math.max(0, Math.ceil((trialEnd - Date.now()) / (1000 * 60 * 60 * 24)));
  const isTrial = subscription?.status !== "ACTIVE";

  const handleCheckout = async (planName, gateway) => {
    setProcessing(true);
    if (onUpgradePlan) {
      await onUpgradePlan({ plan: planName, cycle: billingCycle, gateway });
    }
    setTimeout(() => setProcessing(false), 1200);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-slate-800">
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-indigo-400" />
          Subscription & Billing
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Manage your organization&apos;s subscription, payment methods, and automated billing invoices.
        </p>
      </div>

      {/* Trial Status Banner */}
      {isTrial && (
        <div className="bg-gradient-to-r from-indigo-950/80 to-slate-900 border border-indigo-500/30 rounded-xl p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">30-Day Free Trial</span>
              <h3 className="text-sm font-bold text-slate-100 mt-0.5">
                {daysLeft} Days Remaining in Your Free Trial
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Full access to all rule engines, voice features, and automated escalations. No credit card required.
              </p>
            </div>
          </div>
          <button
            onClick={() => handleCheckout("Professional", "paystack")}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-4 py-2.5 rounded-lg shrink-0 shadow-lg shadow-indigo-950 transition-all"
          >
            Activate Subscription
          </button>
        </div>
      )}

      {/* Cycle Toggle */}
      <div className="flex items-center justify-center gap-3 py-2">
        <span className={`text-xs ${billingCycle === "monthly" ? "text-slate-100 font-bold" : "text-slate-400"}`}>Monthly Billing</span>
        <button
          type="button"
          onClick={() => setBillingCycle(c => c === "monthly" ? "yearly" : "monthly")}
          className="w-12 h-6 bg-slate-800 border border-slate-700 rounded-full p-0.5 transition-colors relative"
        >
          <div className={`w-5 h-5 bg-indigo-500 rounded-full transition-transform ${billingCycle === "yearly" ? "translate-x-6" : "translate-x-0"}`} />
        </button>
        <span className={`text-xs flex items-center gap-1.5 ${billingCycle === "yearly" ? "text-slate-100 font-bold" : "text-slate-400"}`}>
          Annual Billing
          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">Save 20%</span>
        </span>
      </div>

      {/* Pricing Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {/* Starter Plan */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm flex flex-col justify-between hover:border-slate-700 transition-colors">
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Standard Office</span>
              <Zap className="w-5 h-5 text-slate-400" />
            </div>
            <div className="mb-4">
              <span className="text-3xl font-extrabold text-slate-100">
                {billingCycle === "monthly" ? "₦45,000" : "₦432,000"}
              </span>
              <span className="text-xs text-slate-400 ml-1.5">
                {billingCycle === "monthly" ? "/ month" : "/ year"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              Ideal for small to medium businesses needing automated IT triage and instant troubleshooting.
            </p>

            <ul className="space-y-2.5 text-xs text-slate-300 mb-6">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Up to 50 staff members</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Full 36-article knowledge base & voice</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Windows Quick Assist integration</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Email escalation & SLA monitors</li>
            </ul>
          </div>

          <button
            onClick={() => handleCheckout("Standard", "paystack")}
            disabled={processing}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium py-2.5 rounded-lg border border-slate-700 transition-colors"
          >
            {processing ? "Processing..." : "Pay with Paystack / Card"}
          </button>
        </div>

        {/* Enterprise Plan */}
        <div className="bg-gradient-to-b from-indigo-950/40 to-slate-900 border-2 border-indigo-500/40 rounded-xl p-6 shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-3 right-3">
            <span className="text-[10px] font-bold text-indigo-300 bg-indigo-500/20 px-2.5 py-1 rounded-full border border-indigo-500/30">
              POPULAR
            </span>
          </div>

          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Enterprise Fleet</span>
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="mb-4">
              <span className="text-3xl font-extrabold text-slate-100">
                {billingCycle === "monthly" ? "₦120,000" : "₦1,152,000"}
              </span>
              <span className="text-xs text-slate-400 ml-1.5">
                {billingCycle === "monthly" ? "/ month" : "/ year"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              For organizations requiring multi-department custom knowledge base uploads and endpoint agent telemetry.
            </p>

            <ul className="space-y-2.5 text-xs text-slate-200 mb-6">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-indigo-400" /> Unlimited staff & machines</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-indigo-400" /> Custom Knowledge Base JSON / CSV uploader</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-indigo-400" /> Custom SLA timers & Teams bot webhook</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-indigo-400" /> Dedicated support & custom branding</li>
            </ul>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => handleCheckout("Enterprise", "paystack")}
              disabled={processing}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2.5 rounded-lg shadow-lg shadow-indigo-950 transition-all"
            >
              {processing ? "Processing..." : "Pay with Paystack (NGN / Cards)"}
            </button>
            <button
              onClick={() => handleCheckout("Enterprise", "stripe")}
              disabled={processing}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2 rounded-lg border border-slate-700 transition-colors"
            >
              Pay with Stripe / International USD
            </button>
          </div>
        </div>
      </div>

      {/* Security note */}
      <div className="flex items-center justify-center gap-2 text-xs text-slate-500 pt-3">
        <Shield className="w-4 h-4 text-emerald-500" />
        <span>PCI-DSS Compliant 256-bit encrypted transactions. Cancel anytime with 1 click.</span>
      </div>

      {/* ── Platform Support Contact ─────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Headphones className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">Need Help? Contact Platform Support</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Billing questions, enterprise onboarding, or feature requests — reach the BizaDesk team directly.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* WhatsApp */}
          <a
            href="https://wa.me/2349162029201?text=Hello%20BizaDesk%20Team%2C%20I%20need%20assistance%20with%20my%20business%20subscription."
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-700/40 hover:border-emerald-600/60 rounded-lg p-3 transition-all group"
          >
            <MessageCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <span className="text-[11px] font-semibold text-emerald-400 block">WhatsApp</span>
              <span className="text-xs text-slate-300 font-mono">+234 916 202 9201</span>
            </div>
          </a>

          {/* Hotline */}
          <a
            href="tel:+2349162029201"
            className="flex items-center gap-3 bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-lg p-3 transition-all group"
          >
            <Phone className="w-5 h-5 text-indigo-400 shrink-0" />
            <div>
              <span className="text-[11px] font-semibold text-indigo-400 block">Call Hotline</span>
              <span className="text-xs text-slate-300 font-mono">+234 916 202 9201</span>
            </div>
          </a>

          {/* Email */}
          <a
            href="mailto:helpdesk@bizadoc.com?subject=BizaDesk%20Business%20Inquiry"
            className="flex items-center gap-3 bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-lg p-3 transition-all group"
          >
            <Mail className="w-5 h-5 text-sky-400 shrink-0" />
            <div>
              <span className="text-[11px] font-semibold text-sky-400 block">Email Support</span>
              <span className="text-xs text-slate-300">helpdesk@bizadoc.com</span>
            </div>
          </a>
        </div>

        <p className="text-[10px] text-slate-500 text-center mt-3">
          Available Mon–Fri 8am–6pm WAT · WhatsApp support 24/7
        </p>
      </div>
    </div>
  );
}
