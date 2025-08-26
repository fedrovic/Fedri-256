// Dark Mode
const darkToggle = document.getElementById("dark-mode-toggle");
darkToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  darkToggle.classList.toggle("fa-moon");
  darkToggle.classList.toggle("fa-sun");
});

// Mobile Nav
const nav = document.getElementById("nav");
const menuToggle = document.querySelector(".menu-toggle");
menuToggle.addEventListener("click", () => {
  nav.classList.toggle("active");
});

// Music Player
const musicPlayer = document.getElementById("musicPlayer");
const songSelector = document.getElementById("songSelector");
songSelector.addEventListener("change", () => {
  if (songSelector.value !== "none") {
    musicPlayer.src = songSelector.value;
    musicPlayer.play();
  }
});

// Like Button
const likeBtn = document.getElementById("likeBtn");
const likeCount = document.getElementById("likeCount");
let likes = 0;
likeBtn.addEventListener("click", () => {
  likes++;
  likeCount.textContent = likes;
  likeBtn.textContent = "❤️ Liked";
});

// Share Button
const shareBtn = document.getElementById("shareBtn");
shareBtn.addEventListener("click", async () => {
  if (navigator.share) {
    await navigator.share({
      title: "Fred Akunzire Portfolio",
      text: "Check out Fred Akunzire's portfolio!",
      url: window.location.href
    });
  } else {
    alert("Sharing not supported on this browser.");
  }
});

// Comments
const commentForm = document.getElementById("commentForm");
const commentsList = document.getElementById("commentsList");
const viewCommentsBtn = document.getElementById("viewCommentsBtn");
const commentMessage = document.getElementById("commentMessage");
let comments = [];

commentForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const textarea = commentForm.querySelector("textarea");
  comments.push(textarea.value);
  textarea.value = "";
  commentMessage.textContent = "✅ Comment submitted!";
});

viewCommentsBtn.addEventListener("click", () => {
  commentsList.innerHTML = comments.map(c => `<p>${c}</p>`).join("");
  commentsList.style.display = commentsList.style.display === "none" ? "block" : "none";
});

// Visitor Counter (Local Simulation)
const visitorCount = document.getElementById("visitorCount");
let count = localStorage.getItem("visitors") || 0;
count++;
localStorage.setItem("visitors", count);
visitorCount.textContent = count;
