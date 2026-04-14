import { generateMonthlyReports } from './jobs/generateMonthlyReports';
import { generateWeeklyReports } from './jobs/generateWeeklyReports';
import { sendLeadDigest } from './jobs/sendLeadDigest';

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

void main();
