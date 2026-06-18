const loginTab = document.getElementById('login-tab');
const signupTab = document.getElementById('signup-tab');
const authForm = document.getElementById('auth-form');
const nameField = document.getElementById('name-field');
const roleField = document.getElementById('role-field');
const messageBox = document.getElementById('message');

let mode = 'login';

const setMode = (nextMode) => {
  mode = nextMode;
  if (mode === 'signup') {
    signupTab.classList.add('active');
    loginTab.classList.remove('active');
    nameField.classList.remove('hidden');
    roleField.classList.remove('hidden');
  } else {
    loginTab.classList.add('active');
    signupTab.classList.remove('active');
    nameField.classList.add('hidden');
    roleField.classList.add('hidden');
  }
  messageBox.textContent = '';
};

loginTab.addEventListener('click', () => setMode('login'));
signupTab.addEventListener('click', () => setMode('signup'));

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  messageBox.textContent = '';

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const role = document.getElementById('role').value;

  const payload = { email, password };
  let url = '/api/login';

  if (mode === 'signup') {
    payload.name = name;
    payload.role = role;
    url = '/api/signup';
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      messageBox.textContent = data.message || 'An error occurred.';
      return;
    }

   localStorage.setItem('token', data.token);
localStorage.setItem('user', JSON.stringify(data.user));

if (mode === 'signup') {
  messageBox.style.color = '#8fd9c5';
  messageBox.textContent = `Signup successful. Welcome, ${data.user.name}!`;
  authForm.reset();
} else {
  window.location.href = '/dashboard.html';
}
  } catch (error) {
    messageBox.style.color = '#f29b9b';
    messageBox.textContent = 'Unable to connect to the server.';
    console.error(error);
  }
});

setMode('login');
