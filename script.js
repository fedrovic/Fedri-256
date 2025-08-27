// ===============================
// script.js (updated — robust slideshow)
// ===============================

// --- Helper: safe query
const $ = (sel) => document.querySelector(sel);

// --- Background Slideshow (robust: checks image availability)
const slideshowEl = $('.background-slideshow');
const overlayEl = $('.background-overlay');

// list only the two images you mentioned
const candidateImages = [
  'Fred-software.jpg',
  'pexels-fotios-photos-19743300.jpg'
];

// preload and return only successfully loaded images
function preloadImages(urls, timeout = 7000) {
  const loaders = urls.map(url => new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const timer = setTimeout(() => {
      if (!done) { done = true; resolve({ url, ok: false }); }
    }, timeout);

    img.onload = () => {
      if (!done) { done = true; clearTimeout(timer); resolve({ url, ok: true }); }
    };
    img.onerror = () => {
      if (!done) { done = true; clearTimeout(timer); resolve({ url, ok: false }); }
    };
    img.src = url;
  }));
  return Promise.all(loaders).then(results => results.filter(r => r.ok).map(r => r.url));
}

// start slideshow from an array of valid image URLs
function startSlideshow(images, intervalMs = 8000) {
  if (!slideshowEl) return;
  if (!images || images.length === 0) {
    // no images — hide slideshow element and keep dark overlay
    slideshowEl.style.display = 'none';
    overlayEl.style.background = 'rgba(0,0,0,0.45)';
    return;
  }

  // set initial background
  let idx = 0;
  slideshowEl.style.backgroundImage = `url("${images[idx]}")`;
  slideshowEl.style.opacity = '1';

  // if only one image, no need to rotate
  if (images.length === 1) {
    // keep single image visible
    return;
  }

  // rotate images with cross-fade by changing background-image
  setInterval(() => {
    idx = (idx + 1) % images.length;
    // fade out, change, fade in for smoother cross-fade in browsers that don't animate background-image
    slideshowEl.style.transition = 'opacity 700ms ease';
    slideshowEl.style.opacity = '0';
    setTimeout(() => {
      slideshowEl.style.backgroundImage = `url("${images[idx]}")`;
      slideshowEl.style.opacity = '1';
    }, 300);
  }, intervalMs);
}

// preload candidate images and start slideshow with whatever loaded
preloadImages(candidateImages).then(validImages => {
  startSlideshow(validImages);
});

// ------------------------------
// Rest of site logic (unchanged)
// ------------------------------

// --- Dark Mode Toggle ---
const toggleBtn = document.getElementById('dark-mode-toggle');
toggleBtn?.addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
  toggleBtn.classList.toggle('fa-moon');
  toggleBtn.classList.toggle('fa-sun');
});

// --- Mobile Nav Toggle ---
const navToggle = document.querySelector('.nav-toggle');
const nav = document.getElementById('nav');
navToggle?.addEventListener('click', () => {
  nav.classList.toggle('active');
});

// --- Music Player ---
const songSelector = document.getElementById('songSelector');
const musicPlayer = document.getElementById('musicPlayer');
songSelector?.addEventListener('change', function () {
  const selected = this.value;
  if (selected !== 'none') {
    musicPlayer.src = selected;
    musicPlayer.play().catch(()=>{ /* ignore autoplay restrictions */ });
  } else {
    musicPlayer.pause();
    musicPlayer.src = '';
  }
});

// --- Firebase setup & features ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase, ref, get, set, push, onValue, runTransaction
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

// Visitor count (transaction-safe)
const visitRef = ref(db, 'visitorCount');
runTransaction(visitRef, (current) => (current || 0) + 1).then(res => {
  const el = document.getElementById('visitorCount');
  if (el) el.textContent = res.snapshot.val();
});

// --- Like button (one like per device)
const likeBtn = document.getElementById('likeBtn');
const likeCount = document.getElementById('likeCount');
const likesRef = ref(db, 'likes/count');

function setLikeUI(liked){
  likeBtn?.classList.toggle('liked', liked);
  if (likeBtn) likeBtn.textContent = liked ? '❤️ Liked' : '🤍';
}

let userLiked = localStorage.getItem('userLiked') === 'true';
setLikeUI(userLiked);

// live likes
onValue(likesRef, (snap)=>{
  if (likeCount) likeCount.textContent = snap.exists() ? snap.val() : 0;
});

likeBtn?.addEventListener('click', () => {
  if (userLiked) return;
  runTransaction(likesRef, (current) => (current || 0) + 1).then(() => {
    userLiked = true;
    localStorage.setItem('userLiked', 'true');
    setLikeUI(true);
  });
});

// --- Comments
const commentForm = document.getElementById('commentForm');
const commentMessage = document.getElementById('commentMessage');
const commentsList = document.getElementById('commentsList');
const viewBtn = document.getElementById('viewCommentsBtn');

commentForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const textarea = commentForm.querySelector('textarea');
  const text = textarea.value.trim();
  if (!text) return;
  push(ref(db, 'comments'), { text, time: new Date().toISOString() })
    .then(() => {
      textarea.value = '';
      if (commentMessage){
        commentMessage.textContent = '✅ Thank you for your comment!';
        setTimeout(()=> commentMessage.textContent = '', 2500);
      }
    });
});

viewBtn?.addEventListener('click', () => {
  if (commentsList) {
    commentsList.style.display = commentsList.style.display === 'none' ? 'block' : 'block';
    commentsList.innerHTML = '<p>Loading comments...</p>';
  }
  get(ref(db, 'comments')).then(snap => {
    if (!commentsList) return;
    commentsList.innerHTML = '';
    if (snap.exists()) {
      const data = snap.val();
      Object.values(data).forEach(entry => {
        const p = document.createElement('p');
        p.textContent = entry.text;
        commentsList.appendChild(p);
      });
    } else {
      commentsList.innerHTML = '<p>No comments yet.</p>';
    }
  });
});

// --- Share
const shareBtn = document.getElementById('shareBtn');
shareBtn?.addEventListener('click', async () => {
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Fred Akunzire | Portfolio',
        text: 'Check out this amazing developer!',
        url: window.location.href,
      });
    } catch { /* user cancelled */ }
  } else {
    alert('Your browser does not support Web Share API.');
  }
});

// ===============================
// Dummy Chatbot (minimizable)
// ===============================
const chatbot = document.getElementById('chatbot');
const chatbotToggle = document.getElementById('chatbotToggle');
const chatbotClose = document.getElementById('chatbotClose');
const chatbotForm = document.getElementById('chatbotForm');
const chatbotText = document.getElementById('chatbotText');
const chatbotMessages = document.getElementById('chatbotMessages');

// Open/close
chatbotToggle?.addEventListener('click', () => {
  chatbot.style.display = 'flex';
  chatbotText?.focus();
});
chatbotClose?.addEventListener('click', () => {
  chatbot.style.display = 'none';
});

// FAQ is empty by your request; add pairs in this array later as:
// { q: /who are you/i, a: "I'm Fred..." }
const FAQ = [];

// fallback
function fallbackReply(){
  return "Thanks — I don't have an answer for that yet. Please try another question or use the Contact form.";
}

function findAnswer(input){
  for (const item of FAQ){
    if (item.q.test(input)) return item.a;
  }
  return null;
}

function appendMessage(text, sender='bot'){
  const div = document.createElement('div');
  div.className = sender === 'user' ? 'user' : 'bot';
  div.textContent = text;
  chatbotMessages.appendChild(div);
  chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
}

chatbotForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const msg = chatbotText.value.trim();
  if (!msg) return;
  appendMessage(msg, 'user');
  chatbotText.value = '';
  setTimeout(()=>{
    const answer = findAnswer(msg) || fallbackReply();
    appendMessage(answer, 'bot');
  }, 400);
});
