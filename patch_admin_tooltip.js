const fs = require('fs');
const path = 'c:/MyPers/Projects/GYCAnalysis/frontend/src/components/AdminDashboard.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add tooltipPos state
content = content.replace(
  "const [selectedProfilePreview, setSelectedProfilePreview] = useState(null);",
  "const [selectedProfilePreview, setSelectedProfilePreview] = useState(null);\n  const [profileTooltipPos, setProfileTooltipPos] = useState({x: 0, y: 0});"
);

// 2. Change all onClick={() => setSelectedProfilePreview(...)} to onMouseEnter/onMouseLeave
content = content.replace(
  /onClick=\{\(\) => setSelectedProfilePreview\(([^)]+)\)\}/g,
  'onMouseEnter={(e) => { setSelectedProfilePreview(); setProfileTooltipPos({ x: e.clientX, y: e.clientY }); }} onMouseLeave={() => setSelectedProfilePreview(null)}'
);

content = content.replace(
  /onClick=\{\(e\) => \{\s*e\.stopPropagation\(\);\s*setSelectedProfilePreview\(([^)]+)\);\s*\}\}/g,
  'onMouseEnter={(e) => { e.stopPropagation(); setSelectedProfilePreview(); setProfileTooltipPos({ x: e.clientX, y: e.clientY }); }} onMouseLeave={(e) => { e.stopPropagation(); setSelectedProfilePreview(null); }}'
);

// 3. Replace the modal structure at the bottom with a tooltip structure
const modalStartRegex = /\{selectedProfilePreview && \([\s\S]*?zIndex:\s*1000\s*\},\s*\]\)\}\s*>\s*\{selectedProfilePreview\.domain\}\s*<\/span>;[\s\S]*?<\/div>\s*\)\}\s*<\/div>\s*\)\}\s*<\/div>\s*\)\}/;

const tooltipJSX = \{selectedProfilePreview && (
        <div className="tooltip-profile" style={{ 
          left: Math.min(profileTooltipPos.x + 15, window.innerWidth - 300) + 'px', 
          top: Math.min(profileTooltipPos.y + 15, window.innerHeight - 200) + 'px',
          position: 'fixed'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.75rem', marginBottom: '0.25rem' }}>
            <div style={{ width: '50px', height: '50px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '2px solid var(--border-color)', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f5f5f5' }}>
              {selectedProfilePreview.photo ? (
                <img 
                  src={selectedProfilePreview.photo} 
                  alt={selectedProfilePreview.name} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#666' }}>
                  {selectedProfilePreview.name ? selectedProfilePreview.name.charAt(0).toUpperCase() : 'U'}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                {selectedProfilePreview.name}
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                ?? {selectedProfilePreview.email}
              </p>
              {selectedProfilePreview.phone && (
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                  ?? {selectedProfilePreview.phone}
                </p>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            {selectedProfilePreview.domain && (
              <div style={{ marginTop: '0.2rem' }}>
                {(() => {
                    const dl = (selectedProfilePreview.domain || '').toLowerCase();
                    let dbg = '#f3f4f6'; let dc = '#374151';
                    if (dl.includes('academic')) { dbg = '#dbeafe'; dc = '#1e40af'; }
                    else if (dl.includes('development')) { dbg = '#fce7f3'; dc = '#be185d'; }
                    else if (dl.includes('business')) { dbg = '#fef3c7'; dc = '#b45309'; }
                    return <span style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', background: dbg, color: dc, border: \1.5px solid \\ }}>{selectedProfilePreview.domain}</span>;
                })()}
              </div>
            )}
          </div>
        </div>
      )}\;

content = content.replace(modalStartRegex, tooltipJSX);

fs.writeFileSync(path, content);
console.log('Tooltip patched.');
