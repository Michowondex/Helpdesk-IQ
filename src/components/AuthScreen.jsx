import { useState, useRef } from "react";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { 
  Bot, Lock, Mail, ArrowRight, ShieldCheck, UserCheck, AlertCircle, 
  Sparkles, Eye, EyeOff, KeyRound, ChevronLeft, Building2, User, 
  Briefcase, CheckCircle2, ShieldAlert, Check
} from "lucide-react";
import { supabase } from "../supabase";
import MfaChallengeModal from "./MfaChallengeModal";
import LegalModal from "./LegalModal";

const IS_DEV_MODE = import.meta.env.DEV;

// ── Consumer, Free & Disposable email domain blacklist ────────────────────────
const FREE_EMAIL_DOMAINS = [
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com",
  "aol.com", "proton.me", "protonmail.com", "zoho.com", "zohomail.com",
  "mail.com", "live.com", "msn.com", "googlemail.com", "ymail.com",
  "inbox.com", "yandex.com", "tutanota.com", "gmx.com", "gmx.net",
  
  // Temporary & disposable burner email providers
  "mailinator.com", "temp-mail.org", "temp-mail.io", "tempmail.com", "tempmail.net",
  "10minutemail.com", "10minutemail.net", "guerrillamail.com", "guerrillamail.net",
  "sharklasers.com", "trashmail.com", "trashmail.net", "yopmail.com", "yopmail.net",
  "dispostable.com", "throwawaymail.com", "getairmail.com", "fakemailgenerator.com",
  "crazymailing.com", "mytemp.email", "mohmal.com", "burnermail.io", "emailondeck.com",
  "nada.ltd", "getnada.com", "tempinbox.com", "generator.email",
  
  // Bogus / placeholder domains
  "test.com", "example.com", "fake.com", "sample.com", "none.com", "mail.test"
];

const isConsumerEmail = (email) => {
  const domain = email.split("@")[1]?.toLowerCase()?.trim();
  if (!domain) return false;
  return FREE_EMAIL_DOMAINS.includes(domain);
};

export default function AuthScreen({ onAuthSuccess, onBackToLanding }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [accountType, setAccountType] = useState("business"); // 'business' | 'individual'
  const [workspaceMode, setWorkspaceMode] = useState("ENTERPRISE"); // 'ENTERPRISE' | 'COMMERCIAL'
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  
  // hCaptcha state & ref
  const [captchaToken, setCaptchaToken] = useState("");
  const captchaRef = useRef(null);
  const HCAPTCHA_SITE_KEY = import.meta.env.VITE_HCAPTCHA_SITE_KEY || "9b20e012-e932-413c-ac42-37a637d4ad82";
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [duplicateBlockMsg, setDuplicateBlockMsg] = useState("");
  const [verificationPendingEmail, setVerificationPendingEmail] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [showSandboxPreview, setShowSandboxPreview] = useState(IS_DEV_MODE);
  const [legalModalTab, setLegalModalTab] = useState(null); // 'privacy' | 'terms' | null

  // 2FA / MFA Challenge state
  const [showMfaChallenge, setShowMfaChallenge] = useState(false);
  const [mfaPendingUser, setMfaPendingUser] = useState(null);
  const [mfaFactorId, setMfaFactorId] = useState("");

  const emailDomain = email.split("@")[1]?.toLowerCase()?.trim();
  const showBusinessDomainWarning = isSignUp && accountType === "business" && email.includes("@") && emailDomain && isConsumerEmail(email);

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setInfoMsg("");
    setDuplicateBlockMsg("");
    setLoading(true);
    try {
      const redirectUrl = import.meta.env.VITE_APP_URL || window.location.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      if (error) throw error;
      setInfoMsg("✅ Password reset link sent! Check your email inbox and follow the link to set a new password.");
    } catch (err) {
      setErrorMsg(err.message || "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setInfoMsg("");
    setDuplicateBlockMsg("");

    // ── Client-side validation ──────────────────────────────────────────
    if (isSignUp) {
      if (password.length < 8) {
        setErrorMsg("Password must be at least 8 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg("Passwords do not match. Please verify your password.");
        return;
      }
    }

    // Require captcha verification if hCaptcha site key is configured
    if (HCAPTCHA_SITE_KEY && !captchaToken) {
      setErrorMsg("Please complete the security captcha verification below.");
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const cleanEmail = email.trim().toLowerCase();
        const domain = cleanEmail.split("@")[1];

        // ══════════════════════════════════════════════════════════════════════
        // 🏢 BUSINESS ACCOUNT REGISTRATION VALIDATION
        // ══════════════════════════════════════════════════════════════════════
        if (accountType === "business") {
          // 1. Block consumer / free / disposable webmails
          if (isConsumerEmail(cleanEmail)) {
            setErrorMsg(
              "Business workspaces require a verified corporate email (e.g. name@company.com). " +
              "Personal webmail providers like Gmail, Yahoo, and Hotmail are not permitted. " +
              "If you are registering for personal use, switch to the 'Individual' tab above."
            );
            setLoading(false);
            return;
          }

          if (!companyName.trim()) {
            setErrorMsg("Please enter your Company / Organization name.");
            setLoading(false);
            return;
          }

          // 2. Strict Duplicate Check: Block if domain OR company name already exists
          const { data: existingOrgs, error: checkError } = await supabase
            .from("organizations")
            .select("id, name, domain")
            .or(`domain.eq.${domain},name.ilike.${companyName.trim()}`)
            .limit(1);

          if (!checkError && existingOrgs && existingOrgs.length > 0) {
            const matchedOrg = existingOrgs[0];
            setDuplicateBlockMsg(
              `"${matchedOrg.name}" is already registered on BizaDesk. To protect company security, new accounts cannot be self-registered under this company. Please reach out directly to your company's IT Administrator to receive an invitation.`
            );
            setLoading(false);
            return;
          }

          // 3. MX / DNS Mail Server Verification
          try {
            const { data: mxCheck } = await supabase.functions.invoke("verify-domain", {
              body: { domain }
            });

            if (mxCheck && mxCheck.valid === false) {
              setErrorMsg(
                `The domain "${domain}" does not have active mail servers (MX records). Please verify your company email address.`
              );
              setLoading(false);
              return;
            }
          } catch (_) {
            // Non-fatal edge function bypass
          }
        }

        // ══════════════════════════════════════════════════════════════════════
        // 🚀 DISPATCH SUPABASE AUTH SIGNUP (REQUIRES EMAIL VERIFICATION)
        // ══════════════════════════════════════════════════════════════════════
        const finalCompanyName = accountType === "business" 
          ? companyName.trim() 
          : `${fullName.trim() || cleanEmail.split("@")[0]}'s Workspace`;

        const redirectUrl = import.meta.env.VITE_APP_URL || window.location.origin;

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            captchaToken: captchaToken || undefined,
            data: {
              full_name: fullName.trim() || cleanEmail.split("@")[0],
              company_name: finalCompanyName,
              account_type: accountType, // 'business' | 'individual'
              workspace_mode: accountType === "business" ? workspaceMode : "COMMERCIAL",
              role: "admin"
            }
          }
        });

        if (error) throw error;

        // Duplicate Email Detection when Supabase Email Enumeration Protection is enabled
        // Supabase returns an empty identities array if the email already exists in auth.users
        if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          setErrorMsg("An account with this email already exists. Please sign in or use 'Forgot password' if you need to recover access.");
          setIsSignUp(false); // Switch to sign in view so user can log in immediately
          setLoading(false);
          return;
        }

        // Check if session was returned immediately (if email confirmation is turned off in dev)
        if (data?.session) {
          onAuthSuccess(data.session.user);
        } else {
          // Normal production flow: Email confirmation link sent!
          setVerificationPendingEmail(cleanEmail);
        }
      } else {
        // Sign In Existing User
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
          options: {
            captchaToken: captchaToken || undefined
          }
        });

        if (error) throw error;
        if (data?.user) {
          // Check if user has an active TOTP MFA challenge requirement (aal1 -> aal2)
          try {
            const { data: aalData, error: aalErr } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
            if (!aalErr && aalData?.nextLevel === "aal2" && aalData?.currentLevel === "aal1") {
              const { data: factorsData } = await supabase.auth.mfa.listFactors();
              const verifiedTotp = factorsData?.totp?.find(f => f.status === "verified");
              if (verifiedTotp) {
                setMfaPendingUser(data.user);
                setMfaFactorId(verifiedTotp.id);
                setShowMfaChallenge(true);
                setLoading(false);
                return;
              }
            }
          } catch (_) {}

          onAuthSuccess(data.user);
        }
      }
    } catch (err) {
      setErrorMsg(err.message || "Authentication failed");
      // Reset captcha on failure so user can retry cleanly
      if (captchaRef.current) {
        captchaRef.current.resetCaptcha();
      }
      setCaptchaToken("");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoRole = (roleType, demoName, demoEmail) => {
    const demoUser = {
      id: `demo-${roleType}-id`,
      email: demoEmail,
      user_metadata: { full_name: demoName },
      demoRole: roleType
    };
    onAuthSuccess(demoUser);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-indigo-500 selection:text-white">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo and Brand */}
        <div className="flex flex-col items-center mb-6">
          {onBackToLanding && (
            <button
              type="button"
              onClick={onBackToLanding}
              className="self-start mb-3 flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-400 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Back to Home
            </button>
          )}
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white shadow-xl shadow-indigo-500/20 mb-3">
            <Bot className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Biza<span className="text-indigo-400">Desk</span></h1>
          <p className="text-xs text-slate-400 mt-1">Autonomous IT Support & Incident Command</p>
        </div>

        {/* ── Email Verification Pending Screen ── */}
        {verificationPendingEmail ? (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto">
              <Mail className="w-7 h-7 animate-bounce" />
            </div>
            <h2 className="text-lg font-bold text-white">Check Your Email</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              We have sent an account confirmation link to:
              <br />
              <strong className="text-indigo-400 font-mono text-sm block mt-1">{verificationPendingEmail}</strong>
            </p>
            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400 leading-relaxed text-left space-y-1.5">
              <div className="flex items-center gap-2 text-slate-300 font-semibold">
                <Check className="w-4 h-4 text-emerald-400" /> Complete Registration:
              </div>
              <p>Click the verification link inside the email to activate your workspace and log in.</p>
            </div>
            <button
              onClick={() => {
                setVerificationPendingEmail("");
                setIsSignUp(false);
                setErrorMsg("");
                setInfoMsg("Verification link sent! Once clicked, enter your password below to log in.");
              }}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors"
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          /* Card Box */
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-7 shadow-2xl backdrop-blur-xl">
            {/* Top Navigation Mode Switcher */}
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-800">
              <div>
                <h2 className="text-sm font-bold text-white">
                  {isForgotPassword ? "Reset Your Password" : isSignUp ? "Create Your Account" : "Sign In to Your Workspace"}
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {isForgotPassword
                    ? "Enter your email to receive a reset link"
                    : isSignUp
                    ? accountType === "business"
                      ? "Enterprise IT Workspace for teams"
                      : "Personal workspace for device IT help"
                    : "Enter your credentials to access your dashboard"}
                </p>
              </div>

              {!isForgotPassword && (
                <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                  <button
                    type="button"
                    onClick={() => { setIsSignUp(false); setErrorMsg(""); setInfoMsg(""); setDuplicateBlockMsg(""); }}
                    className={`px-3 py-1 rounded-md transition-all font-medium ${!isSignUp ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsSignUp(true); setErrorMsg(""); setInfoMsg(""); setDuplicateBlockMsg(""); }}
                    className={`px-3 py-1 rounded-md transition-all font-medium ${isSignUp ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
                  >
                    Register
                  </button>
                </div>
              )}

              {isForgotPassword && (
                <button
                  type="button"
                  onClick={() => { setIsForgotPassword(false); setErrorMsg(""); setInfoMsg(""); }}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-indigo-400 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Back to login
                </button>
              )}
            </div>

            {/* ── Side-by-Side Dual Heading: Business vs. Individual (Signup mode only) ── */}
            {isSignUp && !isForgotPassword && (
              <div className="mb-5">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Select Account Type
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => { setAccountType("business"); setErrorMsg(""); setDuplicateBlockMsg(""); }}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      accountType === "business"
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-950"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    Business Workspace
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAccountType("individual"); setErrorMsg(""); setDuplicateBlockMsg(""); }}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      accountType === "individual"
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-950"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    Individual / Personal
                  </button>
                </div>

                {/* Organization Operating Model Selection (Business accounts only) */}
                {accountType === "business" && (
                  <div className="mt-3.5 p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-300">
                      Organization Operating Model *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setWorkspaceMode("ENTERPRISE")}
                        className={`p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between ${
                          workspaceMode === "ENTERPRISE"
                            ? "bg-indigo-600/15 border-indigo-500 text-white shadow-sm"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs flex items-center gap-1.5 text-indigo-300">
                            🏦 Internal Enterprise IT
                          </span>
                          {workspaceMode === "ENTERPRISE" && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                        </div>
                        <span className="text-[10px] text-slate-400 leading-tight">
                          Banks, Hospitals, Corporates. Free internal staff self-service.
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setWorkspaceMode("COMMERCIAL")}
                        className={`p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between ${
                          workspaceMode === "COMMERCIAL"
                            ? "bg-indigo-600/15 border-indigo-500 text-white shadow-sm"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs flex items-center gap-1.5 text-indigo-300">
                            🛠️ IT Service / MSP
                          </span>
                          {workspaceMode === "COMMERCIAL" && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                        </div>
                        <span className="text-[10px] text-slate-400 leading-tight">
                          IT firms & vendors. Provide paid support to external clients.
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Duplicate Company Block Alert (Hard Stop) ── */}
            {duplicateBlockMsg && (
              <div className="mb-4 p-4 rounded-xl bg-amber-950/70 border border-amber-800 text-amber-200 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                  Organization Already Registered
                </div>
                <p className="text-[11px] leading-relaxed text-amber-200/90">
                  {duplicateBlockMsg}
                </p>
              </div>
            )}

            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-rose-950/60 border border-rose-900/80 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {infoMsg && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-950/60 border border-emerald-900/80 text-emerald-300 text-xs flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{infoMsg}</span>
              </div>
            )}

            {/* ── Forgot Password Form ── */}
            {isForgotPassword ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Your Account Email</label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none transition-colors"
                    />
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs py-2.5 rounded-xl shadow-lg shadow-indigo-950 flex items-center justify-center gap-2 transition-all"
                >
                  {loading ? "Sending reset link..." : <><KeyRound className="w-3.5 h-3.5" /> Send Password Reset Link</>}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignUp && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. David Adeleke"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none transition-colors"
                      />
                    </div>

                    {accountType === "business" && (
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">Company / Organization Name *</label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            placeholder="e.g. Acme Corporation"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none transition-colors"
                          />
                          <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-medium text-slate-300">
                      {isSignUp 
                        ? accountType === "business" ? "Work Email *" : "Personal Email *"
                        : "Email Address"}
                    </label>
                    {isSignUp && accountType === "business" && (
                      <span className="text-[10px] text-indigo-400 font-semibold">Corporate only</span>
                    )}
                  </div>

                  <div className="relative">
                    <input
                      type="email"
                      required
                      placeholder={accountType === "business" ? "name@company.com" : "name@gmail.com"}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`w-full bg-slate-950 border rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors ${
                        showBusinessDomainWarning
                          ? "border-amber-500/60 focus:border-amber-400"
                          : "border-slate-800 focus:border-indigo-500"
                      }`}
                    />
                    <Mail className={`w-4 h-4 absolute left-3 top-3 ${showBusinessDomainWarning ? "text-amber-400" : "text-slate-500"}`} />
                  </div>

                  {showBusinessDomainWarning && (
                    <div className="mt-2 flex items-start gap-1.5 text-[10px] text-amber-400">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>
                        <strong>{emailDomain}</strong> is a personal webmail. Please use your company domain or switch to the <strong>Individual</strong> tab above.
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-medium text-slate-300">Password</label>
                    {isSignUp && (
                      <span className="text-[10px] text-slate-500">Min. 8 characters</span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={8}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none transition-colors"
                    />
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {!isSignUp && (
                    <div className="text-right mt-1.5">
                      <button
                        type="button"
                        onClick={() => { setIsForgotPassword(true); setErrorMsg(""); setInfoMsg(""); setDuplicateBlockMsg(""); }}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        Forgot Password?
                      </button>
                    </div>
                  )}
                </div>

                {/* ── Confirm Password Field (Registration Mode Only) ── */}
                {isSignUp && (
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Confirm Password *</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        minLength={8}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`w-full bg-slate-950 border rounded-xl pl-9 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors ${
                          confirmPassword && password !== confirmPassword
                            ? "border-rose-500/80 focus:border-rose-400"
                            : confirmPassword && password === confirmPassword
                            ? "border-emerald-500/80 focus:border-emerald-400"
                            : "border-slate-800 focus:border-indigo-500"
                        }`}
                      />
                      <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {confirmPassword && password !== confirmPassword && (
                      <p className="text-[10px] text-rose-400 mt-1">Passwords do not match.</p>
                    )}
                    {confirmPassword && password === confirmPassword && (
                      <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Passwords match!
                      </p>
                    )}
                  </div>
                )}

                {/* ── hCaptcha Anti-Bot Security Widget ── */}
                {HCAPTCHA_SITE_KEY && (
                  <div className="pt-2 flex justify-center">
                    <HCaptcha
                      ref={captchaRef}
                      sitekey={HCAPTCHA_SITE_KEY}
                      onVerify={(token) => setCaptchaToken(token)}
                      onExpire={() => setCaptchaToken("")}
                      theme="dark"
                      size="normal"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs py-2.5 rounded-xl shadow-lg shadow-indigo-950 flex items-center justify-center gap-2 transition-all mt-2"
                >
                  {loading ? (
                    "Processing..."
                  ) : isSignUp ? (
                    accountType === "business" ? (
                      <>Register Business Workspace <ArrowRight className="w-3.5 h-3.5" /></>
                    ) : (
                      <>Create Individual Account <ArrowRight className="w-3.5 h-3.5" /></>
                    )
                  ) : (
                    <>Sign In to Workspace <ArrowRight className="w-3.5 h-3.5" /></>
                  )}
                </button>
              </form>
            )}

            {/* Quick Demo Role Switcher (Development Only) */}
            {IS_DEV_MODE && (
              <div className="mt-6 pt-5 border-t border-slate-800">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Dev Sandbox Testing:</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSandboxPreview(!showSandboxPreview)}
                    className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
                  >
                    {showSandboxPreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {showSandboxPreview ? "Hide Preview" : "Show Preview"}
                  </button>
                </div>

                {showSandboxPreview && (
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleQuickDemoRole("admin", "Chief IT Admin", "admin@company.com")}
                        className="bg-slate-950 hover:bg-slate-800 border border-indigo-500/30 text-indigo-300 rounded-lg p-2 text-center transition-all group"
                      >
                        <div className="font-bold text-[11px]">IT Admin</div>
                        <div className="text-[9px] text-slate-500">Full Access</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickDemoRole("technician", "Alex Network Tech", "tech@company.com")}
                        className="bg-slate-950 hover:bg-slate-800 border border-cyan-500/30 text-cyan-300 rounded-lg p-2 text-center transition-all group"
                      >
                        <div className="font-bold text-[11px]">Technician</div>
                        <div className="text-[9px] text-slate-500">Tickets & Outages</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickDemoRole("user", "Sarah Employee", "sarah@company.com")}
                        className="bg-slate-950 hover:bg-slate-800 border border-emerald-500/30 text-emerald-300 rounded-lg p-2 text-center transition-all group"
                      >
                        <div className="font-bold text-[11px]">Staff User</div>
                        <div className="text-[9px] text-slate-500">Virtual IT Only</div>
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-600 text-center pt-1 font-mono">
                      Note: This box is automatically removed when deployed to production.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Security Footer Notice */}
        <div className="text-center mt-6 text-[11px] text-slate-500 flex flex-col items-center justify-center gap-1.5">
          <div className="flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
            <span>Protected with Supabase Row Level Security (RLS) & Verified Email Confirmation</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500 pt-1">
            <button
              type="button"
              onClick={() => setLegalModalTab("privacy")}
              className="hover:text-indigo-400 underline transition-colors"
            >
              Privacy Policy
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setLegalModalTab("terms")}
              className="hover:text-indigo-400 underline transition-colors"
            >
              Terms of Service
            </button>
          </div>
        </div>
      </div>

      {/* Terms of Service & Privacy Policy Modal */}
      <LegalModal
        isOpen={Boolean(legalModalTab)}
        initialTab={legalModalTab || "privacy"}
        onClose={() => setLegalModalTab(null)}
      />

      {/* MFA / 2FA Login Challenge Modal */}
      {showMfaChallenge && (
        <MfaChallengeModal
          isOpen={showMfaChallenge}
          factorId={mfaFactorId}
          userEmail={mfaPendingUser?.email || email}
          onSuccess={() => {
            setShowMfaChallenge(false);
            onAuthSuccess(mfaPendingUser);
          }}
          onCancel={async () => {
            setShowMfaChallenge(false);
            setMfaPendingUser(null);
            setMfaFactorId("");
            await supabase.auth.signOut();
          }}
        />
      )}
    </div>
  );
}
