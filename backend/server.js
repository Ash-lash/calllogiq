require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Bypass SSL certificate validation for misconfigured government portals
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { exec, execSync } = require('child_process');
const db = require('./db');

// Auto-install python dependencies on startup if missing
try {
  console.log('Checking Python dependencies (pdfplumber, openpyxl)...');
  let pythonCmd = 'python';
  try {
    execSync('python --version', { stdio: 'ignore' });
  } catch (e) {
    pythonCmd = 'python3';
  }
  
  try {
    execSync(`${pythonCmd} -c "import pdfplumber, openpyxl"`, { stdio: 'ignore' });
    console.log('Python dependencies are already installed.');
  } catch (e) {
    console.log(`Python dependencies missing. Installing pdfplumber and openpyxl using ${pythonCmd}...`);
    execSync(`${pythonCmd} -m pip install pdfplumber openpyxl`, { stdio: 'inherit' });
    console.log('Python dependencies installed successfully.');
  }
} catch (err) {
  console.warn('Warning: Auto-installation of Python dependencies skipped or failed:', err.message);
}

const https = require('https');
const http = require('http');
const { fetch, ProxyAgent } = require('undici'); // Override global fetch to ensure undici version parity

// Global Scraper Proxy dispatcher and scraper API keys
let proxyDispatcher = null;
const scrapingAntApiKey = process.env.SCRAPINGANT_API_KEY || null;
let scrapingBeeApiKey = process.env.SCRAPINGBEE_API_KEY || null;
let scrapeDoApiKey = process.env.SCRAPE_DO_API_KEY || null;
const crawlbaseToken = process.env.CRAWLBASE_TOKEN || null;

if (process.env.SCRAPER_PROXY) {
  try {
    if (process.env.SCRAPER_PROXY.includes('scrapingbee.com')) {
      const parsed = new URL(process.env.SCRAPER_PROXY);
      scrapingBeeApiKey = scrapingBeeApiKey || parsed.username;
      console.log('Scraper proxy: ScrapingBee detected via SCRAPER_PROXY. Using direct REST API.');
    } else if (process.env.SCRAPER_PROXY.includes('scrape.do')) {
      const parsed = new URL(process.env.SCRAPER_PROXY);
      scrapeDoApiKey = scrapeDoApiKey || parsed.username;
      console.log('Scraper proxy: Scrape.do detected via SCRAPER_PROXY. Using direct REST API.');
    } else {
      proxyDispatcher = new ProxyAgent(process.env.SCRAPER_PROXY);
      console.log('Scraper proxy dispatcher initialized using:', process.env.SCRAPER_PROXY);
    }
  } catch (err) {
    console.error('Failed to initialize ProxyAgent/ScrapingBee/Scrape.do from SCRAPER_PROXY:', err.message);
  }
}

console.log('Scraper APIs Configured:', {
  ScrapingAnt: !!scrapingAntApiKey,
  Crawlbase: !!crawlbaseToken,
  ScrapingBee: !!scrapingBeeApiKey,
  'Scrape.do': !!scrapeDoApiKey,
  CustomProxyAgent: !!proxyDispatcher
});

// Cloudinary SDK Configuration
const cloudinary = require('cloudinary').v2;
const isCloudinaryConfigured = process.env.CLOUDINARY_CLOUD_NAME && 
                               process.env.CLOUDINARY_API_KEY && 
                               !process.env.CLOUDINARY_API_KEY.includes('YOUR_') &&
                               process.env.CLOUDINARY_API_SECRET;

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  console.log('Cloudinary SDK configured successfully.');
} else {
  console.log('Cloudinary configuration incomplete or using default placeholders. Running in Local file storage fallback mode.');
}

// Helper to extract Cloudinary public ID from URL
function extractCloudinaryPublicId(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('cloudinary.com')) {
      const pathname = parsed.pathname;
      const parts = pathname.split('/');
      const rawIdx = parts.indexOf('raw');
      const uploadIdx = parts.indexOf('upload');
      
      let startIdx = -1;
      if (rawIdx !== -1 && uploadIdx !== -1) {
        startIdx = Math.max(rawIdx, uploadIdx) + 1;
      } else if (uploadIdx !== -1) {
        startIdx = uploadIdx + 1;
      } else if (rawIdx !== -1) {
        startIdx = rawIdx + 1;
      }
      
      if (startIdx !== -1) {
        // Skip the version folder if it starts with 'v' and is numeric
        if (parts[startIdx] && parts[startIdx].startsWith('v') && !isNaN(parts[startIdx].substring(1))) {
          startIdx++;
        }
        return parts.slice(startIdx).join('/');
      }
    }
  } catch (err) {
    console.error('Error parsing Cloudinary URL:', err);
  }
  return null;
}

// Helper to fetch resource from URL following up to 5 redirects
function getStreamWithRedirects(url, callback, redirectCount = 0) {
  if (redirectCount > 5) {
    return callback(new Error('Too many redirects'));
  }
  
  // Auto-sign Cloudinary URLs to bypass Restricted PDF/ZIP delivery security check
  try {
    if (url.includes('cloudinary.com') && isCloudinaryConfigured && !url.includes('signature=')) {
      const pubId = extractCloudinaryPublicId(url);
      if (pubId) {
        const signedUrl = cloudinary.utils.private_download_url(pubId, null, {
          resource_type: 'raw',
          type: 'upload',
          expires_at: Math.floor(Date.now() / 1000) + 3600
        });
        console.log(`Auto-signed Cloudinary URL: ${signedUrl}`);
        return getStreamWithRedirects(signedUrl, callback, redirectCount + 1);
      }
    }
  } catch (signErr) {
    console.error('Failed to sign Cloudinary URL during stream:', signErr);
  }

  try {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept': '*/*'
      }
    };
    protocol.get(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (!redirectUrl.startsWith('http')) {
          redirectUrl = new URL(redirectUrl, url).toString();
        }
        getStreamWithRedirects(redirectUrl, callback, redirectCount + 1);
      } else {
        callback(null, res);
      }
    }).on('error', (err) => {
      callback(err);
    });
  } catch (err) {
    callback(err);
  }
}

// Helper to download a file from a URL to an in-memory buffer, following redirects and using headers
function downloadUrlToBuffer(url) {
  return new Promise((resolve, reject) => {
    getStreamWithRedirects(url, (err, res) => {
      if (err) return reject(err);
      if (res.statusCode >= 400) {
        return reject(new Error(`Server returned status code ${res.statusCode}`));
      }
      
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      res.on('error', (streamErr) => {
        reject(streamErr);
      });
    });
  });
}

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'calllogiq_super_secret_jwt_key_123';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'vtredusolutions@gmail.com').toLowerCase();

let migrationStatus = {
  inProgress: false,
  total: 0,
  current: 0,
  successCount: 0,
  alreadyMigrated: 0,
  errorCount: 0,
  errors: []
};

// Ensure uploads and output directories exist
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure Multer for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || path.extname(file.originalname).toLowerCase() === '.pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed!'), false);
    }
  }
});

// Configure Multer for image uploads
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'asset-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const imageUpload = multer({
  storage: imageStorage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/i;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) {
      cb(null, true);
    } else {
      cb(new Error('Only images (jpg, jpeg, png, webp) are allowed!'), false);
    }
  }
});

// Middleware for JWT Verification
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access token required' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// Middleware to verify Admin role
const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Access denied: Not an Admin' });
  }
};

// Generate a random 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Nodemailer SMTP Transporter
const nodemailer = require('nodemailer');
let mailTransporter = null;

if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  mailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    connectionTimeout: 5000, // 5 seconds connection timeout
    greetingTimeout: 5000,   // 5 seconds greeting timeout
    socketTimeout: 5000      // 5 seconds socket timeout
  });
  console.log('Real SMTP Mail Transporter configured.');
} else {
  console.log('SMTP configuration missing in .env. Running in Simulated OTP Mode.');
}

// Log a simulated email template to console (fallback)
function logSimulatedEmail(email, otp) {
  console.log('\n┌────────────────────────────────────────────────────────┐');
  console.log(`│  SIMULATED EMAIL SENT TO: ${email.padEnd(29)} │`);
  console.log(`│  OTP CODE: ${otp}                                       │`);
  console.log(`│  This code is valid for 10 minutes.                    │`);
  console.log('└────────────────────────────────────────────────────────┘\n');
}

// Send OTP Email (Resend Web API, falling back to SMTP, falling back to Console)
async function sendOTPEmail(email, otp) {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 480px;">
      <h2 style="color: #4f46e5; margin-bottom: 10px;">CallLogIQ Verification</h2>
      <p style="color: #475569; font-size: 16px;">Hello,</p>
      <p style="color: #475569; font-size: 16px;">Your verification OTP code is:</p>
      <div style="background-color: #f1f5f9; padding: 15px; border-radius: 8px; font-size: 28px; font-weight: bold; letter-spacing: 4px; text-align: center; margin: 20px 0; color: #0f172a;">
        ${otp}
      </div>
      <p style="color: #94a3b8; font-size: 14px;">This code is valid for 10 minutes. If you did not request this, you can safely ignore this email.</p>
    </div>
  `;

  // 1. Try Resend API if API Key is configured
  if (process.env.RESEND_API_KEY) {
    try {
      console.log('Attempting to send OTP email via Resend API...');
      const fromEmail = process.env.RESEND_FROM || "CallLogIQ <onboarding@resend.dev>";
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromEmail,
          to: email,
          subject: 'Your CallLogIQ Verification OTP Code',
          html: htmlContent
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || JSON.stringify(result));
      }
      console.log(`OTP Email sent to ${email} via Resend API successfully.`);
      return true;
    } catch (err) {
      console.error('Resend API email sending failed, trying SMTP fallback:', err.message);
    }
  }

  // 2. Fallback to Nodemailer SMTP
  if (mailTransporter) {
    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || `"CallLogIQ" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Your CallLogIQ Verification OTP Code',
        text: `Your CallLogIQ verification code is ${otp}. It is valid for 10 minutes.`,
        html: htmlContent
      };
      await mailTransporter.sendMail(mailOptions);
      console.log(`OTP Email sent to ${email} via SMTP.`);
      return true;
    } catch (err) {
      console.error('SMTP Email sending failed, falling back to console:', err);
      logSimulatedEmail(email, otp);
      return false;
    }
  } else {
    logSimulatedEmail(email, otp);
    return true;
  }
}

// Send Watchlist Alert Email to admin(s)
async function sendWatchlistAlertEmail(siteName, siteUrl, changeTitle, description) {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; padding: 24px; border: 2px solid #0f172a; border-radius: 16px; max-width: 580px; background-color: #ffffff; color: #0f172a; box-shadow: 4px 4px 0px #0f172a;">
      <div style="display: flex; align-items: center; gap: 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px;">
        <span style="font-size: 20px;">⚡</span>
        <h2 style="margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: -0.01em; color: #4f46e5;">Web Watchlist Alert</h2>
      </div>
      <p style="font-size: 14px; line-height: 1.5; color: #334155; margin: 0 0 12px 0;">
        A content modification was detected on monitored website: <strong>${siteName}</strong>
      </p>
      <div style="background-color: #f8fafc; border: 1.5px solid #0f172a; border-radius: 8px; padding: 12px 16px; margin: 16px 0;">
        <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 4px;">Target URL:</div>
        <a href="${siteUrl}" target="_blank" style="font-size: 13px; color: #2563eb; text-decoration: underline; font-weight: bold; word-break: break-all;">${siteUrl}</a>
      </div>
      <div style="background-color: #fdf0d5; border: 1.5px solid #0f172a; border-radius: 8px; padding: 12px 16px; margin: 16px 0;">
        <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #7f5539; margin-bottom: 4px;">Change Event:</div>
        <div style="font-size: 13px; font-weight: bold; color: #0f172a;">${changeTitle}</div>
      </div>
      <div style="background-color: #0f172a; border-radius: 8px; padding: 16px; color: #f8fafc; font-family: monospace; font-size: 12px; line-height: 1.6; white-space: pre-wrap; max-height: 200px; overflow-y: auto;">
        ${description}
      </div>
      <div style="margin-top: 24px; border-top: 1.5px dashed #e2e8f0; padding-top: 16px; text-align: center;">
        <a href="https://calllogiq-frontend.vercel.app" target="_blank" style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 10px 20px; border: 2.5px solid #0f172a; border-radius: 8px; font-size: 13px; font-weight: bold; text-decoration: none; text-transform: uppercase; box-shadow: 2px 2px 0px #0f172a;">
          Open Dashboard
        </a>
      </div>
    </div>
  `;

  let recipients = [];
  if (process.env.ADMIN_ALERT_EMAIL) {
    recipients = process.env.ADMIN_ALERT_EMAIL.split(',').map(e => e.trim());
  } else {
    try {
      console.log('ADMIN_ALERT_EMAIL not configured in env. Retrieving admin users from database...');
      const users = await db.listUsers();
      const admins = users.filter(u => u.role === 'admin' && u.email);
      recipients = admins.map(u => u.email);
    } catch (dbErr) {
      console.error('Failed to retrieve admin users for alert fallback:', dbErr.message);
    }
  }

  if (recipients.length === 0) {
    console.warn('No email recipients found for Watchlist Alert. Skipping email dispatch.');
    return false;
  }

  console.log(`Attempting to send alert email for "${siteName}" to: ${recipients.join(', ')}`);

  if (process.env.RESEND_API_KEY) {
    try {
      const fromEmail = process.env.RESEND_FROM || "CallLogIQ Alerts <onboarding@resend.dev>";
      for (const email of recipients) {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: fromEmail,
            to: email,
            subject: `[CallLogIQ Alert] Change detected on ${siteName}`,
            html: htmlContent
          })
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.message || JSON.stringify(result));
        }
        console.log(`Alert Email sent to ${email} via Resend API successfully.`);
      }
      return true;
    } catch (err) {
      console.error('Resend API alert email sending failed, trying SMTP fallback:', err.message);
    }
  }

  if (mailTransporter) {
    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || `"CallLogIQ Alerts" <${process.env.SMTP_USER}>`,
        to: recipients.join(', '),
        subject: `[CallLogIQ Alert] Change detected on ${siteName}`,
        text: `Change detected on website: ${siteName}\nURL: ${siteUrl}\n\nDetail:\n${description}`,
        html: htmlContent
      };
      await mailTransporter.sendMail(mailOptions);
      console.log(`Alert Email sent successfully to recipients via SMTP.`);
      return true;
    } catch (err) {
      console.error('SMTP Alert Email sending failed:', err);
      return false;
    }
  } else {
    console.log('No SMTP transporter configured. Watchlist alert email log simulation:');
    console.log(`[ALERT EMAIL] To: ${recipients.join(', ')} | Site: ${siteName} | Change: ${changeTitle}`);
    return true;
  }
}

// Firebase Admin SDK Initialization
const admin = require('firebase-admin');

let firebaseInitialized = false;

// 1. Try to load from environment variable (as JSON string)
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin SDK initialized successfully via FIREBASE_SERVICE_ACCOUNT env variable.');
    firebaseInitialized = true;
  } catch (err) {
    console.error('Failed to initialize Firebase Admin SDK from FIREBASE_SERVICE_ACCOUNT env variable:', err);
  }
}

// 2. Fallback to file check if not initialized
if (!firebaseInitialized) {
  const firebaseConfigPath = path.join(__dirname, 'firebase-service-account.json');
  if (fs.existsSync(firebaseConfigPath)) {
    try {
      const serviceAccount = require(firebaseConfigPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('Firebase Admin SDK initialized successfully with service account file.');
      firebaseInitialized = true;
    } catch (err) {
      console.error('Failed to initialize Firebase Admin SDK with service account file:', err);
    }
  }
}

if (!firebaseInitialized) {
  console.log('Firebase service account key is missing (neither FIREBASE_SERVICE_ACCOUNT env var nor firebase-service-account.json file). Using local database fallback (db.json).');
}

// redundant config removed

// Upload File to Cloudinary helper
async function uploadToCloudinary(filePath, publicId, isRaw = false) {
  if (!isCloudinaryConfigured) {
    console.log(`Cloudinary is not configured. Storing ${publicId} locally only.`);
    return null;
  }

  try {
    const options = {
      public_id: publicId,
      resource_type: isRaw ? 'raw' : 'auto',
      overwrite: true
    };
    const result = await cloudinary.uploader.upload(filePath, options);
    console.log(`Uploaded ${publicId} to Cloudinary. URL: ${result.secure_url}`);
    return result.secure_url;
  } catch (err) {
    console.error('Cloudinary upload failed:', err);
    return null;
  }
}

// Upload File to Firebase Storage helper
async function uploadToFirebaseStorage(localFilePath, destinationPath) {
  // Check if Firebase is initialized
  if (admin.apps.length === 0) {
    console.log(`Firebase is not initialized. Skipping Firebase Storage upload for ${destinationPath}.`);
    return null;
  }

  try {
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'callogiq.firebasestorage.app';
    const bucket = admin.storage().bucket(bucketName);
    
    console.log(`Uploading ${localFilePath} to Firebase Storage: ${destinationPath}...`);
    await bucket.upload(localFilePath, {
      destination: destinationPath,
      metadata: {
        cacheControl: 'public, max-age=31536000'
      }
    });

    const gsUrl = `gs://${bucketName}/${destinationPath}`;
    console.log(`Uploaded to Firebase Storage. GS URL: ${gsUrl}`);
    return gsUrl;
  } catch (err) {
    console.error('Firebase Storage upload failed:', err);
    return null;
  }
}

// Health Check Routes
app.get('/', (req, res) => {
  res.json({ status: 'healthy', service: 'CallLogIQ Backend', timestamp: new Date() });
});
app.get('/api/health', (req, res) => {
  // Trigger background check on cron ping (runs asynchronously)
  triggerBackgroundWebCheck().catch(err => {
    console.error('Failed to trigger background web check:', err);
  });
  res.json({ status: 'healthy', service: 'CallLogIQ Backend API' });
});

// --- AUTH ROUTES ---

// 1. Initiate Register
// 1. Google Sign-In Verification
app.post('/api/auth/google', async (req, res) => {
  const { idToken, domain } = req.body;
  if (!idToken) {
    return res.status(400).json({ error: 'Google ID token is required' });
  }

  try {
    // Validate ID Token with Google's tokeninfo API
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    const payload = await response.json();

    if (!response.ok) {
      return res.status(400).json({ error: payload.error_description || 'Invalid Google ID token' });
    }

    const { email, name } = payload;
    if (!email) {
      return res.status(400).json({ error: 'Google account is missing email address' });
    }

    // Check if user exists by email
    let user = await db.findUserByEmail(email.toLowerCase());
    
    // Auto-create user if they don't exist
    if (!user) {
      console.log(`Auto-registering new user via Google: ${email}`);
      const isEmailAdmin = email.toLowerCase() === ADMIN_EMAIL;
      user = await db.createUser({
        email: email.toLowerCase(),
        passwordHash: '', // Google users don't have local password
        name: name || email.split('@')[0],
        domain: 'Pending', // Mark as pending to trigger frontend selection modal
        branch: 'Pending', // Branch is also pending for new users
        role: isEmailAdmin ? 'admin' : 'user'
      });
    }

    // Check if user requires domain selection (i.e. domain is 'Pending')
    const isPending = user.domain === 'Pending' || user.domain === 'pending';
    if (isPending) {
      if (domain) {
        const validDomains = ['Academic Counselling Team', 'Accounts & Development Team', 'Business Development Team'];
        if (validDomains.includes(domain)) {
          user = await db.updateUser(user.id, { domain });
          console.log(`Updated pending user ${email} domain to ${domain}`);
        } else {
          return res.status(400).json({ error: 'Invalid department domain selected' });
        }
      } else {
        // Return response indicating domain selection is needed
        return res.json({
          needsDomain: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            domain: user.domain,
            branch: user.branch || 'Pending',
            role: user.role
          }
        });
      }
    }

    // Generate JWT token
    const token = jwt.sign({
      userId: user.id,
      email: user.email,
      name: user.name,
      domain: user.domain,
      branch: user.branch || 'Pending',
      role: user.role
    }, JWT_SECRET, { expiresIn: '30d' });

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        domain: user.domain,
        branch: user.branch || 'Pending',
        role: user.role
      }
    });
  } catch (err) {
    console.error('Google Auth Error:', err);
    return res.status(500).json({ error: 'Google Authentication failed. Please try again.' });
  }
});

// 2. Initiate Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // Enforce Direct Admin Login
  if (email.toLowerCase() === ADMIN_EMAIL) {
    if (password === 'Chennai@600116') {
      let user = await db.findUserByEmail(ADMIN_EMAIL);
      if (!user) {
        // Auto-seed admin user if missing
        const passwordHash = bcrypt.hashSync('Chennai@600116', 10);
        user = await db.createUser({
          email: ADMIN_EMAIL,
          passwordHash,
          name: 'System Admin',
          domain: 'Operations',
          branch: 'Maduravoyal',
          role: 'admin'
        });
      }

      // Generate token directly (No OTP!)
      const token = jwt.sign({
        userId: user.id,
        email: user.email,
        name: user.name,
        domain: user.domain,
        branch: user.branch || 'Maduravoyal',
        role: user.role
      }, JWT_SECRET, { expiresIn: '30d' });

      return res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          domain: user.domain,
          branch: user.branch || 'Maduravoyal',
          role: user.role
        }
      });
    } else {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }
  }

  // Regular users are required to sign in with Google
});

// 3. Update User Profile (Name and Domain selection)
app.post('/api/users/update-profile', authenticateToken, async (req, res) => {
  const { name, domain, branch } = req.body;
  if (!name || !domain || !branch) {
    return res.status(400).json({ error: 'Name, Domain, and Branch are required' });
  }

  const validDomains = ['Academic Counselling Team', 'Accounts & Development Team', 'Business Development Team'];
  if (!validDomains.includes(domain)) {
    return res.status(400).json({ error: 'Invalid department domain' });
  }

  const validBranches = ['Maduravoyal', 'Porur', 'Mettur', 'Tiruvannamalai'];
  if (!validBranches.includes(branch)) {
    return res.status(400).json({ error: 'Invalid branch selection' });
  }

  try {
    const userId = req.user.userId;
    const updatedUser = await db.updateUser(userId, { name, domain, branch });
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate new JWT token with updated profile info
    const token = jwt.sign({
      userId: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      domain: updatedUser.domain,
      branch: updatedUser.branch || 'Pending',
      role: updatedUser.role
    }, JWT_SECRET, { expiresIn: '30d' });

    return res.json({
      token,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        domain: updatedUser.domain,
        branch: updatedUser.branch || 'Pending',
        role: updatedUser.role
      }
    });
  } catch (err) {
    console.error('Update Profile Error:', err);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get User Profile Details
app.get('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await db.findUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const { passwordHash, ...safeUser } = user;
    return res.json(safeUser);
  } catch (err) {
    console.error('Get Profile Error:', err);
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update User Profile Settings (Name, Phone, and Base64 Photo)
app.post('/api/users/update-profile-settings', authenticateToken, async (req, res) => {
  const { name, phone, photo, email, domain, branch } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    const userId = req.user.userId;
    const updatedFields = { name };
    if (phone !== undefined) updatedFields.phone = phone;
    if (photo !== undefined) updatedFields.photo = photo;
    if (email !== undefined) updatedFields.email = email;
    if (domain !== undefined) updatedFields.domain = domain;
    if (branch !== undefined) updatedFields.branch = branch;

    const updatedUser = await db.updateUser(userId, updatedFields);
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate new JWT token with updated profile info
    const token = jwt.sign({
      userId: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      domain: updatedUser.domain,
      branch: updatedUser.branch || 'Pending',
      role: updatedUser.role
    }, JWT_SECRET, { expiresIn: '30d' });

    const { passwordHash, ...safeUser } = updatedUser;

    return res.json({
      token,
      user: safeUser
    });
  } catch (err) {
    console.error('Update Profile Settings Error:', err);
    return res.status(500).json({ error: 'Failed to update profile settings' });
  }
});


// --- CALL ANALYSIS ROUTES ---

// Simple sequential task queue to prevent concurrent Python execution and save memory
const analysisQueue = [];
let isProcessingQueue = false;

async function processQueue() {
  if (isProcessingQueue) return;
  if (analysisQueue.length === 0) return;

  isProcessingQueue = true;
  const task = analysisQueue.shift();

  try {
    await task();
  } catch (err) {
    console.error('Queue task error:', err);
  } finally {
    isProcessingQueue = false;
    processQueue();
  }
}

// Upload Call Log PDF
app.post('/api/calls/upload', authenticateToken, (req, res) => {
  upload.single('pdf')(req, res, (multerErr) => {
    if (multerErr) {
      console.error('--- MULTER UPLOAD FAILURE (Developer Log) ---');
      console.error('Multer Error:', multerErr);
      console.error('--------------------------------------------');
      return res.status(400).json({ error: 'Only PDF documents are allowed. Please choose a valid PDF file.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a PDF file' });
    }

    const pdfPath = req.file.path;
    const username = req.user.name;
    const userId = req.user.userId;
    
    const excelFilename = `${username.replace(/\s+/g, '_')}_Call_Log_Analysis_${Date.now()}.xlsx`;
    const excelPath = path.join(UPLOADS_DIR, excelFilename);
    
    // Push the analysis function to the queue
    analysisQueue.push(() => {
      return new Promise((resolve) => {
        // Fetch all logs for this user first, then run the analyzer
        db.getAllLogs().then(async (allLogs) => {

          // Call Python analyzer FIRST so we know the PDF's date
          const pyScript = path.join(__dirname, 'analyzer.py');
          const command = `python "${pyScript}" --pdf "${pdfPath}" --user "${username}" --out "${excelPath}"`;
          
          exec(command, async (error, stdout, stderr) => {
            if (error) {
              if (fs.existsSync(pdfPath)) {
                fs.unlinkSync(pdfPath);
              }
              // Programmer-friendly detailed log
              console.error('--- UPLOAD ANALYZER FAILURE (Developer Log) ---');
              console.error('Command:', command);
              console.error('Exit Code:', error.code);
              console.error('Stderr:', stderr);
              console.error('Error Message:', error.message);
              console.error('-----------------------------------------------');

              res.status(400).json({ 
                error: 'The uploaded PDF file could not be parsed. Please check if the file is corrupted, or ensure it is a valid call log PDF exported directly from the call recorder app.'
              });
              return resolve();
            }
            
            try {
              let analysisData;
              try {
                analysisData = JSON.parse(stdout);
              } catch (parseErr) {
                if (fs.existsSync(pdfPath)) { fs.unlinkSync(pdfPath); }
                if (fs.existsSync(excelPath)) { fs.unlinkSync(excelPath); }
                
                // Programmer-friendly detailed log
                console.error('--- UPLOAD JSON PARSE FAILURE (Developer Log) ---');
                console.error('Raw stdout:', stdout);
                console.error('Parse Error:', parseErr);
                console.error('-------------------------------------------------');
                
                res.status(400).json({ 
                  error: 'The system failed to extract data from the call log PDF. Please ensure you uploaded a genuine call log PDF.'
                });
                return resolve();
              }
              
              if (analysisData.error) {
                if (fs.existsSync(pdfPath)) {
                  fs.unlinkSync(pdfPath);
                }
                // Programmer-friendly log
                console.error('--- ANALYZER RETURNED ERROR (Developer Log) ---');
                console.error('Error string:', analysisData.error);
                console.error('------------------------------------------------');
                
                let userError = analysisData.error;
                if (analysisData.error.includes('No call log records found in PDF')) {
                  userError = 'No call records were found in the uploaded PDF. Please make sure you uploaded the correct call log document.';
                } else if (analysisData.error.includes('File not found')) {
                  userError = 'File not found on server during processing. Please try uploading the PDF again.';
                }
                
                res.status(400).json({ error: userError });
                return resolve();
              }
              
              // 3 UNIQUE PDFS PER DATE CONSTRAINT CHECK (based on PDF's own callDate)
              const existingLogsForDate = allLogs.filter(l => l.userId === userId && l.callDate === analysisData.call_date);
              
              if (existingLogsForDate.length >= 3) {
                if (fs.existsSync(pdfPath)) { fs.unlinkSync(pdfPath); }
                if (fs.existsSync(excelPath)) { fs.unlinkSync(excelPath); }
                res.status(400).json({ 
                  error: `A maximum of 3 call logs can be uploaded for the date ${analysisData.call_date}.` 
                });
                return resolve();
              }

              // Helper to check if two call lists are identical
              const areCallListsIdentical = (listA, listB) => {
                if (!listA || !listB) return false;
                if (listA.length !== listB.length) return false;
                for (let i = 0; i < listA.length; i++) {
                  const cA = listA[i];
                  const cB = listB[i];
                  if (cA.phone !== cB.phone ||
                      cA.time_str !== cB.time_str ||
                      cA.duration_secs !== cB.duration_secs ||
                      cA.type !== cB.type) {
                    return false;
                  }
                }
                return true;
              };

              // Reject if an identical call log content exists for this date
              const isDuplicate = existingLogsForDate.some(el => areCallListsIdentical(el.calls, analysisData.calls));
              if (isDuplicate) {
                if (fs.existsSync(pdfPath)) { fs.unlinkSync(pdfPath); }
                if (fs.existsSync(excelPath)) { fs.unlinkSync(excelPath); }
                res.status(400).json({ 
                  error: `This exact call log for ${analysisData.call_date} has already been uploaded.` 
                });
                return resolve();
              }
              
              const logId = 'log_' + Date.now().toString() + Math.random().toString(36).substr(2, 5);
              const finalFilename = `${logId}.xlsx`;
              const finalPath = path.join(UPLOADS_DIR, finalFilename);
              
              // Rename excel file locally
              if (fs.existsSync(excelPath)) {
                fs.renameSync(excelPath, finalPath);
              }

              // Convert PDF and Excel to Base64 strings for Firestore storage
              let pdfBase64 = '';
              try {
                if (fs.existsSync(pdfPath)) {
                  pdfBase64 = fs.readFileSync(pdfPath).toString('base64');
                }
              } catch (readErr) {
                console.error('Error reading PDF for Base64 conversion:', readErr);
              }

              let excelBase64 = '';
              try {
                if (fs.existsSync(finalPath)) {
                  excelBase64 = fs.readFileSync(finalPath).toString('base64');
                }
              } catch (readErr) {
                console.error('Error reading Excel for Base64 conversion:', readErr);
              }

              // Delete local temp PDF upload
              if (fs.existsSync(pdfPath)) {
                fs.unlinkSync(pdfPath);
              }
              
              // Save log entry to DB
              const logEntry = await db.createLog({
                id: logId,
                userId,
                filename: finalFilename,
                callDate: analysisData.call_date,
                summary: analysisData.summary,
                calls: analysisData.calls,
                arrivalTime: analysisData.summary.workday_start,
                departureTime: analysisData.summary.workday_end,
                pdfUrl: '',
                excelUrl: '',
                pdfBase64,
                excelBase64
              });
              
              res.json({
                message: 'PDF analyzed and Excel sheet generated successfully!',
                log: logEntry
              });
              resolve();
              
            } catch (parseErr) {
              if (fs.existsSync(pdfPath)) { fs.unlinkSync(pdfPath); }
              if (fs.existsSync(excelPath)) { fs.unlinkSync(excelPath); }
              
              // Programmer-friendly detailed log
              console.error('--- UPLOAD EXCEPTION (Developer Log) ---');
              console.error('Error:', parseErr);
              console.error('----------------------------------------');

              res.status(400).json({ 
                error: 'An unexpected processing error occurred. Please try again.'
              });
              resolve();
            }
          });
        }).catch(err => {
          if (fs.existsSync(pdfPath)) { fs.unlinkSync(pdfPath); }
          console.error('Queue database retrieval error:', err);
          res.status(500).json({ error: 'Database retrieval error' });
          resolve();
        });
      });
    });
    
    // Trigger processing
    processQueue();
  });
});

// Get history of uploads
app.get('/api/calls/history', authenticateToken, async (req, res) => {
  const logs = await db.getLogsByUserId(req.user.userId);
  return res.json(logs);
});

// Download Generated Excel File (Admin only)
app.get('/api/calls/download/:logId', authenticateToken, requireAdmin, async (req, res) => {
  const { logId } = req.params;
  const log = await db.getLogById(logId);
  
  if (!log) {
    return res.status(404).json({ error: 'Excel log file record not found' });
  }
  
  const logUser = await db.findUserById(log.userId);
  const downloadName = `${logUser ? logUser.name.replace(/\s+/g, '_') : 'User'}_Call_Log_Analysis_${log.callDate.replace(/\s+/g, '')}.xlsx`;
  
  // 1. Try local file first
  const filePath = path.join(UPLOADS_DIR, log.filename);
  if (fs.existsSync(filePath)) {
    return res.download(filePath, downloadName);
  }
  
  // 2. Try Firestore Base64 next
  if (log.excelBase64) {
    try {
      const excelBuffer = Buffer.from(log.excelBase64, 'base64');
      res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(excelBuffer);
    } catch (err) {
      console.error('Error sending Excel from Base64:', err);
    }
  }

  // 3. Fall back: proxy from Firebase Storage or Cloudinary excelUrl
  if (log.excelUrl) {
    if (log.excelUrl.startsWith('gs://')) {
      try {
        const gsUrl = log.excelUrl;
        const parts = gsUrl.replace('gs://', '').split('/');
        const bucketName = parts[0];
        const filePath = parts.slice(1).join('/');
        
        const bucket = admin.storage().bucket(bucketName);
        const file = bucket.file(filePath);
        
        const [exists] = await file.exists();
        if (!exists) {
          return res.status(404).json({ error: 'Excel file not found in cloud storage' });
        }
        
        res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        
        file.createReadStream()
          .on('error', (streamErr) => {
            console.error('Error reading Excel stream from Firebase Storage:', streamErr);
            if (!res.headersSent) {
              res.status(500).json({ error: 'Failed to stream Excel from cloud storage' });
            }
          })
          .pipe(res);
        return;
      } catch (err) {
        console.error('Error streaming Excel from Firebase Storage:', err);
        return res.status(500).json({ error: 'Failed to retrieve Excel' });
      }
    }

    try {
      getStreamWithRedirects(log.excelUrl, (err, fileRes) => {
        if (err) {
          console.error('Error proxying Excel from Cloudinary:', err);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to stream Excel from cloud storage' });
          }
          return;
        }

        if (fileRes.statusCode >= 400) {
          console.error(`Cloudinary returned status ${fileRes.statusCode} for Excel`);
          if (!res.headersSent) {
            res.status(fileRes.statusCode).json({ error: `Excel file not found or inaccessible in cloud storage (Status ${fileRes.statusCode})` });
          }
          return;
        }
        
        res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        fileRes.pipe(res);
      });
    } catch (err) {
      console.error('Error setting up Excel proxy:', err);
      return res.status(500).json({ error: 'Excel proxy error' });
    }
    return;
  }
  
  return res.status(404).json({ error: 'Excel file not available (not on disk and no cloud URL)' });
});

// View/Download PDF (Admin only) - streams the PDF from Firestore Base64, Firebase Storage, or Cloudinary
app.get('/api/calls/pdf/:logId', authenticateToken, requireAdmin, async (req, res) => {
  const { logId } = req.params;
  const log = await db.getLogById(logId);
  
  if (!log) {
    return res.status(404).json({ error: 'Log record not found' });
  }
  
  // Make sure we have a way to fetch the PDF
  if (!log.pdfBase64 && !log.pdfUrl) {
    return res.status(404).json({ error: 'No PDF available for this log entry' });
  }
  
  try {
    const logUser = await db.findUserById(log.userId);
    const filename = `${logUser ? logUser.name.replace(/\s+/g, '_') : 'User'}_${log.callDate.replace(/\s+/g, '')}.pdf`;
    
    // 1. Try Firestore Base64 first
    if (log.pdfBase64) {
      try {
        const pdfBuffer = Buffer.from(log.pdfBase64, 'base64');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        return res.send(pdfBuffer);
      } catch (err) {
        console.error('Error sending PDF from Base64:', err);
      }
    }

    // 2. Fall back to Firebase Storage (gs://) or Cloudinary pdfUrl
    if (log.pdfUrl) {
      if (log.pdfUrl.startsWith('gs://')) {
        try {
          const gsUrl = log.pdfUrl;
          const parts = gsUrl.replace('gs://', '').split('/');
          const bucketName = parts[0];
          const filePath = parts.slice(1).join('/');
          
          const bucket = admin.storage().bucket(bucketName);
          const file = bucket.file(filePath);
          
          const [exists] = await file.exists();
          if (!exists) {
            return res.status(404).json({ error: 'PDF file not found in cloud storage' });
          }
          
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
          
          file.createReadStream()
            .on('error', (streamErr) => {
              console.error('Error reading PDF stream from Firebase Storage:', streamErr);
              if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to stream PDF from cloud storage' });
              }
            })
            .pipe(res);
          return;
        } catch (err) {
          console.error('Error streaming PDF from Firebase Storage:', err);
          return res.status(500).json({ error: 'Failed to retrieve PDF' });
        }
      }

      getStreamWithRedirects(log.pdfUrl, (err, fileRes) => {
        if (err) {
          console.error('Error proxying PDF from Cloudinary:', err);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to stream PDF from cloud storage' });
          }
          return;
        }

        if (fileRes.statusCode >= 400) {
          console.error(`Cloudinary returned status ${fileRes.statusCode} for PDF`);
          if (!res.headersSent) {
            res.status(fileRes.statusCode).json({ error: `PDF file not found or inaccessible in cloud storage (Status ${fileRes.statusCode})` });
          }
          return;
        }
        
        // Only set headers if the source response is 2xx success
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        fileRes.pipe(res);
      });
      return;
    }
  } catch (err) {
    console.error('Error setting up PDF proxy:', err);
    return res.status(500).json({ error: 'PDF proxy error' });
  }
  
  return res.status(404).json({ error: 'PDF file not available' });
});


// Generate & Download Aggregate Excel for a single user (Admin only)
app.get('/api/calls/aggregate-excel/:userId', authenticateToken, requireAdmin, async (req, res) => {
  const { userId } = req.params;
  try {
    const targetUser = await db.findUserById(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userLogs = await db.getLogsByUserId(userId);
    if (!userLogs || userLogs.length === 0) {
      return res.status(404).json({ error: 'No call logs found for this user' });
    }

    const safeUserName = targetUser.name.replace(/\s+/g, '_');
    const outputFilename = `${safeUserName}_AllCallLogs_${Date.now()}.xlsx`;
    const outputPath = path.join(__dirname, 'uploads', outputFilename);

    const pyScript = path.join(__dirname, 'generate_user_report.py');

    let pythonCmd = 'python';
    try {
      execSync('python --version', { stdio: 'ignore' });
    } catch (e) {
      pythonCmd = 'python3';
    }

    const { spawn } = require('child_process');
    const pyProcess = spawn(pythonCmd, ['-u', pyScript, '--output', outputPath]);

    let stderr = '';
    pyProcess.stdin.write(JSON.stringify({ userName: targetUser.name, logs: userLogs }));
    pyProcess.stdin.end();

    pyProcess.stderr.on('data', (data) => { stderr += data.toString(); });

    pyProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Aggregate report python failed (code ${code}): ${stderr}`);
        return res.status(500).json({ error: `Report generation failed: ${stderr}` });
      }
      if (!fs.existsSync(outputPath)) {
        return res.status(500).json({ error: 'Report file was not created' });
      }
      const downloadName = `${safeUserName}_Aggregate_CallLog_Report.xlsx`;
      res.download(outputPath, downloadName, (err) => {
        if (err) console.error('Error sending aggregate report:', err);
        try { fs.unlinkSync(outputPath); } catch (e) {}
      });
    });
  } catch (err) {
    console.error('Error generating aggregate report:', err);
    return res.status(500).json({ error: 'Failed to generate aggregate report' });
  }
});

// Get all configured holidays (Admin only)
app.get('/api/admin/holidays', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const list = await db.getHolidays();
    return res.json(list);
  } catch (err) {
    console.error('Error fetching holidays:', err);
    return res.status(500).json({ error: 'Failed to fetch holidays' });
  }
});

// Save holidays for a specific month (Admin only)
app.post('/api/admin/holidays', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { month, dates } = req.body;
    if (!month || !Array.isArray(dates)) {
      return res.status(400).json({ error: 'Missing month or dates array' });
    }
    await db.saveHolidaysForMonth(month, dates);
    return res.json({ message: 'Holidays saved successfully' });
  } catch (err) {
    console.error('Error saving holidays:', err);
    return res.status(500).json({ error: 'Failed to save holidays' });
  }
});

// Get Attendance Report for a specific user (Admin only)
app.get('/api/admin/attendance/:userId', authenticateToken, requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const targetUser = await db.findUserById(userId);
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Get all logs for this user
  const userLogs = await db.getLogsByUserId(userId);
  
  // Get all configured holidays
  let holidaysList = [];
  try {
    holidaysList = await db.getHolidays();
  } catch (err) {
    console.error('Error reading holidays in attendance calculation:', err);
  }
  
  // Calculate days from registrationDate to today
  const regDateStr = targetUser.registrationDate || targetUser.createdAt.split('T')[0];
  const startDate = new Date(regDateStr);
  startDate.setHours(12, 0, 0, 0);
  
  const endDate = new Date();
  endDate.setHours(12, 0, 0, 0);
  
  let workingDays = 0;
  let holidays = 0;
  let presentDays = 0;
  let absentDays = 0;
  let overtimeDays = 0;
  
  const attendanceList = [];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  // Loop through each day from startDate to today
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    const isSunday = d.getDay() === 0;
    
    // Format YYYY-MM-DD
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const ymdStr = `${year}-${month}-${day}`;
    
    const isConfiguredHoliday = holidaysList.some(h => h.date === ymdStr);
    const isHoliday = isSunday || isConfiguredHoliday;
    
    // Find if there is an uploaded log for this date
    const log = userLogs.find(l => l.callDate.toLowerCase() === dateStr.toLowerCase());
    
    if (isHoliday) {
      holidays++;
      if (log) {
        overtimeDays++;
        
        // Calculate workday span duration
        let durationStr = log.summary.workday_span_str || '-';
        let netWorkHoursStr = '-';
        if (log.summary.workday_span_secs) {
          // Subtract 45 minutes lunch break
          const netSecs = Math.max(0, log.summary.workday_span_secs - 2700);
          const nh = Math.floor(netSecs / 3600);
          const nm = Math.floor((netSecs % 3600) / 60);
          const ns = netSecs % 60;
          netWorkHoursStr = `${nh.toString().padStart(2, '0')}:${nm.toString().padStart(2, '0')}:${ns.toString().padStart(2, '0')}`;
        }

        attendanceList.push({
          date: dateStr,
          status: 'Overtime',
          arrival: log.summary.workday_start || '-',
          departure: log.summary.workday_end || '-',
          duration: durationStr,
          netWorkHours: netWorkHoursStr,
          talkTime: log.summary.talk_time_str || '-',
          calls: log.summary.grand_total || 0,
          logId: log.id || '',
          pdfUrl: log.pdfUrl || '',
          hasPdf: log.hasPdf || !!log.pdfUrl
        });
      } else {
        attendanceList.push({
          date: dateStr,
          status: 'Holiday',
          arrival: '-',
          departure: '-',
          duration: '-',
          netWorkHours: '-',
          talkTime: '-',
          calls: 0
        });
      }
    } else {
      workingDays++;
      if (log) {
        presentDays++;
        
        // Calculate workday span duration
        let durationStr = log.summary.workday_span_str || '-';
        let netWorkHoursStr = '-';
        if (log.summary.workday_span_secs) {
          // Subtract 45 minutes lunch break
          const netSecs = Math.max(0, log.summary.workday_span_secs - 2700);
          const nh = Math.floor(netSecs / 3600);
          const nm = Math.floor((netSecs % 3600) / 60);
          const ns = netSecs % 60;
          netWorkHoursStr = `${nh.toString().padStart(2, '0')}:${nm.toString().padStart(2, '0')}:${ns.toString().padStart(2, '0')}`;
        }

        attendanceList.push({
          date: dateStr,
          status: 'Present',
          arrival: log.summary.workday_start || '-',
          departure: log.summary.workday_end || '-',
          duration: durationStr,
          netWorkHours: netWorkHoursStr,
          talkTime: log.summary.talk_time_str || '-',
          calls: log.summary.grand_total || 0,
          logId: log.id || '',
          pdfUrl: log.pdfUrl || '',
          hasPdf: log.hasPdf || !!log.pdfUrl
        });
      } else {
        absentDays++;
        attendanceList.push({
          date: dateStr,
          status: 'Absent',
          arrival: '-',
          departure: '-',
          duration: '-',
          netWorkHours: '-',
          talkTime: '-',
          calls: 0
        });
      }
    }
  }
  
  return res.json({
    summary: {
      workingDays,
      holidays,
      presentDays,
      absentDays,
      overtimeDays
    },
    history: attendanceList.reverse() // Newest first
  });
});

// Generate & Download Attendance Excel for a single user (Admin only)
app.get('/api/admin/attendance/:userId/excel', authenticateToken, requireAdmin, async (req, res) => {
  const { userId } = req.params;
  try {
    const targetUser = await db.findUserById(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get all logs for this user
    const userLogs = await db.getLogsByUserId(userId);
    
    // Get all configured holidays
    let holidaysList = [];
    try {
      holidaysList = await db.getHolidays();
    } catch (err) {
      console.error('Error reading holidays in attendance calculation:', err);
    }
    
    // Calculate days from registrationDate to today
    const regDateStr = targetUser.registrationDate || targetUser.createdAt.split('T')[0];
    const startDate = new Date(regDateStr);
    startDate.setHours(12, 0, 0, 0);
    
    const endDate = new Date();
    endDate.setHours(12, 0, 0, 0);
    
    let workingDays = 0;
    let holidays = 0;
    let presentDays = 0;
    let absentDays = 0;
    let overtimeDays = 0;
    
    const attendanceList = [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      const isSunday = d.getDay() === 0;
      
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const ymdStr = `${year}-${month}-${day}`;
      
      const isConfiguredHoliday = holidaysList.some(h => h.date === ymdStr);
      const isHoliday = isSunday || isConfiguredHoliday;
      
      const log = userLogs.find(l => l.callDate.toLowerCase() === dateStr.toLowerCase());
      
      if (isHoliday) {
        holidays++;
        if (log) {
          overtimeDays++;
          let durationStr = log.summary.workday_span_str || '-';
          let netWorkHoursStr = '-';
          if (log.summary.workday_span_secs) {
            const netSecs = Math.max(0, log.summary.workday_span_secs - 2700);
            const nh = Math.floor(netSecs / 3600);
            const nm = Math.floor((netSecs % 3600) / 60);
            const ns = netSecs % 60;
            netWorkHoursStr = `${nh.toString().padStart(2, '0')}:${nm.toString().padStart(2, '0')}:${ns.toString().padStart(2, '0')}`;
          }
          attendanceList.push({
            date: dateStr,
            status: 'Overtime',
            arrival: log.summary.workday_start || '-',
            departure: log.summary.workday_end || '-',
            duration: durationStr,
            netWorkHours: netWorkHoursStr,
            talkTime: log.summary.talk_time_str || '-',
            calls: log.summary.grand_total || 0
          });
        } else {
          attendanceList.push({
            date: dateStr,
            status: 'Holiday',
            arrival: '-',
            departure: '-',
            duration: '-',
            netWorkHours: '-',
            talkTime: '-',
            calls: 0
          });
        }
      } else {
        workingDays++;
        if (log) {
          presentDays++;
          let durationStr = log.summary.workday_span_str || '-';
          let netWorkHoursStr = '-';
          if (log.summary.workday_span_secs) {
            const netSecs = Math.max(0, log.summary.workday_span_secs - 2700);
            const nh = Math.floor(netSecs / 3600);
            const nm = Math.floor((netSecs % 3600) / 60);
            const ns = netSecs % 60;
            netWorkHoursStr = `${nh.toString().padStart(2, '0')}:${nm.toString().padStart(2, '0')}:${ns.toString().padStart(2, '0')}`;
          }
          attendanceList.push({
            date: dateStr,
            status: 'Present',
            arrival: log.summary.workday_start || '-',
            departure: log.summary.workday_end || '-',
            duration: durationStr,
            netWorkHours: netWorkHoursStr,
            talkTime: log.summary.talk_time_str || '-',
            calls: log.summary.grand_total || 0
          });
        } else {
          absentDays++;
          attendanceList.push({
            date: dateStr,
            status: 'Absent',
            arrival: '-',
            departure: '-',
            duration: '-',
            netWorkHours: '-',
            talkTime: '-',
            calls: 0
          });
        }
      }
    }

    const payload = {
      userName: targetUser.name,
      domain: targetUser.domain || 'Pending',
      branch: targetUser.branch || 'Pending',
      registrationDate: regDateStr,
      summary: {
        workingDays,
        holidays,
        presentDays,
        absentDays,
        overtimeDays
      },
      history: attendanceList.reverse() // Keep newest first like in UI
    };

    const safeUserName = targetUser.name.replace(/\s+/g, '_');
    const outputFilename = `${safeUserName}_AttendanceReport_${Date.now()}.xlsx`;
    const outputPath = path.join(__dirname, 'uploads', outputFilename);
    const pyScript = path.join(__dirname, 'generate_attendance_report.py');

    let pythonCmd = 'python';
    try {
      execSync('python --version', { stdio: 'ignore' });
    } catch (e) {
      pythonCmd = 'python3';
    }

    const { spawn } = require('child_process');
    const pyProcess = spawn(pythonCmd, ['-u', pyScript, '--output', outputPath]);

    let stderr = '';
    pyProcess.stdin.write(JSON.stringify(payload));
    pyProcess.stdin.end();

    pyProcess.stderr.on('data', (data) => { stderr += data.toString(); });

    pyProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Attendance report python failed (code ${code}): ${stderr}`);
        return res.status(500).json({ error: `Report generation failed: ${stderr}` });
      }
      if (!fs.existsSync(outputPath)) {
        return res.status(500).json({ error: 'Report file was not created' });
      }
      const downloadName = `${safeUserName}_Attendance_Report.xlsx`;
      res.download(outputPath, downloadName, (err) => {
        if (err) console.error('Error sending attendance report:', err);
        try { fs.unlinkSync(outputPath); } catch (e) {}
      });
    });

  } catch (err) {
    console.error('Error generating attendance report:', err);
    return res.status(500).json({ error: 'Failed to generate attendance report' });
  }
});

// --- TODO LIST / TASKS ROUTES ---

// Cleanup helper to remove completed tasks from previous days
async function cleanupOldCompletedTasks() {
  // Discard auto-deletion to keep tasks for "All Assigned Works (Hierarchical Grouping)"
  return;
}

// Get tasks for the current user
app.get('/api/tasks', authenticateToken, async (req, res) => {
  await cleanupOldCompletedTasks();
  const tasks = await db.getTasksForUser(req.user.userId, req.user.domain);
  const todayStr = new Date().toISOString().split('T')[0];
  
  // Format task checklist response
  const formattedTasks = tasks.map(t => {
    const isDomainTask = db.checkIsDomainTask(t.assignedTo);
    const status = t.employeeStages?.[req.user.userId] || (isDomainTask ? (t.completions?.includes(req.user.userId) ? 'completed' : 'pending') : (t.status || 'pending'));
    const isCompleted = status === 'completed';
    const taskDateStr = t.createdAt.split('T')[0];
    
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      assignedTo: t.assignedTo,
      isDomainTask,
      isCompleted,
      status, // 'pending', 'seen', 'doing', 'completed'
      createdAt: t.createdAt,
      taskDateStr,
      completedAtByUser: t.completedAtByUser || {},
      completedAt: t.completedAt
    };
  })
  // Filter out completed tasks that were completed more than 24 hours ago
  .filter(t => {
    if (t.status === 'completed') {
      const completedTime = t.completedAtByUser?.[req.user.userId] || t.completedAt;
      if (completedTime) {
        const msDiff = new Date() - new Date(completedTime);
        return msDiff <= 24 * 60 * 60 * 1000;
      } else {
        // Fallback for historical completed tasks without a completion timestamp
        return t.taskDateStr === todayStr;
      }
    }
    return true; // Keep pending, seen, doing tasks until completed
  });
  
  return res.json(formattedTasks);
});

// Update Task Status (specific stage: pending, seen, doing, completed)
app.post('/api/tasks/:taskId/status', authenticateToken, async (req, res) => {
  const { taskId } = req.params;
  const { status } = req.body;
  
  if (!['pending', 'seen', 'doing', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid task status' });
  }
  
  const updatedTask = await db.updateTaskStatus(taskId, req.user.userId, status);
  if (!updatedTask) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  return res.json({ message: `Task status updated to ${status}`, task: updatedTask });
});

// Toggle Task Status (for backwards compatibility/simple checklist)
app.post('/api/tasks/:taskId/toggle', authenticateToken, async (req, res) => {
  const { taskId } = req.params;
  const { isCompleted } = req.body;
  
  const status = isCompleted ? 'completed' : 'pending';
  const updatedTask = await db.updateTaskStatus(taskId, req.user.userId, status);
  if (!updatedTask) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  return res.json({ message: 'Task status updated successfully', task: updatedTask });
});

// Submit field visit (Business Development Team)
app.post('/api/business-development/field-visit', authenticateToken, async (req, res) => {
  const { photos, gpsEnabled, location, visitDateTime } = req.body;
  if (!photos || !Array.isArray(photos) || photos.length === 0) {
    return res.status(400).json({ error: 'At least one photo is required' });
  }
  if (photos.length > 2) {
    return res.status(400).json({ error: 'Maximum 2 photos can be uploaded' });
  }
  if (!location) {
    return res.status(400).json({ error: 'Location is required' });
  }
  if (!visitDateTime) {
    return res.status(400).json({ error: 'Date and time of visit are required' });
  }

  try {
    const visit = {
      userId: req.user.userId,
      userName: req.user.name,
      domain: req.user.domain,
      photos,
      gpsEnabled: !!gpsEnabled,
      location,
      visitDateTime
    };

    const newVisit = await db.createFieldVisit(visit);
    return res.status(201).json({ message: 'Field visit recorded successfully', visit: newVisit });
  } catch (err) {
    console.error('Error creating field visit:', err);
    return res.status(500).json({ error: 'Failed to record field visit' });
  }
});

// Get field visits (All for admin, filtered by userId for employees)
app.get('/api/business-development/field-visits', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const allVisits = await db.getAllFieldVisits();
      return res.json(allVisits);
    } else {
      const userVisits = await db.getFieldVisitsByUserId(req.user.userId);
      return res.json(userVisits);
    }
  } catch (err) {
    console.error('Error fetching field visits:', err);
    return res.status(500).json({ error: 'Failed to fetch field visits' });
  }
});

// --- ADMIN CONTROL PANEL ROUTES ---

// Get all registered users (Admin only)
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  const users = await db.listUsers();
  return res.json(users);
});

// Update a user (Admin only)
app.put('/api/admin/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { name, domain, role, email, branch } = req.body;
  
  if (!name || !domain || !role || !email) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Prevent self-role downgrade
  if (userId === req.user.userId && role !== 'admin') {
    return res.status(400).json({ error: 'You cannot downgrade your own administrator role.' });
  }
  
  try {
    const updateFields = { name, domain, role, email };
    if (branch) {
      updateFields.branch = branch;
    }
    const updatedUser = await db.updateUser(userId, updateFields);
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ message: 'User updated successfully', user: updatedUser });
  } catch (err) {
    console.error('Error updating user:', err);
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete a user (Admin only)
app.delete('/api/admin/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
  const { userId } = req.params;
  
  // Prevent self-deletion
  if (userId === req.user.userId) {
    return res.status(400).json({ error: 'You cannot delete your own administrator account.' });
  }
  
  try {
    const targetUser = await db.findUserById(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    await db.deleteUser(userId);
    return res.json({ message: `User ${targetUser.name} and their call history deleted successfully.` });
  } catch (err) {
    console.error('Error deleting user:', err);
    return res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Get analytics for all logs (Admin only)
app.get('/api/admin/logs', authenticateToken, requireAdmin, async (req, res) => {
  const logs = await db.getAllLogs();
  
  // Attach user details to logs
  const users = await db.listUsers();
  const logsWithUsers = logs.map(l => {
    const user = users.find(u => u.id === l.userId);
    return {
      ...l,
      user: user ? { name: user.name, email: user.email, domain: user.domain } : null
    };
  });
  
  return res.json(logsWithUsers);
});

// Get all tasks (Admin only)
app.get('/api/admin/tasks', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await cleanupOldCompletedTasks();
    const tasks = await db.getAllTasks();
    return res.json(tasks);
  } catch (err) {
    console.error('Error fetching all tasks:', err);
    return res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Delete a task (Admin only)
app.delete('/api/admin/tasks/:taskId', authenticateToken, requireAdmin, async (req, res) => {
  const { taskId } = req.params;
  try {
    const success = await db.deleteTask(taskId);
    if (!success) {
      return res.status(404).json({ error: 'Task not found' });
    }
    return res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    console.error('Error deleting task:', err);
    return res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Assign a task (Admin only)
app.post('/api/admin/assign-task', authenticateToken, requireAdmin, async (req, res) => {
  const { title, description, assignedTo } = req.body; // assignedTo can be a userId or a domain
  if (!title || !assignedTo) {
    return res.status(400).json({ error: 'Task title and assignee are required' });
  }
  
  const newTask = await db.createTask({
    title,
    description: description || '',
    assignedTo,
    assignedBy: req.user.userId
  });
  
  return res.json({ message: 'Task assigned successfully', task: newTask });
});

// Flush/Reset database (Admin only)
app.post('/api/admin/flush-database', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.flushDatabase();
    return res.json({ message: 'Database flushed successfully.' });
  } catch (err) {
    console.error('Error flushing database:', err);
    return res.status(500).json({ 
      error: 'Failed to flush database.', 
      details: err.message,
      stack: err.stack
    });
  }
});

// Helper function to run migration in the background
async function runMigrationInBackground(logs) {
  for (const log of logs) {
    if (!migrationStatus.inProgress) break;
    
    migrationStatus.current++;
    try {
      const fullLog = await db.getLogById(log.id);
      if (!fullLog) {
        migrationStatus.errorCount++;
        migrationStatus.errors.push({ id: log.id, date: log.callDate, error: 'Log document not found by ID' });
        continue;
      }
      
      let pdfBase64 = fullLog.pdfBase64 || '';
      let excelBase64 = fullLog.excelBase64 || '';
      let updated = false;
      let hadPdfError = false;
      let hadExcelError = false;
      
      // 1. Migrate PDF
      if (!pdfBase64 && fullLog.pdfUrl) {
        try {
          console.log(`Downloading PDF for log ${log.id} from ${fullLog.pdfUrl}`);
          let buffer;
          if (fullLog.pdfUrl.startsWith('gs://')) {
            const parts = fullLog.pdfUrl.replace('gs://', '').split('/');
            const bucketName = parts[0];
            const filePath = parts.slice(1).join('/');
            const bucket = admin.storage().bucket(bucketName);
            const file = bucket.file(filePath);
            const [fileBuffer] = await file.download();
            buffer = fileBuffer;
          } else {
            buffer = await downloadUrlToBuffer(fullLog.pdfUrl);
          }
          if (buffer) {
            pdfBase64 = buffer.toString('base64');
            updated = true;
          }
        } catch (pdfErr) {
          hadPdfError = true;
          console.error(`Failed to migrate PDF for log ${log.id}:`, pdfErr.message);
          migrationStatus.errorCount++;
          migrationStatus.errors.push({ id: log.id, date: log.callDate, field: 'pdf', error: pdfErr.message });
        }
      }
      
      // 2. Migrate Excel
      if (!excelBase64 && fullLog.excelUrl) {
        try {
          console.log(`Downloading Excel for log ${log.id} from ${fullLog.excelUrl}`);
          let buffer;
          if (fullLog.excelUrl.startsWith('gs://')) {
            const parts = fullLog.excelUrl.replace('gs://', '').split('/');
            const bucketName = parts[0];
            const filePath = parts.slice(1).join('/');
            const bucket = admin.storage().bucket(bucketName);
            const file = bucket.file(filePath);
            const [fileBuffer] = await file.download();
            buffer = fileBuffer;
          } else {
            buffer = await downloadUrlToBuffer(fullLog.excelUrl);
          }
          if (buffer) {
            excelBase64 = buffer.toString('base64');
            updated = true;
          }
        } catch (excelErr) {
          hadExcelError = true;
          console.error(`Failed to migrate Excel for log ${log.id}:`, excelErr.message);
          migrationStatus.errorCount++;
          migrationStatus.errors.push({ id: log.id, date: log.callDate, field: 'excel', error: excelErr.message });
        }
      }
      
      if (updated) {
        await db.updateLog(log.id, { pdfBase64, excelBase64 });
        migrationStatus.successCount++;
      } else if (fullLog.pdfBase64 || fullLog.excelBase64) {
        if (!hadPdfError && !hadExcelError) {
          migrationStatus.alreadyMigrated++;
        }
      }
    } catch (logErr) {
      console.error(`Error processing log ${log.id}:`, logErr);
      migrationStatus.errorCount++;
      migrationStatus.errors.push({ id: log.id, date: log.callDate, error: logErr.message });
    }
  }
  
  migrationStatus.inProgress = false;
  console.log(`Migration finished in background.`);
}

// Migrate Cloudinary/Firebase links to Base64 in Firestore (Admin only)
app.post('/api/admin/migrate-to-base64', authenticateToken, requireAdmin, async (req, res) => {
  if (migrationStatus.inProgress) {
    return res.status(400).json({ error: 'Migration is already in progress' });
  }

  try {
    const logs = await db.getAllLogs();
    
    migrationStatus = {
      inProgress: true,
      total: logs.length,
      current: 0,
      successCount: 0,
      alreadyMigrated: 0,
      errorCount: 0,
      errors: []
    };

    // Run in background
    runMigrationInBackground(logs);

    return res.json({ message: 'Migration started successfully', status: migrationStatus });
  } catch (err) {
    console.error('Failed to start migration:', err);
    return res.status(500).json({ error: 'Failed to start migration: ' + err.message });
  }
});

// Get migration status (Admin only)
app.get('/api/admin/migration-status', authenticateToken, requireAdmin, (req, res) => {
  return res.json(migrationStatus);
});


// Seed admin account (Helper route for development testing)
app.post('/api/auth/seed-admin', async (req, res) => {
  const existingAdmin = await db.findUserByEmail(ADMIN_EMAIL);
  if (existingAdmin) {
    return res.json({ message: 'Admin account already exists' });
  }
  
  const passwordHash = bcrypt.hashSync('admin123', 10);
  const newAdmin = await db.createUser({
    email: ADMIN_EMAIL,
    passwordHash,
    name: 'Administrator',
    domain: 'Operations',
    branch: 'Maduravoyal',
    role: 'admin'
  });
  
  return res.json({ message: 'Admin account seeded successfully', admin: { email: newAdmin.email } });
});

// --- ASSET MANAGER ENDPOINTS ---

// Upload image endpoint for assets (available to authenticated users)
app.post('/api/assets/upload-image', authenticateToken, imageUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }
    
    const localPath = req.file.path;
    const filename = req.file.filename;
    const publicId = `assets/${filename.split('.')[0]}`;
    
    // Upload to Cloudinary if configured
    let imageUrl = await uploadToCloudinary(localPath, publicId, false);
    
    if (!imageUrl) {
      // Fallback to local URL path
      imageUrl = `/uploads/${filename}`;
    } else {
      // Cleanup local file if Cloudinary succeeds
      try {
        fs.unlinkSync(localPath);
      } catch (unlinkErr) {
        console.error('Error deleting temp file:', unlinkErr);
      }
    }
    
    return res.json({ imageUrl });
  } catch (err) {
    console.error('Error uploading asset image:', err);
    return res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Get all assets (available to authenticated users to populate dropdowns / see assignments)
app.get('/api/assets', authenticateToken, async (req, res) => {
  try {
    const assets = await db.listAllAssets();
    return res.json(assets);
  } catch (err) {
    console.error('Error fetching assets:', err);
    return res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

// Create asset (Admin only)
app.post('/api/assets', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const asset = req.body;
    if (!asset.assetTagId) {
      return res.status(400).json({ error: 'Asset Tag ID is required' });
    }
    const existing = await db.getAssetByTagId(asset.assetTagId);
    if (existing) {
      return res.status(400).json({ error: 'Asset Tag ID already exists' });
    }
    const newAsset = await db.createAsset({
      assetPhoto: asset.assetPhoto || '',
      assetTagId: asset.assetTagId,
      description: asset.description || '',
      brand: asset.brand || '',
      status: asset.status || 'Available',
      assignedTo: asset.assignedTo || '',
      assignedToName: asset.assignedToName || asset.assignedTo || ''
    });
    return res.status(201).json(newAsset);
  } catch (err) {
    console.error('Error creating asset:', err);
    return res.status(500).json({ error: 'Failed to create asset' });
  }
});

// Update asset (Admin only)
app.put('/api/assets/:tagId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { tagId } = req.params;
    const updated = await db.updateAsset(tagId, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    return res.json(updated);
  } catch (err) {
    console.error('Error updating asset:', err);
    return res.status(500).json({ error: 'Failed to update asset' });
  }
});

// Delete asset (Admin only)
app.delete('/api/assets/:tagId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { tagId } = req.params;
    await db.deleteAsset(tagId);
    return res.json({ message: 'Asset deleted successfully' });
  } catch (err) {
    console.error('Error deleting asset:', err);
    return res.status(500).json({ error: 'Failed to delete asset' });
  }
});

// List all verifications (Admin only)
app.get('/api/assets/verifications', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const verifications = await db.listAssetVerifications();
    return res.json(verifications);
  } catch (err) {
    console.error('Error fetching verifications:', err);
    return res.status(500).json({ error: 'Failed to fetch verifications' });
  }
});

// List all notifications/alerts (Admin only)
app.get('/api/assets/notifications', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const notifications = await db.listAssetNotifications();
    return res.json(notifications);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Resolve notification (Admin only)
app.post('/api/assets/notifications/:id/resolve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const resolved = await db.resolveAssetNotification(id);
    if (!resolved) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    return res.json(resolved);
  } catch (err) {
    console.error('Error resolving notification:', err);
    return res.status(500).json({ error: 'Failed to resolve notification' });
  }
});

// Get user's latest verification for the current calendar month
app.get('/api/assets/verifications/my-latest', authenticateToken, async (req, res) => {
  try {
    const userEmail = req.user.email.toLowerCase();
    const verifications = await db.listAssetVerifications();
    
    // Find verifications matching this user's email
    const userVers = verifications.filter(v => v.email && v.email.toLowerCase() === userEmail);
    
    // Check if any matches the current month (format YYYY-MM)
    const currentMonth = new Date().toISOString().substring(0, 7); // e.g. "2026-06"
    const currentVer = userVers.find(v => v.month === currentMonth);
    
    // Extract currently checked-out assets from inventory
    const allAssets = await db.listAllAssets();
    const myAssets = allAssets.filter(a => a.assignedTo && a.assignedTo.toLowerCase() === userEmail);
    
    return res.json({
      verifiedThisMonth: !!currentVer,
      latestVerification: currentVer || null,
      myAssets
    });
  } catch (err) {
    console.error('Error fetching latest verification:', err);
    return res.status(500).json({ error: 'Failed to fetch latest verification' });
  }
});

// Submit user verification/declaration
app.post('/api/assets/verifications', authenticateToken, async (req, res) => {
  try {
    let { 
      month, 
      assets, 
      hasIssues, 
      repairedHandedOver, 
      newDeviceReceived, 
      newAssetTagId,
      isInitialDeclaration 
    } = req.body;

    const userEmail = req.user.email.toLowerCase();
    const userName = req.user.name;

    if (!month) {
      return res.status(400).json({ error: 'Month parameter is required' });
    }

    // Sanitize assets codes and phone numbers (remove spaces, uppercase)
    if (assets && Array.isArray(assets)) {
      assets = assets.map(item => {
        const cleaned = { ...item };
        if (cleaned.code) {
          cleaned.code = cleaned.code.replace(/\s+/g, '').toUpperCase();
        }
        if (cleaned.phoneNumber) {
          cleaned.phoneNumber = cleaned.phoneNumber.replace(/\s+/g, '');
        }
        return cleaned;
      });
    }

    if (newAssetTagId) {
      newAssetTagId = newAssetTagId.replace(/\s+/g, '').toUpperCase();
    }

    // Save verification entry
    const verification = await db.createAssetVerification({
      userId: req.user.userId,
      name: userName,
      email: userEmail,
      month,
      assets: assets || [],
      hasIssues: !!hasIssues,
      repairedHandedOver: repairedHandedOver !== undefined ? repairedHandedOver : null,
      newDeviceReceived: newDeviceReceived !== undefined ? newDeviceReceived : null,
      newAssetTagId: newAssetTagId || null
    });

    const notificationsCreated = [];

    if (isInitialDeclaration) {
      // 1. First-time declaration logic
      let simDetailsList = [];
      let laptopDetail = 'None';
      let mobileDetail = 'None';

      for (const item of (assets || [])) {
        if (item.type === 'Laptop') {
          laptopDetail = item.code;
          let asset = await db.getAssetByTagId(item.code);
          if (asset) {
            await db.updateAsset(item.code, { 
              status: 'Checked out', 
              assignedTo: userEmail, 
              assignedToName: userName,
              assetPhoto: item.photo || asset.assetPhoto || ''
            });
          } else {
            await db.createAsset({
              assetPhoto: item.photo || '',
              assetTagId: item.code,
              description: 'Laptop (Auto-created on declaration)',
              brand: 'Laptop',
              status: 'Checked out',
              assignedTo: userEmail,
              assignedToName: userName
            });
          }
        } else if (item.type === 'Mobile') {
          mobileDetail = item.code;
          let asset = await db.getAssetByTagId(item.code);
          if (asset) {
            await db.updateAsset(item.code, { 
              status: 'Checked out', 
              assignedTo: userEmail, 
              assignedToName: userName,
              assetPhoto: item.photo || asset.assetPhoto || ''
            });
          } else {
            await db.createAsset({
              assetPhoto: item.photo || '',
              assetTagId: item.code,
              description: 'Mobile (Auto-created on declaration)',
              brand: 'Mobile',
              status: 'Checked out',
              assignedTo: userEmail,
              assignedToName: userName
            });
          }
        } else if (item.type === 'SIM') {
          const providerStr = item.provider || 'Airtel';
          simDetailsList.push(`${item.phoneNumber} (${providerStr})`);
          
          const simTagId = `SIM-${item.phoneNumber}`;
          let asset = await db.getAssetByTagId(simTagId);
          if (asset) {
            await db.updateAsset(simTagId, {
              status: 'Checked out',
              assignedTo: userEmail,
              assignedToName: userName,
              assetPhoto: item.photo || asset.assetPhoto || ''
            });
          } else {
            await db.createAsset({
              assetPhoto: item.photo || '',
              assetTagId: simTagId,
              description: `SIM Card - ${providerStr} (${item.phoneNumber})`,
              brand: providerStr,
              status: 'Checked out',
              assignedTo: userEmail,
              assignedToName: userName
            });
          }
        }
      }

      const simDetailsText = simDetailsList.length > 0 ? simDetailsList.join(', ') : 'None';
      const msg = `User ${userName} submitted asset declaration for ${month}. Laptop: ${laptopDetail}, Mobile: ${mobileDetail}, SIMs: ${simDetailsText}.`;
      
      const notif = await db.createAssetNotification({
        userEmail,
        userName,
        type: 'declaration',
        message: msg,
        details: { verificationId: verification.id, assets }
      });
      notificationsCreated.push(notif);

    } else {
      // 2. Monthly check-in verification logic
      if (!hasIssues) {
        const msg = `User ${userName} verified assets for ${month}. Status: All assets are working fine (no repairs, no defects).`;
        const notif = await db.createAssetNotification({
          userEmail,
          userName,
          type: 'verification_ok',
          message: msg,
          details: { verificationId: verification.id }
        });
        notificationsCreated.push(notif);
      } else {
        let issueMsg = `User ${userName} reported asset issues for ${month}.`;
        issueMsg += ` Repaired device handed over: ${repairedHandedOver ? 'Yes' : 'No'}.`;
        issueMsg += ` New device received: ${newDeviceReceived ? 'Yes' : 'No'}.`;
        
        if (newDeviceReceived && newAssetTagId) {
          issueMsg += ` New Asset ID entered: ${newAssetTagId}.`;
        }

        const notifType = newDeviceReceived ? 'verification_issue' : 'no_device_alert';
        
        const notif = await db.createAssetNotification({
          userEmail,
          userName,
          type: notifType,
          message: issueMsg,
          details: { 
            verificationId: verification.id, 
            repairedHandedOver, 
            newDeviceReceived, 
            newAssetTagId 
          }
        });
        notificationsCreated.push(notif);

        const allAssets = await db.listAllAssets();
        const userAssigned = allAssets.filter(a => a.assignedTo && a.assignedTo.toLowerCase() === userEmail);

        if (repairedHandedOver) {
          for (const asset of userAssigned) {
            await db.updateAsset(asset.assetTagId, { status: 'Under repair' });
          }
        }

        if (newDeviceReceived && newAssetTagId) {
          if (repairedHandedOver) {
            for (const asset of userAssigned) {
              await db.updateAsset(asset.assetTagId, { status: 'Under repair', assignedTo: '', assignedToName: '' });
            }
          }

          let newAsset = await db.getAssetByTagId(newAssetTagId);
          if (newAsset) {
            await db.updateAsset(newAssetTagId, { 
              status: 'Checked out', 
              assignedTo: userEmail, 
              assignedToName: userName,
              assetPhoto: req.body.newDevicePhoto || newAsset.assetPhoto || ''
            });
          } else {
            await db.createAsset({
              assetPhoto: req.body.newDevicePhoto || '',
              assetTagId: newAssetTagId,
              description: 'Replacement Device (Auto-created on verification)',
              brand: 'Replacement',
              status: 'Checked out',
              assignedTo: userEmail,
              assignedToName: userName
            });
          }
        }
      }
    }

    return res.status(201).json({
      message: 'Verification submitted successfully',
      verification,
      notifications: notificationsCreated
    });
  } catch (err) {
    console.error('Error submitting verification:', err);
    return res.status(500).json({ error: 'Failed to submit verification' });
  }
});

// Download Excel Report (Admin only)
app.get('/api/assets/reports/download', authenticateToken, requireAdmin, async (req, res) => {
  const { year, month } = req.query;
  try {
    const assets = await db.listAllAssets();
    const verifications = await db.listAssetVerifications();
    const notifications = await db.listAssetNotifications();

    const dataPayload = {
      assets,
      verifications,
      notifications
    };

    const outputFilename = `AssetReport-${year || 'ALL'}-${month || 'ALL'}-${Date.now()}.xlsx`;
    const outputPath = path.join(__dirname, 'uploads', outputFilename);

    const pyScript = path.join(__dirname, 'generate_asset_report.py');
    
    let pythonCmd = 'python';
    try {
      execSync('python --version', { stdio: 'ignore' });
    } catch (e) {
      pythonCmd = 'python3';
    }

    const { spawn } = require('child_process');
    const args = ['-u', pyScript, '--output', outputPath];
    if (year) args.push('--year', year);
    if (month) args.push('--month', month);

    const pyProcess = spawn(pythonCmd, args);

    let stderr = '';
    
    pyProcess.stdin.write(JSON.stringify(dataPayload));
    pyProcess.stdin.end();

    pyProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pyProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python script failed with code ${code}. Stderr: ${stderr}`);
        return res.status(500).json({ error: `Python report generation failed: ${stderr}` });
      }

      if (!fs.existsSync(outputPath)) {
        return res.status(500).json({ error: 'Failed to generate report file' });
      }

      res.download(outputPath, outputFilename, (err) => {
        if (err) {
          console.error('Error downloading report file:', err);
        }
        try {
          fs.unlinkSync(outputPath);
        } catch (unlinkErr) {
          console.error('Error deleting temp report file:', unlinkErr);
        }
      });
    });

  } catch (err) {
    console.error('Error generating download report:', err);
    return res.status(500).json({ error: 'Failed to generate download report' });
  }
});

// Database Migration for Domain Categories
async function migrateDomainCategories() {
  try {
    console.log('Running domain category database migration...');
    const usersList = await db.listUsers();
    const tasksList = await db.getAllTasks();

    // 1. Migrate Users
    for (const user of usersList) {
      if (user.domain) {
        let updatedDomain = null;
        const lowerDom = user.domain.toLowerCase();
        
        if (lowerDom === 'sales') {
          updatedDomain = 'Academic Counselling Team';
        } else if (lowerDom === 'accounts') {
          updatedDomain = 'Accounts & Development Team';
        } else if (['support', 'hr', 'operations'].includes(lowerDom)) {
          updatedDomain = 'Pending';
        }

        if (updatedDomain) {
          await db.updateUser(user.id, { domain: updatedDomain });
          console.log(`Migrated user ${user.email} domain from "${user.domain}" to "${updatedDomain}"`);
        }
      }
    }

    // 2. Migrate Tasks
    for (const task of tasksList) {
      if (task.assignedTo) {
        let updatedAssignee = null;
        const lowerAssignee = task.assignedTo.toLowerCase();

        if (lowerAssignee === 'sales') {
          updatedAssignee = 'Academic Counselling Team';
        } else if (lowerAssignee === 'accounts') {
          updatedAssignee = 'Accounts & Development Team';
        } else if (['support', 'hr', 'operations'].includes(lowerAssignee)) {
          await db.deleteTask(task.id);
          console.log(`Deleted task "${task.title}" (ID: ${task.id}) assigned to removed domain: ${task.assignedTo}`);
          continue;
        }

        if (updatedAssignee) {
          await db.updateTask(task.id, { assignedTo: updatedAssignee });
          console.log(`Migrated task "${task.title}" assignee from "${task.assignedTo}" to "${updatedAssignee}"`);
        }
      }
    }

    console.log('Domain category database migration completed successfully.');
  } catch (err) {
    console.error('Error running domain categories migration:', err);
  }
}

// --- WEB MONITORING CRAWLER HELPERS ---

const crypto = require('crypto');
const cheerio = require('cheerio');

function extractTextFromHtml(html) {
  let clean = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
  clean = clean.replace(/<[^>]+>/g, ' ');
  clean = clean.replace(/&nbsp;/g, ' ')
               .replace(/&amp;/g, '&')
               .replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>');
  return clean.replace(/\s+/g, ' ').trim();
}

function isProxyRequired(url) {
  const protectedDomains = ['tneaonline.org', 'tnhealth.tn.gov.in', 'aaccc.gov.in'];
  return protectedDomains.some(domain => url.includes(domain));
}

async function fetchWithFallbackScraper(targetUrl, signal = null) {
  const isProtected = isProxyRequired(targetUrl);
  
  // Define providers in order of preference/credits
  const providers = [];

  if (scrapingAntApiKey) {
    providers.push({
      name: 'ScrapingAnt',
      buildUrl: (url) => {
        const renderParam = isProtected ? '&browser=true&proxy_country=in' : '&browser=false';
        return `https://api.scrapingant.com/v2/general?x-api-key=${scrapingAntApiKey}&url=${encodeURIComponent(url)}${renderParam}`;
      }
    });
  }

  if (crawlbaseToken) {
    providers.push({
      name: 'Crawlbase',
      buildUrl: (url) => {
        const geoParam = isProtected ? '&country=in' : '';
        return `https://api.crawlbase.com/?token=${crawlbaseToken}&url=${encodeURIComponent(url)}${geoParam}`;
      }
    });
  }

  if (scrapingBeeApiKey) {
    providers.push({
      name: 'ScrapingBee',
      buildUrl: (url) => {
        const renderParam = isProtected ? '&render_js=true&country_code=in&premium_proxy=true' : '&render_js=false';
        return `https://app.scrapingbee.com/api/v1/?api_key=${scrapingBeeApiKey}&url=${encodeURIComponent(url)}${renderParam}`;
      }
    });
  }

  if (scrapeDoApiKey) {
    providers.push({
      name: 'Scrape.do',
      buildUrl: (url) => {
        const superParam = isProtected ? '&super=true&render=true&geoCode=in' : '';
        return `https://api.scrape.do?token=${scrapeDoApiKey}&url=${encodeURIComponent(url)}${superParam}`;
      }
    });
  }

  console.log(`[Scraper] Request received for: ${targetUrl}. Protected: ${isProtected}`);

  // Try each configured API sequentially, each with its own 25s timeout.
  // This prevents a single slow provider from consuming the full 90s budget.
  for (const provider of providers) {
    // Check if the outer (global) signal has already aborted
    if (signal && signal.aborted) break;

    try {
      const apiUrl = provider.buildUrl(targetUrl);
      console.log(`[Scraper] Fetching via ${provider.name}...`);

      // Per-provider 25s timeout
      const perProviderController = new AbortController();
      const perProviderTimeout = setTimeout(() => perProviderController.abort(), 25000);

      // Forward the global abort signal to per-provider controller
      const onGlobalAbort = () => perProviderController.abort();
      if (signal) signal.addEventListener('abort', onGlobalAbort, { once: true });

      let response;
      try {
        response = await fetch(apiUrl, { signal: perProviderController.signal });
      } finally {
        clearTimeout(perProviderTimeout);
        if (signal) signal.removeEventListener('abort', onGlobalAbort);
      }

      // 409 = ScrapingAnt free-tier concurrency limit — skip to next provider
      if (response.status === 409) {
        console.warn(`[Scraper] ${provider.name} hit concurrency limit (409). Skipping...`);
        continue;
      }

      if (response.ok) {
        console.log(`[Scraper] Success using ${provider.name}`);
        return response;
      }

      console.warn(`[Scraper] ${provider.name} returned status ${response.status}. Trying next provider...`);
    } catch (err) {
      if (signal && signal.aborted) {
        console.warn(`[Scraper] Global timeout hit — stopping provider chain.`);
        break;
      }
      console.warn(`[Scraper] ${provider.name} timed out/errored (${err.message}). Trying next...`);
    }
  }

  // Fallback to direct fetch
  console.warn(`[Scraper] All scraper APIs failed or none configured. Trying direct fallback fetch...`);
  const fallbackOpts = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  };
  if (signal) fallbackOpts.signal = signal;
  if (proxyDispatcher) {
    fallbackOpts.dispatcher = proxyDispatcher;
  }
  return await fetch(targetUrl, fallbackOpts);
}

async function checkWebsiteForChanges(site) {
  let text = '';
  let scrapedVia = 'Cheerio Fast Fetch';
  let selectorNotFound = false;
  
  const isSairamNcc = site.url.includes('sairamncc.in') || site.url.includes('ncc-sairam');
  
  if (isSairamNcc) {
    console.log(`Checking Sairam NCC website "${site.name}" using Firestore REST API...`);
    scrapedVia = 'Firestore REST API';
    try {
      const projectId = 'ncc-sairam-website';
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/announcements`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.documents && data.documents.length > 0) {
          const list = data.documents.map(doc => {
            const fields = doc.fields || {};
            const title = fields.title?.stringValue || '';
            const content = fields.content?.stringValue || '';
            const createdAt = fields.createdAt?.timestampValue 
              ? new Date(fields.createdAt.timestampValue).toLocaleDateString()
              : '';
            return `[${createdAt}] ${title}: ${content}`;
          });
          text = list.join('\n');
        } else {
          text = "No announcements found.";
        }
      } else {
        throw new Error(`Firestore API returned status ${res.status}`);
      }
    } catch (err) {
      console.error('Error fetching Sairam NCC Firestore documents:', err.message);
      text = `[ERROR] Failed to fetch announcements directly from Firestore: ${err.message}`;
    }
  } else {
    // For other websites, use standard Cheerio scraper
    try {
      console.log(`Checking website "${site.name}" (${site.url}) using multi-provider fallback scraper...`);
      
      let response;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s timeout
      
      try {
        response = await fetchWithFallbackScraper(site.url, controller.signal);
      } catch (fetchErr) {
        console.warn(`Fetch error for ${site.name}: ${fetchErr.message}`);
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response || !response.ok) {
        throw new Error(response ? `Server returned status: ${response.status}` : 'Fetch failed completely');
      }
      
      if (response.ok) {
        const html = await response.text();
        const $ = cheerio.load(html);
        
        if (site.selector) {
          const elements = $(site.selector);
          if (elements.length > 0) {
            const clone = elements.clone();
            clone.find('script, style, noscript, iframe, svg').remove();
            text = clone.map((i, el) => $(el).text() || '').get().join('\n').replace(/\s+/g, ' ').trim();
          } else {
            selectorNotFound = true;
            text = `[SELECTOR NOT FOUND] The CSS selector "${site.selector}" could not be found on the page.`;
          }
        } else {
          const clone = $('body').clone();
          clone.find('script, style, noscript, iframe, svg').remove();
          text = clone.text().replace(/\s+/g, ' ').trim();
        }
      } else {
        throw new Error(`Server returned status: ${response.status}`);
      }
    } catch (err) {
      console.error(`Cheerio scrape failed for ${site.name}:`, err.message, err.cause);
      const causeStr = err.cause ? ` (Cause: ${err.cause.message || err.cause})` : '';
      text = `[ERROR] Failed to scrape website: ${err.message}${causeStr}`;
    }
  }
  
  const hash = crypto.createHash('md5').update(text).digest('hex');
  const previousHash = site.lastContentHash;
  const nowStr = new Date().toISOString();
  const cleanSnippet = text.substring(0, 300) + (text.length > 300 ? '...' : '');
  
  await db.updateTrackedWebsite(site.id, {
    lastContentHash: hash,
    lastCheckedAt: nowStr,
    latestContentText: cleanSnippet,
    scrapedVia
  });
  
  if (selectorNotFound) {
    console.warn(`Selector "${site.selector}" not found on page ${site.name}`);
    return false;
  }
  
  if (!previousHash) {
    console.log(`Initialized content hash for tracked website: ${site.name} (${site.url})`);
    return false;
  }
  
  if (hash !== previousHash) {
    console.log(`Detected change on monitored website: ${site.name} (${site.url})`);
    const snippetLimit = text.substring(0, 180) + (text.length > 180 ? '...' : '');
    
    const changeTitle = `Change detected on ${site.name}`;
    const changeDesc = site.selector 
      ? `Selected element change detected. Content: "${snippetLimit}"` 
      : `Content updated on website. Preview: "${snippetLimit}"`;

    await db.createWebNotification({
      websiteId: site.id,
      websiteName: site.name,
      url: site.url,
      title: changeTitle,
      description: changeDesc,
      createdAt: nowStr
    });
    
    // Trigger SMTP / Resend alert email in background
    sendWatchlistAlertEmail(site.name, site.url, changeTitle, changeDesc).catch(err => {
      console.error('Error dispatching watchlist alert email:', err);
    });
    
    return true;
  }
  
  return false;
}

let lastBackgroundCheckTime = 0;

async function triggerBackgroundWebCheck() {
  const now = Date.now();
  // Throttle: don't run more than once every 30 minutes
  if (now - lastBackgroundCheckTime < 30 * 60 * 1000) {
    return;
  }
  lastBackgroundCheckTime = now;
  console.log('Running background web monitor check...');
  try {
    const sites = await db.listTrackedWebsites();
    for (const site of sites) {
      if (site.enabled !== false) {
        await checkWebsiteForChanges(site);
        // Add 2-second cooldown to respect Scrape.do's rate limit
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  } catch (err) {
    console.error('Error in background web monitor check:', err);
  }
}

function startWebNotificationCrawlLoop() {
  // Run initial check on startup after a 10s delay
  setTimeout(() => {
    triggerBackgroundWebCheck().catch(err => console.error(err));
  }, 10000);

  // Set interval to check every 30 minutes
  setInterval(async () => {
    await triggerBackgroundWebCheck();
  }, 30 * 60 * 1000);
}

// --- WEB MONITORING REST ROUTING (Admin only) ---
app.get('/api/admin/web-notifications/sites', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const sites = await db.listTrackedWebsites();
    res.json(sites);
  } catch (err) {
    console.error('Error listing tracked sites:', err);
    res.status(500).json({ error: 'Failed to list tracked websites' });
  }
});

app.post('/api/admin/web-notifications/sites', authenticateToken, requireAdmin, async (req, res) => {
  const { url, name, selector } = req.body;
  if (!url || !name) {
    return res.status(400).json({ error: 'Name and URL are required' });
  }
  try {
    const newSite = await db.createTrackedWebsite({ url, name, selector, enabled: true });
    checkWebsiteForChanges(newSite).catch(err => {
      console.error(`Initial check background error for ${name}:`, err);
    });
    res.status(201).json(newSite);
  } catch (err) {
    console.error('Error adding tracked site:', err);
    res.status(500).json({ error: 'Failed to add tracked website' });
  }
});

app.patch('/api/admin/web-notifications/sites/:id/toggle', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { enabled } = req.body;
  try {
    const sites = await db.listTrackedWebsites();
    const site = sites.find(s => s.id === id);
    if (!site) {
      return res.status(404).json({ error: 'Website not found' });
    }
    await db.updateTrackedWebsite(id, { enabled: !!enabled });
    res.json({ message: `Website monitor ${enabled ? 'enabled' : 'disabled'} successfully`, site: { ...site, enabled: !!enabled } });
  } catch (err) {
    console.error('Error toggling website monitor:', err);
    res.status(500).json({ error: 'Failed to toggle website monitor' });
  }
});

app.delete('/api/admin/web-notifications/sites/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await db.deleteTrackedWebsite(id);
    res.json({ message: 'Tracked website deleted successfully' });
  } catch (err) {
    console.error('Error deleting tracked site:', err);
    res.status(500).json({ error: 'Failed to delete tracked website' });
  }
});

// Custom auth that also accepts token via query param (needed for iframe src)
const authenticateTokenOrQuery = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;
  if (!token) return res.status(401).send('Access token required');
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).send('Invalid or expired token');
    req.user = user;
    next();
  });
};

app.get('/api/admin/web-notifications/proxy', authenticateTokenOrQuery, requireAdmin, async (req, res) => {
  let targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send('URL query parameter is required');
  }

  // Prepend protocol if missing
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = 'https://' + targetUrl;
  }

  try {
    console.log(`Proxying request for visual selector: ${targetUrl}`);
    let response;
    try {
      response = await fetchWithFallbackScraper(targetUrl);
    } catch (fetchErr) {
      console.warn(`Visual Selector proxy fetch error: ${fetchErr.message}`);
    }

    if (!response || !response.ok) {
      const status = response ? response.status : 502;
      return res.status(status).send(`Failed to fetch target URL. Status: ${status}`);
    }

    const rawHtml = await response.text();
    const $ = cheerio.load(rawHtml);

    // Prepend base tag to head
    $('head').prepend(`<base href="${targetUrl}">`);

    // Inject highlighting styles
    $('head').append(`
      <style>
        .antigravity-hovered {
          outline: 2px solid #2563eb !important;
          outline-offset: -2px !important;
          background-color: rgba(37, 99, 235, 0.15) !important;
          cursor: pointer !important;
        }
        .antigravity-selected {
          outline: 3px solid #16a34a !important;
          outline-offset: -3px !important;
          background-color: rgba(22, 163, 74, 0.25) !important;
        }
      </style>
    `);

    // Inject selector JavaScript
    $('body').append(`
      <script>
        (function() {
          window.selectMode = true;
          window.proxyToken = '';  // filled by parent via postMessage

          window.addEventListener('message', function(e) {
            if (!e.data) return;
            if (e.data.type === 'SET_SELECT_MODE') {
              window.selectMode = e.data.enabled;
              if (!window.selectMode) {
                document.querySelectorAll('.antigravity-hovered')
                  .forEach(el => el.classList.remove('antigravity-hovered'));
              }
            }
            if (e.data.type === 'SET_TOKEN') {
              window.proxyToken = e.data.token || '';
            }
          });

          function getCssSelector(el) {
            if (!(el instanceof Element)) return '';
            const path = [];
            let current = el;
            while (current && current.nodeType === Node.ELEMENT_NODE) {
              let selector = current.nodeName.toLowerCase();
              if (current.id) {
                selector += '#' + CSS.escape(current.id);
                path.unshift(selector);
                break;
              }
              let className = (current.className || '').toString()
                .replace(/antigravity-hovered|antigravity-selected/g, '').trim();
              if (className) {
                const classes = className.split(/\\s+/).filter(c => c && !c.includes(':'));
                if (classes.length > 0) selector += '.' + classes.slice(0, 2).join('.');
              }
              let sibling = current.previousElementSibling;
              let nth = 1;
              while (sibling) { nth++; sibling = sibling.previousElementSibling; }
              if (nth > 1) selector += ':nth-child(' + nth + ')';
              path.unshift(selector);
              current = current.parentElement;
            }
            return path.join(' > ');
          }

          // ── Hover highlighting (SELECT mode only) ──
          let lastHovered = null;
          document.addEventListener('mousemove', function(e) {
            if (!window.selectMode) return;
            const target = e.target;
            if (target === lastHovered) return;
            if (lastHovered) lastHovered.classList.remove('antigravity-hovered');
            if (target && target.tagName !== 'BODY' && target.tagName !== 'HTML') {
              target.classList.add('antigravity-hovered');
              lastHovered = target;
            } else {
              lastHovered = null;
            }
          }, true);

          // ── Click handler ──
          document.addEventListener('click', function(e) {
            if (window.selectMode) {
              // In SELECT mode: capture selector and prevent navigation
              e.preventDefault();
              e.stopPropagation();
              const target = e.target;
              target.classList.remove('antigravity-hovered');
              
              // Toggle selection
              if (target.classList.contains('antigravity-selected')) {
                target.classList.remove('antigravity-selected');
              } else {
                target.classList.add('antigravity-selected');
              }
              
              // Collect selectors and text from all selected elements
              const selectedEls = document.querySelectorAll('.antigravity-selected');
              const selectors = [];
              const texts = [];
              
              selectedEls.forEach(el => {
                selectors.push(getCssSelector(el));
                const txt = (el.innerText || el.textContent || '').trim();
                if (txt) {
                  texts.push(txt);
                }
              });
              
              const combinedSelector = selectors.join(', ');
              const combinedText = texts.join('\\n\\n--- Element ---\\n\\n');
              
              window.parent.postMessage({ 
                type: 'SELECTOR_SELECTED', 
                selector: combinedSelector, 
                text: combinedText 
              }, '*');
            } else {
              // In BROWSE mode: let JS run naturally, only intercept real page navigations
              const anchor = e.target.closest('a[href]');
              if (anchor) {
                const href = anchor.getAttribute('href') || '';
                // Allow: hash links, javascript: links, same-page anchors → let them fire naturally
                if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
                
                try {
                  const resolved = new URL(href, document.baseURI);
                  const currentTargetStr = new URLSearchParams(window.location.search).get('url');
                  if (currentTargetStr) {
                    const currentTarget = new URL(currentTargetStr);
                    // Check if it's the same page (same origin, pathname, search) - let JS run
                    if (resolved.origin === currentTarget.origin &&
                        resolved.pathname === currentTarget.pathname &&
                        resolved.search === currentTarget.search) {
                      return; // Let it fire naturally!
                    }
                  }
                  
                  // For real navigations: rewrite through proxy preserving token
                  e.preventDefault();
                  e.stopPropagation();
                  const proxyUrl = '/api/admin/web-notifications/proxy?url='
                    + encodeURIComponent(resolved.href)
                    + (window.proxyToken ? '&token=' + encodeURIComponent(window.proxyToken) : '');
                  window.location.href = proxyUrl;
                } catch(err) {
                  // If URL resolution fails, let it go
                }
              }
              // All other clicks (buttons, div toggles, JS menus) fire normally in browse mode
            }
          }, true);

          // Notify parent that iframe is ready so parent can send the token
          window.parent.postMessage({ type: 'IFRAME_READY' }, '*');
        })();
      </script>
    `);


    res.send($.html());
  } catch (err) {
    console.error('Proxy error:', err, err.cause);
    const causeStr = err.cause ? ` (Cause: ${err.cause.message || err.cause})` : '';
    res.status(500).send(`Error proxying website: ${err.message}${causeStr}`);
  }
});


app.post('/api/admin/web-notifications/sites/:id/check', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const sites = await db.listTrackedWebsites();
    const site = sites.find(s => s.id === id);
    if (!site) {
      return res.status(404).json({ error: 'Website not found' });
    }
    const changed = await checkWebsiteForChanges(site);
    res.json({ message: changed ? 'Change detected!' : 'No changes detected.' });
  } catch (err) {
    console.error('Error checking single site:', err);
    res.status(500).json({ error: 'Failed to check website' });
  }
});

app.get('/api/admin/web-notifications', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const notifications = await db.listWebNotifications();
    res.json(notifications);
  } catch (err) {
    console.error('Error listing notifications:', err);
    res.status(500).json({ error: 'Failed to list notifications' });
  }
});

app.post('/api/admin/web-notifications/clear', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.clearWebNotifications();
    res.json({ message: 'All web notifications cleared' });
  } catch (err) {
    console.error('Error clearing notifications:', err);
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

app.post('/api/admin/web-notifications/sites/:id/clear-alerts', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await db.clearWebNotificationsForSite(id);
    res.json({ message: 'Alerts cleared for website' });
  } catch (err) {
    console.error('Error clearing alerts for website:', err);
    res.status(500).json({ error: 'Failed to clear alerts' });
  }
});


app.post('/api/admin/web-notifications/trigger-check', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('Manual web monitor check triggered by admin');
    const sites = await db.listTrackedWebsites();
    let changeCount = 0;
    for (const site of sites) {
      if (site.enabled !== false) {
        const changed = await checkWebsiteForChanges(site);
        if (changed) changeCount++;
        // Add 2-second cooldown to respect Scrape.do's rate limit
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    res.json({ message: `Check completed. Detected changes on ${changeCount} site(s).` });
  } catch (err) {
    console.error('Error triggering web check:', err);
    res.status(500).json({ error: 'Failed to check websites' });
  }
});

app.post('/api/admin/web-notifications/simulate-change/:siteId', authenticateToken, requireAdmin, async (req, res) => {
  const { siteId } = req.params;
  try {
    const sites = await db.listTrackedWebsites();
    const site = sites.find(s => s.id === siteId);
    if (!site) {
      return res.status(404).json({ error: 'Website not found' });
    }
    
    let updates = [];
    const lowerName = site.name.toLowerCase();
    const lowerUrl = site.url.toLowerCase();
    
    if (lowerName.includes('ncc') || lowerUrl.includes('ncc') || lowerName.includes('sairam') || lowerName.includes('college') || lowerName.includes('univ')) {
      updates = [
        "New announcement: 'CATC camp registrations are now open for Navy Wing.'",
        "Notice: 'Updated department-wise cadet selection list for Academic Year 2026.'",
        "Circular: 'Upcoming training camp schedules updated on portal.'",
        "Attention: 'NCC B & C Certificate examinations dates announced.'"
      ];
    } else {
      updates = [
        "Added a new post: 'Latest system features and portal updates.'",
        "Updated contact details: official support phone number updated.",
        "Added a new banner notification: 'Upcoming System Maintenance on Sunday.'",
        "Notice: 'Privacy policy and user guidelines updated.'"
      ];
    }
    
    const randomUpdate = updates[Math.floor(Math.random() * updates.length)];
    const mockContent = `[SIMULATED CHANGE] Content updated on website. Detail: ${randomUpdate}`;
    const mockHash = crypto.createHash('md5').update(mockContent).digest('hex');
    const nowStr = new Date().toISOString();
    
    await db.updateTrackedWebsite(site.id, {
      lastContentHash: mockHash,
      lastCheckedAt: nowStr,
      latestContentText: mockContent
    });
    
    const changeTitle = `Change detected on ${site.name}`;
    await db.createWebNotification({
      websiteId: site.id,
      websiteName: site.name,
      url: site.url,
      title: changeTitle,
      description: mockContent,
      createdAt: nowStr
    });
    
    // Trigger simulated alert email
    sendWatchlistAlertEmail(site.name, site.url, `[SIMULATION] ${changeTitle}`, mockContent).catch(err => {
      console.error('Error dispatching simulated alert email:', err);
    });
    
    res.json({ message: `Simulated change notification created for ${site.name}.` });
  } catch (err) {
    console.error('Error simulating change:', err);
    res.status(500).json({ error: 'Failed to simulate change' });
  }
});

// ======================================================
// WhatsApp Business API Integration
// ======================================================
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_WABA_ID = process.env.WHATSAPP_WABA_ID;
const WHATSAPP_GYC_PHONE_NUMBER_ID = process.env.WHATSAPP_GYC_PHONE_NUMBER_ID;
const WHATSAPP_VTR_PHONE_NUMBER_ID = process.env.WHATSAPP_VTR_PHONE_NUMBER_ID;
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'calllogiq_whatsapp_verify_token_2026';

// Helper to send message via Meta WhatsApp Cloud API
async function sendMetaWhatsAppMessage(portal, to, payload) {
  const phoneId = portal === 'gyc' ? WHATSAPP_GYC_PHONE_NUMBER_ID : WHATSAPP_VTR_PHONE_NUMBER_ID;
  if (!phoneId) throw new Error(`Phone ID for portal ${portal} is not configured`);
  if (!WHATSAPP_TOKEN) throw new Error('WhatsApp access token is not configured');

  const url = `https://graph.facebook.com/v18.0/${phoneId}/messages`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      ...payload
    })
  });

  const resJson = await response.json();
  if (!response.ok) {
    console.error('Meta API Error Response:', JSON.stringify(resJson, null, 2));
    throw new Error(resJson.error?.message || 'Meta API returned an error');
  }
  return resJson;
}

// 1. Webhook Verification (GET)
app.get('/api/admin/whatsapp/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode && token) {
    if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
      console.log('WhatsApp webhook verified successfully!');
      return res.status(200).send(challenge);
    }
  }
  return res.status(403).send('Verification failed');
});

// Debugging endpoint for webhook events and environment configuration
app.get('/api/admin/whatsapp/webhook-debug', (req, res) => {
  res.json({
    firebaseInitialized: admin.apps.length > 0,
    env: {
      WHATSAPP_TOKEN: WHATSAPP_TOKEN ? `${WHATSAPP_TOKEN.substring(0, 10)}... (length: ${WHATSAPP_TOKEN.length})` : 'missing',
      WHATSAPP_WABA_ID: WHATSAPP_WABA_ID || 'missing',
      WHATSAPP_GYC_PHONE_NUMBER_ID: WHATSAPP_GYC_PHONE_NUMBER_ID || 'missing',
      WHATSAPP_VTR_PHONE_NUMBER_ID: WHATSAPP_VTR_PHONE_NUMBER_ID || 'missing',
      WHATSAPP_VERIFY_TOKEN: WHATSAPP_VERIFY_TOKEN || 'missing',
      PORT: process.env.PORT || 'missing',
      NODE_ENV: process.env.NODE_ENV || 'missing'
    },
    logs: global.whatsappWebhookLogs || []
  });
});

// Endpoint to check who the currently active token belongs to
app.get('/api/admin/whatsapp/token-check', async (req, res) => {
  if (!WHATSAPP_TOKEN) {
    return res.json({ error: 'WHATSAPP_TOKEN is missing' });
  }
  try {
    const response = await fetch('https://graph.facebook.com/v19.0/me?fields=id,name', {
      headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` }
    });
    const resJson = await response.json();
    res.json(resJson);
  } catch (err) {
    res.json({ error: err.message });
  }
});

// 2. Webhook Event Handler (POST)
app.post('/api/admin/whatsapp/webhook', async (req, res) => {
  const body = req.body;
  
  // Acknowledge receipt of the webhook to Meta immediately
  res.sendStatus(200);

  // Store in global logs for debugging
  if (!global.whatsappWebhookLogs) {
    global.whatsappWebhookLogs = [];
  }
  global.whatsappWebhookLogs.unshift({
    timestamp: new Date().toISOString(),
    headers: req.headers,
    body: body
  });
  if (global.whatsappWebhookLogs.length > 50) {
    global.whatsappWebhookLogs.pop();
  }

  try {
    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          const value = change.value;
          if (!value) continue;
          
          const metadata = value.metadata || {};
          const phoneId = metadata.phone_number_id;
          let portal = null;
          if (phoneId === WHATSAPP_GYC_PHONE_NUMBER_ID) portal = 'gyc';
          else if (phoneId === WHATSAPP_VTR_PHONE_NUMBER_ID) portal = 'vtr';
          
          if (!portal) continue; // ignore unregistered numbers
          
          // Handle delivery status updates
          if (value.statuses && value.statuses.length > 0) {
            for (const statusObj of value.statuses) {
              const msgId = statusObj.id;
              const status = statusObj.status; // delivered, read, failed, etc.
              await db.updateWhatsappMessageStatus(msgId, status);
            }
          }
          
          // Handle incoming messages
          if (value.messages && value.messages.length > 0) {
            for (const message of value.messages) {
              const chatNumber = message.from;
              const msgId = message.id;
              const timestamp = parseInt(message.timestamp) * 1000;
              const isoTime = new Date(timestamp).toISOString();
              
              let msgBody = '';
              if (message.type === 'text') {
                msgBody = message.text.body;
              } else if (message.type === 'interactive') {
                msgBody = message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || '[Interactive Reply]';
              } else if (message.type === 'button') {
                msgBody = message.button?.text || '[Button Click]';
              } else {
                msgBody = `[Received ${message.type} message]`;
              }
              
              const contact = value.contacts?.find(c => c.wa_id === chatNumber);
              const contactName = contact?.profile?.name || chatNumber;
              
              // Record incoming message in DB
              await db.createWhatsappMessage({
                id: msgId,
                portal,
                chatNumber,
                fromMe: false,
                body: msgBody,
                timestamp: isoTime,
                status: 'read'
              });
              
              // Increment unread and update chat log
              const existingChat = await db.findWhatsappChat(portal + '_' + chatNumber);
              const unread = existingChat ? (existingChat.unreadCount || 0) : 0;
              await db.upsertWhatsappChat(portal + '_' + chatNumber, {
                portal,
                number: chatNumber,
                name: contactName,
                lastMessage: msgBody,
                lastMessageTime: isoTime,
                unreadCount: unread + 1
              });
              
              // Trigger Chatbot Auto-responders
              const chatbots = await db.listWhatsappChatbots();
              const activeBots = chatbots.filter(b => b.active && b.portal === portal);
              
              for (const bot of activeBots) {
                let isMatch = false;
                const cleanBody = msgBody.toLowerCase().trim();
                const cleanTrigger = bot.triggerWord.toLowerCase().trim();
                
                if (bot.triggerType === 'exact') {
                  isMatch = (cleanBody === cleanTrigger);
                } else {
                  isMatch = cleanBody.includes(cleanTrigger);
                }
                
                if (isMatch) {
                  try {
                    const replyPayload = {
                      type: 'text',
                      text: { body: bot.replyText }
                    };
                    const metaRes = await sendMetaWhatsAppMessage(portal, chatNumber, replyPayload);
                    
                    // Log auto-responder message
                    await db.createWhatsappMessage({
                      id: metaRes.messages[0].id,
                      portal,
                      chatNumber,
                      fromMe: true,
                      body: bot.replyText,
                      timestamp: new Date().toISOString(),
                      status: 'sent'
                    });
                    
                    // Update chat details
                    await db.upsertWhatsappChat(portal + '_' + chatNumber, {
                      lastMessage: bot.replyText,
                      lastMessageTime: new Date().toISOString()
                    });
                  } catch (replyErr) {
                    console.error('Chatbot auto-reply failed:', replyErr);
                  }
                  break; // Stop checking other rules for this message
                }
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Error processing WhatsApp Webhook body:', err);
  }
});

// Get Stats Summary
app.get('/api/admin/whatsapp/stats', authenticateToken, requireAdmin, async (req, res) => {
  const { portal } = req.query;
  if (!portal) {
    return res.status(400).json({ error: 'Portal parameter is required' });
  }
  try {
    const chats = await db.listWhatsappChats();
    const broadcasts = await db.listWhatsappBroadcasts();
    const chatbots = await db.listWhatsappChatbots();
    
    // Read local db or firestore to get messages
    const firestore = admin.apps.length > 0 ? admin.firestore() : null;
    let portalMessages = [];
    
    if (firestore) {
      const messagesSnap = await firestore.collection('whatsapp_messages')
        .where('portal', '==', portal)
        .get();
      portalMessages = messagesSnap.docs.map(doc => doc.data());
    } else {
      const parsedData = JSON.parse(fs.readFileSync(path.join(__dirname, 'db.json'), 'utf8'));
      const allMsgs = parsedData.whatsappMessages || [];
      portalMessages = allMsgs.filter(m => m.portal === portal);
    }
    
    const sentCount = portalMessages.filter(m => m.fromMe).length;
    const receivedCount = portalMessages.filter(m => !m.fromMe).length;
    
    const portalChats = chats.filter(c => c.portal === portal);
    const portalBroadcasts = broadcasts.filter(b => b.portal === portal);
    const portalChatbots = chatbots.filter(c => c.portal === portal);
    
    // Time calculations for active users/contacts
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const msgs24h = portalMessages.filter(m => new Date(m.timestamp) >= oneDayAgo);
    const msgs7d = portalMessages.filter(m => new Date(m.timestamp) >= sevenDaysAgo);
    
    const unique24h = new Set(msgs24h.map(m => m.chatNumber)).size;
    const unique7d = new Set(msgs7d.map(m => m.chatNumber)).size;
    
    // Today's campaigns count
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todaysCampaigns = portalBroadcasts.filter(b => {
      const date = new Date(b.createdAt || b.timestamp || now);
      return date >= startOfToday;
    }).length;
    
    res.json({
      totalChats: portalChats.length,
      totalMessagesSent: sentCount,
      totalMessagesReceived: receivedCount,
      totalBroadcasts: portalBroadcasts.length,
      totalChatbots: portalChatbots.length,
      
      // Advanced dashboard statistics
      totalCampaigns: portalBroadcasts.length,
      todaysCampaigns,
      uniquePhones7Days: unique7d,
      uniquePhones24Hours: unique24h,
      accountStatus: 'CONNECTED',
      qualityRating: 'GREEN',
      messagingLimit: '100K',
      wabaCredits: '₹1,247.4',
      aiCredits: 0,
      voiceCredits: 0,
      rcsCredits: 0,
      planExpiry: '28 Feb 2027'
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Failed to fetch WhatsApp statistics' });
  }
});

// 3. Get Chat Contacts List
app.get('/api/admin/whatsapp/chats', authenticateToken, requireAdmin, async (req, res) => {
  const { portal } = req.query;
  try {
    let chats = await db.listWhatsappChats();
    if (portal) {
      chats = chats.filter(c => c.portal === portal);
    }
    res.json(chats);
  } catch (err) {
    console.error('Error fetching chats:', err);
    res.status(500).json({ error: 'Failed to fetch WhatsApp chats' });
  }
});

// 4. Get Chat Messages Thread
app.get('/api/admin/whatsapp/chats/:number/messages', authenticateToken, requireAdmin, async (req, res) => {
  const { number } = req.params;
  const { portal } = req.query;
  if (!portal) {
    return res.status(400).json({ error: 'Portal parameter is required' });
  }
  try {
    // Reset unread count since chat is opened
    await db.upsertWhatsappChat(portal + '_' + number, { unreadCount: 0 });
    
    const messages = await db.listWhatsappMessages(number, portal);
    res.json(messages);
  } catch (err) {
    console.error('Error fetching chat messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// 5. Send WhatsApp Message (Text Reply)
app.post('/api/admin/whatsapp/chats/:number/messages', authenticateToken, requireAdmin, async (req, res) => {
  const { number } = req.params;
  const { portal, body } = req.body;
  if (!portal || !body) {
    return res.status(400).json({ error: 'Portal and body parameters are required' });
  }
  try {
    const replyPayload = {
      type: 'text',
      text: { body }
    };
    const metaRes = await sendMetaWhatsAppMessage(portal, number, replyPayload);
    
    const newMsg = await db.createWhatsappMessage({
      id: metaRes.messages[0].id,
      portal,
      chatNumber: number,
      fromMe: true,
      body,
      timestamp: new Date().toISOString(),
      status: 'sent'
    });
    
    await db.upsertWhatsappChat(portal + '_' + number, {
      portal,
      number,
      lastMessage: body,
      lastMessageTime: new Date().toISOString()
    });
    
    res.status(201).json(newMsg);
  } catch (err) {
    console.error('Error sending WhatsApp message:', err);
    res.status(500).json({ error: err.message || 'Failed to send WhatsApp message' });
  }
});

// 6. Get Broadcast Campaigns History
app.get('/api/admin/whatsapp/broadcasts', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const broadcasts = await db.listWhatsappBroadcasts();
    res.json(broadcasts);
  } catch (err) {
    console.error('Error fetching broadcasts:', err);
    res.status(500).json({ error: 'Failed to fetch broadcasts' });
  }
});

// 7. Send Template Broadcast Campaign
app.post('/api/admin/whatsapp/broadcasts', authenticateToken, requireAdmin, async (req, res) => {
  const { name, portal, templateName, contacts, languageCode, variables } = req.body;
  if (!name || !portal || !templateName || !contacts || !Array.isArray(contacts)) {
    return res.status(400).json({ error: 'Missing required broadcast fields' });
  }
  
  try {
    const broadcast = await db.createWhatsappBroadcast({
      name,
      portal,
      templateName,
      totalContacts: contacts.length,
      status: 'running'
    });
    
    // Asynchronous broadcast runner
    (async () => {
      let success = 0;
      let failed = 0;
      
      for (const number of contacts) {
        try {
          const cleanNumber = number.replace(/[^0-9]/g, '');
          if (!cleanNumber) continue;
          
          const components = [];
          if (variables && Array.isArray(variables) && variables.length > 0) {
            components.push({
              type: 'body',
              parameters: variables.map(v => ({ type: 'text', text: v }))
            });
          }
          
          const payload = {
            type: 'template',
            template: {
              name: templateName,
              language: { code: languageCode || 'en_US' },
              components: components.length > 0 ? components : undefined
            }
          };
          
          const metaRes = await sendMetaWhatsAppMessage(portal, cleanNumber, payload);
          
          await db.createWhatsappMessage({
            id: metaRes.messages[0].id,
            portal,
            chatNumber: cleanNumber,
            fromMe: true,
            body: `[Template Broadcast: ${templateName}]`,
            timestamp: new Date().toISOString(),
            status: 'sent'
          });
          
          await db.upsertWhatsappChat(portal + '_' + cleanNumber, {
            portal,
            number: cleanNumber,
            lastMessage: `[Template Broadcast: ${templateName}]`,
            lastMessageTime: new Date().toISOString()
          });
          
          success++;
        } catch (err) {
          console.error(`Broadcast sending failed to ${number}:`, err);
          failed++;
        }
        
        // Brief sleep to respect API rate limits
        await new Promise(r => setTimeout(r, 100));
      }
      
      await db.updateWhatsappBroadcast(broadcast.id, {
        sentCount: success + failed,
        successCount: success,
        failedCount: failed,
        status: 'completed'
      });
    })().catch(err => {
      console.error('Async broadcast runner crashed:', err);
      db.updateWhatsappBroadcast(broadcast.id, { status: 'failed' });
    });
    
    res.status(201).json(broadcast);
  } catch (err) {
    console.error('Failed to trigger broadcast campaign:', err);
    res.status(500).json({ error: 'Failed to launch broadcast campaign' });
  }
});

// 8. Auto-responder Rule List
app.get('/api/admin/whatsapp/chatbots', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const bots = await db.listWhatsappChatbots();
    res.json(bots);
  } catch (err) {
    console.error('Error fetching chatbots:', err);
    res.status(500).json({ error: 'Failed to fetch auto-responders' });
  }
});

// 9. Create Auto-responder Rule
app.post('/api/admin/whatsapp/chatbots', authenticateToken, requireAdmin, async (req, res) => {
  const { portal, triggerWord, triggerType, replyText } = req.body;
  if (!portal || !triggerWord || !replyText) {
    return res.status(400).json({ error: 'Portal, triggerWord, and replyText are required' });
  }
  try {
    const newBot = await db.createWhatsappChatbot({ portal, triggerWord, triggerType, replyText });
    res.status(201).json(newBot);
  } catch (err) {
    console.error('Error creating chatbot:', err);
    res.status(500).json({ error: 'Failed to create auto-responder' });
  }
});

// 10. Update Auto-responder Rule
app.put('/api/admin/whatsapp/chatbots/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { triggerWord, triggerType, replyText, active } = req.body;
  try {
    await db.updateWhatsappChatbot(id, { triggerWord, triggerType, replyText, active });
    res.json({ message: 'Auto-responder updated successfully' });
  } catch (err) {
    console.error('Error updating chatbot:', err);
    res.status(500).json({ error: 'Failed to update auto-responder' });
  }
});

// 11. Delete Auto-responder Rule
app.delete('/api/admin/whatsapp/chatbots/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await db.deleteWhatsappChatbot(id);
    res.json({ message: 'Auto-responder deleted successfully' });
  } catch (err) {
    console.error('Error deleting chatbot:', err);
    res.status(500).json({ error: 'Failed to delete auto-responder' });
  }
});

// Seed default WhatsApp Chatbots
async function seedWhatsappChatbots() {
  try {
    const bots = await db.listWhatsappChatbots();
    if (bots && bots.length > 0) {
      console.log('WhatsApp chatbots already configured. Skipping seeding.');
      return;
    }
    
    console.log('Seeding default WhatsApp chatbots...');
    await db.createWhatsappChatbot({
      id: 'bot_gyc_hi_' + Date.now(),
      portal: 'gyc',
      triggerWord: 'hi',
      triggerType: 'contains',
      replyText: `👋 Hi there!

Thanks for reaching out to GET YOUR COLLEGE🎓

We have received your enquiry. Our admission expert will connect with you shortly to guide you step-by-step.

👉 To get faster guidance, kindly fill your details here:
🔗 Google Form:
https://forms.gle/cY9bcEWpBcNJcUmf9

▶️ YouTube:
https://www.youtube.com/@getyourcollege_gyc

📌 We provide:
✅ Engineering (TNEA + Management Quota) Admission Guidance
✅ Medical (MBBS / BDS / AYUSH / Nursing) Admission Guidance
✅ India & Abroad Admissions Guidance
✅ Cut-off Based College Selection
✅ End-to-End Counselling Support

📞 For instant support, WhatsApp us:
Engineering: 9150391925
Medical: 9884362838`,
      active: true
    });

    await db.createWhatsappChatbot({
      id: 'bot_vtr_hi_' + Date.now(),
      portal: 'vtr',
      triggerWord: 'hi',
      triggerType: 'contains',
      replyText: `👋 Hi there!

Thanks for reaching out to VTR EDU SOLUTIONS.

Our representative will connect with you shortly.

📞 Contact: 9884362838`,
      active: true
    });
    console.log('WhatsApp chatbots seeded successfully.');
  } catch (err) {
    console.error('Failed to seed WhatsApp chatbots:', err);
  }
}

// Start Express server
app.listen(PORT, async () => {
  console.log(`CallLogIQ backend running on port ${PORT}`);
  console.log(`Admin email configured as: ${ADMIN_EMAIL}`);
  console.log(`Create admin by registering or logging in with this email.`);
  
  // Run startup migrations
  try {
    await migrateDomainCategories();
  } catch (err) {
    console.error('Failed to run startup domain categories migration:', err);
  }

  // Run startup assets seeder
  try {
    await db.seedAssets();
  } catch (err) {
    console.error('Failed to run startup assets seeder:', err);
  }

  // Run startup chatbots seeder
  try {
    await seedWhatsappChatbots();
  } catch (err) {
    console.error('Failed to run startup chatbots seeder:', err);
  }

  // Start background web monitoring crawler loop
  startWebNotificationCrawlLoop();
});
