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

// Speech recognition for microphone input.
document.addEventListener("DOMContentLoaded", () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const voiceButton = document.getElementById("voice-button");
  const voiceStatus = document.getElementById("voice-status");
  const voiceLanguage = document.getElementById("voice-language");
  const input = document.getElementById("input");

  if (!SpeechRecognition) {
    voiceButton.disabled = true;
    voiceStatus.textContent = "Voice input needs Chrome or Edge.";
    return;
  }

  if (!window.isSecureContext) {
    voiceButton.disabled = true;
    voiceStatus.textContent = "Open this page through HTTPS or localhost.";
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 5;

  voiceButton.addEventListener("click", () => {
    if (voiceButton.classList.contains("listening")) {
      recognition.stop();
      return;
    }

    recognition.lang = voiceLanguage.value;
    voiceStatus.textContent = "Listening...";
    document.getElementById("robot-face").classList.add("listening");
    document.getElementById("robot-state").textContent = "Listening...";
    voiceButton.classList.add("listening");
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        stream.getTracks().forEach((track) => track.stop());
        recognition.start();
      })
      .catch((error) => {
        voiceButton.classList.remove("listening");
        document.getElementById("robot-face").classList.remove("listening");
        if (error.name === "NotAllowedError") {
          voiceStatus.textContent = "Allow microphone access in the browser address-bar settings.";
        } else if (error.name === "NotFoundError") {
          voiceStatus.textContent = "No microphone found on this laptop.";
        } else if (error.name === "NotReadableError") {
          voiceStatus.textContent = "Microphone is busy. Close other apps using it.";
        } else {
          voiceStatus.textContent = "Could not access the microphone.";
        }
      });
  });

  recognition.onresult = (event) => {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      transcript += event.results[i][0].transcript;
    }
    input.value = transcript.trim();

    if (event.results[event.results.length - 1].isFinal) {
      let spokenText = transcript.trim();
      if (!spokenText) {
        const firstResult = event.results[event.results.length - 1];
        for (let i = 0; i < firstResult.length; i += 1) {
          if (firstResult[i].transcript.trim()) {
            spokenText = firstResult[i].transcript.trim();
            break;
          }
        }
      }
      if (spokenText) {
        input.value = "";
        output(spokenText);
      }
    }
  };

  recognition.onend = () => {
    voiceButton.classList.remove("listening");
    document.getElementById("robot-face").classList.remove("listening");
    voiceStatus.textContent = "";
  };

  recognition.onerror = (event) => {
    voiceButton.classList.remove("listening");
    if (event.error === "not-allowed") {
      voiceStatus.textContent = "Microphone permission is required.";
    } else if (event.error === "no-speech") {
      voiceStatus.textContent = "No speech detected. Try again.";
    } else {
      voiceStatus.textContent = "Voice input could not be completed.";
    }
  };
});