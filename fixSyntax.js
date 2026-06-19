const fs = require('fs');
const path = 'c:/MyPers/Projects/GYCAnalysis/frontend/src/components/UserProfile.jsx';
let content = fs.readFileSync(path, 'utf8');

// I will overwrite UserProfile.jsx because the script replaced too much and broke the tags.
// I will fetch it from git, then do the multi-replace properly.
