const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const speechScript = fs.readFileSync(path.join(__dirname, "..", "speech.js"), "utf8");
const chatScript = fs.readFileSync(path.join(__dirname, "..", "index.js"), "utf8");

class MockElement {
  constructor(value = "") {
    this.value = value;
    this.textContent = "";
    this.listeners = new Map();
    this.classNames = new Set();
    this.classList = {
      toggle: (name, enabled) => {
        if (enabled) this.classNames.add(name);
        else this.classNames.delete(name);
      }
    };
    this.clickCount = 0;
  }

  addEventListener(name, listener) {
    const listeners = this.listeners.get(name) || [];
    listeners.push(listener);
    this.listeners.set(name, listeners);
  }

  removeEventListener(name, listener) {
    this.listeners.set(name, (this.listeners.get(name) || []).filter((item) => item !== listener));
  }

  click() {
    this.clickCount += 1;
    for (const listener of this.listeners.get("click") || []) listener();
  }
}

function setupVoiceInput({ sanbot, SpeechRecognition, includeChatFlow = false } = {}) {
  const elements = {
    "voice-button": new MockElement(),
    "voice-status": new MockElement(),
    "voice-language": new MockElement("si-LK"),
    input: new MockElement(),
    "send-button": new MockElement(),
    "robot-face": new MockElement(),
    "robot-state": new MockElement()
  };
  const windowListeners = new Map();
  const window = {
    Sanbot: sanbot,
    speechSynthesis: null,
    addEventListener(name, listener) {
      windowListeners.set(name, listener);
    },
    removeEventListener(name, listener) {
      if (windowListeners.get(name) === listener) windowListeners.delete(name);
    }
  };
  if (SpeechRecognition) window.SpeechRecognition = SpeechRecognition;

  const readyHandlers = [];
  const document = {
    addEventListener(name, listener) {
      if (name === "DOMContentLoaded") readyHandlers.push(listener);
    },
    getElementById(id) {
      return elements[id];
    }
  };
  const submittedMessages = [];
  const context = { window, document, Promise, Error, console, setTimeout() {} };
  if (includeChatFlow) {
    vm.runInNewContext(chatScript, context, { filename: "index.js" });
    context.output = (message) => submittedMessages.push(message);
  }
  vm.runInNewContext(speechScript, context, { filename: "speech.js" });
  for (const onReady of readyHandlers) onReady();
  return { context, elements, windowListeners, submittedMessages };
}

test("native bridge is preferred without constructing browser recognition", () => {
  let startCount = 0;
  let recognitionCount = 0;
  class BrowserRecognition {
    constructor() {
      recognitionCount += 1;
    }
  }
  const app = setupVoiceInput({ SpeechRecognition: BrowserRecognition });
  app.context.window.Sanbot = {
    startVoiceInput() { startCount += 1; },
    stopVoiceInput() {}
  };

  app.elements["voice-button"].click();

  assert.equal(startCount, 1);
  assert.equal(recognitionCount, 0);
  assert.equal(app.elements["voice-status"].textContent, "Listening...");
  assert.equal(app.elements["voice-button"].classNames.has("listening"), true);
});

test("a present but incomplete native bridge does not fall back to browser recognition", () => {
  let recognitionCount = 0;
  class BrowserRecognition {
    constructor() {
      recognitionCount += 1;
    }
  }
  const app = setupVoiceInput({
    sanbot: { stopVoiceInput() {} },
    SpeechRecognition: BrowserRecognition
  });

  app.elements["voice-button"].click();

  assert.equal(recognitionCount, 0);
  assert.equal(
    app.elements["voice-status"].textContent,
    "Sanbot voice bridge cannot start listening."
  );
});

test("native result is sent through the chat button once and remains plain text", () => {
  const app = setupVoiceInput({
    sanbot: { startVoiceInput() {}, stopVoiceInput() {} },
    includeChatFlow: true
  });
  app.elements["voice-button"].click();

  app.context.window.onSanbotVoiceResult("  <b>Hello</b>  ");
  app.context.window.onSanbotVoiceResult("Hello again");

  assert.deepEqual(app.submittedMessages, ["<b>Hello</b>"]);
  assert.equal(app.elements.input.value, "");
  assert.equal(app.elements["send-button"].clickCount, 1);
});

test("cancelling native input stops the SDK and ignores late results", () => {
  let stopCount = 0;
  const app = setupVoiceInput({
    sanbot: { startVoiceInput() {}, stopVoiceInput() { stopCount += 1; } }
  });
  app.elements["voice-button"].click();
  app.elements["voice-button"].click();
  app.context.window.onSanbotVoiceResult("late result");

  assert.equal(stopCount, 1);
  assert.equal(app.elements["voice-status"].textContent, "Voice input stopped.");
  assert.equal(app.elements["send-button"].clickCount, 0);
});

test("native state and error callbacks update the voice UI", () => {
  const app = setupVoiceInput({
    sanbot: { startVoiceInput() {}, stopVoiceInput() {} }
  });

  app.context.window.onSanbotVoiceState("listening");
  assert.equal(app.elements["voice-status"].textContent, "Listening...");
  assert.equal(app.elements["robot-state"].textContent, "Listening...");

  app.context.window.onSanbotVoiceState("stopped");
  assert.equal(app.elements["voice-status"].textContent, "Voice input stopped.");
  app.context.window.onSanbotVoiceState("listening");

  app.context.window.onSanbotVoiceError("Microphone permission denied");
  assert.equal(app.elements["voice-status"].textContent, "Microphone permission denied");
  assert.equal(app.elements["voice-button"].classNames.has("listening"), false);

  app.context.window.onSanbotVoiceState("stopped");
  assert.equal(app.elements["voice-status"].textContent, "Microphone permission denied");
});

test("browser fallback uses the selected language and submits its transcript", () => {
  let recognition;
  class BrowserRecognition {
    constructor() {
      recognition = this;
    }

    start() {
      this.started = true;
    }

    stop() {}
  }
  const app = setupVoiceInput({ SpeechRecognition: BrowserRecognition });

  app.elements["voice-button"].click();
  recognition.onresult({
    resultIndex: 0,
    results: [[{ transcript: "recognized in browser" }]]
  });

  assert.equal(recognition.started, true);
  assert.equal(recognition.lang, "si-LK");
  assert.equal(app.elements.input.value, "recognized in browser");
  assert.equal(app.elements["send-button"].clickCount, 1);
});

test("page cleanup stops native listening and removes bridge callbacks", () => {
  let stopCount = 0;
  const app = setupVoiceInput({
    sanbot: { startVoiceInput() {}, stopVoiceInput() { stopCount += 1; } }
  });
  app.elements["voice-button"].click();

  app.windowListeners.get("pagehide")();

  assert.equal(stopCount, 1);
  assert.equal(app.context.window.onSanbotVoiceResult, null);
  assert.equal(app.elements["voice-button"].listeners.get("click").length, 0);
});
