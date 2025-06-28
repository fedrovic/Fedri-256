// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyCygRKrnhEecPrhRMJZUm1sVKVrZYUbWLY",
  authDomain: "fredportfolio-7a53c.firebaseapp.com",
  databaseURL: "https://fredportfolio-7a53c-default-rtdb.firebaseio.com/",
  projectId: "fredportfolio-7a53c",
  storageBucket: "fredportfolio-7a53c.appspot.com",
  messagingSenderId: "586695046110",
  appId: "1:586695046110:web:b16ad1db078b359c3fe34f"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// DARK MODE
document.getElementById('dark-mode-toggle')?.addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
  const toggleIcon = document.getElementById('dark-mode-toggle');
  toggleIcon.classList.toggle('fa-moon');
  toggleIcon.classList.toggle('fa-sun');
});

// NAV TOGGLE
document.querySelector('.nav-toggle')?.addEventListener('click', () => {
  document.getElementById('nav').classList.toggle('active');
});

// MUSIC PLAYER
const songSelector = document.getElementById('songSelector');
const musicPlayer = document.getElementById('musicPlayer');
songSelector?.addEventListener('change', function () {
  const selected = this.value;
  if (selected !== 'none') {
    musicPlayer.src = selected;
    musicPlayer.play();
  } else {
    musicPlayer.pause();
    musicPlayer.src = '';
  }
});

// VISITOR COUNT
const visitorCountSpan = document.getElementById('visitorCount');
const visitorRef = db.ref("visitorCount");

visitorRef.transaction((count) => {
  return (count || 0) + 1;
});

visitorRef.on("value", (snapshot) => {
  visitorCountSpan.textContent = snapshot.val();
});

// LIKE BUTTON
const likeBtn = document.getElementById('likeBtn');
const likeCount = document.getElementById('likeCount');
const likeRef = db.ref("likeCount");
let hasLiked = localStorage.getItem("liked") === "true";

likeRef.on("value", (snapshot) => {
  likeCount.textContent = snapshot.val() || 0;
  if (hasLiked) {
    likeBtn.classList.add("liked");
  }
});

likeBtn?.addEventListener('click', () => {
  if (!hasLiked) {
    likeRef.transaction(current => (current || 0) + 1);
    localStorage.setItem("liked", "true");
    likeBtn.classList.add("liked");
  }
});

// SHARE
document.getElementById('shareBtn')?.addEventListener('click', async () => {
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Fred Akunzire | Portfolio',
        text: 'Check out this amazing developer!',
        url: window.location.href
      });
    } catch (err) {
      alert("Sharing failed.");
    }
  } else {
    alert("Your browser doesn't support sharing.");
  }
});

// COMMENTS
const commentForm = document.getElementById('commentForm');
const commentList = document.getElementById('commentsList');
const commentMessage = document.getElementById('commentMessage');
const commentRef = db.ref("comments");

// Submit comment
commentForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = commentForm.querySelector("textarea").value.trim();
  if (text) {
    const newComment = commentRef.push();
    newComment.set({
      text,
      timestamp: Date.now()
    });
    commentForm.reset();
    commentMessage.textContent = "✅ Thank you for your comment!";
    setTimeout(() => (commentMessage.textContent = ""), 3000);
  }
});

// View comments
document.getElementById('viewCommentsBtn')?.addEventListener('click', () => {
  commentList.classList.toggle("hidden");
  commentList.innerHTML = ""; // Clear
  commentRef.once("value", (snapshot) => {
    const data = snapshot.val();
    if (data) {
      Object.values(data).forEach(comment => {
        const item = document.createElement("p");
        item.textContent = comment.text;
        commentList.appendChild(item);
      });
    } else {
      commentList.innerHTML = "<p>No comments yet.</p>";
    }
  });
});
