// Simple debug script to check if login fields are properly found
document.addEventListener('DOMContentLoaded', function() {
    console.log('*** LOGIN DEBUG SCRIPT LOADED ***');
    
    // Check for login form elements
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginButton = document.getElementById('loginBtn');
    
    console.log('Login form found:', !!loginForm);
    console.log('Email input found:', !!emailInput);
    console.log('Password input found:', !!passwordInput);
    console.log('Login button found:', !!loginButton);
    
    // If we have a login form, add a debug handler
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Log the values (for debugging only)
            const email = emailInput ? emailInput.value : 'NOT FOUND';
            const password = passwordInput ? passwordInput.value : 'NOT FOUND';
            
            console.log('Form submitted with email:', email);
            console.log('Form submitted with password:', password ? '(password entered)' : '(no password)');
            
            // Check if SimpleAuth is available
            if (typeof SimpleAuth !== 'undefined') {
                const result = SimpleAuth.login({ 
                    email: email, 
                    password: password 
                });
                
                console.log('Login result:', result);
                
                if (result.success) {
                    alert('Login successful! Redirecting to home page.');
                    window.location.href = 'laundary.html';
                } else {
                    alert('Login failed: ' + result.message);
                }
            } else {
                alert('SimpleAuth not available. Cannot login.');
            }
        });
    }
}); 