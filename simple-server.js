const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const port = 8080;
const USERS_STORAGE_FILE = './users.json';

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
};

// Helper function to read users from JSON file
function getUsers() {
    try {
        if (fs.existsSync(USERS_STORAGE_FILE)) {
            const data = fs.readFileSync(USERS_STORAGE_FILE, 'utf8');
            return JSON.parse(data);
        }
        return [];
    } catch (error) {
        console.error('Error reading users file:', error);
        return [];
    }
}

// Helper function to save users to JSON file
function saveUsers(users) {
    try {
        fs.writeFileSync(USERS_STORAGE_FILE, JSON.stringify(users, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving users file:', error);
        return false;
    }
}

const server = http.createServer((req, res) => {
    console.log(`Request: ${req.method} ${req.url}`);
    
    const parsedUrl = url.parse(req.url, true);
    
    // API endpoints
    if (parsedUrl.pathname === '/api/users' && req.method === 'GET') {
        // Get all users
        const users = getUsers();
        
        // Remove sensitive information (passwords) before sending
        const safeUsers = users.map(user => {
            const { password, ...userWithoutPassword } = user;
            return userWithoutPassword;
        });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, users: safeUsers }));
        return;
    } 
    else if (parsedUrl.pathname === '/api/auth/signup' && req.method === 'POST') {
        // Handle user registration
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                const userData = JSON.parse(body);
                
                // Validate required fields
                if (!userData.firstName || !userData.lastName || !userData.email || !userData.phone || !userData.password) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: 'All fields are required'
                    }));
                    return;
                }
                
                // Get existing users
                const users = getUsers();
                
                // Check if email already exists
                if (users.some(user => user.email === userData.email)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: 'Email already in use'
                    }));
                    return;
                }
                
                // Create new user object
                const newUser = {
                    id: Date.now().toString(),
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    email: userData.email,
                    phone: userData.phone,
                    password: userData.password, // In a real app, hash this password
                    createdAt: new Date().toISOString()
                };
                
                // Add to users array
                users.push(newUser);
                
                // Save to JSON file
                saveUsers(users);
                
                // Remove password from return value
                const { password, ...userWithoutPassword } = newUser;
                
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'Registration successful',
                    user: userWithoutPassword
                }));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Invalid request data'
                }));
            }
        });
        return;
    } 
    else if (parsedUrl.pathname === '/api/auth/login' && req.method === 'POST') {
        // Handle user login
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                const credentials = JSON.parse(body);
                
                // Validate required fields
                if (!credentials.email || !credentials.password) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: 'Email and password are required'
                    }));
                    return;
                }
                
                // Get existing users
                const users = getUsers();
                
                // Find user by email
                const user = users.find(u => u.email === credentials.email);
                
                // Check if user exists and password matches
                if (!user || user.password !== credentials.password) {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: 'Invalid email or password'
                    }));
                    return;
                }
                
                // Remove password from return value
                const { password, ...userWithoutPassword } = user;
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'Login successful',
                    user: userWithoutPassword
                }));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Invalid request data'
                }));
            }
        });
        return;
    }
    else if (parsedUrl.pathname === '/api/users/sync' && req.method === 'POST') {
        // Handle syncing users from client to server
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                
                if (!data.users || !Array.isArray(data.users)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: 'Invalid user data format'
                    }));
                    return;
                }
                
                // Get existing server users
                const serverUsers = getUsers();
                
                // Track stats for response
                let stats = {
                    added: 0,
                    updated: 0,
                    skipped: 0
                };
                
                // Process each user from client
                data.users.forEach(clientUser => {
                    // Skip if missing required fields
                    if (!clientUser.email) {
                        stats.skipped++;
                        return;
                    }
                    
                    // Look for existing user by email
                    const existingUserIndex = serverUsers.findIndex(u => u.email === clientUser.email);
                    
                    if (existingUserIndex >= 0) {
                        // Update existing user
                        // Preserve the password if not provided
                        if (!clientUser.password) {
                            clientUser.password = serverUsers[existingUserIndex].password;
                        }
                        
                        serverUsers[existingUserIndex] = {
                            ...serverUsers[existingUserIndex],
                            ...clientUser,
                            updatedAt: new Date().toISOString()
                        };
                        
                        stats.updated++;
                    } else {
                        // Add new user
                        serverUsers.push({
                            ...clientUser,
                            id: clientUser.id || Date.now().toString(),
                            createdAt: clientUser.createdAt || new Date().toISOString()
                        });
                        
                        stats.added++;
                    }
                });
                
                // Save updated users to server
                saveUsers(serverUsers);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: `Sync complete: ${stats.added} added, ${stats.updated} updated, ${stats.skipped} skipped`,
                    stats: stats
                }));
            } catch (error) {
                console.error('Error syncing users:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Server error: ' + error.message
                }));
            }
        });
        return;
    }
    else if (parsedUrl.pathname.match(/^\/api\/users\/\w+$/) && req.method === 'DELETE') {
        // Handle user deletion
        try {
            // Extract user ID from URL
            const userId = parsedUrl.pathname.split('/').pop();
            
            // Get existing users
            const users = getUsers();
            
            // Find the user index
            const userIndex = users.findIndex(user => user.id === userId);
            
            // If user doesn't exist, return 404
            if (userIndex === -1) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'User not found'
                }));
                return;
            }
            
            // Remove the user from the array
            users.splice(userIndex, 1);
            
            // Save the updated users array
            const saveSuccessful = saveUsers(users);
            
            if (saveSuccessful) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'User deleted successfully'
                }));
            } else {
                throw new Error('Failed to save users after deletion');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Server error: ' + error.message
            }));
        }
        return;
    }
    
    // Serve static files
    let filePath = '.' + parsedUrl.pathname;
    if (filePath === './') {
        filePath = './laundary.html'; // Default page
    }
    
    // Get file extension
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';
    
    // Read file
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // File not found
                console.log(`File not found: ${filePath}`);
                res.writeHead(404);
                res.end('404 Not Found: ' + filePath);
            } else {
                // Server error
                console.log(`Server error: ${error.code}`);
                res.writeHead(500);
                res.end('Server Error: ' + error.code);
            }
        } else {
            // Success
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
    console.log('To use the authentication system, try these pages:');
    console.log(`- http://localhost:${port}/reset-user.html (to reset the demo user)`);
    console.log(`- http://localhost:${port}/simple-login.html (to login)`);
    console.log(`- http://localhost:${port}/storage-debug.html (to debug localStorage)`);
    console.log(`- http://localhost:${port}/operator-customers.html (to manage customers)`);
}); 