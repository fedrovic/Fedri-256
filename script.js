// === script.js ===

// DARK MODE TOGGLE const toggleBtn = document.getElementById('dark-mode-toggle'); const body = document.body;

if (toggleBtn) { toggleBtn.addEventListener('click', () => { body.classList.toggle('dark-mode'); toggleBtn.classList.toggle('fa-moon'); toggleBtn.classList.toggle('fa-sun'); }); }

// NAV TOGGLE const navToggle = document.querySelector('.nav-toggle'); const nav = document.getElementById('nav');

if (navToggle && nav) { navToggle.addEventListener('click', () => { nav.classList.toggle('active'); }); }

// Music Player const songSelector = document.getElementById('songSelector'); const musicPlayer = document.getElementById('musicPlayer');

if (songSelector && musicPlayer) { songSelector.addEventListener('change', function () { const selectedSong = this.value; if (selectedSong !== 'none') { musicPlayer.src = selectedSong; musicPlayer.play(); } else { musicPlayer.pause(); musicPlayer.src = ''; } }); }

// Like Button let likeCount = localStorage.getItem('likeCount') || 0; const likeBtn = document.getElementById('likeBtn'); const likeDisplay = document.getElementById('likeDisplay');

if (likeBtn && likeDisplay) { likeDisplay.innerText = likeCount; likeBtn.addEventListener('click', () => { likeBtn.classList.toggle('liked'); if (likeBtn.classList.contains('liked')) { likeCount++; likeBtn.style.color = 'red'; } else { likeCount--; likeBtn.style.color = ''; } likeDisplay.innerText = likeCount; localStorage.setItem('likeCount', likeCount); }); }

// Share Button const shareBtn = document.getElementById('shareBtn');

if (shareBtn) { shareBtn.addEventListener('click', async () => { if (navigator.share) { await navigator.share({ title: 'Fred Akunzire Portfolio', text: 'Check out this awesome portfolio by Fred Akunzire!', url: window.location.href }); } else { alert('Sharing is not supported on your device.'); } }); }

// Comment Form const commentForm = document.getElementById('commentForm'); const commentInput = document.getElementById('commentInput'); const commentList = document.getElementById('commentList');

if (commentForm && commentInput && commentList) { commentForm.addEventListener('submit', function (e) { e.preventDefault(); const comment = commentInput.value.trim(); if (comment !== '') { const p = document.createElement('p'); p.textContent = comment; commentList.appendChild(p); alert('Thank you for your comment!'); commentInput.value = ''; } }); }

