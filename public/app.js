const requestBtn = document.getElementById('request-btn');
const reportTypeSel = document.getElementById('report-type');
const jobIdEl = document.getElementById('job-id');
const jobStatusEl = document.getElementById('job-status');
const progressFillEl = document.getElementById('progress-fill');
const progressTextEl = document.getElementById('progress-text');
const downloadBtn = document.getElementById('download-btn');
const downloadOutput = document.getElementById('download-output');

function renderJob(job) {
  jobIdEl.textContent = job.id;
  jobStatusEl.textContent = job.status;
  jobStatusEl.className = 'badge status-' + job.status.toLowerCase();
  progressFillEl.style.width = job.progress + '%';
  progressTextEl.textContent = job.progress + '%';
  downloadBtn.disabled = job.status === 'QUEUED';
}

function startPolling(jobId) {
  setInterval(async () => {
    const res = await fetch(`/api/reports/${jobId}`);
    const job = await res.json();
    renderJob(job);
  }, 1000);
}

requestBtn.addEventListener('click', async () => {
  const res = await fetch('/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reportType: reportTypeSel.value })
  });
  const body = await res.json();
  downloadOutput.classList.add('hidden');
  renderJob(body);
  startPolling(body.jobId);
});

downloadBtn.addEventListener('click', async () => {
  const jobId = jobIdEl.textContent;
  const res = await fetch(`/api/reports/${jobId}/download`);
  const body = await res.json();
  downloadOutput.textContent = res.ok ? body.data : `Error: ${body.error}`;
  downloadOutput.classList.remove('hidden');
});

// --- tooling: reset button (not part of the app under test) ---
(() => {
  const pending = sessionStorage.getItem('__toolingToast');
  if (pending) {
    sessionStorage.removeItem('__toolingToast');
    const t = document.createElement('div');
    t.className = 'tooling-toast';
    t.textContent = pending;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2000);
  }
  const resetBtn = document.getElementById('reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      await fetch('/api/reset', { method: 'POST' });
      sessionStorage.setItem('__toolingToast', 'Data reset');
      location.reload();
    });
  }
})();
