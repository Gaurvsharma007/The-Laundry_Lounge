const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');
const crypto = require('crypto');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const server = http.createServer(app);

// Configure socket.io with CORS support
const io = socketIo(server, {
    cors: {
        origin: "*", // Allow all origins
        methods: ["GET", "POST", "PUT", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true
    }
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, './')));

// Enable CORS for all routes
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// --------- User Authentication ----------
// Simple in-memory user storage (replace with database in production)
const USERS_FILE = path.join(__dirname, 'users.json');

// Create users.json if it doesn't exist
if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2), 'utf8');
    console.log("Created new users.json file");
}

function readUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const usersData = fs.readFileSync(USERS_FILE, 'utf8');
      return JSON.parse(usersData);
    }
    return [];
  } catch (error) {
    console.error('Error reading users file:', error);
    return [];
  }
}

function writeUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    console.log("Users written to file, count:", users.length);
    return true;
  } catch (error) {
    console.error('Error writing users file:', error);
    return false;
  }
}

// Load users from file
let users = readUsers();
console.log(`Loaded ${users.length} users from storage`);

// Add demo user if no users exist
if (users.length === 0) {
    users = [
        {
            id: '1',
            firstName: 'Test',
            lastName: 'User',
            email: 'test@example.com',
            phone: '1234567890',
            password: 'password', // Store hashed passwords in production
            createdAt: new Date().toISOString()
        }
    ];
    writeUsers(users);
    console.log("Created demo user");
}

// Add these constants for token generation
const TOKEN_SECRET = 'laundry-service-secret-key';
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Replace the existing simple password check with a secure hash function
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  const verifiedHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verifiedHash;
}

// Simple token generator and verifier instead of JWT
function generateToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    exp: Date.now() + TOKEN_EXPIRY
  };
  
  // Simple encryption as a JWT alternative (not as secure, but works without dependencies)
  const data = JSON.stringify(payload);
  const cipher = crypto.createCipher('aes-256-cbc', TOKEN_SECRET);
  let token = cipher.update(data, 'utf8', 'hex');
  token += cipher.final('hex');
  
  return token;
}

function verifyToken(token) {
  try {
    // Decrypt token
    const decipher = crypto.createDecipher('aes-256-cbc', TOKEN_SECRET);
    let decrypted = decipher.update(token, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    const payload = JSON.parse(decrypted);
    
    // Check if token is expired
    if (payload.exp < Date.now()) {
      return null;
    }
    
    return payload;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

// Add authentication middleware
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required'
    });
  }
  
  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);
  
  if (!payload) {
    return res.status(403).json({ 
      success: false, 
      message: 'Invalid or expired token'
    });
  }
  
  req.user = payload;
  next();
}

// API Routes for Authentication
// User Registration
app.post('/api/auth/signup', (req, res) => {
    console.log("POST /api/auth/signup - Creating new user");
    const { firstName, lastName, email, phone, password } = req.body;
    
    // Validate required fields
    if (!firstName || !lastName || !email || !phone || !password) {
        return res.status(400).json({ 
            success: false, 
            message: 'All fields are required' 
        });
    }
    
    // Check if email already exists
    const existingUser = users.find(user => user.email === email);
    if (existingUser) {
        return res.status(400).json({ 
            success: false, 
            message: 'Email already in use' 
        });
    }
    
    // Hash password with secure method
    const { hash, salt } = hashPassword(password);
    
    // Create new user
    const newUser = {
        id: Date.now().toString(),
        firstName,
        lastName,
        email,
        phone,
        password: hash,
        salt: salt,
        createdAt: new Date().toISOString()
    };
    
    // Add to users array
    users.push(newUser);
    
    // Save to file
    writeUsers(users);
    
    // Return success (exclude password and salt from response)
    const { password: _, salt: __, ...userWithoutPassword } = newUser;
    
    res.status(201).json({
        success: true,
        message: 'User registered successfully',
        user: userWithoutPassword
    });
});

// User Login
app.post('/api/auth/login', (req, res) => {
    console.log("POST /api/auth/login - User login attempt");
    const { email, password } = req.body;
    
    // Validate required fields
    if (!email || !password) {
        return res.status(400).json({ 
            success: false, 
            message: 'Email and password are required' 
        });
    }
    
    // Find user by email
    const user = users.find(user => user.email === email);
    
    // Check if user exists and password matches
    if (!user || !verifyPassword(password, user.password, user.salt)) {
        return res.status(401).json({ 
            success: false, 
            message: 'Invalid email or password' 
        });
    }
    
    // Generate token
    const token = generateToken(user);
    
    // Return success (exclude password and salt from response)
    const { password: _, salt: __, ...userWithoutPassword } = user;
    
    res.status(200).json({
        success: true,
        message: 'Login successful',
        user: userWithoutPassword,
        token
    });
});

// Get current user
app.get('/api/auth/me', authenticateJWT, (req, res) => {
    console.log("GET /api/auth/me - Getting current user");
    
    // Find user by ID (from token)
    const user = users.find(user => user.id === req.user.id);
    
    if (!user) {
        return res.status(404).json({ 
            success: false, 
            message: 'User not found' 
        });
    }
    
    // Return user data (exclude password and salt)
    const { password, salt, ...userWithoutPassword } = user;
    
    res.status(200).json({
        success: true,
        user: userWithoutPassword
    });
});

// Add a route to update user profile
app.put('/api/auth/profile', authenticateJWT, (req, res) => {
    console.log("PUT /api/auth/profile - Updating user profile");
    const { firstName, lastName, phone } = req.body;
    
    // Find user by ID (from token)
    const userIndex = users.findIndex(user => user.id === req.user.id);
    
    if (userIndex === -1) {
        return res.status(404).json({ 
            success: false, 
            message: 'User not found' 
        });
    }
    
    // Update user data (only allowed fields)
    if (firstName) users[userIndex].firstName = firstName;
    if (lastName) users[userIndex].lastName = lastName;
    if (phone) users[userIndex].phone = phone;
    
    // Save to file
    writeUsers(users);
    
    // Return updated user (exclude password and salt)
    const { password, salt, ...userWithoutPassword } = users[userIndex];
    
    res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        user: userWithoutPassword
    });
});

// Add a route to change password
app.put('/api/auth/password', authenticateJWT, (req, res) => {
    console.log("PUT /api/auth/password - Changing user password");
    const { currentPassword, newPassword } = req.body;
    
    // Validate required fields
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ 
            success: false, 
            message: 'Current password and new password are required' 
        });
    }
    
    // Find user by ID (from token)
    const userIndex = users.findIndex(user => user.id === req.user.id);
    
    if (userIndex === -1) {
        return res.status(404).json({ 
            success: false, 
            message: 'User not found' 
        });
    }
    
    // Verify current password
    if (!verifyPassword(currentPassword, users[userIndex].password, users[userIndex].salt)) {
        return res.status(401).json({ 
            success: false, 
            message: 'Current password is incorrect' 
        });
    }
    
    // Hash new password
    const { hash, salt } = hashPassword(newPassword);
    
    // Update password and salt
    users[userIndex].password = hash;
    users[userIndex].salt = salt;
    
    // Save to file
    writeUsers(users);
    
    res.status(200).json({
        success: true,
        message: 'Password changed successfully'
    });
});

// --------- End User Authentication ----------

// Read/Write orders.json file
const ORDERS_FILE = path.join(__dirname, 'orders.json');

// Create orders.json if it doesn't exist
if (!fs.existsSync(ORDERS_FILE)) {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify([], null, 2), 'utf8');
    console.log("Created new orders.json file");
}

function readOrders() {
  try {
    if (fs.existsSync(ORDERS_FILE)) {
      const ordersData = fs.readFileSync(ORDERS_FILE, 'utf8');
      return JSON.parse(ordersData);
    }
    return [];
  } catch (error) {
    console.error('Error reading orders file:', error);
    return [];
  }
}

function writeOrders(orders) {
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
    console.log("Orders written to file, count:", orders.length);
    return true;
  } catch (error) {
    console.error('Error writing orders file:', error);
    return false;
  }
}

// Load orders from file or initialize with sample data
let orders = readOrders();
console.log(`Loaded ${orders.length} orders from storage`);

// If no orders in file, use sample data
if (orders.length === 0) {
    orders = [
        {
            id: 'ORD1234567',
            createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
            expectedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
            status: 'processing',
            statusHistory: {
                pending: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
                processing: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
            },
            totalAmount: 45.50,
            customer: {
                name: 'John Doe',
                phone: '555-123-4567',
                address: '123 Main St, Anytown, CA 12345',
                email: 'test@example.com'
            },
            pickup: {
                date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
                timeSlot: '10:00 AM - 12:00 PM',
                specialInstructions: 'Please call when you arrive.'
            },
            services: [
                { name: 'Wash & Fold', quantity: 3, price: 10.00 },
                { name: 'Dry Cleaning', quantity: 2, price: 7.75 }
            ]
        },
        {
            id: 'ORD7654321',
            createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
            expectedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
            status: 'pending',
            statusHistory: {
                pending: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
            },
            totalAmount: 28.75,
            customer: {
                name: 'Jane Smith',
                phone: '555-987-6543',
                address: '456 Oak Ave, Somewhere, NY 54321',
                email: 'user@example.com'
            },
            pickup: {
                date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
                timeSlot: '2:00 PM - 4:00 PM'
            },
            services: [
                { name: 'Wash & Fold', quantity: 2, price: 10.00 },
                { name: 'Ironing', quantity: 3, price: 2.25 }
            ]
        },
        {
            id: 'ORD9876543',
            createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
            expectedDelivery: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
            status: 'completed',
            statusHistory: {
                pending: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                processing: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
                ready: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                completed: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
            },
            totalAmount: 67.25,
            customer: {
                name: 'Robert Johnson',
                phone: '555-555-5555',
                address: '789 Pine Blvd, Elsewhere, TX 98765',
                email: 'test@example.com'
            },
            pickup: {
                date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                timeSlot: '9:00 AM - 11:00 AM'
            },
            services: [
                { name: 'Wash & Fold', quantity: 4, price: 10.00 },
                { name: 'Dry Cleaning', quantity: 3, price: 7.75 },
                { name: 'Ironing', quantity: 2, price: 2.25 }
            ]
        }
    ];
    // Save the sample orders to file
    writeOrders(orders);
    console.log("Created sample orders");
}

// API Routes
// Get all orders
app.get('/api/orders', (req, res) => {
    console.log("GET /api/orders - Returning all orders");
    res.json(orders);
});

// Get order by ID
app.get('/api/orders/:id', (req, res) => {
    console.log(`GET /api/orders/${req.params.id} - Searching for order`);
    const order = orders.find(o => o.id === req.params.id);
    if (!order) {
        console.log(`Order ${req.params.id} not found`);
        return res.status(404).json({ message: 'Order not found' });
    }
    console.log(`Returning order ${req.params.id}`);
    res.json(order);
});

// Create new order
app.post('/api/orders', (req, res) => {
    console.log("POST /api/orders - Creating new order");
    const newOrder = req.body;
    
    // Generate order ID if not provided
    if (!newOrder.id) {
        const orderId = 'ORD' + Math.floor(1000000 + Math.random() * 9000000);
        newOrder.id = orderId;
        console.log(`Generated order ID: ${orderId}`);
    }
    
    // Set created date if not provided
    if (!newOrder.createdAt) {
        newOrder.createdAt = new Date().toISOString();
    }
    
    // Set expected delivery if not provided (3 days from now)
    if (!newOrder.expectedDelivery) {
        newOrder.expectedDelivery = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    }
    
    // Set initial status if not provided
    if (!newOrder.status) {
        newOrder.status = 'pending';
    }
    
    // Set status history if not provided
    if (!newOrder.statusHistory) {
        newOrder.statusHistory = {
            pending: new Date().toISOString()
        };
    }
    
    // Check if order with same ID already exists
    const existingIndex = orders.findIndex(o => o.id === newOrder.id);
    if (existingIndex !== -1) {
        // Replace existing order
        console.log(`Replacing existing order with ID ${newOrder.id}`);
        orders[existingIndex] = newOrder;
    } else {
        // Add order to the array
        console.log(`Adding new order with ID ${newOrder.id}`);
        orders.push(newOrder);
    }
    
    // Save to file
    writeOrders(orders);
    
    // Emit socket event for new order
    console.log(`Emitting orderCreated event for order ${newOrder.id}`);
    io.emit('orderCreated', newOrder);
    
    res.status(201).json(newOrder);
});

// Update order status
app.put('/api/orders/:id/status', (req, res) => {
    console.log(`PUT /api/orders/${req.params.id}/status - Updating status to ${req.body.status}`);
    const { status } = req.body;
    const order = orders.find(o => o.id === req.params.id);
    
    if (!order) {
        console.log(`Order ${req.params.id} not found`);
        return res.status(404).json({ message: 'Order not found' });
    }
    
    // Update status
    order.status = status;
    
    // Update status history
    if (!order.statusHistory) {
        order.statusHistory = {};
    }
    order.statusHistory[status] = new Date().toISOString();
    
    // Save to file
    writeOrders(orders);
    
    // Emit socket event for status update
    console.log(`Emitting statusUpdated event for order ${order.id} with status ${status}`);
    io.emit('statusUpdated', { id: order.id, status });
    
    res.json(order);
});

// Update order
app.put('/api/orders/:id', (req, res) => {
    console.log(`PUT /api/orders/${req.params.id} - Updating order`);
    const updatedOrder = req.body;
    const orderIndex = orders.findIndex(o => o.id === req.params.id);
    
    if (orderIndex === -1) {
        console.log(`Order ${req.params.id} not found`);
        return res.status(404).json({ message: 'Order not found' });
    }
    
    // Preserve the original ID
    updatedOrder.id = req.params.id;
    
    // Update order in array
    orders[orderIndex] = updatedOrder;
    
    // Save to file
    writeOrders(orders);
    
    // Emit socket event for order update
    console.log(`Emitting orderUpdated event for order ${updatedOrder.id}`);
    io.emit('orderUpdated', updatedOrder);
    
    res.json(updatedOrder);
});

// Delete order
app.delete('/api/orders/:id', (req, res) => {
    console.log(`DELETE /api/orders/${req.params.id} - Deleting order`);
    const orderIndex = orders.findIndex(o => o.id === req.params.id);
    
    if (orderIndex === -1) {
        console.log(`Order ${req.params.id} not found`);
        return res.status(404).json({ message: 'Order not found' });
    }
    
    // Remove order from array
    const deletedOrder = orders.splice(orderIndex, 1)[0];
    
    // Save to file
    writeOrders(orders);
    
    // Emit socket event for order deletion
    console.log(`Emitting orderDeleted event for order ${req.params.id}`);
    io.emit('orderDeleted', { id: req.params.id });
    
    res.json(deletedOrder);
});

// Add protected routes for laundry orders
app.get('/api/orders/me', authenticateJWT, (req, res) => {
    console.log("GET /api/orders/me - Getting user's orders");
    
    // Read all orders
    const orders = readOrders();
    
    // Filter orders by user ID
    const userOrders = orders.filter(order => 
        order.customer && order.customer.email === req.user.email
    );
    
    res.status(200).json({
        success: true,
        orders: userOrders
    });
});

// Only authenticated users can create orders (optional, can be uncommented)
/*
app.post('/api/orders', authenticateJWT, (req, res) => {
    // ... existing order creation code ...
});
*/

// Update the socket.io connection to use custom token verification
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
        return next(new Error('Authentication token required'));
    }
    
    const payload = verifyToken(token);
    if (!payload) {
        return next(new Error('Invalid or expired token'));
    }
    
    socket.user = payload;
    next();
});

// Serve HTML files directly
app.get('/:file.html', (req, res) => {
    const filePath = path.join(__dirname, req.params.file + '.html');
    console.log(`Serving HTML file: ${filePath}`);
    res.sendFile(filePath);
});

// Fallback route to serve the main HTML file
app.get('*', (req, res) => {
    console.log('Serving main page (laundary.html)');
    res.sendFile(path.join(__dirname, 'laundary.html'));
});

// Completely rewritten server start logic
const findAvailablePort = (startPort) => {
  return new Promise((resolve, reject) => {
    const testServer = http.createServer();
    
    testServer.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        // Port is in use, try the next port
        testServer.close(() => {
          resolve(findAvailablePort(startPort + 1));
        });
      } else {
        reject(err);
      }
    });
    
    testServer.once('listening', () => {
      // Found an available port
      const port = testServer.address().port;
      testServer.close(() => {
        resolve(port);
      });
    });
    
    testServer.listen(startPort);
    });
};

// Start the server
(async () => {
  try {
const PORT = process.env.PORT || 3001;
    const availablePort = await findAvailablePort(PORT);
    
    server.listen(availablePort, () => {
      console.log(`Server is running on port ${availablePort}`);
      console.log(`Open http://localhost:${availablePort} in your browser`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
  }
})();

// Gemini API proxy route to avoid CORS issues
app.post('/api/gemini', async (req, res) => {
  try {
    const { apiKey, requestData } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }
    
    console.log('Proxying request to Gemini API');
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      }
    );
    
    const data = await response.json();
    
    // Forward the response from the Gemini API
    return res.json(data);
  } catch (error) {
    console.error('Error in Gemini API proxy:', error);
    return res.status(500).json({ error: 'Failed to proxy request to Gemini API' });
  }
});

// Order API endpoints
app.post('/api/orders', (req, res) => {
  const order = req.body;
  
  // Generate random order ID with LD prefix
  const orderId = `LD-${Math.floor(Math.random() * 1000000000)}`;
  
  // Normally would save to database
  console.log(`New order received: ${orderId}`, order);
  
  res.json({ 
    success: true, 
    message: 'Order created successfully', 
    orderId 
  });
}); 