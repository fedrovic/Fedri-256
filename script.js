// ===== LIKE BUTTON (Persistent) =====
const likeBtn = document.getElementById("likeBtn");
const likeCount = document.getElementById("likeCount");

let likes = localStorage.getItem("likes") ? parseInt(localStorage.getItem("likes")) : 0;
likeCount.textContent = likes;

if (likes > 0) likeBtn.classList.add("liked");

likeBtn.addEventListener("click", () => {
  if (likeBtn.classList.contains("liked")) {
    likes--;
    likeBtn.classList.remove("liked");
  } else {
    likes++;
    likeBtn.classList.add("liked");
  }
  localStorage.setItem("likes", likes);
  likeCount.textContent = likes;
});

// ===== COMMENTS =====
const commentForm = document.getElementById("commentForm");
const commentsList = document.getElementById("commentsList");
const viewCommentsBtn = document.getElementById("viewCommentsBtn");

let comments = JSON.parse(localStorage.getItem("comments")) || [];

const renderComments = () => {
  commentsList.innerHTML = "";
  comments.forEach(c => {
    const div = document.createElement("div");
    div.textContent = c;
    div.classList.add("comment-item");
    commentsList.appendChild(div);
  });
};

viewCommentsBtn.addEventListener("click", () => {
  commentsList.style.display = commentsList.style.display === "none" ? "block" : "none";
  renderComments();
});

commentForm.addEventListener("submit", e => {
  e.preventDefault();
  const text = commentForm.querySelector("textarea").value.trim();
  if (!text) return;
  comments.push(text);
  localStorage.setItem("comments", JSON.stringify(comments));
  commentForm.reset();
  renderComments();
});

// ===== VISITOR COUNT =====
const visitorCount = document.getElementById("visitorCount");
let visits = localStorage.getItem("visits") ? parseInt(localStorage.getItem("visits")) : 0;
visits++;
localStorage.setItem("visits", visits);
visitorCount.textContent = visits;

// ===== MUSIC PLAYER =====
const songSelector = document.getElementById("songSelector");
const musicPlayer = document.getElementById("musicPlayer");

songSelector.addEventListener("change", () => {
  if (songSelector.value !== "none") {
    musicPlayer.src = songSelector.value;
    musicPlayer.play();
  } else {
    musicPlayer.pause();
    musicPlayer.src = "";
  }
});

// ===== CHATBOT (Fred AI) =====
const chatbotToggle = document.getElementById("chatbotToggle");
const chatbot = document.getElementById("chatbot");
const chatbotClose = document.getElementById("chatbotClose");
const chatbotForm = document.getElementById("chatbotForm");
const chatbotText = document.getElementById("chatbotText");
const chatbotMessages = document.getElementById("chatbotMessages");

chatbotToggle.addEventListener("click", () => {
  chatbot.style.display = "flex";
});

chatbotClose.addEventListener("click", () => {
  chatbot.style.display = "none";
});

// Simple rule-based responses
function fredAIResponse(message) {
  message = message.toLowerCase();

  if (message.includes("hello") || message.includes("hi")) {
    return "Hello! 👋 How can I assist you with my portfolio?";
  }
  if (message.includes("project")) {
    return "I have built projects like a Portfolio Website and a Login Page UI.";
  }
  if (message.includes("music")) {
    return "Yes 🎵 — you can select and play a song in the music section.";
  }
  if (message.includes("contact")) {
    return "You can contact me through the form or WhatsApp link in the Contact section.";
  }
  if (message.includes("help")) {
    return "Try asking me about my projects, music, or how to contact me!";
  }
  return "I'm not sure about that 🤔. But you can explore my site sections above!";
}

// Handle chatbot messages
chatbotForm.addEventListener("submit", e => {
  e.preventDefault();
  const userMsg = chatbotText.value.trim();
  if (!userMsg) return;

  // User message
  const userDiv = document.createElement("div");
  userDiv.classList.add("user");
  userDiv.textContent = userMsg;
  chatbotMessages.appendChild(userDiv);

  // Bot response
  setTimeout(() => {
    const botDiv = document.createElement("div");
    botDiv.classList.add("bot");
    botDiv.textContent = fredAIResponse(userMsg);
    chatbotMessages.appendChild(botDiv);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
  }, 500);

  chatbotText.value = "";
});
