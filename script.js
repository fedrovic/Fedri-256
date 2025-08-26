// ==============================
// Firebase Configuration
// ==============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  get,
  set,
  onValue,
  push,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCygRKrnhEecPrhRMJZUm1sVKVrZYUbWLY",
  authDomain: "fredportfolio-7a53c.firebaseapp.com",
  projectId: "fredportfolio-7a53c",
  storageBucket: "fredportfolio-7a53c.appspot.com",
  messagingSenderId: "586695046110",
  appId: "1:586695046110:web:b16ad1db078b359c3fe34f",
  databaseURL: "https://fredportfolio-7a53c-default-rtdb.firebaseio.com/",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ==============================
// Visitor Counter
// ==============================
const visitorCountEl = document.getElementById("visitorCount");
const visitRef = ref(db, "visitorCount");

get(visitRef).then((snapshot) => {
  let count = snapshot.exists() ? snapshot.val() : 0;
  set(visitRef, count + 1);
});

onValue(visitRef, (snapshot) => {
  if (visitorCountEl) visitorCountEl.textContent = snapshot.val();
});

// ==============================
// Dark Mode Toggle
// ==============================
const toggleBtn = document.getElementById("dark-mode-toggle");
const body = document.body;

toggleBtn?.addEventListener("click", () => {
  body.classList.toggle("dark-mode");
  toggleBtn.querySelector("i").classList.toggle("fa-moon");
  toggleBtn.querySelector("i").classList.toggle("fa-sun");
});

// ==============================
// Navigation Toggle
// ==============================
const navToggle = document.querySelector(".nav-toggle");
const nav = document.getElementById("nav");

navToggle?.addEventListener("click", () => {
  nav.classList.toggle("active");
});

// ==============================
// Music Player
// ==============================
const songSelector = document.getElementById("songSelector");
const musicPlayer = document.getElementById("musicPlayer");

songSelector?.addEventListener("change", function () {
  const selected = this.value;
  if (selected !== "none") {
    musicPlayer.src = selected;
    musicPlayer.play();
  } else {
    musicPlayer.pause();
    musicPlayer.src = "";
  }
});

// ==============================
// Like Button (Fixed)
// ==============================
const likeBtn = document.getElementById("likeBtn");
const likeCount = document.getElementById("likeCount");
const likesRef = ref(db, "likes/count");

let userLiked = localStorage.getItem("userLiked") === "true";

function updateLikeUI(isLiked) {
  if (!likeBtn) return;
  likeBtn.classList.toggle("liked", isLiked);
  likeBtn.textContent = isLiked ? "❤️ Liked" : "🤍 Like";
}

// Sync total likes
onValue(likesRef, (snapshot) => {
  const total = snapshot.exists() ? snapshot.val() : 0;
  if (likeCount) likeCount.textContent = total;
});

updateLikeUI(userLiked);

likeBtn?.addEventListener("click", async () => {
  if (userLiked) {
    alert("You already liked ❤️");
    return;
  }

  updateLikeUI(true);
  userLiked = true;
  localStorage.setItem("userLiked", "true");

  try {
    const snapshot = await get(likesRef);
    const current = snapshot.exists() ? snapshot.val() : 0;
    await set(likesRef, current + 1);
  } catch (err) {
    console.error("Like error:", err);
  }
});

// ==============================
// Comments
// ==============================
const commentForm = document.getElementById("commentForm");
const commentMessage = document.getElementById("commentMessage");
const commentsList = document.getElementById("commentsList");
const viewBtn = document.getElementById("viewCommentsBtn");

commentForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const textarea = commentForm.querySelector("textarea");
  const comment = textarea.value.trim();
  if (comment) {
    const commentRef = ref(db, "comments");
    push(commentRef, {
      text: comment,
      time: new Date().toISOString(),
    });
    textarea.value = "";
    commentMessage.textContent = "✅ Thank you for your comment!";
    setTimeout(() => (commentMessage.textContent = ""), 3000);
  }
});

// Fetch & view comments
viewBtn?.addEventListener("click", () => {
  commentsList.innerHTML = "<p>Loading comments...</p>";
  get(ref(db, "comments")).then((snapshot) => {
    commentsList.innerHTML = "";
    if (snapshot.exists()) {
      const data = snapshot.val();
      Object.values(data).forEach((entry) => {
        const p = document.createElement("p");
        p.textContent = entry.text;
        commentsList.appendChild(p);
      });
    } else {
      commentsList.innerHTML = "<p>No comments yet.</p>";
    }
  });
});

// ==============================
// Share Button
// ==============================
const shareBtn = document.getElementById("shareBtn");
shareBtn?.addEventListener("click", async () => {
  if (navigator.share) {
    try {
      await navigator.share({
        title: "Fred Akunzire | Portfolio",
        text: "Check out this amazing developer!",
        url: window.location.href,
      });
    } catch (err) {
      console.warn("Share canceled");
    }
  } else {
    alert("Your browser does not support Web Share API.");
  }
});
