// =============================
// Background slideshow
// =============================
const images = ["fred-software.jpg", "pexels-fotios-photos-19743300.jpg"];
let currentIndex = 0;
function changeBackground() {
  document.body.style.backgroundImage = `url(${images[currentIndex]})`;
  currentIndex = (currentIndex + 1) % images.length;
}
setInterval(changeBackground, 5000);
changeBackground();

// =============================
// Like button logic (with localStorage)
// =============================
let likeCount = parseInt(localStorage.getItem("likeCount")) || 0;
const likeBtn = document.getElementById("likeBtn");
const likeDisplay = document.getElementById("likeCount");

likeDisplay.innerText = `${likeCount} Likes`;

likeBtn.addEventListener("click", () => {
  likeCount++;
  likeDisplay.innerText = `${likeCount} Likes`;
  localStorage.setItem("likeCount", likeCount);
});

// =============================
// Chatbot toggle & minimize
// =============================
const chatbot = document.getElementById("chatbot");
const chatbotToggle = document.getElementById("chatbotToggle");
const closeChatbot = document.getElementById("closeChatbot");

// Floating minimize button
const minimizedBtn = document.createElement("button");
minimizedBtn.innerText = "💬 Fred AI";
minimizedBtn.id = "minimizedChatbot";
minimizedBtn.style.position = "fixed";
minimizedBtn.style.bottom = "20px";
minimizedBtn.style.right = "20px";
minimizedBtn.style.padding = "10px 15px";
minimizedBtn.style.border = "none";
minimizedBtn.style.borderRadius = "20px";
minimizedBtn.style.background = "#007bff";
minimizedBtn.style.color = "white";
minimizedBtn.style.cursor = "pointer";
minimizedBtn.style.display = "none";
document.body.appendChild(minimizedBtn);

// Open chatbot
chatbotToggle.addEventListener("click", () => {
  chatbot.classList.remove("hidden");
  minimizedBtn.style.display = "none";
});

// Minimize chatbot instead of closing
closeChatbot.addEventListener("click", () => {
  chatbot.classList.add("hidden");
  minimizedBtn.style.display = "block";
});

// Restore chatbot from minimized button
minimizedBtn.addEventListener("click", () => {
  chatbot.classList.remove("hidden");
  minimizedBtn.style.display = "none";
});

// =============================
// Chatbot logic (Fred AI with memory + localStorage)
// =============================
const sendBtn = document.getElementById("sendBtn");
const userInput = document.getElementById("userInput");
const messages = document.getElementById("chatbotMessages");

let conversationHistory = JSON.parse(localStorage.getItem("conversationHistory")) || [];

// Render old messages if any
conversationHistory.forEach(msg => {
  const div = document.createElement("div");
  div.classList.add(msg.sender);
  div.innerText = msg.text;
  messages.appendChild(div);
});
messages.scrollTop = messages.scrollHeight;

function addMessage(sender, text) {
  const msg = document.createElement("div");
  msg.classList.add(sender);
  msg.innerText = text;
  messages.appendChild(msg);
  messages.scrollTop = messages.scrollHeight;

  // Save message to history
  conversationHistory.push({ sender, text });
  localStorage.setItem("conversationHistory", JSON.stringify(conversationHistory));
}

// Rule-based AI with context memory
function getBotResponse(input) {
  const msg = input.toLowerCase();

  // Greeting
  if (msg.includes("hello") || msg.includes("hi")) {
    return "Hello! I’m Fred AI 👋 How are you today?";
  }

  if (msg.includes("how are you")) {
    return "I’m great, thanks for asking! And you?";
  }

  if (msg.includes("fine") || msg.includes("good")) {
    return "Glad to hear that! Do you want to hear about Fred’s projects?";
  }

  if (msg.includes("project")) {
    return "Fred has worked on exciting software projects, like this portfolio website 🚀";
  }

  if (msg.includes("about")) {
    return "This site is about Fred’s portfolio, skills, and passion for tech.";
  }

  // Context-based continuation
  if (conversationHistory.length > 1) {
    const lastBot = conversationHistory
      .slice()
      .reverse()
      .find(msg => msg.sender === "bot");

    if (lastBot && lastBot.text.includes("projects")) {
      return "Would you like me to tell you more about Fred’s coding skills?";
    }

    if (lastBot && lastBot.text.includes("portfolio")) {
      return "Fred is also exploring AI and web development.";
    }
  }

  if (msg.includes("bye")) {
    return "Goodbye! Hope you enjoyed visiting Fred’s site 🚀";
  }

  return "Hmm 🤔 I’m not sure, but Fred can explain more!";
}

function handleUserInput() {
  const text = userInput.value.trim();
  if (text === "") return;
  addMessage("user", text);
  userInput.value = "";
  setTimeout(() => {
    const response = getBotResponse(text);
    addMessage("bot", response);
  }, 600);
}

sendBtn.addEventListener("click", handleUserInput);
userInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") handleUserInput();
});
