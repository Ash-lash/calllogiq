const fs = require('fs');
const path = 'c:/MyPers/Projects/GYCAnalysis/frontend/src/components/AdminDashboard.jsx';
let content = fs.readFileSync(path, 'utf8');

const dropdownComponent = `
// Custom Employee Dropdown Component
const EmployeeSelectDropdown = ({ options, value, onChange, placeholder, onHoverProfile }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', minWidth: '220px' }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="form-select"
        style={{ 
          cursor: 'pointer', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          background: '#fff'
        }}
      >
        <span>{selectedOption ? selectedOption.label : placeholder}</span>
        <span>▼</span>
      </div>
      
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '4px',
          backgroundColor: '#fff',
          border: '2px solid #111111',
          borderRadius: '6px',
          boxShadow: '4px 4px 0px #111111',
          maxHeight: '250px',
          overflowY: 'auto',
          zIndex: 1000
        }}>
          <div 
            onClick={() => { onChange(''); setIsOpen(false); }}
            style={{ padding: '0.5rem 1rem', cursor: 'pointer', borderBottom: '1px solid #eee' }}
            onMouseEnter={() => onHoverProfile(null)}
          >
            {placeholder}
          </div>
          {options.map((opt) => (
            <div 
              key={opt.value}
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
              onMouseEnter={(e) => {
                if (opt.user) {
                  const rect = e.target.getBoundingClientRect();
                  onHoverProfile({ user: opt.user, x: rect.right + 10, y: rect.top });
                }
              }}
              onMouseLeave={() => onHoverProfile(null)}
              style={{ 
                padding: '0.5rem 1rem', 
                cursor: 'pointer', 
                borderBottom: '1px solid #eee',
                backgroundColor: value === opt.value ? '#f3f4f6' : 'transparent',
                fontWeight: value === opt.value ? 700 : 400
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
`;

if (!content.includes('EmployeeSelectDropdown')) {
  content = content.replace(/(const AdminDashboard = \(\) => \{)/, dropdownComponent + '\n$1');
}

// Replace the deepAnalytics select
content = content.replace(
  /<select className="form-select" value=\{deepAnalyticsUserId\} onChange=\{e => setDeepAnalyticsUserId\(e\.target\.value\)\}[\s\S]*?<\/select>/,
  `<EmployeeSelectDropdown 
                  options={users.sort((a, b) => a.name.localeCompare(b.name)).map(u => ({ value: u.id, label: \`\${u.name} (\${u.domain})\`, user: u }))}
                  value={deepAnalyticsUserId}
                  onChange={setDeepAnalyticsUserId}
                  placeholder="-- Select Employee --"
                  onHoverProfile={(data) => {
                    if (data) {
                      setSelectedProfilePreview(data.user);
                      setProfileTooltipPos({ x: data.x, y: data.y });
                    } else {
                      setSelectedProfilePreview(null);
                    }
                  }}
                />`
);

// Replace the Attendance select
content = content.replace(
  /<select className="form-select" value=\{selectedAttendanceUserId\} onChange=\{\(e\) => setSelectedAttendanceUserId\(e\.target\.value\)\}[\s\S]*?<\/select>/,
  `<EmployeeSelectDropdown 
                options={users.sort((a, b) => a.name.localeCompare(b.name)).map(u => ({ value: u.id, label: \`\${u.name} (\${u.email})\`, user: u }))}
                value={selectedAttendanceUserId}
                onChange={setSelectedAttendanceUserId}
                placeholder="-- Choose Employee --"
                onHoverProfile={(data) => {
                  if (data) {
                    setSelectedProfilePreview(data.user);
                    setProfileTooltipPos({ x: data.x, y: data.y });
                  } else {
                    setSelectedProfilePreview(null);
                  }
                }}
              />`
);

// Wait, the tooltip should be floating without taking full screen IF it's triggered from the dropdown!
// Wait! If `selectedProfilePreview` is used by BOTH the click modal AND the hover dropdown, they will conflict!
// In the click modal, it takes up the whole screen. If the dropdown hovers and triggers the modal, the modal takes up the whole screen and blocks the dropdown!
// I need a separate state for dropdown hover tooltip!
// Let's add a `hoveredDropdownProfile` state to AdminDashboard.
content = content.replace(
  /const \[selectedProfilePreview, setSelectedProfilePreview\] = useState\(null\);/,
  "const [selectedProfilePreview, setSelectedProfilePreview] = useState(null);\n  const [hoveredDropdownProfile, setHoveredDropdownProfile] = useState(null);"
);

content = content.replace(
  /setSelectedProfilePreview\(data\.user\)/g,
  "setHoveredDropdownProfile(data.user)"
);

content = content.replace(
  /setSelectedProfilePreview\(null\)/g,
  "setSelectedProfilePreview(null);\n                      if (data === null) setHoveredDropdownProfile(null);"
);
// Above replace for `setSelectedProfilePreview(null)` is too broad. Let's fix it by manually crafting the replacement.

fs.writeFileSync(path, content);
console.log('Script replaced parts. Run a separate pass to fix tooltip.');
