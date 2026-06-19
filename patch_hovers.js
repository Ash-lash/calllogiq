const fs = require('fs');
const path = 'c:/MyPers/Projects/GYCAnalysis/frontend/src/components/AdminDashboard.jsx';
let content = fs.readFileSync(path, 'utf8');

// Replace standard onClick with onMouseEnter + onMouseLeave
content = content.replace(
  /onClick=\{\(\) => setSelectedProfilePreview\(([^)]+)\)\}/g,
  'onMouseEnter={(e) => { setSelectedProfilePreview(); setProfileTooltipPos({ x: e.clientX, y: e.clientY }); }} onMouseLeave={() => setSelectedProfilePreview(null)}'
);

// Replace stopPropagation onClick
content = content.replace(
  /onClick=\{\(e\) => \{\s*e\.stopPropagation\(\);\s*setSelectedProfilePreview\(([^)]+)\);\s*\}\}/g,
  'onMouseEnter={(e) => { e.stopPropagation(); setSelectedProfilePreview(); setProfileTooltipPos({ x: e.clientX, y: e.clientY }); }} onMouseLeave={(e) => { e.stopPropagation(); setSelectedProfilePreview(null); }}'
);

fs.writeFileSync(path, content);
console.log('Hovers patched.');
