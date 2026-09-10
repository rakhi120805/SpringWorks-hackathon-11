# Report Status Poller

Request an asynchronous report generation job, poll for progress and completion status, and download the generated report once ready.

## Quick Start

```bash
# Install dependencies
npm install

# Start the server locally
npm start
```

Runs on http://localhost:3011 by default.

## Architecture & Lifecycle

1. **Job Creation (`POST /api/reports`)**:
   - Accepts a JSON body with `reportType` (`SUMMARY` or `DETAILED`, defaults to `SUMMARY`).
   - Creates a new job with initial status `QUEUED` and `progress: 0`.
   - Returns HTTP 201 with job metadata (`id`, `jobId`, `status`, `progress`).

2. **Status Polling (`GET /api/reports/:id`)**:
   - Transitions from `QUEUED` to `PROCESSING` after 1.2s.
   - Progress increments until reaching 100% and status `DONE`.
   - Returns HTTP 200 with job state and `isDownloadReady: true` when `DONE`.

3. **Download (`GET /api/reports/:id/download`)**:
   - Available once job status reaches `DONE`.
   - Returns HTTP 200 with report text content and generation timestamp.

## API Endpoints

### `POST /api/reports`
Create a new report generation job.
- **Request Body**:
  ```json
  {
    "reportType": "SUMMARY"
  }
  ```
  Allowed values: `"SUMMARY"`, `"DETAILED"`.
- **Response (201 Created)**:
  ```json
  {
    "id": "job-1",
    "jobId": "job-1",
    "status": "QUEUED",
    "progress": 0
  }
  ```
- **Error (400 Bad Request)**: When `reportType` is not in allowed values.

### `GET /api/reports/:id`
Check the status and progress of a report job.
- **Path Parameter**: `id` (e.g. `job-1`)
- **Response (200 OK)**:
  ```json
  {
    "id": "job-1",
    "status": "PROCESSING",
    "progress": 60,
    "isDownloadReady": false
  }
  ```
- **Error (404 Not Found)**: When job ID does not exist.

### `GET /api/reports/:id/download`
Download the generated report content (only available when job is `DONE`).
- **Path Parameter**: `id` (e.g. `job-1`)
- **Response (200 OK)**:
  ```json
  {
    "id": "job-1",
    "content": "Report content for job-1 (SUMMARY)",
    "generatedAt": "2026-09-10T09:00:00.000Z"
  }
  ```
- **Error (404 Not Found)**: When job ID does not exist.
- **Error (409 Conflict)**: When report is not ready (still `QUEUED` or `PROCESSING`).

### `POST /api/reset`
Reset in-memory job store and active timers for testing.

---

## Phase 2: Automated Bug Reproduction Tests

Automated tests asserting expected behavior for all 9 confirmed bugs are located in `test/bugs.test.js`.
To run the tests:

```bash
npm test
```
