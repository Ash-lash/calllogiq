const fs = require('fs');
const path = 'c:/MyPers/Projects/GYCAnalysis/frontend/src/components/AdminDashboard.jsx';
let content = fs.readFileSync(path, 'utf8');

// Replace standard select inline styles with className="form-select"
content = content.replace(/<select\s+value=\{([^}]+)\}\s+onChange=\{([^}]+)\}\s+style=\{\{\s*padding:\s*'[^']+',\s*fontSize:\s*'[^']+',\s*border:\s*'[^']+',\s*borderRadius:\s*'[^']+',\s*fontWeight:\s*\d+,\s*backgroundColor:\s*'[^']+',\s*outline:\s*'[^']+'\s*\}\}/g, '<select className="form-select" value={} onChange={}');

fs.writeFileSync(path, content);
console.log('Selects patched.');
