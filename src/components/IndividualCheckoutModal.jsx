import { useState } from "react";
import { X, ShieldCheck, MapPin, Monitor, CreditCard, CheckCircle2, AlertCircle, Phone, Calendar, Clock, Sparkles } from "lucide-react";

export default function IndividualCheckoutModal({
  user,
  userProfile,
  pendingContext,
  selectedOption, // 'whatsapp' | 'call' | 'ticket'
  orgPricing,
  onClose,
  onPaymentSuccess
}) {
  const [supportType, setSupportType] = useState("REMOTE"); // 'REMOTE' | 'PHYSICAL_VISIT'
  const [paying, setPaying] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Physical visit form states
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Lagos (Mainland)");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("Morning (9 AM - 12 PM)");
  const [contactPhone, setContactPhone] = useState(userProfile?.phone || "");

  // Pricing configuration (Pulls custom pricing if set by IT firm workspace, else uses platform defaults)
  const REMOTE_PRICE = Number(orgPricing?.remote_fee) || 3500;
  const BASE_PHYSICAL = Number(orgPricing?.physical_visit_fee) || 10000;
  const PHYSICAL_PRICES = {
    "Lagos (Mainland)": BASE_PHYSICAL,
    "Lagos (Island / Lekki)": BASE_PHYSICAL + 2000,
    "Abuja": BASE_PHYSICAL + 2000,
    "Port Harcourt": BASE_PHYSICAL + 2000,
    "Other Locations": BASE_PHYSICAL + 5000
  };

  const finalAmount = supportType === "REMOTE" ? REMOTE_PRICE : (PHYSICAL_PRICES[city] || BASE_PHYSICAL);

  // Initialize Paystack Inline Pop-up
  const handlePaystackCheckout = () => {
    setErrorMsg("");

    if (supportType === "PHYSICAL_VISIT") {
      if (!address.trim()) {
        setErrorMsg("Please enter your street address and landmark for the technician visit.");
        return;
      }
      if (!contactPhone.trim()) {
        setErrorMsg("Please enter a valid phone number for the dispatch technician.");
        return;
      }
    }

    const paystackPublicKey = orgPricing?.custom_paystack_public_key || import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
    if (!paystackPublicKey) {
      setErrorMsg("Payment gateway is temporarily unavailable (missing Public Key).");
      return;
    }

    // Unique reference with prefix HDIQ_IND_
    const txRef = `HDIQ_IND_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const userEmail = user?.email || "customer@bizadoc.com";
    const userName = userProfile?.full_name || userEmail.split("@")[0];

    // Load Paystack Inline script if not already present
    const loadPaystack = (callback) => {
      if (window.PaystackPop) {
        callback();
        return;
      }
      const script = document.createElement("script");
      script.src = "https://js.paystack.co/v1/inline.js";
      script.onload = callback;
      script.onerror = () => setErrorMsg("Could not load Paystack secure gateway.");
      document.body.appendChild(script);
    };

    setPaying(true);

    loadPaystack(() => {
      const handler = window.PaystackPop.setup({
        key: paystackPublicKey,
        email: userEmail,
        amount: finalAmount * 100, // Paystack requires amount in kobo
        currency: "NGN",
        ref: txRef,
        metadata: {
          app: "BizaDesk",
          service: supportType === "REMOTE" ? "remote_it_support" : "physical_onsite_visit",
          user_id: user?.id,
          customer_name: userName,
          selected_channel: selectedOption,
          support_type: supportType,
          visit_city: supportType === "PHYSICAL_VISIT" ? city : null,
          visit_address: supportType === "PHYSICAL_VISIT" ? address : null,
          visit_time: supportType === "PHYSICAL_VISIT" ? `${preferredDate} - ${preferredTime}` : null,
          contact_phone: contactPhone || null,
          domain: "desk.bizadoc.com"
        },
        callback: function (response) {
          setPaying(false);
          // Payment successful! Handover to parent
          onPaymentSuccess({
            reference: response.reference || txRef,
            amount: finalAmount,
            supportType: supportType,
            address: address,
            city: city,
            visitSchedule: `${preferredDate} ${preferredTime}`,
            contactPhone: contactPhone
          });
        },
        onClose: function () {
          setPaying(false);
        }
      });

      handler.openIframe();
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              IT Technician Dispatch &amp; Support
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              1-on-1 Dedicated Support with 100% Fixed-or-Refunded Guarantee
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-950/70 border border-rose-900/80 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Service Mode Selector: Remote Assist vs In-Person Physical Visit */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSupportType("REMOTE")}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                supportType === "REMOTE"
                  ? "bg-indigo-600/15 border-indigo-500 text-white shadow-md shadow-indigo-950/30"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <Monitor className={`w-4 h-4 ${supportType === "REMOTE" ? "text-indigo-400" : "text-slate-500"}`} />
                <span className="text-xs font-bold text-indigo-400">₦3,500</span>
              </div>
              <h4 className="text-xs font-bold text-slate-100">Remote IT Assist</h4>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                Screen share, WhatsApp &amp; hotline. Instant resolution.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setSupportType("PHYSICAL_VISIT")}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                supportType === "PHYSICAL_VISIT"
                  ? "bg-indigo-600/15 border-indigo-500 text-white shadow-md shadow-indigo-950/30"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <MapPin className={`w-4 h-4 ${supportType === "PHYSICAL_VISIT" ? "text-indigo-400" : "text-slate-500"}`} />
                <span className="text-xs font-bold text-emerald-400">From ₦10,000</span>
              </div>
              <h4 className="text-xs font-bold text-slate-100">Physical Visit</h4>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                Technician dispatched to your home or office address.
              </p>
            </button>
          </div>

          {/* Physical Visit Address & Logistics Form */}
          {supportType === "PHYSICAL_VISIT" && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
              <h4 className="font-semibold text-slate-200 flex items-center gap-1.5 text-xs">
                <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                Dispatch Address &amp; Schedule Details
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Coverage Location / City</label>
                  <select
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Lagos (Mainland)">Lagos (Mainland) — ₦10,000</option>
                    <option value="Lagos (Island / Lekki)">Lagos (Island / Lekki) — ₦12,000</option>
                    <option value="Abuja">Abuja — ₦12,000</option>
                    <option value="Port Harcourt">Port Harcourt — ₦12,000</option>
                    <option value="Other Locations">Other Locations — ₦15,000</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Direct Contact Phone</label>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={e => setContactPhone(e.target.value)}
                    placeholder="e.g. 08012345678"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Street Address &amp; Closest Landmark</label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="e.g. 15 Allen Avenue, opposite Zenith Bank, Ikeja"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Preferred Date</label>
                  <input
                    type="date"
                    value={preferredDate}
                    onChange={e => setPreferredDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Preferred Time Window</label>
                  <select
                    value={preferredTime}
                    onChange={e => setPreferredTime(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Morning (9 AM - 12 PM)">Morning (9 AM - 12 PM)</option>
                    <option value="Afternoon (12 PM - 3 PM)">Afternoon (12 PM - 3 PM)</option>
                    <option value="Late Afternoon (3 PM - 6 PM)">Late Afternoon (3 PM - 6 PM)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Refund Policy Guarantee Box */}
          <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-3.5 space-y-1.5">
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs">
              <ShieldCheck className="w-4 h-4" />
              <span>100% Fixed-or-Refunded Policy</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              If our technician cannot diagnose or resolve your issue, you will receive an immediate, full refund back to your payment card. No questions asked.
            </p>
          </div>

          {/* Pricing Summary */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Total Due</span>
              <span className="text-xs text-slate-200">
                {supportType === "REMOTE" ? "Remote Assist Incident" : `Physical Visit (${city})`}
              </span>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-emerald-400 font-mono">
                ₦{finalAmount.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-500 block">Secure via Paystack</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2.5 px-4 rounded-lg border border-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePaystackCheckout}
            disabled={paying}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 transition-all"
          >
            <CreditCard className="w-4 h-4" />
            {paying ? "Opening Paystack..." : `Pay ₦${finalAmount.toLocaleString()} & Connect to IT`}
          </button>
        </div>
      </div>
    </div>
  );
}

