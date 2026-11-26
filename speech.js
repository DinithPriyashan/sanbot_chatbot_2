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

// Prefer Sanbot voice input on the robot and fall back to browser recognition.
document.addEventListener("DOMContentLoaded", () => {
  const voiceButton = document.getElementById("voice-button");
  const voiceStatus = document.getElementById("voice-status");
  const voiceLanguage = document.getElementById("voice-language");
  const input = document.getElementById("input");
  const sendButton = document.getElementById("send-button");
  const robotFace = document.getElementById("robot-face");
  const robotState = document.getElementById("robot-state");
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = Recognition ? new Recognition() : null;
  let listeningWith = null;

  if (recognition) {
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
  }

  const setListening = (listening) => {
    voiceButton.classList.toggle("listening", listening);
    robotFace.classList.toggle("listening", listening);
    if (listening) {
      robotState.textContent = "Listening...";
    } else if (robotState.textContent === "Listening...") {
      robotState.textContent = "Online - listening";
    }
  };

  const showVoiceError = (action, error) => {
    listeningWith = null;
    setListening(false);
    voiceStatus.textContent = error instanceof Error && error.message
      ? error.message
      : `Could not ${action} voice input.`;
  };

  const sendVoiceResult = (text) => {
    if (typeof text !== "string" || !text.trim()) return;
    input.value = text.trim();
    listeningWith = null;
    setListening(false);
    voiceStatus.textContent = "";
    sendButton.click();
  };

  const hasSanbotVoiceInput = () => window.Sanbot
    && typeof window.Sanbot.startVoiceInput === "function"
    && typeof window.Sanbot.stopVoiceInput === "function";

  const stopListening = () => {
    const source = listeningWith;
    listeningWith = null;
    setListening(false);
    voiceStatus.textContent = "";

    try {
      const result = source === "sanbot"
        ? window.Sanbot.stopVoiceInput()
        : recognition.stop();
      Promise.resolve(result).catch((error) => showVoiceError("stop", error));
    } catch (error) {
      showVoiceError("stop", error);
    }
  };

  voiceButton.addEventListener("click", () => {
    if (listeningWith) {
      stopListening();
      return;
    }

    if (!hasSanbotVoiceInput() && !recognition) {
      voiceStatus.textContent = window.isSecureContext
        ? "Voice input is not supported in this browser."
        : "Voice input requires HTTPS or localhost.";
      return;
    }

    setListening(true);
    voiceStatus.textContent = "Listening...";
    try {
      listeningWith = hasSanbotVoiceInput() ? "sanbot" : "browser";
      let result;
      if (listeningWith === "sanbot") {
        result = window.Sanbot.startVoiceInput();
      } else {
        recognition.lang = voiceLanguage.value;
        result = recognition.start();
      }
      Promise.resolve(result).catch((error) => showVoiceError("start", error));
    } catch (error) {
      showVoiceError("start", error);
    }
  });

  if (recognition) {
    recognition.onresult = (event) => {
      const result = event.results[event.resultIndex];
      if (result && result[0]) sendVoiceResult(result[0].transcript);
    };

    recognition.onend = () => {
      listeningWith = null;
      setListening(false);
    };

    recognition.onerror = (event) => {
      listeningWith = null;
      setListening(false);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        voiceStatus.textContent = "Allow microphone access in your browser settings.";
      } else if (event.error === "no-speech") {
        voiceStatus.textContent = "No speech detected. Try again.";
      } else if (event.error === "audio-capture") {
        voiceStatus.textContent = "No microphone is available.";
      } else {
        voiceStatus.textContent = "Voice input could not be completed.";
      }
    };
  }

  window.onSanbotVoiceResult = sendVoiceResult;
});