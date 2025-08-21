# FreshThreads Laundry Application

A full-stack web application for a laundry service with user authentication, email and phone verification, and a modern UI.

## Project Structure

```
/
├── laundary.html        # Main landing page
├── signup.html          # Login page
├── registration.html    # Registration page with multi-step form
├── verification.html    # Email & Phone verification page
├── backend/             # Backend server code
    ├── src/             # Source files
    ├── .env.example     # Environment variables template
    └── README.md        # Backend-specific documentation
```

## Features

### Frontend
- Modern, responsive UI with gradient design
- Multi-step registration process
- Form validation
- Interactive verification process
- Authentication state management
- Seamless API integration

### Backend
- Complete user authentication system
- Email verification with tokens
- Phone verification with OTP
- JWT-based authentication with refresh tokens
- Secure password hashing
- Input validation and sanitization
- Rate limiting for security
- MongoDB database integration
- RESTful API architecture

## Technology Stack

### Frontend
- HTML5, CSS3, JavaScript (Vanilla)
- Lucide Icons
- Responsive design with media queries
- Fetch API for server communication

### Backend
- Node.js & Express.js
- MongoDB & Mongoose
- JWT for authentication
- Nodemailer for email sending
- Twilio for SMS (with fallback mock)
- bcrypt for password hashing
- express-validator for input validation
- express-rate-limit for security
- Helmet for security headers

## Getting Started

### Prerequisites
- Node.js (v14.x or higher) and npm
- MongoDB (local installation or Atlas account)
- Code editor (VS Code recommended)

### Installation & Setup

1. Clone the repository or extract the project files

2. Install backend dependencies:
   ```bash
   cd backend
   npm init -y
   npm install bcryptjs cors dotenv express express-rate-limit express-validator jsonwebtoken mongoose nodemailer twilio helmet cookie-parser morgan uuid
   npm install --save-dev nodemon
   ```

3. Configure environment variables:
   - Copy `.env.example` to `.env` in the backend directory
   - Fill in required values for database, email, SMS, etc.

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open the application in your browser:
   ```
   http://localhost:5000
   ```

## API Documentation

See the [backend README](backend/README.md) for detailed API documentation.

## Development Notes

This application uses a combined approach where:
- The backend serves static HTML/CSS/JS files
- The backend also provides RESTful API endpoints
- Frontend JavaScript communicates with the API using fetch

## Security Features

- Password hashing with bcrypt
- JWT with HTTP-only cookies
- Email and phone verification
- Rate limiting to prevent abuse
- Input validation and sanitization
- Secure HTTP headers with Helmet
- CORS protection

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Author

FreshThreads Development Team 