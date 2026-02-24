import { spawn } from 'node:child_process';

const port = 4123;
const app = spawn('npm', ['run', 'dev', '--', '--port', String(port)], { cwd: process.cwd(), stdio: 'pipe' });

function wait(ms){ return new Promise((r)=>setTimeout(r,ms)); }
async function fetchText(path){
  const res = await fetch(`http://127.0.0.1:${port}${path}`);
  if(!res.ok) throw new Error(`Route failed: ${path}`);
  return res.text();
}

(async()=>{
  try {
    await wait(7000);
    const home = await fetchText('/demo/evidence-viewer');
    if (!home.includes('Evidence Viewer')) throw new Error('Viewer heading missing');
    console.log('PASS evidence viewer route');
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    app.kill('SIGTERM');
  }
})();
