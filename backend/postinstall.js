const { execSync } = require('child_process');

if (process.env.RENDER) {
  console.log('Render environment detected. Installing Chrome into cache directory...');
  try {
    execSync('npx puppeteer browsers install chrome', {
      env: { ...process.env, PUPPETEER_CACHE_DIR: '/opt/render/.cache/puppeteer' },
      stdio: 'inherit'
    });
    console.log('Chrome installed successfully.');
  } catch (err) {
    console.error('Failed to install Chrome:', err);
    process.exit(1);
  }
} else {
  console.log('Local environment. Skipping Render Chrome installation.');
}
