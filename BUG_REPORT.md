# Bug Report — Report Status Poller (App 11)

Summary of the 9 confirmed bugs identified during Phase 1 for which automated reproduction tests are implemented.

---

## 1. POST /api/reports — wrong-persisted-default
- **Endpoint**: `POST /api/reports`
- **Defect Category**: `wrong-persisted-default`
- **Issue**: Newly created report jobs return `progress: 5` instead of the specified initial progress of `0`.
- **Expected vs Actual**:
  - **Expected**: A newly created job should have status `QUEUED` and `progress: 0`.
  - **Actual**: The newly created job has status `QUEUED` but `progress: 5`.

---

## 2. GET /api/reports/:id/download — missing-reference-or-state-check
- **Endpoint**: `GET /api/reports/:id/download`
- **Defect Category**: `missing-reference-or-state-check`
- **Issue**: The download endpoint returns report content even when the report job is still in progress (`PROCESSING`) and not yet ready (`DONE`).
- **Expected vs Actual**:
  - **Expected**: Downloading a report before it is completed should return HTTP `409 Conflict` with `{"error": "Report not ready"}`.
  - **Actual**: When a job is in `PROCESSING`, the download endpoint returns HTTP `201 Created` with report content prematurely.

---

## 3. POST /api/reports — missing-enum-validation
- **Endpoint**: `POST /api/reports`
- **Defect Category**: `missing-enum-validation`
- **Issue**: The API accepts invalid `reportType` values and creates a report job instead of rejecting them.
- **Expected vs Actual**:
  - **Expected**: The API should validate `reportType` against the allowed enum values (`SUMMARY`, `DETAILED`) and return HTTP `400 Bad Request` for invalid types.
  - **Actual**: The API accepts `reportType: "INVALID"`, returns HTTP `201`, and creates the job.

---

## 4. GET /api/reports/:id — state-not-persisted
- **Endpoint**: `GET /api/reports/:id`
- **Defect Category**: `state-not-persisted`
- **Issue**: The report's download-ready state is incorrect after the job reaches `DONE`.
- **Expected vs Actual**:
  - **Expected**: When a report reaches `DONE`, `isDownloadReady` should be `true`.
  - **Actual**: The report status reaches `DONE`, but `isDownloadReady` remains `false` due to a casing mismatch in server logic (`job.status === 'Done'`).

---

## 5. GET /api/reports/:id — off-by-one-boundary
- **Endpoint**: `GET /api/reports/:id`
- **Defect Category**: `off-by-one-boundary`
- **Issue**: A completed report has progress greater than the allowed maximum of 100.
- **Expected vs Actual**:
  - **Expected**: A `DONE` report should have progress capped at exactly `100`.
  - **Actual**: The `DONE` report returns progress `125` because increments (+30 from initial 5) overshoot 100 without a boundary check.

---

## 6. GET /api/reports/:id/download — wrong-status-code
- **Endpoint**: `GET /api/reports/:id/download`
- **Defect Category**: `wrong-status-code`
- **Issue**: When requesting a download for a non-existing job ID, the server crashes with a 500 error instead of returning 404.
- **Expected vs Actual**:
  - **Expected**: Requesting download for a non-existent ID should return HTTP `404 Not Found`.
  - **Actual**: Attempting to read `.status` on undefined job throws an unhandled TypeError, resulting in HTTP `500 {"error": "internal error"}`.

---

## 7. UI — ui-filter-not-applied
- **Component**: UI (`public/app.js`)
- **Defect Category**: `ui-filter-not-applied`
- **Issue**: The "Request Report" button is not greyed out or disabled while a job is being created and processed.
- **Expected vs Actual**:
  - **Expected**: The "Request Report" button should be disabled (`disabled = true`, grey) while a job is active to prevent concurrent requests.
  - **Actual**: The button remains enabled and clickable (blue), allowing users to spam requests and trigger unhandled parallel polling loops.

---

## 8. UI — missing-ui-feedback-guard
- **Component**: UI (`public/app.js`)
- **Defect Category**: `missing-ui-feedback-guard`
- **Issue**: Progress of 125% is directly rendered in the UI without bounds clamping.
- **Expected vs Actual**:
  - **Expected**: The progress display should clamp values to a maximum of 100% (displaying `100%`).
  - **Actual**: The UI displays `125%` and extends the progress track beyond 100%.

---

## 9. UI — wrong-status-badge-color
- **Component**: UI (`public/style.css`)
- **Defect Category**: `wrong-status-badge-color`
- **Issue**: The status badge color does not provide distinct styling for all statuses.
- **Expected vs Actual**:
  - **Expected**: `QUEUED`, `PROCESSING`, and `DONE` should each have their own distinct status badge CSS style (colors).
  - **Actual**: `.status-processing` is completely missing from `style.css`, so the `PROCESSING` badge renders unstyled with no background or text color.
