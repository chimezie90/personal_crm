import { db } from '../src/lib/db';

async function backfillTimestampDate() {
  console.log('Backfilling timestampDate for existing messages...');

  // Get all messages without timestampDate
  const messages = await db.message.findMany({
    where: { timestampDate: null },
    select: { id: true, timestamp: true, content: true },
  });

  console.log(`Found ${messages.length} messages to backfill`);

  // Process in batches of 1000
  const batchSize = 1000;
  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize);

    await db.$transaction(
      batch.map(msg => {
        const timestampDate = msg.timestamp.toISOString().slice(0, 10);
        const wordCount = msg.content ? msg.content.split(/\s+/).filter(Boolean).length : 0;

        return db.message.update({
          where: { id: msg.id },
          data: { timestampDate, wordCount },
        });
      })
    );

    const processed = i + batchSize < messages.length ? i + batchSize : messages.length;
    console.log(`Processed ${processed}/${messages.length}`);
  }

  console.log('Backfill complete!');
}

backfillTimestampDate()
  .catch(console.error)
  .finally(() => db.$disconnect());
