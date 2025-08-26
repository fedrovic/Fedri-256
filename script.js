// ================================
// script.js
// ================================

// 🌙 Dark Mode Toggle
const darkToggle = document.getElementById("dark-mode-toggle");
const body = document.body;

darkToggle.addEventListener("click", () => {
  body.classList.toggle("dark-mode");
  darkToggle.classList.toggle("fa-moon");
  darkToggle.classList.toggle("fa-sun");
});

// 📱 Mobile Menu Toggle
const menuToggle = document.querySelector(".menu-toggle");
const nav = document.getElementById("nav");

menuToggle.addEventListener("click", () => {
  nav.classList.toggle("active");
});

// 🎵 Music Player
const songSelector = document.getElementById("songSelector");
const musicPlayer = document.getElementById("musicPlayer");

songSelector.addEventListener("change", () => {
  const song = songSelector.value;
  if (song === "none") {
    musicPlayer.pause();
    musicPlayer.src = "";
  } else {
    musicPlayer.src = song;
    musicPlayer.play();
  }
});

// 🤍 Like Button
const likeBtn = document.getElementById("likeBtn");
const likeCount = document.getElementById("likeCount");

let likes = 0;
likeBtn.addEventListener("click", () => {
  likes++;
  likeCount.textContent = likes;
  likeBtn.textContent = "❤️";
  setTimeout(() => {
    likeBtn.textContent = "🤍";
  }, 1000);
});

// 📤 Share Button
const shareBtn = document.getElementById("shareBtn");
shareBtn.addEventListener("click", () => {
  if (navigator.share) {
    navigator.share({
      title: "Fred Akunzire Portfolio",
      text: "Check out this awesome portfolio!",
      url: window.location.href,
    });
  } else {
    alert("Sharing is not supported on this browser.");
  }
});

// 💬 Comments
const commentForm = document.getElementById("commentForm");
const commentMessage = document.getElementById("commentMessage");
const viewCommentsBtn = document.getElementById("viewCommentsBtn");
const commentsList = document.getElementById("commentsList");

let comments = [];

commentForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const textarea = commentForm.querySelector("textarea");
  const comment = textarea.value.trim();

  if (comment) {
    comments.push(comment);
    commentMessage.textContent = "✅ Comment submitted!";
    textarea.value = "";
  } else {
    commentMessage.textContent = "⚠️ Please write a comment.";
  }
});

viewCommentsBtn.addEventListener("click", () => {
  if (comments.length === 0) {
    commentsList.innerHTML = "<p>No comments yet.</p>";
  } else {
    commentsList.innerHTML = comments
      .map((c) => `<p>💬 ${c}</p>`)
      .join("");
  }
  commentsList.style.display =
    commentsList.style.display === "none" ? "block" : "none";
});

// 👥 Visitor Counter (local storage simulation)
const visitorCountEl = document.getElementById("visitorCount");
let count = localStorage.getItem("visitorCount") || 0;
count++;
localStorage.setItem("visitorCount", count);
visitorCountEl.textContent = count;

// 🖼 Background Slideshow
const images = ["Fred-software.jpg", "pexels-fotios-photos-19743300.jpg"];
let currentIndex = 0;
const overlay = document.querySelector(".background-overlay");

function changeBackground() {
  overlay.style.backgroundImage = `url('${images[currentIndex]}')`;
  currentIndex = (currentIndex + 1) % images.length;
}
setInterval(changeBackground, 5000);
changeBackground();
