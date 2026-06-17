// Central API base URL
// In production (Vercel), reads from VITE_API_BASE_URL environment variable
// In local dev, falls back to '' (empty string) so Vite's proxy handles /api/* → localhost:5000

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export default API_BASE;
