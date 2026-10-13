import Database from "better-sqlite3";
import { performance } from "perf_hooks";
import fs from "fs";
import path from "path";
import os from "os";

// ---------------------------------------------------------
// Helper Types & Stats
// ---------------------------------------------------------
interface LatencyStats {
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  opsPerSec: number;
  count: number;
}

function computeStats(latenciesMs: number[], totalDurationMs: number): LatencyStats {
  const count = latenciesMs.length;
  if (count === 0) {
    return { mean: 0, p50: 0, p95: 0, p99: 0, min: 0, max: 0, opsPerSec: 0, count: 0 };
  }
  const sorted = [...latenciesMs].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = sum / count;
  const p50 = sorted[Math.floor(count * 0.50)];
  const p95 = sorted[Math.floor(count * 0.95)];
  const p99 = sorted[Math.floor(count * 0.99)];
  const min = sorted[0];
  const max = sorted[count - 1];
  const opsPerSec = totalDurationMs > 0 ? count / (totalDurationMs / 1000) : 0;

  return { mean, p50, p95, p99, min, max, opsPerSec, count };
}

function formatMs(val: number): string {
  if (val < 0.001) return "<0.001 ms";
  if (val < 1) return `${val.toFixed(3)} ms`;
  return `${val.toFixed(2)} ms`;
}

function initSchema(db: Database.Database, isStressDb: boolean = false) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      item_id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_name TEXT NOT NULL,
      item_price INTEGER NOT NULL,
      item_amount INTEGER NOT NULL,
      item_barcode TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS active_barcode (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      barcode TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS barcode_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_barcode_queue_status ON barcode_queue(status, id ASC);

    CREATE TABLE IF NOT EXISTS active_cart (
      item_id INTEGER PRIMARY KEY,
      quantity INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE CASCADE
    );
  `);
}

function seedItems(db: Database.Database, count: number = 20) {
  const insert = db.prepare(
    "INSERT OR IGNORE INTO items (item_id, item_name, item_price, item_amount, item_barcode) VALUES (?, ?, ?, ?, ?)"
  );
  for (let i = 1; i <= count; i++) {
    insert.run(i, `Item ${i}`, 10 + i * 5, 100, `88500000${String(i).padStart(2, "0")}`);
  }
}

// ---------------------------------------------------------
// 1. Performance Test (Baseline Latency & Throughput)
// ---------------------------------------------------------
async function runPerformanceTest() {
  console.log("================================================================================");
  console.log("  [Performance Test] Baseline Latency and Operations / Sec");
  console.log("================================================================================");

  const db = new Database(":memory:");
  initSchema(db);
  seedItems(db);

  const getStmt = db.prepare("SELECT barcode FROM barcode_queue WHERE status = 'pending' ORDER BY id ASC LIMIT 1");
  const enqueueStmt = db.prepare(`
    INSERT INTO barcode_queue (barcode, status, created_at)
    VALUES (?, 'pending', CURRENT_TIMESTAMP)
  `);
  const popStmt = db.prepare(`
    UPDATE barcode_queue SET status = 'consumed'
    WHERE id = (SELECT id FROM barcode_queue WHERE status = 'pending' ORDER BY id ASC LIMIT 1)
  `);
  const cartUpsertStmt = db.prepare(
    "INSERT INTO active_cart (item_id, quantity) VALUES (?, 1) ON CONFLICT(item_id) DO UPDATE SET quantity = quantity + 1"
  );

  // 1. Test enqueueBarcode
  const setIterations = 5000;
  const setLatencies: number[] = [];
  const setStart = performance.now();
  for (let i = 0; i < setIterations; i++) {
    const t0 = performance.now();
    enqueueStmt.run(`BC-${i % 100}`);
    setLatencies.push(performance.now() - t0);
  }
  const setTotal = performance.now() - setStart;
  const setStats = computeStats(setLatencies, setTotal);

  // 2. Test peek barcode
  const getIterations = 10000;
  const getLatencies: number[] = [];
  const getStart = performance.now();
  for (let i = 0; i < getIterations; i++) {
    const t0 = performance.now();
    getStmt.get();
    getLatencies.push(performance.now() - t0);
  }
  const getTotal = performance.now() - getStart;
  const getStats = computeStats(getLatencies, getTotal);

  // 3. Test popBarcode
  const popIterations = 5000;
  const popLatencies: number[] = [];
  const popStart = performance.now();
  for (let i = 0; i < popIterations; i++) {
    const t0 = performance.now();
    popStmt.run();
    popLatencies.push(performance.now() - t0);
  }
  const popTotal = performance.now() - popStart;
  const popStats = computeStats(popLatencies, popTotal);

  // 4. Test cart upsert
  const cartIterations = 5000;
  const cartLatencies: number[] = [];
  const cartStart = performance.now();
  for (let i = 0; i < cartIterations; i++) {
    const itemId = (i % 20) + 1;
    const t0 = performance.now();
    cartUpsertStmt.run(itemId);
    cartLatencies.push(performance.now() - t0);
  }
  const cartTotal = performance.now() - cartStart;
  const cartStats = computeStats(cartLatencies, cartTotal);

  console.log(
    `| ${"Operation".padEnd(20)} | ${"Ops/sec".padStart(11)} | ${"Mean".padStart(10)} | ${"p50".padStart(9)} | ${"p95".padStart(9)} | ${"p99".padStart(9)} |`
  );
  console.log(`|${"-".repeat(22)}|${"-".repeat(13)}|${"-".repeat(12)}|${"-".repeat(11)}|${"-".repeat(11)}|${"-".repeat(11)}|`);

  const printRow = (name: string, s: LatencyStats) => {
    console.log(
      `| ${name.padEnd(20)} | ${Math.round(s.opsPerSec).toLocaleString().padStart(11)} | ${formatMs(s.mean).padStart(10)} | ${formatMs(s.p50).padStart(9)} | ${formatMs(s.p95).padStart(9)} | ${formatMs(s.p99).padStart(9)} |`
    );
  };

  printRow("enqueueBarcode", setStats);
  printRow("peekBarcode", getStats);
  printRow("popBarcode", popStats);
  printRow("Cart Upsert", cartStats);
  console.log("");
}

// ---------------------------------------------------------
// 2. Load Test (20 Producers + UI Consumers over 800 requests)
// ---------------------------------------------------------
async function runLoadTest() {
  console.log("================================================================================");
  console.log("  [Load Test] 20 Concurrent Producers + UI Consumers (800 Requests)");
  console.log("================================================================================");

  const db = new Database(":memory:");
  initSchema(db);
  seedItems(db);

  const numProducers = 20;
  const requestsPerProducer = 40; // 20 * 40 = 800 total scan requests
  const totalScanRequests = numProducers * requestsPerProducer;
  const numConsumers = 5;

  const itemStmt = db.prepare("SELECT item_id, item_barcode FROM items WHERE item_barcode = ?");
  const cartStmt = db.prepare(
    "INSERT INTO active_cart (item_id, quantity) VALUES (?, 1) ON CONFLICT(item_id) DO UPDATE SET quantity = quantity + 1"
  );
  const enqueueStmt = db.prepare(`
    INSERT INTO barcode_queue (barcode, status, created_at)
    VALUES (?, 'pending', CURRENT_TIMESTAMP)
  `);
  const setBarcodeStmt = db.prepare(`
    INSERT INTO active_barcode (id, barcode, updated_at)
    VALUES (1, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET barcode = excluded.barcode, updated_at = CURRENT_TIMESTAMP
  `);
  const popStmt = db.prepare(`
    UPDATE barcode_queue SET status = 'consumed'
    WHERE id = (SELECT id FROM barcode_queue WHERE status = 'pending' ORDER BY id ASC LIMIT 1)
    RETURNING barcode
  `);

  let completedScans = 0;
  let producerErrors = 0;
  let consumerErrors = 0;
  const producerLatencies: number[] = [];
  const consumerLatencies: number[] = [];
  let isRunning = true;

  const startTime = performance.now();

  // Producer worker
  async function runProducer(producerId: number) {
    for (let req = 0; req < requestsPerProducer; req++) {
      const itemIdx = ((producerId * 7 + req) % 20) + 1;
      const barcode = `88500000${String(itemIdx).padStart(2, "0")}`;

      const t0 = performance.now();
      try {
        const item = itemStmt.get(barcode) as { item_id: number } | undefined;
        if (!item) throw new Error("Item not found");

        const tx = db.transaction(() => {
          cartStmt.run(item.item_id);
          enqueueStmt.run(barcode);
          setBarcodeStmt.run(barcode);
        });
        tx();
        completedScans++;
      } catch (err) {
        producerErrors++;
      } finally {
        producerLatencies.push(performance.now() - t0);
      }

      await new Promise((r) => setImmediate(r));
    }
  }

  // UI Consumer worker
  async function runConsumer() {
    while (isRunning) {
      const t0 = performance.now();
      try {
        popStmt.get();
      } catch (err) {
        consumerErrors++;
      } finally {
        consumerLatencies.push(performance.now() - t0);
      }
      await new Promise((r) => setImmediate(r));
    }
  }

  const consumerPromises = Array.from({ length: numConsumers }, () => runConsumer());
  const producerPromises = Array.from({ length: numProducers }, (_, i) => runProducer(i));

  await Promise.all(producerPromises);
  isRunning = false;
  await Promise.all(consumerPromises);

  const totalDuration = performance.now() - startTime;
  const producerStats = computeStats(producerLatencies, totalDuration);
  const consumerStats = computeStats(consumerLatencies, totalDuration);
  const totalOps = producerLatencies.length + consumerLatencies.length;
  const overallThroughput = totalOps / (totalDuration / 1000);

  console.log(`- Total Producer Scans Attempted : ${totalScanRequests}`);
  console.log(`- Producer Scans Succeeded       : ${completedScans}`);
  console.log(`- Total Consumer Polls Executed  : ${consumerLatencies.length}`);
  console.log(`- Test Duration                  : ${formatMs(totalDuration)}`);
  console.log(`- Combined Throughput            : ${Math.round(overallThroughput).toLocaleString()} req/sec`);
  console.log(`- Producer Latency (p50 / p95)   : ${formatMs(producerStats.p50)} / ${formatMs(producerStats.p95)}`);
  console.log(`- Consumer Latency (p50 / p95)   : ${formatMs(consumerStats.p50)} / ${formatMs(consumerStats.p95)}`);
  console.log(`- Total Errors (Producer/Consumer): ${producerErrors} / ${consumerErrors}`);
  console.log("");
}

// ---------------------------------------------------------
// 3. Stress Test (High Concurrency Burst: 50-100 Workers)
// ---------------------------------------------------------
async function runStressTest() {
  console.log("================================================================================");
  console.log("  [Stress Test] High Concurrency Burst (75 Concurrent Workers)");
  console.log("  Measuring: Scan Loss Rate, Duplicate Read Rate, SQLite Lock Contention");
  console.log("================================================================================");

  const tmpDbDir = fs.mkdtempSync(path.join(os.tmpdir(), "storemate-stress-"));
  const tmpDbPath = path.join(tmpDbDir, "stress.db");

  const initDb = new Database(tmpDbPath);
  initSchema(initDb, true);
  seedItems(initDb, 50);
  initDb.close();

  const numProducers = 50;
  const scansPerProducer = 20; // 50 * 20 = 1,000 scans
  const totalScans = numProducers * scansPerProducer;
  const numConsumers = 25; // 50 producers + 25 consumers = 75 concurrent workers

  let acceptedScansCount = 0;
  let sqliteBusyErrors = 0;
  let otherErrors = 0;

  const acceptedScans = new Set<string>();
  const polledBarcodeCounts = new Map<string, number>();
  let totalNonEmptyPolls = 0;
  let duplicatePollsCount = 0;

  let isBurstActive = true;
  const burstStartTime = performance.now();

  async function producerWorker(workerId: number) {
    let workerDb: Database.Database | null = null;
    try {
      workerDb = new Database(tmpDbPath, { timeout: 5000 });
      const itemStmt = workerDb.prepare("SELECT item_id FROM items WHERE item_id = ?");
      const cartStmt = workerDb.prepare(
        "INSERT INTO active_cart (item_id, quantity) VALUES (?, 1) ON CONFLICT(item_id) DO UPDATE SET quantity = quantity + 1"
      );
      const enqueueStmt = workerDb.prepare(`
        INSERT INTO barcode_queue (barcode, status, created_at)
        VALUES (?, 'pending', CURRENT_TIMESTAMP)
      `);
      const setBarcodeStmt = workerDb.prepare(`
        INSERT INTO active_barcode (id, barcode, updated_at)
        VALUES (1, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET barcode = excluded.barcode, updated_at = CURRENT_TIMESTAMP
      `);

      for (let s = 0; s < scansPerProducer; s++) {
        const uniqueScanId = `SCAN-W${workerId}-S${s}-${Date.now()}`;
        const itemId = ((workerId + s) % 50) + 1;

        try {
          workerDb.exec("BEGIN IMMEDIATE");
          itemStmt.get(itemId);
          cartStmt.run(itemId);
          enqueueStmt.run(uniqueScanId);
          setBarcodeStmt.run(uniqueScanId);
          workerDb.exec("COMMIT");

          acceptedScans.add(uniqueScanId);
          acceptedScansCount++;
        } catch (err: any) {
          try {
            workerDb.exec("ROLLBACK");
          } catch {}
          if (err?.code === "SQLITE_BUSY" || err?.message?.includes("locked") || err?.message?.includes("busy")) {
            sqliteBusyErrors++;
          } else {
            otherErrors++;
          }
        }

        await new Promise((r) => setImmediate(r));
      }
    } finally {
      if (workerDb) {
        try {
          workerDb.close();
        } catch {}
      }
    }
  }

  async function consumerWorker() {
    let workerDb: Database.Database | null = null;
    try {
      workerDb = new Database(tmpDbPath, { timeout: 5000 });
      const popStmt = workerDb.prepare(`
        UPDATE barcode_queue SET status = 'consumed'
        WHERE id = (
          SELECT id FROM barcode_queue WHERE status = 'pending' ORDER BY id ASC LIMIT 1
        )
        RETURNING barcode
      `);

      while (isBurstActive) {
        try {
          const row = popStmt.get() as { barcode: string } | undefined;
          const barcode = row?.barcode;

          if (barcode && barcode.length > 0) {
            totalNonEmptyPolls++;
            const priorCount = polledBarcodeCounts.get(barcode) || 0;
            if (priorCount > 0) {
              duplicatePollsCount++;
            }
            polledBarcodeCounts.set(barcode, priorCount + 1);
          } else {
            await new Promise((r) => setTimeout(r, 5));
          }
        } catch (err: any) {
          if (err?.code === "SQLITE_BUSY" || err?.message?.includes("locked") || err?.message?.includes("busy")) {
            sqliteBusyErrors++;
          } else {
            otherErrors++;
          }
        }

        await new Promise((r) => setImmediate(r));
      }
    } finally {
      if (workerDb) {
        try {
          workerDb.close();
        } catch {}
      }
    }
  }

  try {
    const consumerPromises = Array.from({ length: numConsumers }, () => consumerWorker());
    const producerPromises = Array.from({ length: numProducers }, (_, i) => producerWorker(i));

    await Promise.all(producerPromises);

    // Drain remaining pending items in the queue
    const drainDb = new Database(tmpDbPath, { timeout: 5000 });
    const countPendingStmt = drainDb.prepare("SELECT COUNT(*) as count FROM barcode_queue WHERE status = 'pending'");
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const row = countPendingStmt.get() as { count: number };
      if (!row || row.count === 0) break;
      await new Promise((r) => setTimeout(r, 20));
    }
    drainDb.close();

    isBurstActive = false;
    await Promise.all(consumerPromises);

    const burstDuration = performance.now() - burstStartTime;

    const totalAccepted = acceptedScans.size;
    let receivedUniqueScans = 0;
    for (const scanId of acceptedScans) {
      if (polledBarcodeCounts.has(scanId)) {
        receivedUniqueScans++;
      }
    }

    const lostScans = totalAccepted - receivedUniqueScans;
    const scanLossRate = totalAccepted > 0 ? (lostScans / totalAccepted) * 100 : 0;
    const duplicateReadRate =
      totalNonEmptyPolls > 0 ? (duplicatePollsCount / totalNonEmptyPolls) * 100 : 0;

    console.log(`- Concurrency Level             : ${numProducers + numConsumers} concurrent workers (50 producers, 25 consumers)`);
    console.log(`- Total Scans Attempted         : ${totalScans}`);
    console.log(`- Backend Accepted Scans (200)  : ${totalAccepted}`);
    console.log(`- Unique Scans Received by UI   : ${receivedUniqueScans}`);
    console.log(`- Overwritten / Lost Scans      : ${lostScans}`);
    console.log(`- >>> Scan Loss Rate <<<        : ${scanLossRate.toFixed(2)}%`);
    console.log(`- Total Non-Empty UI Polls      : ${totalNonEmptyPolls}`);
    console.log(`- Duplicate Reads Detected      : ${duplicatePollsCount}`);
    console.log(`- >>> Duplicate Read Rate <<<   : ${duplicateReadRate.toFixed(2)}%`);
    console.log(`- >>> SQLite Lock / Busy Errors : ${sqliteBusyErrors}`);
    console.log(`- Other System Errors           : ${otherErrors}`);
    console.log(`- Burst Duration                : ${formatMs(burstDuration)}`);
    console.log("--------------------------------------------------------------------------------");
    console.log("DIAGNOSIS SUMMARY:");
    if (scanLossRate === 0 && duplicateReadRate === 0) {
      console.log(`[✓] SUCCESS: 0% Scan Loss & 0% Duplicate Reads!`);
      console.log(`    FIFO Queue and atomic pop successfully eliminate scan loss and duplicate reads under high concurrency.`);
    } else {
      if (scanLossRate > 0) {
        console.log(`[!] CRITICAL: Confirmed Scan Loss Flaw (${scanLossRate.toFixed(1)}%).`);
      }
      if (duplicateReadRate > 0) {
        console.log(`[!] CRITICAL: Confirmed Duplicate Read Flaw (${duplicateReadRate.toFixed(1)}%).`);
      }
    }
    if (sqliteBusyErrors > 0) {
      console.log(`[!] WARNING: SQLite Lock Contention (${sqliteBusyErrors} SQLITE_BUSY events).`);
    } else {
      console.log(`[✓] SQLite WAL mode and busy timeout eliminated all lock contention.`);
    }
    console.log("================================================================================");

    if (scanLossRate > 0) {
      throw new Error(`Scan loss rate expected 0%, but was ${scanLossRate.toFixed(2)}%`);
    }
    if (duplicateReadRate > 0) {
      throw new Error(`Duplicate read rate expected 0%, but was ${duplicateReadRate.toFixed(2)}%`);
    }
  } finally {
    try {
      fs.rmSync(tmpDbDir, { recursive: true, force: true });
    } catch {}
  }
}

// ---------------------------------------------------------
// Main Execution
// ---------------------------------------------------------
async function main() {
  console.log("\n================================================================================");
  console.log("  STORE MATE POS - BARCODE SUBSYSTEM BENCHMARK & LOAD/STRESS TEST");
  console.log("================================================================================\n");

  await runPerformanceTest();
  await runLoadTest();
  await runStressTest();
}

main().catch((err) => {
  console.error("Benchmark failed with uncaught error:", err);
  process.exit(1);
});
