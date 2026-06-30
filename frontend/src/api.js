const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 
                 (isLocalhost ? '' : 'https://calllogiq-backend.onrender.com');

export default API_BASE;
