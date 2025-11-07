const { execSync, spawn } = require("child_process");

function run(cmd) {
  console.log(`\n> ${cmd}`);
  try {
    const out = execSync(cmd, { stdio: "pipe" }).toString();
    console.log(out.trim());
  } catch (err) {
    console.log("Error:", err.message);
  }
}

console.log("=== QueueCTL Minimal Test Script ===");

run('del queue_data.json 2>nul'); // delete old data (Windows safe)
run('node queuectl.js enqueue "echo Hello World"');
run('node queuectl.js enqueue "node -e \\"process.exit(1)\\""');

console.log("\nStarting worker for 10 seconds...");
const worker = spawn("node", ["queuectl.js", "worker", "start"]);

setTimeout(() => {
  worker.kill("SIGINT");
  console.log("\nWorker stopped. Checking job list...");
  run("node queuectl.js list");
  console.log("\n Test complete.");
}, 10000);

