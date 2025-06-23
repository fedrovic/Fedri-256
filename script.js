// DARK MODE TOGGLE
const toggleBtn = document.getElementById('dark-mode-toggle');
const body = document.body;

if (toggleBtn) {
  toggleBtn.addEventListener('click', () => {
    body.classList.toggle('dark-mode');
    const icon = toggleBtn;
    if (body.classList.contains('dark-mode')) {
      icon.classList.remove('fa-moon');
      icon.classList.add('fa-sun');
    } else {
      icon.classList.remove('fa-sun');
      icon.classList.add('fa-moon');
    }
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
let likeCount = parseInt(localStorage.getItem('likeCount')) || 0;
const likeBtn = document.getElementById('like-btn');
const likeDisplay = document.getElementById('like-count');

function updateLikeDisplay() {
  if (likeDisplay) likeDisplay.textContent = `Likes: ${likeCount}`;
  if (likeBtn) {
    likeBtn.classList.add('liked');
    likeBtn.innerHTML = '❤️ Liked';
  }
}

if (likeBtn && likeDisplay) {
  updateLikeDisplay();

  likeBtn.addEventListener('click', () => {
    likeCount++;
    localStorage.setItem('likeCount', likeCount);
    updateLikeDisplay();
  });
}

// SHARE BUTTON
const shareBtn = document.getElementById('share-btn');

if (shareBtn && navigator.share) {
  shareBtn.addEventListener('click', () => {
    navigator.share({
      title: 'Fred Akunzire | Portfolio',
      text: 'Check out this amazing portfolio!',
      url: window.location.href
    }).catch(err => {
      console.error('Share failed:', err);
    });
  });
}

// COMMENT SUBMIT (if Firebase is set up)
const commentForm = document.getElementById('comment-form');
const commentList = document.getElementById('comment-list');

if (commentForm && commentList) {
  commentForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const name = this.name.value;
    const message = this.message.value;

    const commentBox = document.createElement('div');
    commentBox.className = 'comment-box';
    commentBox.innerHTML = `<strong>${name}</strong><p>${message}</p>`;
    commentList.prepend(commentBox);

    alert('Thank you for your comment!');
    this.reset();

    // Optional: Firebase code to push to Firestore
    // db.collection("comments").add({ name, message, timestamp: new Date() });
  });
}
