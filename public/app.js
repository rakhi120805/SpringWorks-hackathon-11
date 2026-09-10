const requestBtn = document.getElementById('request-btn');
const reportTypeSel = document.getElementById('report-type');
const jobIdEl = document.getElementById('job-id');
const jobStatusEl = document.getElementById('job-status');
const progressFillEl = document.getElementById('progress-fill');
const progressTextEl = document.getElementById('progress-text');
const downloadBtn = document.getElementById('download-btn');
const downloadOutput = document.getElementById('download-output');
let pollingTimer = null;

function renderJob(job) {
  jobIdEl.textContent = job.id || job.jobId || '—';
  jobStatusEl.textContent = job.status || '—';
  jobStatusEl.className = job.status ? 'badge status-' + job.status.toLowerCase() : 'badge';
  const progress = Math.max(0, Math.min(100, Number(job.progress) || 0));
  progressFillEl.style.width = progress + '%';
  progressTextEl.textContent = progress + '%';
  downloadBtn.disabled = !job.isDownloadReady;
}

function startPolling(jobId) {
  if (pollingTimer) clearInterval(pollingTimer);
  pollingTimer = setInterval(async () => {
    try {
      const res = await fetch(`/api/reports/${encodeURIComponent(jobId)}`);
      const job = await res.json();
      if (!res.ok) {
        clearInterval(pollingTimer);
        pollingTimer = null;
        requestBtn.disabled = false;
        return;
      }
      renderJob(job);
      if (job.status === 'DONE') {
        clearInterval(pollingTimer);
        pollingTimer = null;
        requestBtn.disabled = false;
      }
    } catch (err) {
      clearInterval(pollingTimer);
      pollingTimer = null;
      requestBtn.disabled = false;
      console.error('Polling failed:', err);
    }
  }, 1000);
}

requestBtn.addEventListener('click', async () => {
  requestBtn.disabled = true;
  try {
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportType: reportTypeSel.value })
    });
    const body = await res.json();
    if (!res.ok) {
      downloadOutput.textContent = `Error: ${body.error || 'Failed to create report'}`;
      downloadOutput.classList.remove('hidden');
      requestBtn.disabled = false;
      return;
    }
    downloadOutput.classList.add('hidden');
    renderJob(body);
    startPolling(body.id || body.jobId);
  } catch (err) {
    console.error('Request failed:', err);
    downloadOutput.textContent = 'Error: Failed to request report';
    downloadOutput.classList.remove('hidden');
    requestBtn.disabled = false;
  }
});

downloadBtn.addEventListener('click', async () => {
  const jobId = jobIdEl.textContent;
  if (!jobId || jobId === '—') return;
  downloadBtn.disabled = true;
  try {
    const res = await fetch(`/api/reports/${encodeURIComponent(jobId)}/download`);
    const body = await res.json();
    downloadOutput.textContent = res.ok ? body.content : `Error: ${body.error || 'Download failed'}`;
    downloadOutput.classList.remove('hidden');
  } catch (err) {
    console.error('Download failed:', err);
    downloadOutput.textContent = 'Error: Download failed';
    downloadOutput.classList.remove('hidden');
  } finally {
    downloadBtn.disabled = false;
  }
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
