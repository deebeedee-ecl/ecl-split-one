const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

class SessionVault {
  constructor(directory, encryption) { this.directory = directory; this.encryption = encryption; this.memory = new Map(); this.persistent = encryption.isEncryptionAvailable(); this.remember = true; this.warning = ''; this.writes = Promise.resolve(); }
  async setRemember(value, keys = []) {
    if (typeof value !== 'boolean') throw new Error('Choose whether to remember this sign-in.');
    this.remember = value;
    if (!value) for (const key of keys) await this.removeItem(key);
  }
  file(key) { return path.join(this.directory, `${crypto.createHash('sha256').update(key).digest('hex')}.bin`); }
  async getItem(key) {
    await this.writes.catch(() => {});
    if (this.memory.has(key)) return this.memory.get(key);
    if (!this.persistent || !this.remember) return null;
    try { const value = this.encryption.decryptString(await fs.readFile(this.file(key))); this.memory.set(key, value); return value; }
    catch (error) { if (error.code !== 'ENOENT') this.warning = 'The previous desktop session could not be unlocked. Please sign in again.'; return null; }
  }
  async setItem(key, value) {
    this.memory.set(key, value);
    if (!this.persistent || !this.remember) return;
    const operation = this.writes.catch(() => {}).then(async () => {
      if (!this.remember) return;
      try {
        const encrypted = this.encryption.encryptString(value);
        await fs.mkdir(this.directory, { recursive: true });
        const file = this.file(key); await fs.writeFile(`${file}.tmp`, encrypted, { mode: 0o600 }); await fs.rename(`${file}.tmp`, file);
      } catch { this.persistent = false; this.warning = 'Secure session storage is unavailable. This sign-in will only last until ECL Hub closes.'; }
    });
    this.writes = operation; await operation;
  }
  async removeItem(key) {
    this.memory.delete(key);
    const operation = this.writes.catch(() => {}).then(async () => {
      for (const file of [this.file(key), `${this.file(key)}.tmp`]) {
        try { await fs.unlink(file); } catch (error) { if (error.code !== 'ENOENT') throw new Error('Could not remove the saved desktop session.'); }
      }
    });
    this.writes = operation; await operation;
  }
}
module.exports = { SessionVault };
