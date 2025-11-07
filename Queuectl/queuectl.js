#!/usr/bin/env node

const { Command } = require('commander');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { loadJobs, saveJobs } = require('./utils/persistance');
const { processJobs } = require('./worker');

const program = new Command();

// CLI app metadata
program
  .name('queuectl')
  .description('CLI-based background job queue system')
  .version('1.0.0');



// ENQUEUE (Add new job)

program
  .command('enqueue')
  .argument('<command>', 'Command to execute')
  .description('Add a new job to the queue')
  .action((cmd) => {
    const jobs = loadJobs();
    const newJob = {
      id: uuidv4(),
      command: cmd,
      state: 'pending',
      attempts: 0,
      max_retries: 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    jobs.push(newJob);
    saveJobs(jobs);
    console.log(`Enqueued job ${newJob.id}: "${cmd}"`);
  });



// WORKER COMMANDS

const worker = program.command('worker').description('Manage worker processes');

//  Start workers (process jobs)
worker
  .command('start')
  .option('--count <number>', 'Number of workers', 2)
  .option('--base <number>', 'Base delay for exponential backoff', 2)
  .option('--retries <number>', 'Max retries per job', 3)
  .description('Start one or more workers to process jobs')
  .action((options) => {
    console.log(` Starting ${options.count} worker(s)...`);
    processJobs(Number(options.base), Number(options.retries), Number(options.count));
  });

//  Stop workers (for simulation)
worker
  .command('stop')
  .description('Stop running workers gracefully')
  .action(() => {
    console.log(' All workers stopped gracefully (simulation).');
  });



//  LIST JOBS

program
  .command('list')
  .option('--state <state>', 'Filter jobs by state (pending, completed, failed, dead)')
  .description('List all jobs or filter by state')
  .action((options) => {
    const jobs = loadJobs();
    const filtered = options.state
      ? jobs.filter((j) => j.state === options.state)
      : jobs;

    if (filtered.length === 0) {
      console.log(' No jobs found.');
      return;
    }

    console.log(` Showing ${filtered.length} job(s):`);
    filtered.forEach((job) => {
      console.log(
        ` [${job.state}] ${job.id} → "${job.command}" (Attempts: ${job.attempts})`
      );
    });
  });



//  STATUS SUMMARY

program
  .command('status')
  .description('Show summary of all job states')
  .action(() => {
    const jobs = loadJobs();
    const summary = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      dead: 0,
    };

    for (const job of jobs) {
      if (summary[job.state] !== undefined) {
        summary[job.state]++;
      }
    }

    console.log(' Job Summary:');
    for (const [state, count] of Object.entries(summary)) {
      console.log(`  ${state}: ${count}`);
    }
  });



//  DEAD LETTER QUEUE (DLQ)

const dlq = program.command('dlq').description('Manage Dead Letter Queue');

// list DLQ jobs
dlq
  .command('list')
  .description('List all jobs in DLQ')
  .action(() => {
    const jobs = loadJobs();
    const dlqJobs = jobs.filter((j) => j.state === 'dead');

    if (dlqJobs.length === 0) {
      console.log(' No jobs in DLQ.');
      return;
    }

    console.log(` ${dlqJobs.length} job(s) found in DLQ:`);
    dlqJobs.forEach((job) => {
      console.log(` [DLQ] ${job.id} → "${job.command}" (Attempts: ${job.attempts})`);
    });
  });

// retry DLQ job
dlq
  .command('retry <jobId>')
  .description('Retry a specific DLQ job')
  .action((jobId) => {
    let jobs = loadJobs();
    const job = jobs.find((j) => j.id === jobId);

    if (!job) {
      console.log(` No job found with ID ${jobId}`);
      return;
    }

    job.state = 'pending';
    job.attempts = 0;
    saveJobs(jobs);
    console.log(` Job ${jobId} moved from DLQ back to pending`);
  });



//  CONFIG COMMAND


const config = program.command('config').description('Manage configuration values');

// Subcommand: set
config
  .command('set')
  .argument('<key>', 'Configuration key (max-retries, base-delay)')
  .argument('<value>', 'New value')
  .description('Set a configuration value')
  .action((key, value) => {
    const configPath = path.join(__dirname, 'config.json');
    let config = {};

    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }

    config[key] = isNaN(value) ? value : Number(value);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    console.log(` Updated config: ${key} = ${value}`);
  });

// Subcommand: get
config
  .command('get')
  .argument('<key>', 'Configuration key to read')
  .description('Get a configuration value')
  .action((key) => {
    const configPath = path.join(__dirname, 'config.json');
    if (!fs.existsSync(configPath)) {
      console.log(' No configuration file found.');
      return;
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (config[key] === undefined) {
      console.log(` No such config key: ${key}`);
    } else {
      console.log(`🔧 ${key} = ${config[key]}`);
    }
  });

// Subcommand: list
config
  .command('list')
  .description('Show all configuration values')
  .action(() => {
    const configPath = path.join(__dirname, 'config.json');
    if (!fs.existsSync(configPath)) {
      console.log(' No configuration file found.');
      return;
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    console.log(' Current Configuration:');
    for (const [key, value] of Object.entries(config)) {
      console.log(`  ${key}: ${value}`);
    }
  });





program.parse();


