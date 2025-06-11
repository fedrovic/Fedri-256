// Wait for the DOM to fully load
document.addEventListener('DOMContentLoaded', () => {
  // Create a container div for the welcome message
  const container = document.createElement('div');
  container.id = 'welcome-container';
  container.style.textAlign = 'center';
  container.style.marginTop = '100px';
  container.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";

  // Create and style the welcome message
  const welcomeMessage = document.createElement('h1');
  welcomeMessage.textContent = "Welcome to Fred's Website!";
  welcomeMessage.style.color = '#2c3e50';
  welcomeMessage.style.fontSize = '3rem';
  welcomeMessage.style.marginBottom = '20px';

  // Create a subtitle
  const subtitle = document.createElement('p');
  subtitle.textContent = "Glad to have you here. Explore and enjoy!";
  subtitle.style.color = '#34495e';
  subtitle.style.fontSize = '1.2rem';
  subtitle.style.marginBottom = '30px';

  // Create a button with hover effects
  const button = document.createElement('button');
  button.textContent = 'Click Me!';
  button.style.padding = '12px 25px';
  button.style.fontSize = '1rem';
  button.style.border = 'none';
  button.style.borderRadius = '5px';
  button.style.backgroundColor = '#2980b9';
  button.style.color = 'white';
  button.style.cursor = 'pointer';
  button.style.transition = 'background-color 0.3s ease';

  // Button hover effect
  button.addEventListener('mouseenter', () => {
    button.style.backgroundColor = '#1abc9c';
  });
  button.addEventListener('mouseleave', () => {
    button.style.backgroundColor = '#2980b9';
  });

  // Button click event changes the welcome message
  button.addEventListener('click', () => {
    welcomeMessage.textContent = "Thanks for visiting, Fred!";
    subtitle.textContent = "Feel free to reach out anytime.";
    button.style.display = 'none'; // Hide button after click
  });

  // Append everything to container
  container.appendChild(welcomeMessage);
  container.appendChild(subtitle);
  container.appendChild(button);

  // Add container to body
  document.body.appendChild(container);
});
