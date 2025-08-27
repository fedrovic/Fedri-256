// =============================
// FIREBASE CONFIGURATION
// =============================
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_BUCKET",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();


// =============================
// BACKGROUND SLIDESHOW
// =============================
const images = ["Fred-software.jpg", "pexels-fotios-photos-19743300.jpg"];
let currentIndex = 0;

function changeBackground() {
  document.body.style.setProperty(
    "--bg-image",
    `url(${images[currentIndex]})`
  );
  document.body.style.backgroundImage = `url(${images[currentIndex]})`;
  currentIndex = (currentIndex + 1) % images.length;
}
setInterval(changeBackground, 6000);
changeBackground();


// =============================
// LIKE BUTTON
// =============================
const likeBtn = document.getElementById("likeBtn");
const likeCount = document.getElementById("likeCount");
const likeRef = db.collection("likes").doc("main");

likeRef.onSnapshot((doc) => {
  if (doc.exists) {
    likeCount.textContent = doc.data().count;
  }
});

likeBtn.addEventListener("click", () => {
  db.runTransaction((transaction) => {
    return transaction.get(likeRef).then((doc) => {
      if (!doc.exists) {
        transaction.set(likeRef, { count: 1 });
        return 1;
      }
      let newCount = doc.data().count + 1;
      transaction.update(likeRef, { count: newCount });
      return newCount;
    });
  }).then(() => {
    likeBtn.classList.add("liked");
    likeBtn.textContent = "❤️ Liked";
  });
});


// =============================
// COMMENT SYSTEM
// =============================
const commentForm = document.getElementById("commentForm");
const commentsList = document.getElementById("commentsList");
const commentsRef = db.collection("comments");

commentForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const commentText = document.getElementById("commentInput").value;
  if (commentText.trim() !== "") {
    commentsRef.add({
      text: commentText,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById("commentInput").value = "";
  }
});

commentsRef.orderBy("timestamp", "desc").onSnapshot((snapshot) => {
  commentsList.innerHTML = "";
  snapshot.forEach((doc) => {
    const li = document.createElement("li");
    li.textContent = doc.data().text;
    commentsList.appendChild(li);
  });
});


// =============================
// DARK MODE TOGGLE
// =============================
const darkModeToggle = document.getElementById("darkModeToggle");
darkModeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
});


// =============================
// FRED AI CHATBOT
// =============================
const chatbot = document.getElementById("chatbot");
const chatbotToggle = document.getElementById("chatbot-toggle");
const chatbotClose = document.getElementById("chatbot-close");
const chatbotMessages = document.getElementById("chatbot-messages");
const chatbotInput = document.getElementById("chatbot-input-field");
const chatbotSend = document.getElementById("chatbot-send");

// Open chatbot
chatbotToggle.addEventListener("click", () => {
  chatbot.style.display = "flex";
  chatbotToggle.style.display = "none";
});

// Close chatbot
chatbotClose.addEventListener("click", () => {
  chatbot.style.display = "none";
  chatbotToggle.style.display = "block";
});

// Append message
function appendMessage(text, sender) {
  const div = document.createElement("div");
  div.classList.add("message", sender === "user" ? "user-message" : "bot-message");
  div.textContent = text;
  chatbotMessages.appendChild(div);
  chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
}

// Rule-based responses
function fredAIResponse(input) {
  const text = input.toLowerCase();

  if (text.includes("hello") || text.includes("hi")) {
    return "Hello! I'm Fred AI 🤖. How can I assist you today?";
  } else if (text.includes("who are you")) {
    return "I'm Fred AI, your smart assistant built into this website.";
  } else if (text.includes("help")) {
    return "Sure! I can help you with website navigation, liking, comments, or just chat for fun!";
  } else if (text.includes("bye")) {
    return "Goodbye! 👋 Come back anytime.";
  } else {
    return "Hmm 🤔... I'm still learning. Can you rephrase that?";
  }
}

// Send message
function sendMessage() {
  const userInput = chatbotInput.value.trim();
  if (userInput === "") return;

  appendMessage(userInput, "user");
  chatbotInput.value = "";

  setTimeout(() => {
    const botReply = fredAIResponse(userInput);
    appendMessage(botReply, "bot");
  }, 600);
}

chatbotSend.addEventListener("click", sendMessage);
chatbotInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    sendMessage();
  }
});
