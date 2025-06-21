// DARK MODE TOGGLE
const toggleBtn = document.getElementById('dark-mode-toggle');
const body = document.body;

if (toggleBtn) {
  toggleBtn.addEventListener('click', () => {
    body.classList.toggle('dark-mode');

    // Save preference
    localStorage.setItem('darkMode', body.classList.contains('dark-mode'));

    // Change icon
    const icon = toggleBtn.querySelector('i');
    if (body.classList.contains('dark-mode')) {
      icon.classList.remove('fa-moon');
      icon.classList.add('fa-sun');
    } else {
      icon.classList.remove('fa-sun');
      icon.classList.add('fa-moon');
    }
  });

  // Load saved dark mode preference
  if (localStorage.getItem('darkMode') === 'true') {
    body.classList.add('dark-mode');
    toggleBtn.querySelector('i').classList.replace('fa-moon', 'fa-sun');
  }
}

// RESPONSIVE NAVBAR TOGGLE
const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('active');
  });
}

// TYPING ANIMATION (Optional)
const typedTarget = document.getElementById('typed-text');
if (typedTarget) {
  new Typed('#typed-text', {
    strings: ['Hello, I’m Fred Akunzire', 'Software Engineering Student', 'Web Developer & Designer'],
    typeSpeed: 60,
    backSpeed: 30,
    loop: true
  });
}

// FETCH GITHUB PROJECTS (Optional)
const githubUsername = 'Fedri-256';
const projectContainer = document.getElementById('github-project-list');

if (projectContainer) {
  fetch(`https://api.github.com/users/${githubUsername}/repos`)
    .then(response => response.json())
    .then(repos => {
      repos.forEach(repo => {
        const card = document.createElement('div');
        card.className = 'github-card';
        card.innerHTML = `
          <h4>${repo.name}</h4>
          <p>${repo.description || 'No description'}</p>
          <a href="${repo.html_url}" target="_blank" class="btn">View on GitHub</a>
        `;
        projectContainer.appendChild(card);
      });
    })
    .catch(error => {
      console.error('GitHub fetch failed:', error);
    });
}
