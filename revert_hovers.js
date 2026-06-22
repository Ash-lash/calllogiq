const fs = require('fs');
const path = 'c:/MyPers/Projects/GYCAnalysis/frontend/src/components/AdminDashboard.jsx';
let content = fs.readFileSync(path, 'utf8');

// Revert hover bindings to onClick
content = content.replace(
  /onMouseEnter=\{\(e\) => \{\s*setSelectedProfilePreview\(([^)]+)\);\s*setProfileTooltipPos\(\{ x: e\.clientX, y: e\.clientY \}\);\s*\}\}\s*onMouseLeave=\{\(\) => setSelectedProfilePreview\(null\)\}/g,
  'onClick={() => setSelectedProfilePreview()}'
);

content = content.replace(
  /onMouseEnter=\{\(e\) => \{\s*e\.stopPropagation\(\);\s*setSelectedProfilePreview\(([^)]+)\);\s*setProfileTooltipPos\(\{ x: e\.clientX, y: e\.clientY \}\);\s*\}\}\s*onMouseLeave=\{\(e\) => \{\s*e\.stopPropagation\(\);\s*setSelectedProfilePreview\(null\);\s*\}\}/g,
  'onClick={(e) => { e.stopPropagation(); setSelectedProfilePreview(); }}'
);

// Revert the tooltip to the fullscreen modal
const tooltipStartRegex = /\{\/\* WhatsApp-style Profile details Tooltip \*\/\}\s*\{selectedProfilePreview && \([\s\S]*?<\/div>\s*\)\}/;

const modalJSX = \{/* WhatsApp-style Profile details Modal */}
      {selectedProfilePreview && (
        <div 
          onClick={() => setSelectedProfilePreview(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(4px)',
            padding: '1rem'
          }}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '320px',
              backgroundColor: '#ffffff',
              border: '3px solid #111111',
              borderRadius: '12px',
              boxShadow: '8px 8px 0px #111111',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              animation: 'fadeIn 0.2s ease-out'
            }}
          >
            {/* Close Button */}
            <button 
              onClick={() => setSelectedProfilePreview(null)}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                border: '2px solid #111111',
                background: '#ffffff',
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                fontWeight: 900,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10
              }}
            >
              ?
            </button>

            {/* Profile Photo Area */}
            <div style={{ height: '240px', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', borderBottom: '3px solid #111111' }}>
              {selectedProfilePreview.photo ? (
                <img 
                  src={selectedProfilePreview.photo} 
                  alt={selectedProfilePreview.name} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              ) : (
                <div style={{ fontSize: '5rem', fontWeight: 800, color: '#4b5563' }}>
                  {selectedProfilePreview.name ? selectedProfilePreview.name.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
            </div>

            {/* Info Area */}
            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#111111', textTransform: 'uppercase' }}>
                {selectedProfilePreview.name}
              </div>
              <div style={{ fontSize: '0.88rem', color: '#4b5563', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                ?? {selectedProfilePreview.email}
              </div>
              {selectedProfilePreview.phone && (
                <div style={{ fontSize: '0.85rem', color: '#4b5563', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  ?? {selectedProfilePreview.phone}
                </div>
              )}
              {selectedProfilePreview.domain && (
                <div style={{ marginTop: '0.5rem', display: 'inline-block' }}>
                  {(() => {
                    const dl = (selectedProfilePreview.domain || '').toLowerCase();
                    const dbg = dl.includes('accounts') ? '#ede9fe' : dl.includes('business') ? '#dcfce7' : '#dbeafe';
                    const dc = dl.includes('accounts') ? '#7c3aed' : dl.includes('business') ? '#15803d' : '#1d4ed8';
                    return <span style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', background: dbg, color: dc, border: \1.5px solid \\ }}>{selectedProfilePreview.domain}</span>;
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}\;

content = content.replace(tooltipStartRegex, modalJSX);
fs.writeFileSync(path, content);
console.log('Reverted to onClick and modal');
