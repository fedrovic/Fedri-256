// DARK MODE TOGGLE
const toggleBtn = document.getElementById('dark-mode-toggle');
const body = document.body;

if (toggleBtn) {
  toggleBtn.addEventListener('click', () => {
    body.classList.toggle('dark-mode');
    const icon = toggleBtn;
    icon.classList.toggle('fa-moon');
    icon.classList.toggle('fa-sun');
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
let likeCount = localStorage.getItem('likeCount') || 0;
let liked = localStorage.getItem('liked') === 'true';

function updateLikeButton() {
  if (likeBtn) {
    likeBtn.innerHTML = `❤️ Like (${likeCount})`;
    likeBtn.classList.toggle('active', liked);
  }
}
if (likeBtn) {
  updateLikeButton();
  likeBtn.addEventListener('click', () => {
    liked = !liked;
    if (liked) likeCount++;
    else likeCount = Math.max(0, likeCount - 1);
    localStorage.setItem('liked', liked);
    localStorage.setItem('likeCount', likeCount);
    updateLikeButton();
  });
}

// COMMENT FORM
const commentForm = document.getElementById('commentForm');
const commentInput = document.getElementById('commentInput');
const commentList = document.getElementById('commentList');

if (commentForm && commentInput && commentList) {
  commentForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const comment = commentInput.value.trim();
    if (comment !== '') {
      const p = document.createElement('p');
      p.textContent = comment;
      commentList.appendChild(p);
      alert("Thank you for your comment!");
      commentInput.value = '';
    }
  });
}

// SHARE BUTTON
const shareBtn = document.getElementById('shareBtn');

if (shareBtn && navigator.share) {
  shareBtn.addEventListener('click', () => {
    navigator.share({
      title: "Fred Akunzire Portfolio",
      text: "Check out Fred Akunzire's website!",
      url: window.location.href
    }).catch((err) => {
      console.log('Share failed:', err.message);
    });
  });
} else if (shareBtn) {
  shareBtn.addEventListener('click', () => {
    alert("Sharing is not supported on your device.");
  });
}
