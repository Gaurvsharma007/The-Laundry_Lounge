/**
 * Script to install authentication dependencies
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Installing authentication dependencies...');

try {
  // Check if package.json exists
  if (!fs.existsSync('package.json')) {
    console.error('Error: package.json not found. Please run this script from the project root directory.');
    process.exit(1);
  }

  // Install jsonwebtoken
  console.log('Installing jsonwebtoken...');
  execSync('npm install jsonwebtoken --save', { stdio: 'inherit' });

  // Check if server.js has jwt import
  const serverJsPath = path.join(process.cwd(), 'server.js');
  if (fs.existsSync(serverJsPath)) {
    let serverJsContent = fs.readFileSync(serverJsPath, 'utf8');
    
    if (!serverJsContent.includes('require(\'jsonwebtoken\')')) {
      console.log('Please make sure to update server.js to include JWT functionality.');
    }
  }

  // Check if users.js exists
  const usersJsPath = path.join(process.cwd(), 'users.js');
  if (!fs.existsSync(usersJsPath)) {
    console.log('Warning: users.js not found. Please create this file for client-side authentication.');
  }

  console.log('\nDependencies installed successfully!');
  console.log('\nTo start the server with authentication support, run:');
  console.log('npm run dev');
  
  console.log('\nMake sure to update the following files if you haven\'t already:');
  console.log('1. server.js - Add JWT authentication');
  console.log('2. users.js - Client-side authentication');
  console.log('3. login.html, signup.html - Connect to authentication system');
  
} catch (error) {
  console.error('Error installing dependencies:', error.message);
  process.exit(1);
} 