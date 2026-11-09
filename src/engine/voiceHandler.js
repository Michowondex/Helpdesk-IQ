// Native Browser Web Speech API (Zero API Tokens, Zero External Latency)

export const VoiceHandler = {
  isRecognitionSupported() {
    return typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);
  },

  isSynthesisSupported() {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  },

  createRecognizer({ onResult, onError, onEnd }) {
    if (!this.isRecognitionSupported()) return null;

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRec();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      if (onResult) onResult(transcript);
    };

    recognition.onerror = (err) => {
      console.warn("Speech recognition error:", err);
      if (onError) onError(err);
    };

    recognition.onend = () => {
      if (onEnd) onEnd();
    };

    return recognition;
  },

  speak(text, { enabled = true, rate = 1.0 } = {}) {
    if (!enabled || !this.isSynthesisSupported() || !text) return;

    try {
      window.speechSynthesis.cancel(); // Stop any ongoing speech
      const cleanText = text.replace(/[*#_`]/g, " ").replace(/\s+/g, " ");
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = rate;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("Speech synthesis error:", err);
    }
  },

  stopSpeaking() {
    if (this.isSynthesisSupported()) {
      window.speechSynthesis.cancel();
    }
  }
};
