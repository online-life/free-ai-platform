import { runSandboxedProcess } from "../../services/ai-runtime/dist/process-sandbox.js";

const scenario = process.argv[2];
if (scenario === "escape") {
  const result = await runSandboxedProcess({
    executable: process.env.NODE_EXECUTABLE,
    workspacePath: process.env.WORKSPACE_PATH,
    timeoutMs: 10_000,
    environment: { PROBE_PORT: process.env.PROBE_PORT },
    args: ["-e", `const fs=require('node:fs'),net=require('node:net'); (async()=>{fs.writeFileSync('/workspace/inside.txt','sandbox-write');let host='blocked';try{host=fs.readFileSync(process.argv[1],'utf8')}catch{};let etc='blocked';try{etc=fs.readFileSync('/etc/passwd','utf8')}catch{};let network='blocked';await new Promise(resolve=>{const socket=net.connect({host:'127.0.0.1',port:Number(process.env.PROBE_PORT)},()=>{network='connected';socket.destroy();resolve()});socket.on('error',()=>resolve())});console.log(JSON.stringify({host,etc,network}))})()`, process.env.OUTSIDE_PATH],
  });
  process.stdout.write(JSON.stringify(result));
} else if (scenario === "timeout") {
  const result = await runSandboxedProcess({
    executable: process.env.NODE_EXECUTABLE,
    workspacePath: process.env.WORKSPACE_PATH,
    timeoutMs: 1500,
    args: ["-e", "setInterval(()=>{},1000)"],
  });
  process.stdout.write(JSON.stringify(result));
} else if (scenario === "output") {
  const result = await runSandboxedProcess({
    executable: process.env.NODE_EXECUTABLE,
    workspacePath: process.env.WORKSPACE_PATH,
    maxOutputBytes: 1024,
    args: ["-e", "process.stdout.write('x'.repeat(4096))"],
  });
  process.stdout.write(JSON.stringify(result));
} else {
  throw new Error("UNKNOWN_TEST_SCENARIO");
}
