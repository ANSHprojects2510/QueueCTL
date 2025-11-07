const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { getbackoffdelay } = require('./utils/backoff');
const { loadJobs, saveJobs } = require('./utils/persistance');

//  Default timeout duration (in milliseconds)
const DEFAULT_JOB_TIMEOUT = 10000; // 10 seconds
//  Log folder
const LOG_DIR = path.join(__dirname, 'logs');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

async function Runjob(job, baseDelay, maxRetry, timeoutMs = DEFAULT_JOB_TIMEOUT) {
  return new Promise((resolve) => {
    // Mark job as processing before starting
    job.state = 'processing';
    saveJobs(loadJobs().map(j => j.id === job.id ? job : j));

    console.log(` Starting job ${job.id} (timeout: ${timeoutMs / 1000}s)`);

    // Create a log file for this job
    const logFile = path.join(LOG_DIR, `${job.id}.log`);
    fs.writeFileSync(logFile, `--- Log for Job ${job.id} ---\nCommand: ${job.command}\n\n`);

    // Start process
    const processRef = exec(job.command, (error, stdout, stderr) => {
      clearTimeout(timer); // cancel timeout on exit

      // Append stdout/stderr to the log file
      if (stdout) fs.appendFileSync(logFile, `STDOUT:\n${stdout}\n`);
      if (stderr) fs.appendFileSync(logFile, `STDERR:\n${stderr}\n`);

      if (error) {
        fs.appendFileSync(logFile, `ERROR: ${error.message}\n`);
        console.log(` Job ${job.id} failed`);

        job.attempts = (job.attempts || 0) + 1;

        if (job.attempts > maxRetry) {
          console.log(`  Job ${job.id} moved to Dead Letter Queue`);
          job.state = 'dead';
        } else {
          job.state = 'failed';
        }
      } else {
        console.log(` Job ${job.id} completed successfully`);
        job.state = 'completed';
      }

      job.updated_at = new Date().toISOString();
      fs.appendFileSync(logFile, `\nFinal state: ${job.state}\n`);
      resolve(job);
    });

    // Capture live stdout and stderr streams (optional, for longer jobs)
    processRef.stdout?.on('data', (chunk) => fs.appendFileSync(logFile, chunk));
    processRef.stderr?.on('data', (chunk) => fs.appendFileSync(logFile, chunk));

    //  Timeout protection
    const timer = setTimeout(() => {
      console.log(`⏱  Job ${job.id} exceeded timeout (${timeoutMs / 1000}s) — terminating`);
      fs.appendFileSync(logFile, `\n⏱ Job timed out after ${timeoutMs / 1000}s\n`);

      processRef.kill('SIGTERM'); // kill child process
      job.attempts = (job.attempts || 0) + 1;

      if (job.attempts > maxRetry) {
        console.log(`  Job ${job.id} moved to Dead Letter Queue due to timeout`);
        job.state = 'dead';
      } else {
        job.state = 'failed';
      }

      job.updated_at = new Date().toISOString();
      saveJobs(loadJobs().map(j => j.id === job.id ? job : j));
      resolve(job);
    }, timeoutMs);
  });
}

async function processJobs(baseDelay = 2, maxRetries = 3, workers = 2) {
  let jobs = loadJobs();
  console.log(" Loaded jobs:", jobs);

  let activeJobs = jobs.filter(j => j.state === "pending" || j.state === "retry");
  console.log(" Active jobs found:", activeJobs.length);

  const runWorker = async (job) => {
    let updatedJob = await Runjob(job, baseDelay, maxRetries);

    if (updatedJob.state === "retry" || updatedJob.state === "failed") {
      if (updatedJob.state !== "dead" && updatedJob.attempts <= maxRetries) {
        const delay = getbackoffdelay(baseDelay, updatedJob.attempts);
        console.log(` Retrying job ${updatedJob.id} after ${delay / 1000}s`);
        await new Promise(r => setTimeout(r, delay));
        await runWorker(updatedJob);
      }
    }

    jobs = jobs.map(j => j.id === updatedJob.id ? updatedJob : j);
    saveJobs(jobs);
  };

  const activeBatch = activeJobs.slice(0, workers);
  await Promise.all(activeBatch.map(runWorker));

  saveJobs(jobs);
}

module.exports = { processJobs };


  
