document.addEventListener("DOMContentLoaded", () => {
  const inputField = document.getElementById("input");
  const sendButton = document.getElementById("send-button");
  const robotState = document.getElementById("robot-state");

  const sendMessage = () => {
    const input = inputField.value.trim();
    if (!input) return;
    inputField.value = "";
    output(input);
  };

  inputField.addEventListener("keydown", (e) => {
    if (e.code === "Enter") sendMessage();
  });
  sendButton.addEventListener("click", sendMessage);

  robotState.textContent = "Online - listening";
  setTimeout(() => {
    addChat("", document.getElementById("welcome-message").textContent);
  }, 350);
});

function output(input) {
  let product;

  // Regex remove non word/space chars
  // Trim trailing whitespce
  // Remove digits - not sure if this is best
  // But solves problem of entering something like 'hi1'

  let text = input.normalize("NFC").toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/[\d]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
  text = text
    .replace(/ a /g, " ")   // 'tell me a story' -> 'tell me story'
    .replace(/i feel /g, "")
    .replace(/whats/g, "what is")
    .replace(/please /g, "")
    .replace(/ please/g, "")
    .replace(/r u/g, "are you");

  if (compare(prompts, replies, text)) { 
    // Search for exact match in `prompts`
    product = compare(prompts, replies, text);
  } else if (text.match(/thank/gi)) {
    product = "You're welcome!"
  } else if (text.match(/(corona|covid|virus)/gi)) {
    // If no match, check if message contains `coronavirus`
    product = coronavirus[Math.floor(Math.random() * coronavirus.length)];
  } else {
    // If all else fails: random alternative
    product = alternative[Math.floor(Math.random() * alternative.length)];
  }

  // Update DOM
  addChat(input, product);
}

function compare(promptsArray, repliesArray, string) {
  let reply;
  let replyFound = false;
  for (let x = 0; x < promptsArray.length; x++) {
    for (let y = 0; y < promptsArray[x].length; y++) {
      const prompt = promptsArray[x][y].normalize("NFC").toLowerCase();
      if (prompt === string
        || (string.length >= 3 && (string.includes(prompt) || prompt.includes(string)))) {
        let replies = repliesArray[x];
        reply = replies[Math.floor(Math.random() * replies.length)];
        replyFound = true;
        // Stop inner loop when input value matches prompts
        break;
      }
    }
    if (replyFound) {
      // Stop outer loop when reply is found instead of interating through the entire array
      break;
    }
  }
  return reply;
}

function addChat(input, product) {
  const messagesContainer = document.getElementById("messages");

  if (input) {
    const userDiv = document.createElement("div");
    userDiv.id = "user";
    userDiv.className = "user response";
    const userAvatar = document.createElement("img");
    userAvatar.src = "user.png";
    userAvatar.className = "avatar";
    const userText = document.createElement("span");
    userText.textContent = input;
    userDiv.appendChild(userAvatar);
    userDiv.appendChild(userText);
    messagesContainer.appendChild(userDiv);
  }

  let botDiv = document.createElement("div");
  let botImg = document.createElement("img");
  let botText = document.createElement("span");
  botDiv.id = "bot";
  botImg.src = "bot-mini.png";
  botImg.className = "avatar";
  botDiv.className = "bot response";
  botText.innerText = "Typing...";
  botDiv.appendChild(botText);
  botDiv.appendChild(botImg);
  messagesContainer.appendChild(botDiv);
  document.getElementById("robot-face").classList.add("thinking");
  document.getElementById("robot-state").textContent = "Thinking...";
  // Keep messages at most recent
  messagesContainer.scrollTop = messagesContainer.scrollHeight - messagesContainer.clientHeight;

  // Fake delay to seem "real"
  setTimeout(() => {
    botText.innerText = `${product}`;
    document.getElementById("robot-face").classList.remove("thinking");
    document.getElementById("robot-face").classList.add("speaking");
    document.getElementById("robot-state").textContent = "Speaking...";
    textToSpeech(product)
    setTimeout(() => {
      document.getElementById("robot-face").classList.remove("speaking");
      document.getElementById("robot-state").textContent = "Online - listening";
    }, Math.max(1800, product.length * 45));
  }, input ? 700 : 250);

}