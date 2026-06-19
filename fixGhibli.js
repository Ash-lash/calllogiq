const fs = require('fs');
const path = 'c:/MyPers/Projects/GYCAnalysis/frontend/src/components/UserProfile.jsx';
let content = fs.readFileSync(path, 'utf8');

// Remove Ghibli functions
content = content.replace(/\/\/ --- GHIBLI FILTER PIPELINE ---[\s\S]*?function UserProfile/m, 'function UserProfile');

// Remove Ghibli states
content = content.replace(/const \[showAvatarPicker.*?;\n/g, '');
content = content.replace(/const \[ghibliLoading.*?;\n/g, '');
content = content.replace(/const \[ghibliVariants.*?;\n/g, '');
content = content.replace(/const \[generatingVariants.*?;\n/g, '');

// Remove Ghibli button and UI
content = content.replace(/<button[\s\S]*?Choose Avatar\s*<\/button>/m, '');
content = content.replace(/\{showAvatarPicker && \([\s\S]*?\)\}/m, '');

// Remove loading UI
content = content.replace(/\{ghibliLoading && \([\s\S]*?\}\)/m, '');

// Remove handleGhibliUpload
content = content.replace(/const handleGhibliUpload = \([\s\S]*?reader\.readAsDataURL\(file\);\s*\};/m, '');

fs.writeFileSync(path, content);
console.log('Fixed UserProfile.jsx');
