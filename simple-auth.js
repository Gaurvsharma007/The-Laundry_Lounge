/**
 * Simple Authentication System for Laundry Service
 * This version works entirely in the browser without requiring server dependencies
 */
const SimpleAuth = (function() {
    // Check if localStorage is available
    function isLocalStorageAvailable() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            console.error("localStorage not available:", e);
            return false;
        }
    }
    
    // Alert if localStorage is not available
    if (!isLocalStorageAvailable()) {
        console.error("localStorage is not available. Authentication will not work.");
        alert("Warning: Your browser doesn't support or has disabled localStorage. The authentication system requires this feature to work properly.");
    }
    
    // Local storage keys
    const USERS_STORAGE_KEY = 'laundryUsers';
    const SESSION_STORAGE_KEY = 'userSession';
    
    // Get users from local storage
    function getUsers() {
        try {
            const storedUsers = localStorage.getItem(USERS_STORAGE_KEY);
            return storedUsers ? JSON.parse(storedUsers) : [];
        } catch (error) {
            console.error("Error getting users:", error);
            return [];
        }
    }
    
    // Save users to local storage
    function saveUsers(users) {
        try {
            localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
            return true;
        } catch (error) {
            console.error("Error saving users:", error);
            return false;
        }
    }
    
    // Simple password hashing (not secure, but works for demo)
    function hashPassword(password) {
        // In a real app, use a proper hashing library
        // This is just a very simple hash for demo purposes
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString(16);
    }
    
    // Generate a token
    function generateToken(user) {
        const now = new Date();
        const expires = new Date(now);
        expires.setDate(expires.getDate() + 1); // 1 day expiration
        
        const tokenData = {
            id: user.id,
            email: user.email,
            expires: expires.getTime()
        };
        
        return btoa(JSON.stringify(tokenData)); // Base64 encode
    }
    
    // Verify a token
    function verifyToken(token) {
        try {
            const tokenData = JSON.parse(atob(token)); // Base64 decode
            
            // Check if token is expired
            if (tokenData.expires < new Date().getTime()) {
                return null;
            }
            
            return tokenData;
        } catch (error) {
            console.error("Error verifying token:", error);
            return null;
        }
    }
    
    // Register a new user
    function register(userData) {
        // Validate required fields
        if (!userData.firstName || !userData.lastName || !userData.email || !userData.phone || !userData.password) {
            return {
                success: false,
                message: 'All fields are required'
            };
        }
        
        // Get existing users
        const users = getUsers();
        
        // Check if email already exists
        if (users.some(user => user.email === userData.email)) {
            return {
                success: false,
                message: 'Email already in use'
            };
        }
        
        // Create new user object
        const newUser = {
            id: Date.now().toString(),
            firstName: userData.firstName,
            lastName: userData.lastName,
            email: userData.email,
            phone: userData.phone,
            password: hashPassword(userData.password),
            createdAt: new Date().toISOString()
        };
        
        // Add to users array
        users.push(newUser);
        
        // Save to local storage
        saveUsers(users);
        
        // Remove password from return value
        const { password, ...userWithoutPassword } = newUser;
        
        return {
            success: true,
            message: 'Registration successful',
            user: userWithoutPassword
        };
    }
    
    // Login a user
    function login(credentials) {
        try {
            // Validate required fields
            if (!credentials.email || !credentials.password) {
                return {
                    success: false,
                    message: 'Email and password are required'
                };
            }
            
            console.log("Login attempt for:", credentials.email);
            
            // Get existing users
            const users = getUsers();
            console.log("Found users:", users.length);
            
            // Find user by email
            const user = users.find(u => u.email === credentials.email);
            console.log("User found:", !!user);
            
            // Hash the provided password for comparison
            const hashedPassword = hashPassword(credentials.password);
            console.log("Comparing passwords:", 
                user ? (user.password === hashedPassword ? "match" : "no match") : "no user");
            
            // Check if user exists and password matches
            if (!user || user.password !== hashedPassword) {
                return {
                    success: false,
                    message: 'Invalid email or password'
                };
            }
            
            // Generate token
            const token = generateToken(user);
            
            // Store session in local storage
            const session = {
                user: {
                    id: user.id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    phone: user.phone,
                    createdAt: user.createdAt
                },
                token: token,
                timestamp: new Date().getTime()
            };
            
            console.log("Setting session:", session);
            localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
            
            return {
                success: true,
                message: 'Login successful',
                user: session.user,
                token: token
            };
        } catch (error) {
            console.error("Login error:", error);
            return {
                success: false,
                message: 'An error occurred during login: ' + error.message
            };
        }
    }
    
    // Logout the current user
    function logout() {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        return {
            success: true,
            message: 'Logout successful'
        };
    }
    
    // Get the current user session
    function getCurrentSession() {
        try {
            const sessionData = localStorage.getItem(SESSION_STORAGE_KEY);
            if (!sessionData) {
                return null;
            }
            
            const session = JSON.parse(sessionData);
            
            // Verify token is still valid
            const tokenData = verifyToken(session.token);
            if (!tokenData) {
                localStorage.removeItem(SESSION_STORAGE_KEY);
                return null;
            }
            
            return session;
        } catch (error) {
            console.error("Error getting current session:", error);
            return null;
        }
    }
    
    // Check if user is logged in
    function isLoggedIn() {
        return getCurrentSession() !== null;
    }
    
    // Get all users (for admin/operator purposes)
    function getAllUsers() {
        try {
            const users = getUsers();
            
            // Remove sensitive information (passwords) before returning
            return users.map(user => {
                const { password, ...userWithoutPassword } = user;
                return userWithoutPassword;
            });
        } catch (error) {
            console.error("Error getting all users:", error);
            return [];
        }
    }
    
    // Get current user
    function getCurrentUser() {
        const session = getCurrentSession();
        return session ? session.user : null;
    }
    
    // Update UI elements based on authentication state
    function updateUI() {
        const isAuthenticated = isLoggedIn();
        const user = getCurrentUser();
        
        console.log("SimpleAuth: Updating UI based on auth state:", isAuthenticated);
        
        // Update login/logout buttons
        const loginButtons = document.querySelectorAll('.login-button, .signin-button');
        const signupButtons = document.querySelectorAll('.signup-button');
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
        
        // Signup buttons
        signupButtons.forEach(button => {
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
                    location.reload(); // Reload page after logout
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
        if (isAuthenticated && user) {
            userDisplayElements.forEach(element => {
                if (element.classList.contains('user-name')) {
                    element.textContent = `${user.firstName} ${user.lastName}`;
                } else if (element.classList.contains('user-email')) {
                    element.textContent = user.email;
                } else {
                    element.textContent = user.firstName;
                }
                element.style.display = '';
            });
        } else {
            userDisplayElements.forEach(element => {
                element.style.display = 'none';
            });
        }
    }

    // Set up event listeners for UI update
    function setupEventListeners() {
        document.addEventListener('DOMContentLoaded', function() {
            updateUI();
        });
    }

    // Initialize
    function init() {
        // Check if localStorage is available
        if (!isLocalStorageAvailable()) {
            console.error("localStorage is not available. Authentication will not work.");
            return false;
        }
        
        // Create demo user if no users exist
        const users = getUsers();
        if (users.length === 0) {
            // Create a demo user
            console.log("Creating demo user");
            register({
                firstName: "Demo",
                lastName: "User",
                email: "demo@example.com",
                phone: "1234567890",
                password: "password"
            });
        }
        
        // Set up event listeners
        setupEventListeners();
        
        return true;
    }

    // Initialize on load
    init();
    
    // Public API
    return {
        register,
        login,
        logout,
        isLoggedIn,
        getCurrentUser,
        getCurrentSession,
        updateUI,
        getAllUsers,
        deleteUser: function(userId) {
            try {
                // Get existing users
                const users = getUsers();
                
                // Find the user index
                const userIndex = users.findIndex(user => user.id === userId);
                
                // If user doesn't exist, return false
                if (userIndex === -1) {
                    return false;
                }
                
                // Check if user is logged in and force logout
                const sessionData = localStorage.getItem(SESSION_STORAGE_KEY);
                if (sessionData) {
                    try {
                        const session = JSON.parse(sessionData);
                        if (session.user && session.user.id === userId) {
                            // Remove the session if it belongs to this user
                            localStorage.removeItem(SESSION_STORAGE_KEY);
                        }
                    } catch (e) {
                        console.error("Error checking session during delete:", e);
                    }
                }
                
                // Remove the user from the array
                users.splice(userIndex, 1);
                
                // Save the updated users array
                const saveSuccessful = saveUsers(users);
                
                return saveSuccessful;
            } catch (error) {
                console.error("Error deleting user:", error);
                return false;
            }
        }
    };
})();

// Make available globally
window.SimpleAuth = SimpleAuth; 