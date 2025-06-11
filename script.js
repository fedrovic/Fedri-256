document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('welcome-container');

  const welcomeMessage = document.createElement('h1');
  welcomeMessage.textContent = "Welcome to Fred's Website!";

  const subtitle = document.createElement('p');
  subtitle.textContent = "Glad to have you here. Explore and enjoy!";

  const button = document.createElement('button');
  button.textContent = 'Click Me!';

  button.addEventListener('click', () => {
    welcomeMessage.textContent = "Thanks for visiting, Fred!";
    subtitle.textContent = "Feel free to reach out anytime.";
    button.style.display = 'none';
  });

  container.appendChild(welcomeMessage);
  container.appendChild(subtitle);
  container.appendChild(button);
});
