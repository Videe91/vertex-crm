# VERTEX CRM - Lead Management System

A modern CRM application built with React 18, TypeScript, and Vite frontend connected to an Express.js backend.

## 🚀 Features

- **Modern Tech Stack**: React 18 + TypeScript + Vite
- **Beautiful UI**: Tailwind CSS with dark theme
- **Authentication**: JWT-based login system
- **Role-based Access**: Support for multiple user roles
- **API Integration**: Seamless backend connectivity
- **Responsive Design**: Works on all devices

## 📋 Prerequisites

- Node.js (v18 or higher)
- npm or yarn

## 🛠️ Installation & Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Create environment file**:
   Create a `.env` file in the root directory:
   ```
   VITE_API_URL=http://localhost:3000/api
   ```

3. **Start the backend server**:
   ```bash
   npm run server:dev
   ```
   The backend will run on `http://localhost:3000`

4. **Start the frontend development server** (in a new terminal):
   ```bash
   npm run dev
   ```
   The frontend will run on `http://localhost:5173`

## 🎯 Usage

1. **Access the application**: Open `http://localhost:5173` in your browser
2. **Login**: Use your VERTEX CRM credentials
3. **Dashboard**: After successful login, you'll be redirected to the dashboard

## 📂 Project Structure

```
vertex_crm/
├── src/                    # React frontend source
│   ├── components/         # Reusable components
│   ├── contexts/          # React contexts (Auth)
│   ├── pages/             # Page components
│   ├── services/          # API services
│   └── main.tsx           # Entry point
├── server.js              # Express backend
├── public/                # Static assets
└── dist/                  # Built frontend
```

## 🔧 Scripts

- `npm run dev` - Start frontend development server
- `npm run build` - Build frontend for production
- `npm run preview` - Preview production build
- `npm run server` - Start backend server
- `npm run server:dev` - Start backend with nodemon
- `npm run lint` - Run ESLint

## 🔐 Authentication

The application uses JWT tokens for authentication:
- Tokens are stored in `localStorage`
- Automatic token validation on app load
- Protected routes redirect to login if not authenticated

## 🎨 Design

The login page features:
- Dark theme with gradient background
- Glass morphism effects
- Lucide React icons
- Responsive design
- Trust indicators and branding elements

## 🔌 API Integration

Frontend communicates with the backend via:
- RESTful API endpoints
- JWT authentication headers
- CORS-enabled requests
- Error handling and user feedback

## 🚀 Deployment

1. Build the frontend:
   ```bash
   npm run build
   ```

2. Serve the built files with your preferred static file server

3. Ensure the backend is running and accessible

## 📞 Support

For issues or questions, contact the development team.

