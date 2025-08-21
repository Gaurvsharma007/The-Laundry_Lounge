/**
 * User Authentication System for Laundry Service
 * Handles user registration, login, logout, and session management
 */
const UserManager = (function() {
    // Store for users
    let users = [];
    // Current logged in user
    let currentUser = null;
    // Auth token
    let authToken = null;
    
    // Socket.io connection
    let socket = null;

    // Save users to localStorage
    function saveUsers() {
        try {
            console.log("Saving users to localStorage:", users.length);
            localStorage.setItem('laundryUsers', JSON.stringify(users));
            console.log("Users saved successfully");
            return true;
        } catch (error) {
            console.error("Error saving users to localStorage:", error);
            return false;
        }
    }

    // Load users from localStorage
    function loadUsers() {
        console.log("Loading users from localStorage");
        
        try {
            const storedUsers = localStorage.getItem('laundryUsers');
            
            if (storedUsers) {
                try {
                    users = JSON.parse(storedUsers);
                    console.log("Successfully loaded users from storage:", users.length);
                } catch (parseError) {
                    console.error("Error parsing stored users:", parseError);
                    users = [];
                }
            } else {
                console.log("No stored users found, starting with empty array");
                users = [];
            }
        } catch (error) {
            console.error("Error loading users:", error);
            users = [];
        }
    }

    // Save current user session
    function saveSession() {
        try {
            if (currentUser && authToken) {
                const session = {
                    user: currentUser,
                    token: authToken,
                    timestamp: new Date().getTime()
                };
                localStorage.setItem('userSession', JSON.stringify(session));
                console.log("Session saved successfully");
                return true;
            } else {
                console.log("No user or token to save session");
                return false;
            }
        } catch (error) {
            console.error("Error saving session:", error);
            return false;
        }
    }

    // Load session from localStorage
    function loadSession() {
        try {
            const storedSession = localStorage.getItem('userSession');
            
            if (storedSession) {
                try {
                    const session = JSON.parse(storedSession);
                    
                    // Check if session is still valid (24 hours)
                    const now = new Date().getTime();
                    const sessionAge = now - session.timestamp;
                    const sessionValid = sessionAge < 24 * 60 * 60 * 1000; // 24 hours
                    
                    if (sessionValid) {
                        currentUser = session.user;
                        authToken = session.token;
                        console.log("Session loaded successfully, user:", currentUser.email);
                        return true;
                    } else {
                        console.log("Session expired, clearing");
                        clearSession();
                        return false;
                    }
                } catch (parseError) {
                    console.error("Error parsing stored session:", parseError);
                    return false;
                }
            } else {
                console.log("No stored session found");
                return false;
            }
        } catch (error) {
            console.error("Error loading session:", error);
            return false;
        }
    }

    // Clear current session
    function clearSession() {
        try {
            currentUser = null;
            authToken = null;
            localStorage.removeItem('userSession');
            console.log("Session cleared successfully");
            return true;
        } catch (error) {
            console.error("Error clearing session:", error);
            return false;
        }
    }

    // Register a new user (client-side validation)
    function validateRegistration(userData) {
        const { firstName, lastName, email, phone, password, confirmPassword } = userData;
        
        const errors = {};
        
        // Validate first name
        if (!firstName || firstName.trim() === '') {
            errors.firstName = 'First name is required';
        }
        
        // Validate last name
        if (!lastName || lastName.trim() === '') {
            errors.lastName = 'Last name is required';
        }
        
        // Validate email
        if (!email || email.trim() === '') {
            errors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(email)) {
            errors.email = 'Email is invalid';
        }
        
        // Validate phone
        if (!phone || phone.trim() === '') {
            errors.phone = 'Phone number is required';
        } else if (!/^\d{10,15}$/.test(phone.replace(/\D/g, ''))) {
            errors.phone = 'Phone number must be between 10 and 15 digits';
        }
        
        // Validate password
        if (!password || password.trim() === '') {
            errors.password = 'Password is required';
        } else if (password.length < 8) {
            errors.password = 'Password must be at least 8 characters';
        }
        
        // Validate confirm password
        if (password !== confirmPassword) {
            errors.confirmPassword = 'Passwords do not match';
        }
        
        return {
            valid: Object.keys(errors).length === 0,
            errors
        };
    }

    // Register a new user
    async function register(userData) {
        try {
            // Client-side validation
            const validation = validateRegistration(userData);
            
            if (!validation.valid) {
                return {
                    success: false,
                    message: 'Validation failed',
                    errors: validation.errors
                };
            }
            
            // Send to server
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Add to local users array (excluding password)
                const { password, confirmPassword, ...userWithoutPassword } = userData;
                
                // Only add if not already exists
                if (!users.find(u => u.email === userWithoutPassword.email)) {
                    users.push({
                        ...userWithoutPassword,
                        id: data.user.id,
                        createdAt: new Date().toISOString()
                    });
                    saveUsers();
                }
                
                return {
                    success: true,
                    message: 'Registration successful',
                    user: data.user
                };
            } else {
                // Handle server validation errors
                return {
                    success: false,
                    message: data.message || 'Registration failed',
                    errors: data.errors
                };
            }
        } catch (error) {
            console.error("Error during registration:", error);
            return {
                success: false,
                message: 'An error occurred during registration',
                errors: { general: error.message }
            };
        }
    }

    // Login
    async function login(credentials) {
        try {
            const { email, password } = credentials;
            
            // Basic validation
            if (!email || !password) {
                return {
                    success: false,
                    message: 'Email and password are required'
                };
            }
            
            // Send to server
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Set current user and token
                currentUser = data.user;
                authToken = data.token;
                
                // Save to session
                saveSession();
                
                // Update event listeners for protected elements
                updateProtectedElements();
                
                return {
                    success: true,
                    message: 'Login successful',
                    user: data.user
                };
            } else {
                return {
                    success: false,
                    message: data.message || 'Invalid email or password'
                };
            }
        } catch (error) {
            console.error("Error during login:", error);
            return {
                success: false,
                message: 'An error occurred during login'
            };
        }
    }

    // Logout
    function logout() {
        // Clear session
        clearSession();
        
        // Update UI
        updateProtectedElements();
        
        // Redirect to home page if on a protected page
        const currentPath = window.location.pathname;
        const protectedPaths = [
            '/account.html',
            '/account',
            '/profile.html',
            '/profile'
        ];
        
        if (protectedPaths.some(path => currentPath.includes(path))) {
            window.location.href = '/';
        }
        
        return {
            success: true,
            message: 'Logout successful'
        };
    }

    // Get current user
    function getCurrentUser() {
        return currentUser;
    }

    // Check if user is logged in
    function isLoggedIn() {
        return !!currentUser && !!authToken;
    }

    // Fetch current user profile (refresh from server)
    async function fetchUserProfile() {
        if (!authToken) {
            return {
                success: false,
                message: 'Not authenticated'
            };
        }
        
        try {
            const response = await fetch('/api/auth/me', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Update current user
                currentUser = data.user;
                saveSession();
                
                return {
                    success: true,
                    user: data.user
                };
            } else {
                // If unauthorized, clear session
                if (response.status === 401) {
                    clearSession();
                    updateProtectedElements();
                }
                
                return {
                    success: false,
                    message: data.message || 'Failed to fetch user profile'
                };
            }
        } catch (error) {
            console.error("Error fetching user profile:", error);
            return {
                success: false,
                message: 'An error occurred while fetching user profile'
            };
        }
    }

    // Update UI elements based on authentication state
    function updateProtectedElements() {
        const isAuthenticated = isLoggedIn();
        
        // Update login/logout buttons
        const loginButtons = document.querySelectorAll('.login-button, .signin-button');
        const logoutButtons = document.querySelectorAll('.logout-button, .signout-button');
        const profileButtons = document.querySelectorAll('.profile-button, .account-button');
        const userDisplayElements = document.querySelectorAll('.user-display, .user-name, .user-email');
        
        // Login buttons
        loginButtons.forEach(button => {
            if (isAuthenticated) {
                button.style.display = 'none';
            } else {
                button.style.display = '';
            }
        });
        
        // Logout buttons
        logoutButtons.forEach(button => {
            if (isAuthenticated) {
                button.style.display = '';
                // Add logout event listener
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    logout();
                });
            } else {
                button.style.display = 'none';
            }
        });
        
        // Profile buttons
        profileButtons.forEach(button => {
            if (isAuthenticated) {
                button.style.display = '';
            } else {
                button.style.display = 'none';
            }
        });
        
        // User display elements
        if (isAuthenticated && currentUser) {
            userDisplayElements.forEach(element => {
                if (element.classList.contains('user-name')) {
                    element.textContent = `${currentUser.firstName} ${currentUser.lastName}`;
                } else if (element.classList.contains('user-email')) {
                    element.textContent = currentUser.email;
                } else {
                    element.textContent = currentUser.firstName;
                }
                element.style.display = '';
            });
        } else {
            userDisplayElements.forEach(element => {
                element.style.display = 'none';
            });
        }
    }

    // Initialize socket connection
    function initSocket() {
        try {
            if (typeof io !== 'undefined') {
                socket = io();
                console.log("Socket initialized for user authentication");
                
                socket.on('connect', function() {
                    console.log("Socket connected for user authentication");
                    
                    // If user is logged in, authenticate socket
                    if (isLoggedIn()) {
                        socket.emit('authenticate', { token: authToken });
                    }
                });
                
                socket.on('connect_error', function(error) {
                    console.error("Socket connection error:", error);
                });
                
                return true;
            } else {
                console.warn("Socket.io not available");
                return false;
            }
        } catch (e) {
            console.error("Error initializing socket:", e);
            return false;
        }
    }

    // Initialize the UserManager
    function init() {
        console.log("Initializing UserManager...");
        
        // Load users from localStorage
        loadUsers();
        
        // Load session
        const sessionLoaded = loadSession();
        
        // Initialize socket
        initSocket();
        
        // Update UI based on authentication state
        setTimeout(updateProtectedElements, 100);
        
        // Refresh user profile if logged in
        if (sessionLoaded) {
            fetchUserProfile()
                .then(result => {
                    if (result.success) {
                        console.log("User profile refreshed successfully");
                    } else {
                        console.warn("Failed to refresh user profile:", result.message);
                    }
                })
                .catch(error => {
                    console.error("Error refreshing user profile:", error);
                });
        }
        
        console.log("UserManager initialization complete");
        return true;
    }

    // Public API
    return {
        init,
        register,
        login,
        logout,
        getCurrentUser,
        isLoggedIn,
        fetchUserProfile,
        updateProtectedElements
    };
})();

// Auto-initialize when the DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    UserManager.init();
}); 