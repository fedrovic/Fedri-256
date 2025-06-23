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

// Music Player
const songSelector = document.getElementById('songSelector');
const musicPlayer = document.getElementById('musicPlayer');

if (songSelector && musicPlayer) {
  songSelector.addEventListener('change', function () {
    const selectedSong = decodeURIComponent(this.value);
    if (selectedSong !== 'none') {
      musicPlayer.src = selectedSong;
      musicPlayer.play();
    } else {
      musicPlayer.pause();
      musicPlayer.src = '';
    }
  });
}
