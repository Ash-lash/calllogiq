const fs = require('fs');
const path = 'c:/MyPers/Projects/GYCAnalysis/frontend/src/index.css';
let content = fs.readFileSync(path, 'utf8');

const selectCss = 
/* Custom Select Dropdowns */
.form-select {
  padding: 10px 14px;
  font-size: 0.9rem;
  border: 2px solid var(--border-color);
  border-radius: 4px;
  font-weight: 700;
  background-color: var(--bg-input);
  outline: none;
  font-family: var(--font-family-body);
  color: var(--text-primary);
  cursor: pointer;
  transition: all var(--transition-fast);
  box-shadow: var(--shadow-flat-sm);
  appearance: none;
  background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23111111%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E");
  background-repeat: no-repeat;
  background-position: right 14px top 50%;
  background-size: 10px auto;
  padding-right: 32px;
}
.form-select:hover, .form-select:focus {
  transform: translateY(-2px) translateX(-2px);
  box-shadow: var(--shadow-flat-sm-hover);
}
;

content += selectCss;
fs.writeFileSync(path, content);
console.log('CSS patched');
