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
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@calllogiq.com').toLowerCase();

// Ensure uploads and output directories exist
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json());

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
    }
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

// Send OTP Email (SMTP with Console fallback)
async function sendOTPEmail(email, otp) {
  if (mailTransporter) {
    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || `"CallLogIQ" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Your CallLogIQ Verification OTP Code',
        text: `Your CallLogIQ verification code is ${otp}. It is valid for 10 minutes.`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 480px;">
            <h2 style="color: #4f46e5; margin-bottom: 10px;">CallLogIQ Verification</h2>
            <p style="color: #475569; font-size: 16px;">Hello,</p>
            <p style="color: #475569; font-size: 16px;">Your verification OTP code is:</p>
            <div style="background-color: #f1f5f9; padding: 15px; border-radius: 8px; font-size: 28px; font-weight: bold; letter-spacing: 4px; text-align: center; margin: 20px 0; color: #0f172a;">
              ${otp}
            </div>
            <p style="color: #94a3b8; font-size: 14px;">This code is valid for 10 minutes. If you did not request this, you can safely ignore this email.</p>
          </div>
        `
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

const firebaseConfigPath = path.join(__dirname, 'firebase-service-account.json');
if (fs.existsSync(firebaseConfigPath)) {
  try {
    const serviceAccount = require(firebaseConfigPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin SDK initialized successfully with service account.');
  } catch (err) {
    console.error('Failed to initialize Firebase Admin SDK with service account:', err);
  }
} else {
  console.log('Firebase service account key (firebase-service-account.json) is missing. Using local database fallback (db.json).');
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
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name, domain } = req.body;
  if (!email || !password || !name || !domain) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const existingUser = await db.findUserByEmail(email);
  if (existingUser) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const isEmailAdmin = email.toLowerCase() === ADMIN_EMAIL;
  
  const userMetadata = {
    email,
    passwordHash,
    name,
    domain,
    role: isEmailAdmin ? 'admin' : 'user'
  };
  
  await db.saveOTP(email, otp, expiresAt, userMetadata);

  const smtpActive = mailTransporter !== null;
  await sendOTPEmail(email, otp);

  return res.json({ 
    message: smtpActive ? 'OTP verification code sent to your email.' : 'OTP sent (Simulated in terminal console)', 
    email, 
    simulated: !smtpActive 
  });
});

// 2. Initiate Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = await db.findUserByEmail(email);
  if (!user) {
    // If logging in as admin but not registered, we can auto-register or reject
    if (email.toLowerCase() === ADMIN_EMAIL) {
      return res.status(404).json({ error: 'Admin account not registered yet. Please register first.' });
    }
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const isValidPassword = bcrypt.compareSync(password, user.passwordHash);
  if (!isValidPassword) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await db.saveOTP(email, otp, expiresAt);
  
  const smtpActive = mailTransporter !== null;
  await sendOTPEmail(email, otp);

  return res.json({ 
    message: smtpActive ? 'OTP verification code sent to your email.' : 'OTP sent (Simulated in terminal console)', 
    email, 
    simulated: !smtpActive 
  });
});

// 3. Verify OTP and get Token
app.post('/api/auth/verify-otp', async (req, res) => {
  const { email, code, type } = req.body; // type can be 'login' or 'register'
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and OTP code are required' });
  }

  const otp = await db.getOTP(email);
  if (!otp || otp.code !== code) {
    return res.status(400).json({ error: 'Invalid OTP code' });
  }

  if (new Date() > new Date(otp.expiresAt)) {
    await db.deleteOTP(email);
    return res.status(400).json({ error: 'OTP code has expired' });
  }

  // Remove used OTP
  await db.deleteOTP(email);

  let user = await db.findUserByEmail(email);

  if (!user && otp.metadata) {
    // This was a register flow, create the user now
    user = await db.createUser({
      email: otp.metadata.email,
      passwordHash: otp.metadata.passwordHash,
      name: otp.metadata.name,
      domain: otp.metadata.domain,
      role: otp.metadata.role
    });
  } else if (!user) {
    return res.status(404).json({ error: 'User record not found' });
  }

  // Create token
  const token = jwt.sign({
    userId: user.id,
    email: user.email,
    name: user.name,
    domain: user.domain,
    role: user.role
  }, JWT_SECRET, { expiresIn: '24h' });

  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      domain: user.domain,
      role: user.role
    }
  });
});

// --- CALL ANALYSIS ROUTES ---

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
  
  // Call Python analyzer
  const pyScript = path.join(__dirname, 'analyzer.py');
  const command = `python "${pyScript}" --pdf "${pdfPath}" --user "${username}" --out "${excelPath}"`;
  
  exec(command, async (error, stdout, stderr) => {
    if (error) {
      if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
      }
      console.error('Python Execution Error:', stderr);
      return res.status(500).json({ 
        error: 'Failed to analyze PDF', 
        details: stderr || error.message 
      });
    }
    
    try {
      const analysisData = JSON.parse(stdout);
      
      if (analysisData.error) {
        if (fs.existsSync(pdfPath)) {
          fs.unlinkSync(pdfPath);
        }
        return res.status(400).json({ error: analysisData.error });
      }
      
      // ONE UPLOAD PER DAY CONSTRAINT CHECK
      const allLogs = await db.getAllLogs();
      const existingLog = allLogs.find(l => l.userId === userId && l.callDate === analysisData.call_date);
      if (existingLog) {
        if (fs.existsSync(pdfPath)) { fs.unlinkSync(pdfPath); }
        if (fs.existsSync(excelPath)) { fs.unlinkSync(excelPath); }
        return res.status(400).json({ 
          error: `You have already uploaded a call log for this date (${analysisData.call_date}). Only one upload per day is allowed.` 
        });
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
      
      return res.json({
        message: 'PDF analyzed and Excel sheet generated successfully!',
        log: logEntry
      });
      
    } catch (parseErr) {
      if (fs.existsSync(pdfPath)) { fs.unlinkSync(pdfPath); }
      if (fs.existsSync(excelPath)) { fs.unlinkSync(excelPath); }
      console.error('JSON Parsing Error:', parseErr, stdout);
      return res.status(500).json({ 
        error: 'Analysis output parsing failed', 
        details: parseErr.message 
      });
    }
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
  
  const filePath = path.join(UPLOADS_DIR, log.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Excel file not found on disk' });
  }
  
  const user = await db.findUserById(log.userId);
  const downloadName = `${user ? user.name.replace(/\s+/g, '_') : 'User'}_Call_Log_Analysis_${log.callDate.replace(/\s+/g, '')}.xlsx`;
  
  return res.download(filePath, downloadName);
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
  const { name, domain, role, email } = req.body;
  
  if (!name || !domain || !role || !email) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Prevent self-role downgrade
  if (userId === req.user.userId && role !== 'admin') {
    return res.status(400).json({ error: 'You cannot downgrade your own administrator role.' });
  }
  
  try {
    const updatedUser = await db.updateUser(userId, { name, domain, role, email });
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
    role: 'admin'
  });
  
  return res.json({ message: 'Admin account seeded successfully', admin: { email: newAdmin.email } });
});

// Start Express server
app.listen(PORT, () => {
  console.log(`CallLogIQ backend running on port ${PORT}`);
  console.log(`Admin email configured as: ${ADMIN_EMAIL}`);
  console.log(`Create admin by registering or logging in with this email.`);
});
