const fs = require('node:fs');
const { chromium } = require('playwright');
module.exports = () => {
  const executablePath = process.env.COSMIC_CHROMIUM_EXECUTABLE || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  return chromium.launch({ args: ['--no-sandbox'], ...(executablePath ? { executablePath } : {}) });
};
