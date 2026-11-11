import { useState } from "react";
import { CheckCircle2, RotateCcw, Scale, AlertTriangle, ShieldCheck, X, Loader2, DollarSign, MapPin, Monitor } from "lucide-react";

export default function TicketSettlementModal({ isOpen, ticket, onClose, onSettle }) {
  if (!isOpen || !ticket) return null;

  const totalAmount = Number(ticket.payment_amount) || 0;
  const isPhysical = ticket.support_type === "PHYSICAL_VISIT";
  
  // Suggested baseline diagnostic/call-out fee
  const defaultDiagnosticFee = isPhysical ? 3000 : 1500;

  const [selectedAction, setSelectedAction] = useState("CONFIRM_RESOLVED"); // 'CONFIRM_RESOLVED' | 'FULL_REFUND' | 'PARTIAL_REFUND'
  const [diagnosticFee, setDiagnosticFee] = useState(defaultDiagnosticFee);
  const [reasonNote, setReasonNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const calculatedRefundAmount = selectedAction === "FULL_REFUND" 
    ? totalAmount 
    : selectedAction === "PARTIAL_REFUND" 
    ? Math.max(0, totalAmount - Number(diagnosticFee || 0))
    : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (selectedAction === "PARTIAL_REFUND") {
      if (Number(diagnosticFee) >= totalAmount) {
        setErrorMsg("Diagnostic fee cannot be greater than or equal to total payment amount. Use Confirm Resolution instead.");
        return;
      }
      if (!reasonNote.trim()) {
        setErrorMsg("Please provide an explanatory note for the partial diagnostic fee retention.");
        return;
      }
    }

    setSubmitting(true);
    try {
      if (onSettle) {
        await onSettle({
          action: selectedAction,
          ticketId: ticket.id,
          totalAmount,
          diagnosticFee: selectedAction === "PARTIAL_REFUND" ? Number(diagnosticFee) : 0,
          refundAmount: calculatedRefundAmount,
          reasonNote: reasonNote.trim(),
          paystackRef: ticket.paystack_ref
        });
      }
      onClose();
    } catch (err) {
      setErrorMsg(err.message || "Failed to process settlement decision.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">Ticket Settlement &amp; Resolution Audit</h3>
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <span>{ticket.id}</span>
                <span>•</span>
                <span className="flex items-center gap-1 text-slate-300">
                  {isPhysical ? <MapPin className="w-3 h-3 text-amber-400" /> : <Monitor className="w-3 h-3 text-cyan-400" />}
                  {isPhysical ? "Physical On-Site Visit" : "Remote Quick Assist"}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* Ticket Financial Summary Card */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Customer Payment (Paystack)</div>
              <div className="text-base font-bold text-slate-100 mt-0.5">
                ₦{totalAmount.toLocaleString()}
              </div>
              <div className="text-[10px] font-mono text-slate-500">Ref: {ticket.paystack_ref || "Direct Payment"}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-slate-400 font-medium">Assigned Tech</div>
              <div className="text-xs font-semibold text-slate-200 mt-0.5">{ticket.assignee_name || "Unassigned"}</div>
              <div className="text-[10px] text-slate-500">{ticket.team || "General Support"}</div>
            </div>
          </div>

          {/* 3 Settlement Options */}
          <div className="space-y-2.5">
            <label className="block text-xs font-semibold text-slate-300">
              Select Settlement Decision:
            </label>

            {/* Option 1: Confirm Resolved */}
            <div 
              onClick={() => setSelectedAction("CONFIRM_RESOLVED")}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                selectedAction === "CONFIRM_RESOLVED" 
                  ? "bg-emerald-500/10 border-emerald-500/50 text-white" 
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedAction === "CONFIRM_RESOLVED" ? "border-emerald-400 bg-emerald-500" : "border-slate-600"}`}>
                  {selectedAction === "CONFIRM_RESOLVED" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div className="flex items-center gap-2 font-semibold text-xs text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Confirm Issue Resolved (No Refund)</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 ml-6 mt-1">
                Technician successfully fixed the issue to customer satisfaction. Ticket is closed and technician payout is approved.
              </p>
            </div>

            {/* Option 2: Full Refund */}
            <div 
              onClick={() => setSelectedAction("FULL_REFUND")}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                selectedAction === "FULL_REFUND" 
                  ? "bg-rose-500/10 border-rose-500/50 text-white" 
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedAction === "FULL_REFUND" ? "border-rose-400 bg-rose-500" : "border-slate-600"}`}>
                  {selectedAction === "FULL_REFUND" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div className="flex items-center gap-2 font-semibold text-xs text-slate-200">
                  <RotateCcw className="w-4 h-4 text-rose-400" />
                  <span>100% Full Refund to Customer (₦{totalAmount.toLocaleString()})</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 ml-6 mt-1">
                Technician failed or could not solve the issue. Automatically returns 100% of funds back to customer's card.
              </p>
            </div>

            {/* Option 3: Partial Diagnostic Call-Out Settle */}
            <div 
              onClick={() => setSelectedAction("PARTIAL_REFUND")}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                selectedAction === "PARTIAL_REFUND" 
                  ? "bg-amber-500/10 border-amber-500/50 text-white" 
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedAction === "PARTIAL_REFUND" ? "border-amber-400 bg-amber-500" : "border-slate-600"}`}>
                  {selectedAction === "PARTIAL_REFUND" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div className="flex items-center gap-2 font-semibold text-xs text-slate-200">
                  <Scale className="w-4 h-4 text-amber-400" />
                  <span>Partial Diagnostic / Call-Out Fee (Fair-Play Settle)</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 ml-6 mt-1">
                Equipment had unrepairable hardware (e.g. burnt chip/dead disk). Retain diagnostic fee for technician's labor/transport and refund remaining balance.
              </p>
            </div>
          </div>

          {/* Conditional inputs for Partial Refund */}
          {selectedAction === "PARTIAL_REFUND" && (
            <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/30 space-y-3 animate-in fade-in duration-150">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Retained Diagnostic Fee:
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-500 text-xs">₦</span>
                    <input
                      type="number"
                      min="500"
                      max={totalAmount - 500}
                      value={diagnosticFee}
                      onChange={(e) => setDiagnosticFee(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-7 pr-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Refunded to Customer:
                  </label>
                  <div className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-bold text-emerald-400">
                    ₦{calculatedRefundAmount.toLocaleString()}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Explanatory Note (Shown on Customer Receipt):
                </label>
                <textarea
                  rows={2}
                  value={reasonNote}
                  onChange={(e) => setReasonNote(e.target.value)}
                  placeholder="e.g. In-depth hardware diagnosis confirmed laptop logic board failure requiring specialized manufacturer part."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 leading-relaxed"
                />
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`flex-1 py-2.5 rounded-xl text-white font-semibold text-xs shadow-lg transition-all flex items-center justify-center gap-1.5 ${
                selectedAction === "CONFIRM_RESOLVED"
                  ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950"
                  : selectedAction === "FULL_REFUND"
                  ? "bg-rose-600 hover:bg-rose-500 shadow-rose-950"
                  : "bg-amber-600 hover:bg-amber-500 shadow-amber-950"
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing Settle...</span>
                </>
              ) : (
                <span>Confirm Settlement Decision</span>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
