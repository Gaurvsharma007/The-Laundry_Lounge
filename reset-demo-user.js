// Script to reset the demo user for SimpleAuth
(function() {
    console.log('Resetting demo user...');
    
    // Same hashing function as used in SimpleAuth.js
    function hashPassword(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString(16);
    }
    
    // Create the hashed password for 'password'
    const hashedPassword = hashPassword('password');
    console.log('Hashed password:', hashedPassword);
    
    // Clear existing users
    localStorage.removeItem('laundryUsers');
    
    // Create demo user
    const demoUser = {
        id: '1',
        firstName: 'Demo',
        lastName: 'User',
        email: 'demo@example.com',
        phone: '1234567890',
        password: hashedPassword, // Using the same hashing function
        createdAt: new Date().toISOString()
    };
    
    // Save to localStorage
    localStorage.setItem('laundryUsers', JSON.stringify([demoUser]));
    
    console.log('Demo user reset complete!');
    console.log('You can now login with:');
    console.log('Email: demo@example.com');
    console.log('Password: password');
    
    // Alert the user
    alert('Demo user has been reset! You can now login with demo@example.com / password');
})(); 