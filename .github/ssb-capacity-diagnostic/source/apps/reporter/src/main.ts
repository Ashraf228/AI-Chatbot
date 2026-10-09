import { generateMonthlyReports } from './jobs/generateMonthlyReports.js';
import { generateWeeklyReports } from './jobs/generateWeeklyReports.js';
import { sendLeadDigest } from './jobs/sendLeadDigest.js';
import { reporterEntry } from './maintenance.js';

async function main() {
  const job = process.argv[2] || 'weekly';

  switch (job) {
    case 'weekly':
      await generateWeeklyReports();
      break;
    case 'monthly':
      await generateMonthlyReports();
      break;
    case 'lead-digest':
      await sendLeadDigest();
      break;
    default:
      throw new Error(`Unknown reporter job: ${job}`);
  }
}

void reporterEntry(main).catch(() => {
  // Do not print job payloads, connection strings or credentials from an exception.
  process.stderr.write('{"event":"reporter_failed","graceful":false}\n');
  process.exit(1);
});
