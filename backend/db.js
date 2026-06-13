const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const DB_FILE = path.join(__dirname, 'db.json');

// Initialize DB file if it doesn't exist
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({
    users: [],
    logs: [],
    tasks: [],
    otps: []
  }, null, 2), 'utf8');
}

function readLocalDB() {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading database file:', err);
    return { users: [], logs: [], tasks: [], otps: [] };
  }
}

function writeLocalDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing database file:', err);
    return false;
  }
}

// Check if Firebase is initialized
function getFirestore() {
  if (admin.apps.length > 0) {
    return admin.firestore();
  }
  return null;
}

const db = {
  // --- USERS ---
  findUserByEmail: async (email) => {
    const firestore = getFirestore();
    if (firestore) {
      const snapshot = await firestore.collection('users')
        .where('email', '==', email.toLowerCase())
        .limit(1)
        .get();
      if (snapshot.empty) return null;
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    } else {
      const data = readLocalDB();
      return data.users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase()) || null;
    }
  },

  findUserById: async (id) => {
    const firestore = getFirestore();
    if (firestore) {
      const doc = await firestore.collection('users').doc(id).get();
      if (!doc.exists) return null;
      return { id: doc.id, ...doc.data() };
    } else {
      const data = readLocalDB();
      return data.users.find(u => u.id === id) || null;
    }
  },

  createUser: async (user) => {
    const firestore = getFirestore();
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const newUser = {
      role: 'user', // Default role
      registrationDate: new Date().toISOString().split('T')[0], // e.g., '2026-06-12'
      createdAt: new Date().toISOString(),
      ...user
    };
    
    if (firestore) {
      await firestore.collection('users').doc(id).set(newUser);
      return { id, ...newUser };
    } else {
      const data = readLocalDB();
      const localUser = { id, ...newUser };
      data.users.push(localUser);
      writeLocalDB(data);
      return localUser;
    }
  },

  listUsers: async () => {
    const firestore = getFirestore();
    if (firestore) {
      const snapshot = await firestore.collection('users').get();
      const usersList = [];
      snapshot.forEach(doc => {
        const { passwordHash, ...u } = doc.data();
        usersList.push({ id: doc.id, ...u });
      });
      return usersList;
    } else {
      const data = readLocalDB();
      return data.users.map(({ passwordHash, ...u }) => u);
    }
  },

  // --- OTPS ---
  saveOTP: async (email, code, expiresAt, metadata = null) => {
    const firestore = getFirestore();
    const expiresAtStr = expiresAt.toISOString ? expiresAt.toISOString() : new Date(expiresAt).toISOString();
    
    if (firestore) {
      // In firestore, use email as the document ID for quick lookup/upsert
      await firestore.collection('otps').doc(email.toLowerCase()).set({
        email: email.toLowerCase(),
        code,
        expiresAt: expiresAtStr,
        metadata: metadata || null
      });
    } else {
      const data = readLocalDB();
      // Remove existing OTPs for this email
      data.otps = data.otps.filter(o => o.email.toLowerCase() !== email.toLowerCase());
      data.otps.push({ 
        email: email.toLowerCase(), 
        code, 
        expiresAt: expiresAtStr, 
        metadata 
      });
      writeLocalDB(data);
    }
  },

  getOTP: async (email) => {
    const firestore = getFirestore();
    if (firestore) {
      const doc = await firestore.collection('otps').doc(email.toLowerCase()).get();
      if (!doc.exists) return null;
      return doc.data();
    } else {
      const data = readLocalDB();
      return data.otps.find(o => o.email.toLowerCase() === email.toLowerCase()) || null;
    }
  },

  deleteOTP: async (email) => {
    const firestore = getFirestore();
    if (firestore) {
      await firestore.collection('otps').doc(email.toLowerCase()).delete();
    } else {
      const data = readLocalDB();
      data.otps = data.otps.filter(o => o.email.toLowerCase() !== email.toLowerCase());
      writeLocalDB(data);
    }
  },

  verifyOTP: async (email, code) => {
    const firestore = getFirestore();
    if (firestore) {
      const docRef = firestore.collection('otps').doc(email.toLowerCase());
      const doc = await docRef.get();
      if (!doc.exists) return false;
      
      const otp = doc.data();
      if (otp.code !== code) return false;
      
      // Check expiration
      if (new Date() > new Date(otp.expiresAt)) {
        await docRef.delete();
        return false;
      }
      
      // Verified, delete it
      await docRef.delete();
      return true;
    } else {
      const data = readLocalDB();
      const index = data.otps.findIndex(o => o.email.toLowerCase() === email.toLowerCase() && o.code === code);
      if (index === -1) return false;
      
      const otp = data.otps[index];
      // Check expiration
      if (new Date() > new Date(otp.expiresAt)) {
        data.otps.splice(index, 1);
        writeLocalDB(data);
        return false;
      }

      // OTP verified, remove it
      data.otps.splice(index, 1);
      writeLocalDB(data);
      return true;
    }
  },

  // --- LOGS ---
  createLog: async (log) => {
    const firestore = getFirestore();
    const id = log.id || ('log_' + Date.now().toString() + Math.random().toString(36).substr(2, 5));
    const newLog = {
      createdAt: new Date().toISOString(),
      ...log,
      id
    };
    
    if (firestore) {
      await firestore.collection('logs').doc(id).set(newLog);
      return newLog;
    } else {
      const data = readLocalDB();
      data.logs.push(newLog);
      writeLocalDB(data);
      return newLog;
    }
  },

  getLogsByUserId: async (userId) => {
    const firestore = getFirestore();
    if (firestore) {
      const snapshot = await firestore.collection('logs')
        .where('userId', '==', userId)
        .get();
      const logsList = [];
      snapshot.forEach(doc => {
        logsList.push({ id: doc.id, ...doc.data() });
      });
      return logsList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else {
      const data = readLocalDB();
      return data.logs.filter(l => l.userId === userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  },

  getLogById: async (id) => {
    const firestore = getFirestore();
    if (firestore) {
      const doc = await firestore.collection('logs').doc(id).get();
      if (!doc.exists) return null;
      return { id: doc.id, ...doc.data() };
    } else {
      const data = readLocalDB();
      return data.logs.find(l => l.id === id) || null;
    }
  },

  getAllLogs: async () => {
    const firestore = getFirestore();
    if (firestore) {
      const snapshot = await firestore.collection('logs').get();
      const logsList = [];
      snapshot.forEach(doc => {
        logsList.push({ id: doc.id, ...doc.data() });
      });
      return logsList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else {
      const data = readLocalDB();
      return data.logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  },

  // --- TASKS ---
  createTask: async (task) => {
    const firestore = getFirestore();
    const id = 'task_' + Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const newTask = {
      status: 'pending',
      completions: [],
      createdAt: new Date().toISOString(),
      ...task,
      id
    };
    
    if (firestore) {
      await firestore.collection('tasks').doc(id).set(newTask);
      return newTask;
    } else {
      const data = readLocalDB();
      data.tasks.push(newTask);
      writeLocalDB(data);
      return newTask;
    }
  },

  getTasksForUser: async (userId, domain) => {
    const firestore = getFirestore();
    if (firestore) {
      // Fetch all tasks from firestore, then filter locally
      const snapshot = await firestore.collection('tasks').get();
      const tasksList = [];
      snapshot.forEach(doc => {
        const t = doc.data();
        if (t.assignedTo === userId || t.assignedTo.toLowerCase() === domain.toLowerCase()) {
          tasksList.push({ id: doc.id, ...t });
        }
      });
      return tasksList;
    } else {
      const data = readLocalDB();
      return data.tasks.filter(t => {
        if (t.assignedTo === userId) return true;
        if (t.assignedTo.toLowerCase() === domain.toLowerCase()) return true;
        return false;
      });
    }
  },

  getAllTasks: async () => {
    const firestore = getFirestore();
    if (firestore) {
      const snapshot = await firestore.collection('tasks').get();
      const tasksList = [];
      snapshot.forEach(doc => {
        tasksList.push({ id: doc.id, ...doc.data() });
      });
      return tasksList;
    } else {
      const data = readLocalDB();
      return data.tasks;
    }
  },

  toggleTaskStatus: async (taskId, userId, isCompleted) => {
    const firestore = getFirestore();
    if (firestore) {
      const docRef = firestore.collection('tasks').doc(taskId);
      const doc = await docRef.get();
      if (!doc.exists) return null;
      
      const task = doc.data();
      const isDomainTask = ['accounts', 'sales', 'support', 'hr', 'operations'].includes(task.assignedTo.toLowerCase());
      
      if (isDomainTask) {
        if (!task.completions) task.completions = [];
        if (isCompleted) {
          if (!task.completions.includes(userId)) {
            task.completions.push(userId);
          }
        } else {
          task.completions = task.completions.filter(id => id !== userId);
        }
      } else {
        task.status = isCompleted ? 'completed' : 'pending';
      }
      
      await docRef.set(task);
      return { id: taskId, ...task };
    } else {
      const data = readLocalDB();
      const task = data.tasks.find(t => t.id === taskId);
      if (!task) return null;

      const isDomainTask = ['accounts', 'sales', 'support', 'hr', 'operations'].includes(task.assignedTo.toLowerCase());

      if (isDomainTask) {
        if (isCompleted) {
          if (!task.completions.includes(userId)) {
            task.completions.push(userId);
          }
        } else {
          task.completions = task.completions.filter(id => id !== userId);
        }
      } else {
        task.status = isCompleted ? 'completed' : 'pending';
      }

      writeLocalDB(data);
      return task;
    }
  },

  deleteUser: async (id) => {
    const firestore = getFirestore();
    if (firestore) {
      await firestore.collection('users').doc(id).delete();
      
      // Cascade delete logs
      const logsSnapshot = await firestore.collection('logs').where('userId', '==', id).get();
      const batch = firestore.batch();
      logsSnapshot.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      
      // Cascade delete personal tasks
      const tasksSnapshot = await firestore.collection('tasks').where('assignedTo', '==', id).get();
      const tasksBatch = firestore.batch();
      tasksSnapshot.forEach(doc => tasksBatch.delete(doc.ref));
      await tasksBatch.commit();
    } else {
      const data = readLocalDB();
      data.users = data.users.filter(u => u.id !== id);
      data.logs = data.logs.filter(l => l.userId !== id);
      data.tasks = data.tasks.filter(t => t.assignedTo !== id);
      writeLocalDB(data);
    }
  },

  updateUser: async (id, updatedFields) => {
    const firestore = getFirestore();
    if (firestore) {
      await firestore.collection('users').doc(id).update(updatedFields);
      const doc = await firestore.collection('users').doc(id).get();
      return { id: doc.id, ...doc.data() };
    } else {
      const data = readLocalDB();
      const idx = data.users.findIndex(u => u.id === id);
      if (idx === -1) return null;
      data.users[idx] = { ...data.users[idx], ...updatedFields };
      writeLocalDB(data);
      return data.users[idx];
    }
  }
};

module.exports = db;
