// Text to speech for bot replies.
const synth = window.speechSynthesis;

const textToSpeech = (string) => {
  if (!synth) return;

  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(string);
  const language = document.getElementById("voice-language")?.value || "en-US";
  const speakWithAvailableVoice = () => {
    const voices = synth.getVoices();
    const voice = voices.find((item) => item.lang === language)
      || voices.find((item) => item.lang.toLowerCase().startsWith(language.split("-")[0].toLowerCase()));
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang || language;
    synth.speak(utterance);
  };

  utterance.volume = 1;
  utterance.rate = 1;
  utterance.pitch = 1;
  if (synth.getVoices().length) {
    speakWithAvailableVoice();
  } else {
    synth.addEventListener("voiceschanged", speakWithAvailableVoice, { once: true });
  }
};

// Sanbot SDK voice input.
document.addEventListener("DOMContentLoaded", () => {
  const voiceButton = document.getElementById("voice-button");
  const voiceStatus = document.getElementById("voice-status");
  const setListening = (listening) => {
    voiceButton.classList.toggle("listening", listening);
    document.getElementById("robot-face").classList.toggle("listening", listening);
    document.getElementById("robot-state").textContent = listening
      ? "Listening..."
      : "Online - listening";
  };

  const showVoiceError = (action, error) => {
    setListening(false);
    voiceStatus.textContent = error instanceof Error && error.message
      ? error.message
      : `Could not ${action} voice input.`;
  };

  voiceButton.addEventListener("click", () => {
    if (voiceButton.classList.contains("listening")) {
      if (!window.Sanbot || typeof window.Sanbot.stopVoiceInput !== "function") {
        voiceStatus.textContent = "Sanbot voice input is unavailable.";
        setListening(false);
        return;
      }

      try {
        const result = window.Sanbot.stopVoiceInput();
        setListening(false);
        voiceStatus.textContent = "";
        Promise.resolve(result).catch((error) => showVoiceError("stop", error));
      } catch (error) {
        showVoiceError("stop", error);
      }
      return;
    }

    if (!window.Sanbot || typeof window.Sanbot.startVoiceInput !== "function") {
      voiceStatus.textContent = "Sanbot voice input is unavailable.";
      return;
    }

    setListening(true);
    voiceStatus.textContent = "Listening...";
    try {
      const result = window.Sanbot.startVoiceInput();
      Promise.resolve(result).catch((error) => showVoiceError("start", error));
    } catch (error) {
      showVoiceError("start", error);
    }
  });

  window.onSanbotVoiceResult = (text) => {
    if (typeof text !== "string" || !text.trim()) return;
    document.getElementById("input").value = text.trim();
    setListening(false);
    voiceStatus.textContent = "";
    document.getElementById("send-button").click();
  };
});