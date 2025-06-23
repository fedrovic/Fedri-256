// DARK MODE TOGGLE
const toggleBtn = document.getElementById('dark-mode-toggle');
const body = document.body;
if (toggleBtn) {
  toggleBtn.addEventListener('click', () => {
    body.classList.toggle('dark-mode');
    toggleBtn.classList.toggle('fa-sun');
    toggleBtn.classList.toggle('fa-moon');
  });
}

// NAV TOGGLE
const navToggle = document.querySelector('.nav-toggle');
const nav = document.getElementById('nav');
if (navToggle && nav) {
  navToggle.addEventListener('click', () => {
    nav.classList.toggle('active');
  });
}

// MUSIC PLAYER
const songSelector = document.getElementById('songSelector');
const musicPlayer = document.getElementById('musicPlayer');
if (songSelector && musicPlayer) {
  songSelector.addEventListener('change', function () {
    const selectedSong = this.value;
    if (selectedSong !== 'none') {
      musicPlayer.src = selectedSong;
      musicPlayer.play();
    } else {
      musicPlayer.pause();
      musicPlayer.src = '';
    }
  });
}

// LIKE BUTTON
const likeBtn = document.getElementById('likeBtn');
const likeCount = document.getElementById('likeCount');
let count = parseInt(localStorage.getItem('like-count')) || 0;
let liked = localStorage.getItem('liked') === 'true';
likeCount.textContent = count;
if (liked) likeBtn.classList.add('liked');

likeBtn.addEventListener('click', () => {
  liked = !liked;
  if (liked) {
    count++;
    likeBtn.classList.add('liked');
  } else {
    count = Math.max(0, count - 1);
    likeBtn.classList.remove('liked');
  }
  localStorage.setItem('like-count', count);
  localStorage.setItem('liked', liked);
  likeCount.textContent = count;
});

// SHARE BUTTON
const shareBtn = document.getElementById('shareBtn');
shareBtn.addEventListener('click', async () => {
  try {
    if (navigator.share) {
      await navigator.share({
        title: "Fred's Portfolio",
        text: "Check out this cool website!",
        url: window.location.href,
      });
    } else {
      alert("Sharing not supported on this device.");
    }
  } catch (err) {
    alert("Failed to share.");
  }
});

// COMMENTS
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, addDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyCygRKrnhEecPrhRMJZUm1sVKVrZYUbWLY",
  authDomain: "fredportfolio-7a53c.firebaseapp.com",
  projectId: "fredportfolio-7a53c",
  storageBucket: "fredportfolio-7a53c.appspot.com",
  messagingSenderId: "586695046110",
  appId: "1:586695046110:web:b16ad1db078b359c3fe34f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// COMMENT FORM
const commentForm = document.getElementById('commentForm');
const commentMsg = document.getElementById('commentMessage');
const commentsList = document.getElementById('commentsList');
const toggleBtn = document.getElementById('toggleCommentsBtn');

if (commentForm) {
  commentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = commentForm.querySelector('textarea').value.trim();
    if (!text) return;

    await addDoc(collection(db, 'comments'), {
      text,
      timestamp: new Date()
    });

    commentMsg.textContent = "Thank you for your comment!";
    commentForm.reset();
    loadComments();
  });
}

// TOGGLE COMMENTS
if (toggleBtn) {
  toggleBtn.addEventListener('click', () => {
    const isVisible = commentsList.style.display === 'block';
    commentsList.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) loadComments();
  });
}

// LOAD COMMENTS
async function loadComments() {
  const snapshot = await getDocs(collection(db, 'comments'));
  commentsList.innerHTML = '';
  snapshot.forEach(doc => {
    const comment = document.createElement('p');
    comment.textContent = "• " + doc.data().text;
    commentsList.appendChild(comment);
  });
}
