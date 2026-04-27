import { DatabaseMigrationsService } from './database-migrations.service';
import { PrismaService } from './prisma.service';

async function run() {
  const db = new PrismaService();
  const migrations = new DatabaseMigrationsService(db);
  await migrations.onModuleInit();
}

run().catch((error) => {
  console.error('Migration run failed');
  console.error(error);
  process.exit(1);
});
