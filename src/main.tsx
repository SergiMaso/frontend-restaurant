import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Debug logging for database connection
console.log('🚀 Frontend starting...');
console.log('Environment:', import.meta.env.MODE);
console.log('API URL:', import.meta.env.VITE_API_URL);

// Test database connection on startup
const testConnection = async () => {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  try {
    console.log('🔍 Testing database connection...');
    const response = await fetch(`${API_URL}/health`);
    console.log('Health check status:', response.status);
    const data = await response.json();
    console.log('Health check data:', data);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
  }
};

testConnection();

createRoot(document.getElementById("root")!).render(<App />);
