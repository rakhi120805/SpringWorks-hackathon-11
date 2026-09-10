const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const TEST_PORT = 3025;
const BASE_URL = `http://localhost:${TEST_PORT}`;

describe('Phase 2: Bug Reproduction Test Suite (app-11)', () => {
  let sessionCookie = '';
  let serverInstance = null;

  before(async () => {
    // Set test port and load server in-process
    process.env.PORT = String(TEST_PORT);
    const mod = require('../server.js');
    serverInstance = mod.server;
    await new Promise((r) => setTimeout(r, 500));

    // Reset store before test suite
    try {
      const resetRes = await fetch(`${BASE_URL}/api/reset`, { method: 'POST' });
      const setCookie = resetRes.headers.get('set-cookie');
      if (setCookie) {
        sessionCookie = setCookie.split(';')[0];
      }
    } catch (_) {}
  });

  after(async () => {
    try {
      await fetch(`${BASE_URL}/api/reset`, { method: 'POST', headers: { Cookie: sessionCookie } });
    } catch (_) {}
    if (serverInstance && serverInstance.close) {
      serverInstance.close();
    }
    // Ensure all timers drain cleanly
    setTimeout(() => {
      process.exit(process.exitCode !== undefined ? process.exitCode : 1);
    }, 200).unref();
  });

  // Helper for requests with persistent session cookie
  async function api(endpoint, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (sessionCookie && !headers['Cookie'] && !headers['cookie']) {
      headers['Cookie'] = sessionCookie;
    }
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      sessionCookie = setCookie.split(';')[0];
    }
    return res;
  }

  // ---------------------------------------------------------------------------
  // Bug 1: POST /api/reports — wrong-persisted-default
  // ---------------------------------------------------------------------------
  test('Bug 1: newly created report jobs must have initial progress 0, not 5', async () => {
    const res = await api('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportType: 'SUMMARY' })
    });
    assert.equal(res.status, 201, `Expected HTTP 201 Created, got ${res.status}`);
    const body = await res.json();
    assert.equal(body.status, 'QUEUED');
    assert.equal(
      body.progress,
      0,
      `Expected newly created job to have progress 0, but received ${body.progress}`
    );
  });

  // ---------------------------------------------------------------------------
  // Bug 2: GET /api/reports/:id/download — missing-reference-or-state-check
  // ---------------------------------------------------------------------------
  test('Bug 2: downloading a report while in PROCESSING status should return 409 Report not ready', async () => {
    const createRes = await api('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportType: 'SUMMARY' })
    });
    const job = await createRes.json();
    const jobId = job.jobId || job.id;

    // Wait until job enters PROCESSING status (after 1200ms)
    await new Promise((r) => setTimeout(r, 1400));

    const statusRes = await api(`/api/reports/${jobId}`);
    const statusBody = await statusRes.json();
    assert.equal(statusBody.status, 'PROCESSING', 'Job should be in PROCESSING state');

    // Attempt download while report is not ready (still PROCESSING)
    const dlRes = await api(`/api/reports/${jobId}/download`);
    assert.equal(
      dlRes.status,
      409,
      `Expected HTTP 409 Report not ready while PROCESSING, but got ${dlRes.status}`
    );
  });

  // ---------------------------------------------------------------------------
  // Bug 3: POST /api/reports — missing-enum-validation
  // ---------------------------------------------------------------------------
  test('Bug 3: POST /api/reports should reject invalid reportType with 400 Bad Request', async () => {
    const res = await api('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportType: 'INVALID' })
    });
    assert.equal(
      res.status,
      400,
      `Expected HTTP 400 Bad Request for invalid reportType 'INVALID', but got ${res.status}`
    );
  });

  // ---------------------------------------------------------------------------
  // Bug 4: GET /api/reports/:id — state-not-persisted
  // ---------------------------------------------------------------------------
  test('Bug 4: completed report must have isDownloadReady: true when status reaches DONE', async () => {
    const createRes = await api('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportType: 'SUMMARY' })
    });
    const job = await createRes.json();
    const jobId = job.jobId || job.id;

    // Poll until DONE (1200ms initial + 4 * 400ms = 2800ms)
    let isDone = false;
    let finalData = null;
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 400));
      const res = await api(`/api/reports/${jobId}`);
      const data = await res.json();
      if (data.status === 'DONE') {
        isDone = true;
        finalData = data;
        break;
      }
    }

    assert.ok(isDone, 'Job did not reach DONE within expected timeframe');
    assert.equal(
      finalData.isDownloadReady,
      true,
      `Expected isDownloadReady to be true when status is DONE, but got ${finalData.isDownloadReady}`
    );
  });

  // ---------------------------------------------------------------------------
  // Bug 5: GET /api/reports/:id — off-by-one-boundary
  // ---------------------------------------------------------------------------
  test('Bug 5: completed report progress should be capped at 100, not exceed 100', async () => {
    const createRes = await api('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportType: 'SUMMARY' })
    });
    const job = await createRes.json();
    const jobId = job.jobId || job.id;

    // Poll until DONE
    let finalData = null;
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 400));
      const res = await api(`/api/reports/${jobId}`);
      const data = await res.json();
      if (data.status === 'DONE') {
        finalData = data;
        break;
      }
    }

    assert.ok(finalData, 'Job should be completed');
    assert.ok(
      finalData.progress <= 100,
      `Expected completed progress to be <= 100, but got ${finalData.progress}`
    );
  });

  // ---------------------------------------------------------------------------
  // Bug 6: GET /api/reports/:id/download — wrong-status-code
  // ---------------------------------------------------------------------------
  test('Bug 6: downloading non-existent report ID should return 404 Not Found instead of 500', async () => {
    const res = await api('/api/reports/non-existent-job-xyz/download');
    assert.equal(
      res.status,
      404,
      `Expected HTTP 404 Not Found for non-existent download, but got ${res.status}`
    );
  });

  // ---------------------------------------------------------------------------
  // Bug 7: UI — ui-filter-not-applied
  // ---------------------------------------------------------------------------
  test('Bug 7: UI request button should be disabled during report creation/processing', () => {
    const appJsPath = path.join(__dirname, '../public/app.js');
    const appJsContent = fs.readFileSync(appJsPath, 'utf8');

    const disablesButton =
      /requestBtn\.disabled\s*=\s*true/.test(appJsContent) ||
      /requestBtn\.setAttribute\(\s*['"]disabled['"]/.test(appJsContent);

    assert.ok(
      disablesButton,
      'UI should disable requestBtn when requesting a report to prevent spam and duplicate jobs'
    );
  });

  // ---------------------------------------------------------------------------
  // Bug 8: UI — missing-ui-feedback-guard
  // ---------------------------------------------------------------------------
  test('Bug 8: UI progress display should clamp progress to 100% and not render 125%', () => {
    const appJsPath = path.join(__dirname, '../public/app.js');
    const appJsContent = fs.readFileSync(appJsPath, 'utf8');

    const elements = {
      'job-id': { textContent: '' },
      'job-status': { textContent: '', className: '' },
      'progress-fill': { style: { width: '0%' } },
      'progress-text': { textContent: '0%' },
      'download-btn': { disabled: true }
    };

    const sandbox = {
      document: {
        getElementById: (id) => elements[id] || { style: {}, classList: { add() {}, remove() {} } }
      },
      jobIdEl: elements['job-id'],
      jobStatusEl: elements['job-status'],
      progressFillEl: elements['progress-fill'],
      progressTextEl: elements['progress-text'],
      downloadBtn: elements['download-btn']
    };

    const renderJobMatch = appJsContent.match(/function\s+renderJob\s*\([^\)]*\)\s*\{[\s\S]*?\n\}/);
    assert.ok(renderJobMatch, 'renderJob function should exist in app.js');

    const fn = new Function('sandbox', `
      with (sandbox) {
        ${renderJobMatch[0]}
        renderJob({ id: 'job-1', status: 'DONE', progress: 125 });
      }
    `);
    fn(sandbox);

    assert.equal(
      sandbox.progressTextEl.textContent,
      '100%',
      `Expected UI progress text to be clamped to '100%', but got '${sandbox.progressTextEl.textContent}'`
    );
  });

  // ---------------------------------------------------------------------------
  // Bug 9: UI — wrong-status-badge-color
  // ---------------------------------------------------------------------------
  test('Bug 9: style.css should define .status-processing with distinct styling', () => {
    const styleCssPath = path.join(__dirname, '../public/style.css');
    const styleCssContent = fs.readFileSync(styleCssPath, 'utf8');

    const hasProcessingRule = /\.status-processing\s*\{/.test(styleCssContent);
    assert.ok(
      hasProcessingRule,
      'Expected public/style.css to include a CSS rule for .status-processing'
    );
  });
});
