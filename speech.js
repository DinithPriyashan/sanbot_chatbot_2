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

// Prefer the native bridge on Sanbot and use browser recognition elsewhere.
document.addEventListener("DOMContentLoaded", () => {
  const voiceButton = document.getElementById("voice-button");
  const voiceStatus = document.getElementById("voice-status");
  const voiceLanguage = document.getElementById("voice-language");
  const input = document.getElementById("input");
  const sendButton = document.getElementById("send-button");
  const robotFace = document.getElementById("robot-face");
  const robotState = document.getElementById("robot-state");
  let nativeBridge = null;
  let recognition = null;
  let listeningWith = null;
  let currentSession = null;
  let cleanedUp = false;
  let voiceErrorVisible = false;

  const setListening = (listening) => {
    voiceButton.classList.toggle("listening", listening);
    robotFace.classList.toggle("listening", listening);
    if (listening) {
      robotState.textContent = "Listening...";
    } else if (robotState.textContent === "Listening...") {
      robotState.textContent = "Online - listening";
    }
  };

  const showVoiceError = (message) => {
    voiceErrorVisible = true;
    if (currentSession) currentSession.cancelled = true;
    listeningWith = null;
    setListening(false);
    voiceStatus.textContent = message;
  };

  const sendVoiceResult = (text, source) => {
    if (typeof text !== "string" || !text.trim()) return;
    if (!currentSession || currentSession.cancelled || currentSession.resultHandled) return;
    if (source && currentSession.source !== source) return;

    currentSession.resultHandled = true;
    input.value = text.trim();
    listeningWith = null;
    setListening(false);
    voiceStatus.textContent = "";
    sendButton.click();
  };

  const createBrowserRecognition = () => {
    if (recognition) return recognition;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return null;

    recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const result = event.results[event.resultIndex];
      if (result && result[0]) sendVoiceResult(result[0].transcript, "browser");
    };
    recognition.onend = () => {
      if (currentSession && currentSession.source === "browser" && !currentSession.resultHandled) {
        currentSession.cancelled = true;
      }
      listeningWith = null;
      setListening(false);
      if (voiceStatus.textContent === "Listening...") {
        voiceStatus.textContent = "Voice input stopped.";
      }
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        showVoiceError("Microphone permission was denied. Allow microphone access in your browser settings.");
      } else if (event.error === "no-speech") {
        showVoiceError("No speech detected. Try again.");
      } else if (event.error === "audio-capture") {
        showVoiceError("No microphone is available.");
      } else {
        showVoiceError("Voice input could not be completed.");
      }
    };
    return recognition;
  };

  const stopListening = () => {
    const source = listeningWith;
    if (currentSession) currentSession.cancelled = true;
    listeningWith = null;
    setListening(false);
    voiceStatus.textContent = "Voice input stopped.";

    try {
      if (source === "sanbot") {
        if (typeof nativeBridge.stopVoiceInput !== "function") {
          voiceStatus.textContent = "Sanbot voice bridge cannot stop listening.";
          return;
        }
        Promise.resolve(nativeBridge.stopVoiceInput()).catch((error) => {
          showVoiceError(error instanceof Error ? error.message : "Could not stop voice input.");
        });
      } else if (source === "browser" && recognition) {
        recognition.stop();
      }
    } catch (error) {
      showVoiceError(error instanceof Error ? error.message : "Could not stop voice input.");
    }
  };

  const startListening = () => {
    nativeBridge = window.Sanbot;
    const hasNativeBridge = Boolean(nativeBridge);
    let browserRecognition = null;
    if (!hasNativeBridge) {
      try {
        browserRecognition = createBrowserRecognition();
      } catch (error) {
        voiceStatus.textContent = error instanceof Error
          ? error.message
          : "Could not initialize browser voice input.";
        return;
      }
    }

    if (hasNativeBridge && typeof nativeBridge.startVoiceInput !== "function") {
      voiceStatus.textContent = "Sanbot voice bridge cannot start listening.";
      return;
    }

    if (!hasNativeBridge && !browserRecognition) {
      voiceStatus.textContent = "Voice input is unavailable in this browser.";
      return;
    }

    currentSession = {
      source: hasNativeBridge ? "sanbot" : "browser",
      resultHandled: false,
      cancelled: false
    };
    voiceErrorVisible = false;
    listeningWith = currentSession.source;
    setListening(true);
    voiceStatus.textContent = "Listening...";

    try {
      if (hasNativeBridge) {
        Promise.resolve(nativeBridge.startVoiceInput()).catch((error) => {
          showVoiceError(error instanceof Error ? error.message : "Could not start Sanbot voice input.");
        });
      } else {
        browserRecognition.lang = voiceLanguage.value;
        browserRecognition.start();
      }
    } catch (error) {
      showVoiceError(error instanceof Error ? error.message : "Could not start voice input.");
    }
  };

  const onVoiceButtonClick = () => {
    if (listeningWith) {
      stopListening();
      return;
    }

    startListening();
  };
  voiceButton.addEventListener("click", onVoiceButtonClick);

  const onSanbotVoiceResult = (text) => sendVoiceResult(text, "sanbot");
  const onSanbotVoiceError = (message) => {
    const errorMessage = typeof message === "string" && message.trim()
      ? message.trim()
      : "Sanbot voice recognition failed.";
    showVoiceError(errorMessage);
  };
  const onSanbotVoiceState = (state) => {
    if (typeof state !== "string" || !window.Sanbot) return;
    nativeBridge = window.Sanbot;
    const normalizedState = state.trim().toLowerCase();
    if (normalizedState === "listening") {
      if (!currentSession || currentSession.source !== "sanbot" || currentSession.cancelled) {
        currentSession = {
          source: "sanbot",
          resultHandled: false,
          cancelled: false
        };
      }
      voiceErrorVisible = false;
      listeningWith = "sanbot";
      setListening(true);
      voiceStatus.textContent = "Listening...";
    } else if (normalizedState === "stopped") {
      if (currentSession && currentSession.source === "sanbot") listeningWith = null;
      setListening(false);
      if (!voiceErrorVisible) voiceStatus.textContent = "Voice input stopped.";
    }
  };

  window.onSanbotVoiceResult = onSanbotVoiceResult;
  window.onSanbotVoiceError = onSanbotVoiceError;
  window.onSanbotVoiceState = onSanbotVoiceState;

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    const source = listeningWith;
    if (currentSession) currentSession.cancelled = true;
    listeningWith = null;
    voiceButton.removeEventListener("click", onVoiceButtonClick);

    if (recognition) {
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
    }

    if (source === "sanbot" && typeof nativeBridge.stopVoiceInput === "function") {
      try {
        Promise.resolve(nativeBridge.stopVoiceInput()).catch((error) => {
          console.error("Could not stop Sanbot voice input during cleanup.", error);
        });
      } catch (error) {
        console.error("Could not stop Sanbot voice input during cleanup.", error);
      }
    } else if (source === "browser" && recognition) {
      try {
        recognition.stop();
      } catch (error) {
        console.error("Could not stop browser voice input during cleanup.", error);
      }
    }

    if (window.onSanbotVoiceResult === onSanbotVoiceResult) window.onSanbotVoiceResult = null;
    if (window.onSanbotVoiceError === onSanbotVoiceError) window.onSanbotVoiceError = null;
    if (window.onSanbotVoiceState === onSanbotVoiceState) window.onSanbotVoiceState = null;
    window.removeEventListener("pagehide", cleanup);
    window.removeEventListener("beforeunload", cleanup);
  };

  window.addEventListener("pagehide", cleanup, { once: true });
  window.addEventListener("beforeunload", cleanup, { once: true });
});
