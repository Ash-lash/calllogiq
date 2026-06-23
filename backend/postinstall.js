const { execSync } = require('child_process');

console.log('Running postinstall: Ensuring Chrome browser is installed...');
try {
  execSync('npx puppeteer browsers install chrome', {
    stdio: 'inherit'
  });
  console.log('Chrome check/installation completed successfully.');
} catch (err) {
  console.error('Failed to install Chrome:', err);
  process.exit(1);
}

