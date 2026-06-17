require('dotenv').config();
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

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'calllogiq_super_secret_jwt_key_123';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'vtredusolutions@gmail.com').toLowerCase();

// Ensure uploads and output directories exist
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json());
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

// Health Check Routes
app.get('/', (req, res) => {
  res.json({ status: 'healthy', service: 'CallLogIQ Backend', timestamp: new Date() });
});
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', service: 'CallLogIQ Backend API' });
});

// --- AUTH ROUTES ---

// 1. Initiate Register
// 1. Google Sign-In Verification
app.post('/api/auth/google', async (req, res) => {
  const { idToken } = req.body;
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

    // Generate JWT token
    const token = jwt.sign({
      userId: user.id,
      email: user.email,
      name: user.name,
      domain: user.domain,
      branch: user.branch || 'Pending',
      role: user.role
    }, JWT_SECRET, { expiresIn: '24h' });

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
      }, JWT_SECRET, { expiresIn: '24h' });

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

  const validDomains = ['Sales', 'Accounts', 'Support', 'HR', 'Operations'];
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
    }, JWT_SECRET, { expiresIn: '24h' });

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
app.post('/api/calls/upload', authenticateToken, upload.single('pdf'), (req, res) => {
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
            console.error('Python Execution Error:', stderr);
            res.status(500).json({ 
              error: 'Failed to analyze PDF', 
              details: stderr || error.message 
            });
            return resolve();
          }
          
          try {
            const analysisData = JSON.parse(stdout);
            
            if (analysisData.error) {
              if (fs.existsSync(pdfPath)) {
                fs.unlinkSync(pdfPath);
              }
              res.status(400).json({ error: analysisData.error });
              return resolve();
            }
            
            // ONE PDF PER DATE CONSTRAINT CHECK (based on the PDF's own date, not upload date)
            // This allows uploading a past-date PDF even after uploading today's PDF,
            // as long as there is no existing PDF for that particular date.
            const existingLog = allLogs.find(l => l.userId === userId && l.callDate === analysisData.call_date);
            if (existingLog) {
              if (fs.existsSync(pdfPath)) { fs.unlinkSync(pdfPath); }
              if (fs.existsSync(excelPath)) { fs.unlinkSync(excelPath); }
              res.status(400).json({ 
                error: `A call log for the date ${analysisData.call_date} has already been uploaded. Only one PDF per date is allowed.` 
              });
              return resolve();
            }
            
            const logId = 'log_' + Date.now().toString() + Math.random().toString(36).substr(2, 5);
            const finalFilename = `${logId}.xlsx`;
            const finalPath = path.join(UPLOADS_DIR, finalFilename);
            
            // Upload PDF to Cloudinary
            const pdfDest = `pdfs/${userId}/${logId}`;
            const pdfUrl = await uploadToCloudinary(pdfPath, pdfDest, true) || '';
            
            // Delete local temp PDF upload
            if (fs.existsSync(pdfPath)) {
              fs.unlinkSync(pdfPath);
            }
            
            // Rename excel file locally
            if (fs.existsSync(excelPath)) {
              fs.renameSync(excelPath, finalPath);
            }
            
            // Upload Excel to Cloudinary
            const excelDest = `excels/${userId}/${logId}`;
            const excelUrl = await uploadToCloudinary(finalPath, excelDest, true) || '';
            
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
              pdfUrl,
              excelUrl
            });
            
            res.json({
              message: 'PDF analyzed and Excel sheet generated successfully!',
              log: logEntry
            });
            resolve();
            
          } catch (parseErr) {
            if (fs.existsSync(pdfPath)) { fs.unlinkSync(pdfPath); }
            if (fs.existsSync(excelPath)) { fs.unlinkSync(excelPath); }
            console.error('JSON Parsing Error:', parseErr, stdout);
            res.status(500).json({ 
              error: 'Analysis output parsing failed', 
              details: parseErr.message 
            });
            resolve();
          }
        });
      }).catch(err => {
        if (fs.existsSync(pdfPath)) { fs.unlinkSync(pdfPath); }
        console.error('Queue database retrieval error:', err);
        res.status(500).json({ error: 'Database retrieval error', details: err.message });
        resolve();
      });
    });
  });

  // Trigger processing
  processQueue();
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
  
  // Try local file first
  const filePath = path.join(UPLOADS_DIR, log.filename);
  if (fs.existsSync(filePath)) {
    return res.download(filePath, downloadName);
  }
  
  // Fall back: proxy from Cloudinary excelUrl
  if (log.excelUrl) {
    try {
      const https = require('https');
      const http = require('http');
      const protocol = log.excelUrl.startsWith('https') ? https : http;
      res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      protocol.get(log.excelUrl, (fileRes) => {
        fileRes.pipe(res);
      }).on('error', (err) => {
        console.error('Error proxying Excel from Cloudinary:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to stream Excel from cloud storage' });
        }
      });
    } catch (err) {
      console.error('Error setting up Excel proxy:', err);
      return res.status(500).json({ error: 'Excel proxy error' });
    }
    return;
  }
  
  return res.status(404).json({ error: 'Excel file not available (not on disk and no cloud URL)' });
});

// View/Download PDF (Admin only) - streams the PDF from Cloudinary with auth
app.get('/api/calls/pdf/:logId', authenticateToken, requireAdmin, async (req, res) => {
  const { logId } = req.params;
  const log = await db.getLogById(logId);
  
  if (!log) {
    return res.status(404).json({ error: 'Log record not found' });
  }
  
  if (!log.pdfUrl) {
    return res.status(404).json({ error: 'No PDF available for this log entry' });
  }
  
  try {
    const https = require('https');
    const http = require('http');
    const protocol = log.pdfUrl.startsWith('https') ? https : http;
    const logUser = await db.findUserById(log.userId);
    const filename = `${logUser ? logUser.name.replace(/\s+/g, '_') : 'User'}_${log.callDate.replace(/\s+/g, '')}.pdf`;
    
    // For view: set Content-Disposition inline so browser opens it
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    
    protocol.get(log.pdfUrl, (fileRes) => {
      fileRes.pipe(res);
    }).on('error', (err) => {
      console.error('Error proxying PDF from Cloudinary:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream PDF from cloud storage' });
      }
    });
  } catch (err) {
    console.error('Error setting up PDF proxy:', err);
    return res.status(500).json({ error: 'PDF proxy error' });
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
  
  const attendanceList = [];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  // Loop through each day from startDate to today
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    const isSunday = d.getDay() === 0;
    
    // Find if there is an uploaded log for this date
    const log = userLogs.find(l => l.callDate.toLowerCase() === dateStr.toLowerCase());
    
    if (isSunday) {
      holidays++;
      attendanceList.push({
        date: dateStr,
        status: 'Holiday',
        arrival: '-',
        departure: '-',
        duration: '-',
        talkTime: '-',
        calls: 0
      });
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
          pdfUrl: log.pdfUrl || ''
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
      absentDays
    },
    history: attendanceList.reverse() // Newest first
  });
});

// --- TODO LIST / TASKS ROUTES ---

// Get tasks for the current user
app.get('/api/tasks', authenticateToken, async (req, res) => {
  const tasks = await db.getTasksForUser(req.user.userId, req.user.domain);
  
  // Format task checklist response
  const formattedTasks = tasks.map(t => {
    const isDomainTask = ['accounts', 'sales', 'support', 'hr', 'operations'].includes(t.assignedTo.toLowerCase());
    const isCompleted = isDomainTask ? t.completions.includes(req.user.userId) : t.status === 'completed';
    
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      assignedTo: t.assignedTo,
      isDomainTask,
      isCompleted,
      createdAt: t.createdAt
    };
  });
  
  return res.json(formattedTasks);
});

// Toggle Task Status
app.post('/api/tasks/:taskId/toggle', authenticateToken, async (req, res) => {
  const { taskId } = req.params;
  const { isCompleted } = req.body;
  
  const updatedTask = await db.toggleTaskStatus(taskId, req.user.userId, isCompleted);
  if (!updatedTask) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  return res.json({ message: 'Task status updated successfully', task: updatedTask });
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
    return res.status(500).json({ error: 'Failed to flush database.' });
  }
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

// Start Express server
app.listen(PORT, async () => {
  console.log(`CallLogIQ backend running on port ${PORT}`);
  console.log(`Admin email configured as: ${ADMIN_EMAIL}`);
  console.log(`Create admin by registering or logging in with this email.`);
  
  // Run startup assets seeder
  try {
    await db.seedAssets();
  } catch (err) {
    console.error('Failed to run startup assets seeder:', err);
  }
});
