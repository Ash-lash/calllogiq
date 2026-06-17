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
    otps: [],
    assets: [],
    assetVerifications: [],
    assetNotifications: []
  }, null, 2), 'utf8');
}

function readLocalDB() {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(data);
    if (!parsed.assets) parsed.assets = [];
    if (!parsed.assetVerifications) parsed.assetVerifications = [];
    if (!parsed.assetNotifications) parsed.assetNotifications = [];
    return parsed;
  } catch (err) {
    console.error('Error reading database file:', err);
    return { users: [], logs: [], tasks: [], otps: [], assets: [], assetVerifications: [], assetNotifications: [] };
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
        const data = doc.data();
        data.hasPdf = !!data.pdfUrl || !!data.pdfBase64;
        data.hasExcel = !!data.excelUrl || !!data.excelBase64;
        delete data.pdfBase64;
        delete data.excelBase64;
        logsList.push({ id: doc.id, ...data });
      });
      return logsList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else {
      const data = readLocalDB();
      return data.logs
        .filter(l => l.userId === userId)
        .map(({ pdfBase64, excelBase64, ...l }) => ({
          ...l,
          hasPdf: !!l.pdfUrl || !!pdfBase64,
          hasExcel: !!l.excelUrl || !!excelBase64
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
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
        const data = doc.data();
        data.hasPdf = !!data.pdfUrl || !!data.pdfBase64;
        data.hasExcel = !!data.excelUrl || !!data.excelBase64;
        delete data.pdfBase64;
        delete data.excelBase64;
        logsList.push({ id: doc.id, ...data });
      });
      return logsList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else {
      const data = readLocalDB();
      return data.logs
        .map(({ pdfBase64, excelBase64, ...l }) => ({
          ...l,
          hasPdf: !!l.pdfUrl || !!pdfBase64,
          hasExcel: !!l.excelUrl || !!excelBase64
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  },

  updateLog: async (id, updatedFields) => {
    const firestore = getFirestore();
    if (firestore) {
      await firestore.collection('logs').doc(id).update(updatedFields);
      const doc = await firestore.collection('logs').doc(id).get();
      return { id: doc.id, ...doc.data() };
    } else {
      const data = readLocalDB();
      const idx = data.logs.findIndex(l => l.id === id);
      if (idx === -1) return null;
      data.logs[idx] = { ...data.logs[idx], ...updatedFields };
      writeLocalDB(data);
      return data.logs[idx];
    }
  },

  // --- TASKS ---
  createTask: async (task) => {
    const firestore = getFirestore();
    const id = 'task_' + Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const newTask = {
      status: 'pending',
      completions: [],
      employeeStages: {},
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

  updateTaskStatus: async (taskId, userId, status) => {
    const firestore = getFirestore();
    if (firestore) {
      const docRef = firestore.collection('tasks').doc(taskId);
      const doc = await docRef.get();
      if (!doc.exists) return null;
      
      const task = doc.data();
      if (!task.employeeStages) task.employeeStages = {};
      task.employeeStages[userId] = status;
      
      const isDomainTask = ['accounts', 'sales', 'support', 'hr', 'operations'].includes(task.assignedTo.toLowerCase());
      if (isDomainTask) {
        if (!task.completions) task.completions = [];
        if (status === 'completed') {
          if (!task.completions.includes(userId)) task.completions.push(userId);
        } else {
          task.completions = task.completions.filter(id => id !== userId);
        }
      } else {
        task.status = status;
      }
      
      await docRef.set(task);
      return { id: taskId, ...task };
    } else {
      const data = readLocalDB();
      const task = data.tasks.find(t => t.id === taskId);
      if (!task) return null;
      
      if (!task.employeeStages) task.employeeStages = {};
      task.employeeStages[userId] = status;
      
      const isDomainTask = ['accounts', 'sales', 'support', 'hr', 'operations'].includes(task.assignedTo.toLowerCase());
      if (isDomainTask) {
        if (!task.completions) task.completions = [];
        if (status === 'completed') {
          if (!task.completions.includes(userId)) task.completions.push(userId);
        } else {
          task.completions = task.completions.filter(id => id !== userId);
        }
      } else {
        task.status = status;
      }
      
      writeLocalDB(data);
      return task;
    }
  },

  toggleTaskStatus: async (taskId, userId, isCompleted) => {
    const status = isCompleted ? 'completed' : 'pending';
    return db.updateTaskStatus(taskId, userId, status);
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
  },

  // --- ASSETS ---
  createAsset: async (asset) => {
    const firestore = getFirestore();
    const tagId = asset.assetTagId;
    if (firestore) {
      await firestore.collection('assets').doc(tagId).set(asset);
      return asset;
    } else {
      const data = readLocalDB();
      // Remove if exists
      data.assets = data.assets.filter(a => a.assetTagId !== tagId);
      data.assets.push(asset);
      writeLocalDB(data);
      return asset;
    }
  },

  updateAsset: async (tagId, updatedFields) => {
    const firestore = getFirestore();
    if (firestore) {
      await firestore.collection('assets').doc(tagId).update(updatedFields);
      const doc = await firestore.collection('assets').doc(tagId).get();
      return { assetTagId: doc.id, ...doc.data() };
    } else {
      const data = readLocalDB();
      const idx = data.assets.findIndex(a => a.assetTagId === tagId);
      if (idx === -1) return null;
      data.assets[idx] = { ...data.assets[idx], ...updatedFields };
      writeLocalDB(data);
      return data.assets[idx];
    }
  },

  deleteAsset: async (tagId) => {
    const firestore = getFirestore();
    if (firestore) {
      await firestore.collection('assets').doc(tagId).delete();
    } else {
      const data = readLocalDB();
      data.assets = data.assets.filter(a => a.assetTagId !== tagId);
      writeLocalDB(data);
    }
  },

  listAllAssets: async () => {
    const firestore = getFirestore();
    if (firestore) {
      const snapshot = await firestore.collection('assets').get();
      const list = [];
      snapshot.forEach(doc => list.push({ assetTagId: doc.id, ...doc.data() }));
      return list;
    } else {
      const data = readLocalDB();
      return data.assets;
    }
  },

  getAssetByTagId: async (tagId) => {
    const firestore = getFirestore();
    if (firestore) {
      const doc = await firestore.collection('assets').doc(tagId).get();
      if (!doc.exists) return null;
      return { assetTagId: doc.id, ...doc.data() };
    } else {
      const data = readLocalDB();
      return data.assets.find(a => a.assetTagId === tagId) || null;
    }
  },

  // --- ASSET VERIFICATIONS ---
  createAssetVerification: async (verification) => {
    const firestore = getFirestore();
    const id = 'verification_' + Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const newVer = {
      submittedAt: new Date().toISOString(),
      ...verification,
      id
    };
    if (firestore) {
      await firestore.collection('asset_verifications').doc(id).set(newVer);
      return newVer;
    } else {
      const data = readLocalDB();
      data.assetVerifications.push(newVer);
      writeLocalDB(data);
      return newVer;
    }
  },

  listAssetVerifications: async () => {
    const firestore = getFirestore();
    if (firestore) {
      const snapshot = await firestore.collection('asset_verifications').get();
      const list = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      return list.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    } else {
      const data = readLocalDB();
      return data.assetVerifications.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    }
  },

  // --- ASSET NOTIFICATIONS / ALERTS ---
  createAssetNotification: async (notification) => {
    const firestore = getFirestore();
    const id = 'notification_' + Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const newNotif = {
      createdAt: new Date().toISOString(),
      resolved: false,
      ...notification,
      id
    };
    if (firestore) {
      await firestore.collection('asset_notifications').doc(id).set(newNotif);
      return newNotif;
    } else {
      const data = readLocalDB();
      data.assetNotifications.push(newNotif);
      writeLocalDB(data);
      return newNotif;
    }
  },

  listAssetNotifications: async () => {
    const firestore = getFirestore();
    if (firestore) {
      const snapshot = await firestore.collection('asset_notifications').get();
      const list = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else {
      const data = readLocalDB();
      return data.assetNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  },

  resolveAssetNotification: async (id) => {
    const firestore = getFirestore();
    if (firestore) {
      await firestore.collection('asset_notifications').doc(id).update({ resolved: true });
      const doc = await firestore.collection('asset_notifications').doc(id).get();
      return { id: doc.id, ...doc.data() };
    } else {
      const data = readLocalDB();
      const idx = data.assetNotifications.findIndex(n => n.id === id);
      if (idx !== -1) {
        data.assetNotifications[idx].resolved = true;
        writeLocalDB(data);
        return data.assetNotifications[idx];
      }
      return null;
    }
  },

  seedAssets: async () => {
    const firestore = getFirestore();
    const { execSync } = require('child_process');
    try {
      let alreadyHasAssets = false;
      if (firestore) {
        const snapshot = await firestore.collection('assets').limit(1).get();
        alreadyHasAssets = !snapshot.empty;
      } else {
        const data = readLocalDB();
        alreadyHasAssets = data.assets && data.assets.length > 0;
      }

      if (alreadyHasAssets) {
        console.log('Database already has assets. Skipping seeding.');
        return;
      }

      console.log('Seeding assets from asset.xlsx...');
      const pyScript = path.join(__dirname, 'seed_assets.py');
      const stdout = execSync(`python "${pyScript}"`, { encoding: 'utf8' });
      const assets = JSON.parse(stdout);

      if (assets && assets.length > 0) {
        if (firestore) {
          const batch = firestore.batch();
          assets.forEach(asset => {
            const docRef = firestore.collection('assets').doc(asset.assetTagId);
            batch.set(docRef, asset);
          });
          await batch.commit();
          console.log(`Seeded ${assets.length} assets to Firestore.`);
        } else {
          const data = readLocalDB();
          data.assets = assets;
          writeLocalDB(data);
          console.log(`Seeded ${assets.length} assets to local JSON DB.`);
        }
      }
    } catch (err) {
      console.error('Failed to seed assets:', err);
    }
  },

  flushDatabase: async () => {
    const firestore = getFirestore();
    if (firestore) {
      const collections = ['users', 'logs', 'tasks', 'otps', 'assets', 'asset_verifications', 'asset_notifications'];
      for (const colName of collections) {
        const snapshot = await firestore.collection(colName).get();
        const batch = firestore.batch();
        snapshot.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      }
    } else {
      const emptyData = {
        users: [],
        logs: [],
        tasks: [],
        otps: [],
        assets: [],
        assetVerifications: [],
        assetNotifications: []
      };
      writeLocalDB(emptyData);
    }
    return true;
  }
};

module.exports = db;
