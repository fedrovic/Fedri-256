// DARK MODE TOGGLE
const toggleBtn = document.getElementById('dark-mode-toggle');
const body = document.body;

if (toggleBtn) {
  toggleBtn.addEventListener('click', () => {
    body.classList.toggle('dark-mode');

    // Change the icon
    const icon = toggleBtn.querySelector('i') || toggleBtn;
    if (body.classList.contains('dark-mode')) {
      icon.classList.remove('fa-moon');
      icon.classList.add('fa-sun');
    } else {
      icon.classList.remove('fa-sun');
      icon.classList.add('fa-moon');
    }
  });
}

// RESPONSIVE NAVBAR TOGGLE
const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('active');
  });
}
