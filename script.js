// ---------- Background Slideshow ----------
const images = ["fred-software.jpg", "pexels-fotios-photos-19743300.jpg"];
let currentIndex = 0;

function changeBackground() {
  document.body.style.backgroundImage = `url(${images[currentIndex]})`;
  currentIndex = (currentIndex + 1) % images.length;
}
setInterval(changeBackground, 5000);
changeBackground();

// ---------- Like Button with Local Storage ----------
const likeBtn = document.getElementById("like-btn");
const likeCount = document.getElementById("like-count");

let likes = localStorage.getItem("likes") || 0;
likeCount.textContent = likes;

likeBtn.addEventListener("click", () => {
  likes++;
  likeCount.textContent = likes;
  likeBtn.style.color = "red"; // turn red when liked
  localStorage.setItem("likes", likes);
});

// ---------- Comments ----------
const commentForm = document.getElementById("comment-form");
const commentInput = document.getElementById("comment-input");
const commentList = document.getElementById("comment-list");
const viewCommentsBtn = document.getElementById("view-comments");

commentForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const comment = commentInput.value.trim();
  if (comment) {
    const li = document.createElement("li");
    li.textContent = comment;
    commentList.appendChild(li);
    commentInput.value = "";
  }
});

viewCommentsBtn.addEventListener("click", () => {
  commentList.classList.toggle("hidden");
});

// ---------- Visitor Counter ----------
const visitorCount = document.getElementById("visitor-count");
let count = localStorage.getItem("visitorCount") || 0;
count++;
localStorage.setItem("visitorCount", count);
visitorCount.textContent = count;

// ---------- Fred AI Chatbot ----------
const chatbotToggle = document.getElementById("chatbot-toggle");
const chatbotBox = document.getElementById("chatbot-box");
const chatbotClose = document.getElementById("chatbot-close");
const chatbotMessages = document.getElementById("chatbot-messages");
const chatbotInput = document.getElementById("chatbot-input");
const chatbotSend = document.getElementById("chatbot-send");

// Toggle chatbot
chatbotToggle.addEventListener("click", () => {
  chatbotBox.classList.toggle("hidden");
});

// Close chatbot
chatbotClose.addEventListener("click", () => {
  chatbotBox.classList.add("hidden");
});

// Function to simulate reasoning before responding
function fredAIResponse(userMessage) {
  let response = "Hmm... let me think about that.";

  // Simple "reasoning" rules
  if (userMessage.includes("hello") || userMessage.includes("hi")) {
    response = "Hello! 👋 I'm Fred AI, how can I help you today?";
  } else if (userMessage.includes("who are you")) {
    response = "I’m Fred AI 🤖, your friendly assistant created to help on this site.";
  } else if (userMessage.includes("project")) {
    response = "Fred has worked on several projects, like a Soccer Management System ⚽ and a Hotel Booking System 🏨.";
  } else if (userMessage.includes("bye")) {
    response = "Goodbye! 👋 Talk to you soon.";
  } else {
    response = "That’s interesting 🤔... I’ll note it down and help however I can.";
  }

  return response;
}

// Send chatbot message
function sendMessage() {
  const userMessage = chatbotInput.value.trim().toLowerCase();
  if (!userMessage) return;

  // Display user message
  const userDiv = document.createElement("div");
  userDiv.classList.add("user-message");
  userDiv.textContent = "You: " + userMessage;
  chatbotMessages.appendChild(userDiv);

  chatbotInput.value = "";

  // Simulate thinking delay
  const thinkingDiv = document.createElement("div");
  thinkingDiv.classList.add("bot-message");
  thinkingDiv.textContent = "Fred AI is thinking...";
  chatbotMessages.appendChild(thinkingDiv);

  setTimeout(() => {
    thinkingDiv.remove();
    const botDiv = document.createElement("div");
    botDiv.classList.add("bot-message");
    botDiv.textContent = "Fred AI: " + fredAIResponse(userMessage);
    chatbotMessages.appendChild(botDiv);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
  }, 1000); // 1 second delay for realism
}

chatbotSend.addEventListener("click", sendMessage);
chatbotInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});
