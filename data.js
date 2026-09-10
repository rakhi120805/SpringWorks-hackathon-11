// In-memory job store. makeSeed() returns a fresh clone for each student's store,
// including the counters and pending-timer bookkeeping that used to be module globals.
function makeSeed() {
  return {
    jobs: {},
    jobCounter: 0,
    lastCreatedId: null,
    pendingTimers: [] // ponytail: track timeout/interval handles so /api/reset can clear them
  };
}

module.exports = { makeSeed };
