const fs = require('node:fs/promises');
const path = require('node:path');
class Preferences {
  constructor(directory) { this.file = path.join(directory, 'preferences.json'); this.language = 'en'; this.writes = Promise.resolve(); }
  async init() {
    try { const bytes = await fs.readFile(this.file); if (bytes.length < 1024) { const data = JSON.parse(bytes.toString('utf8')); if (['en', 'zh-CN'].includes(data.language)) this.language = data.language; } } catch { /* A missing or invalid preference never blocks startup. */ }
    return this;
  }
  async setLanguage(language) {
    if (!['en', 'zh-CN'].includes(language)) throw new Error('Unsupported language.');
    const operation = this.writes.catch(() => {}).then(async () => {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      await fs.writeFile(`${this.file}.tmp`, JSON.stringify({ language }), { mode: 0o600 });
      await fs.rename(`${this.file}.tmp`, this.file); this.language = language;
    });
    this.writes = operation; await operation; return { language: this.language };
  }
}
module.exports = { Preferences };
