const { spawn } = require('node:child_process');
const path = require('node:path');
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(require('electron'), [path.join(__dirname, 'release-key.cjs'), ...process.argv.slice(2)], { env, stdio: 'inherit', windowsHide: true });
child.on('error', () => { console.error('Could not start the protected release-key helper.'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
