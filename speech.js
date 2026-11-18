// Text to speech for bot replies.
const synth = window.speechSynthesis;

const textToSpeech = (string) => {
  if (!synth) return;

  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(string);
  const voices = synth.getVoices();
  const language = document.getElementById("voice-language")?.value || "en-US";
  const voice = voices.find((item) => item.lang === language)
    || voices.find((item) => item.lang.startsWith(language.split("-")[0]));

  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang || "en-US";
  utterance.volume = 1;
  utterance.rate = 1;
  utterance.pitch = 1;
  synth.speak(utterance);
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
    voiceStatus.textContent = "Voice input is not supported in this browser.";
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;

  voiceButton.addEventListener("click", () => {
    if (voiceButton.classList.contains("listening")) {
      recognition.stop();
      return;
    }

    recognition.lang = voiceLanguage.value;
    voiceStatus.textContent = "Listening...";
    voiceButton.classList.add("listening");
    try {
      recognition.start();
    } catch (error) {
      voiceStatus.textContent = "Could not start the microphone.";
      voiceButton.classList.remove("listening");
    }
  });

  recognition.onresult = (event) => {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      transcript += event.results[i][0].transcript;
    }
    input.value = transcript.trim();

    if (event.results[event.results.length - 1].isFinal) {
      const spokenText = transcript.trim();
      if (spokenText) output(spokenText);
    }
  };

  recognition.onend = () => {
    voiceButton.classList.remove("listening");
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