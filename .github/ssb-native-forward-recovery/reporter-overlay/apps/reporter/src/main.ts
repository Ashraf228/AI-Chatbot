import { generateMonthlyReports } from './jobs/generateMonthlyReports.js';
import { generateWeeklyReports } from './jobs/generateWeeklyReports.js';
import { sendLeadDigest } from './jobs/sendLeadDigest.js';
import { reporterEntry, type ReporterProgress } from './maintenance.js';

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

export async function startReporter(progress: ReporterProgress): Promise<void> {
  await reporterEntry(main, progress);
}
