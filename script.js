// DARK MODE TOGGLE const toggleBtn = document.getElementById('dark-mode-toggle'); const body = document.body;

if (toggleBtn) { toggleBtn.addEventListener('click', () => { body.classList.toggle('dark-mode'); localStorage.setItem('darkMode', body.classList.contains('dark-mode')); const icon = toggleBtn; if (body.classList.contains('dark-mode')) { icon.classList.remove('fa-moon'); icon.classList.add('fa-sun'); } else { icon.classList.remove('fa-sun'); icon.classList.add('fa-moon'); } }); }

// Load dark mode preference window.addEventListener('DOMContentLoaded', () => { const isDark = localStorage.getItem('darkMode') === 'true'; if (isDark) { body.classList.add('dark-mode'); if (toggleBtn) { toggleBtn.classList.remove('fa-moon'); toggleBtn.classList.add('fa-sun'); } }

// Typing effect const typed = new Typed('#typed-text', { strings: ["Hello, I’m Fred Akunzire", "I'm a Software Engineering Student", "Welcome to My Portfolio!"], typeSpeed: 50, backSpeed: 30, loop: true }); });

// RESPONSIVE NAVBAR TOGGLE const navToggle = document.querySelector('.nav-toggle'); const navLinks = document.querySelector('.nav-links');

if (navToggle && navLinks) { navToggle.addEventListener('click', () => { navLinks.classList.toggle('active'); }); }

// LIVE GITHUB PROJECTS (From Fedri-256) async function loadGitHubProjects() { const username = "Fedri-256"; const container = document.getElementById("github-project-list");

try { const res = await fetch(https://api.github.com/users/${username}/repos); const repos = await res.json();

repos.forEach(repo => {
  const card = document.createElement('div');
  card.className = 'github-card';
  card.innerHTML = `
    <h3>${repo.name}</h3>
    <p>${repo.description || "No description provided."}</p>
    <a href="${repo.html_url}" target="_blank">View on GitHub</a>
  `;
  container.appendChild(card);
});

} catch (error) { container.innerHTML = "<p>Failed to load GitHub projects.</p>"; console.error("GitHub Fetch Error:", error); } }

// Load GitHub Projects on page ready document.addEventListener("DOMContentLoaded", loadGitHubProjects);

