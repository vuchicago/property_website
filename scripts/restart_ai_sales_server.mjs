import { spawnSync } from 'node:child_process';

const port = Number(process.argv[2] || 8788);

function pidsForPort(value) {
        const result = spawnSync('lsof', ['-ti', `tcp:${value}`], {
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore']
        });

return result.stdout
        .split(/\s+/)
        .map(item => Number(item))
        .filter(pid => Number.isInteger(pid) && pid !== process.pid && pid !== process.ppid);
}

for (const pid of pidsForPort(port)) {
        try {
                process.kill(pid, 'SIGTERM');
        } catch {
                // Process may already be gone.
        }
}

await new Promise(resolve => setTimeout(resolve, 450));

for (const pid of pidsForPort(port)) {
        try {
                process.kill(pid, 'SIGKILL');
        } catch {
                // Process may already be gone.
        }
}

process.argv[2] = String(port);
await import('./dev_ai_sales_server.mjs');
