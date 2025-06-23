// DARK MODE TOGGLE
const toggleBtn = document.getElementById('dark-mode-toggle');
const body = document.body;

toggleBtn?.addEventListener('click', () => {
  body.classList.toggle('dark-mode');
  toggleBtn.classList.toggle('fa-moon');
  toggleBtn.classList.toggle('fa-sun');
});

// NAVBAR TOGGLE
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

// LIKE BUTTON
const likeBtn = document.getElementById('likeBtn');
const likeCount = document.getElementById('likeCount');
let liked = localStorage.getItem('liked') === 'true';
let count = parseInt(localStorage.getItem('likeCount') || '0');

function updateLikeUI() {
  likeBtn.textContent = liked ? '❤️ Liked' : '🤍 Like';
  likeBtn.classList.toggle('red', liked);
  likeCount.textContent = count;
}
updateLikeUI();

likeBtn?.addEventListener('click', () => {
  if (!liked) {
    liked = true;
    count++;
    localStorage.setItem('liked', 'true');
    localStorage.setItem('likeCount', count);
    updateLikeUI();
  }
});

// COMMENT FORM
const commentForm = document.getElementById('commentForm');
const commentMessage = document.getElementById('commentMessage');
const commentsList = document.getElementById('commentsList');

commentForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const textarea = commentForm.querySelector('textarea');
  const comment = textarea.value.trim();
  if (comment) {
    const item = document.createElement('p');
    item.textContent = comment;
    commentsList.appendChild(item);
    textarea.value = '';
    commentMessage.textContent = '✅ Thank you for your comment!';
    setTimeout(() => commentMessage.textContent = '', 3000);
  }
});

// SHARE BUTTON
const shareBtn = document.getElementById('shareBtn');
shareBtn?.addEventListener('click', async () => {
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Fred Akunzire | Portfolio',
        text: 'Check out this amazing developer!',
        url: window.location.href,
      });
    } catch (error) {
      alert('Sharing failed');
    }
  } else {
    alert('Your browser does not support sharing.');
  }
});
