/*
 * Copyright (c) 2025 William y Angel.
 * All rights reserved.
 */
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');

    loginForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const username = event.target.username.value;
        const password = event.target.password.value;

        // Mock login - in a real application, you would fetch this from a server
        if (username === 'admin' && password === 'password') {
            console.log('Login successful');
            // Redirect to the main application page
            window.location.href = 'INDEX.HTML';
        } else {
            errorMessage.textContent = 'Usuario o contraseña incorrectos.';
            // Clear the error message after a few seconds
            setTimeout(() => {
                errorMessage.textContent = '';
            }, 3000);
        }
    });
});