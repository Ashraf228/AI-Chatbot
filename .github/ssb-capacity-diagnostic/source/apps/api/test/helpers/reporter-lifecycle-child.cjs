const path = require('node:path');
const { sourceLoader } = require('./reporter-source.cjs');
const mode = process.argv[2];
let requests = 0, sends = 0, completedBodies = 0, closedReported = false;
// Even an unintended bypass cannot reach a real provider, API or SMTP socket.
require('node:net').Socket.prototype.connect = () => { throw Error('real sockets forbidden'); };
const load = sourceLoader(path.resolve(__dirname, '../../../..'), {
  nodemailer: { createTransport: () => ({ sendMail: async () => {
    sends++;
    process.send({ smtp: true });
    if (mode === 'smtp-failure') throw Error('synthetic-private-smtp');
    if (mode === 'drain-smtp') await new Promise(resolve => setTimeout(resolve, 300));
    return { messageId: 'synthetic' };
  } }) },
});
const { MaintenanceState, MaintenanceDenied } = load('apps/api/src/maintenance/maintenance-state.ts');
const begin = MaintenanceState.prototype.begin;
MaintenanceState.prototype.begin = function (...args) {
  try { return begin.apply(this, args); }
  catch (error) {
    if (!closedReported && error.code === 'admission_closed') {
      closedReported = true; process.send({ waiting: true, requests, sends });
    }
    throw error;
  }
};
if (mode === 'stop-error') MaintenanceState.prototype.stopAdmission = () => { throw Error('synthetic-private-stop'); };
globalThis.fetch = async url => {
  requests++; process.send({ transport: true });
  if (mode === 'admission-shaped-action-error') throw new MaintenanceDenied('admission_closed');
  if (mode === 'hang') { setInterval(() => {}, 1000); return new Promise(() => {}); }
  if (mode === 'drain') await new Promise(resolve => setTimeout(resolve, 300));
  completedBodies++;
  return Response.json(url.includes('/report-subscriptions?') ? [
    { siteId: 'synthetic-site', recipientEmail: 'synthetic@example.test', frequency: 'weekly', isEnabled: true },
    { siteId: 'synthetic-site', recipientEmail: 'synthetic@example.test', frequency: 'weekly', isEnabled: true },
  ] : {});
};
process.on('exit', code => process.stdout.write(JSON.stringify({ code, requests, sends, completedBodies }) + '\n'));
process.argv[2] = 'weekly';
load('apps/reporter/src/main.ts');
