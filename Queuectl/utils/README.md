QueueCTL – CLI-Based Background Job Queue System

QueueCTL is a Node.js command-line tool that manages background jobs with retry logic, exponential backoff, persistence, and multi-worker support.
It simulates a real-world job queue system entirely from the CLI.

 ### 1. Setup Instructions
# Prerequisites

Node.js v14 or higher

NPM (comes with Node)

=> Installation

Clone or download this repository:


cd Queuectl


Install dependencies (if any):

npm install


Run QueueCTL from the command line:

node queuectl.js help

 ### 2. Usage Examples
# Enqueue a job

Add a new job to the queue:

node queuectl.js enqueue "echo Hello QueueCTL"

# Start workers

Start multiple workers to process queued jobs:

node queuectl.js worker start --count 3

=> Configure retries or backoff
node queuectl.js config set max-retries 3
node queuectl.js config set base-delay 2

# List jobs

View all jobs and their current states:

node queuectl.js list

=> Manage DLQ (Dead Letter Queue)
node queuectl.js  list
node queuectl.js status

=> Stop workers gracefully
node queuectl.js worker stop

### 3.  Architecture Overview

=> Core Components
Module	Purpose
queuectl.js	CLI entry point — handles commands and options
worker.js	Executes jobs, handles retries, timeouts, and logging
utils/persistence.js	Reads/writes job data to JSON file (persistent storage)
utils/backoff.js	Calculates exponential backoff delays
config.json	Stores user-defined configurations (e.g., retries, backoff base)
# Job Lifecycle

Enqueued — job is added to queue (pending state)

Processing — picked by a worker

Completed — finished successfully

Failed — exited with error, will retry

Retrying — retried after exponential backoff delay

Dead — moved to Dead Letter Queue after max_retries

# Persistence

All jobs are stored in a local JSON file (jobs.json).

Data survives restarts, so workers can resume processing after crashes.
# Worker Logic

Multiple workers process jobs concurrently (--count option).

Uses locks to prevent duplicate processing.

Supports graceful shutdown.

Implements exponential backoff for retries.

Supports job timeout (default 10s) — automatically kills long-running jobs.

Each job’s output is saved in /logs/<job-id>.log.

### 4. Assumptions & Trade-offs
Decision	Reason
JSON-based storage instead of DB	Simple persistence sufficient for CLI testing.
Node.js child_process.exec	Lightweight execution of shell commands.
Fixed timeout (10s)	Demonstrates timeout handling clearly.
No web dashboard	Focused on CLI reliability and backend behavior.
Job output stored as plain text	Easier to debug and inspect per job.


### 5. Testing Instructions
=> Minimal Test Script

Run the included automated test:

node test_queuectl.js


This script validates:

Job enqueueing and completion

Failure detection and DLQ movement

Retry with exponential backoff

Timeout handling

Persistent job state

# Manual Tests

Simple job:

node queuectl.js enqueue "echo Hello"
node queuectl.js worker start


→ Should complete successfully.

Failing job:

node queuectl.js enqueue "node -e \"process.exit(1)\""


→ Should retry and then move to DLQ.

Timeout test:

node queuectl.js enqueue "ping 127.0.0.1 -n 15"


→ Should exceed timeout and move to DLQ after retries.

Check logs:

cd logs/
type <job-id>.log


→ Contains command output and final state.

### Bonus Features Implemented

# Job Timeout Handling (10s default, configurable)
# Job Output Logging (per-job logs in /logs/)



### 🧾 Example Job Execution Log

```bash
# Enqueue sample jobs

node queuectl.js enqueue "echo Job 1 completed successfully"
node queuectl.js enqueue "ping 127.0.0.1 -n 4 >nul && echo Job 2 done"
node queuectl.js enqueue "invalidCommandTest"
node queuectl.js enqueue "node -e \"throw new Error('Job 4 crashed intentionally')\""

# Start workers

node queuectl.js worker start --count 2

# Sample output 


Starting 2 worker(s)...
Loaded jobs: [ ... ]
Active jobs found: 4
 Job 22dc8e58... completed successfully
 Job bc187670... completed successfully
 Job 1a86813f... failed (invalid command)
 Job a0d33e7a... moved to Dead Letter Queue

 ###WORKING CLI DEMO LINK 
 https://drive.google.com/file/d/1Qgs7lzTbf4U1xV0rb7YUf6-PnQA4ifzS/view?usp=sharing


 Author: Ansh Raghuwanshi
Project: QueueCTL
Language: Node.js
