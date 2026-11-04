// Chay backend (cong 3000) va frontend (cong 5173) cung luc: npm run dev
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const backendEnv = path.join(__dirname, 'backend', '.env');
if (!fs.existsSync(backendEnv)) fs.copyFileSync(path.join(__dirname, 'backend', '.env.example'), backendEnv);

const run = (name, dir, args, color) => {
  const child = spawn(`npm ${args.join(' ')}`, { cwd: path.join(__dirname, dir), shell: true, env: process.env });
  const prefix = `\x1b[${color}m[${name}]\x1b[0m `;
  const pipe = (stream, out) => stream.on('data', (d) => d.toString().split(/\r?\n/).filter(Boolean).forEach((l) => out.write(prefix + l + '\n')));
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    console.log(`${prefix}da dung (ma ${code}).`);
    process.exit(code ?? 0);
  });
  return child;
};

const children = [run('backend', 'backend', ['start'], 32), run('frontend', 'frontend', ['run', 'dev'], 36)];
const stop = () => children.forEach((c) => c.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
