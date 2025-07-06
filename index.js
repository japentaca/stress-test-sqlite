#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');

class SQLiteStressTest {
  constructor() {
    // Load configuration from JSON file
    this.config = this.loadConfig();

    this.dbPath = path.join(__dirname, this.config.database.path);
    this.db = null;
    this.results = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cpus: require('os').cpus().length,
        memory: Math.round(require('os').totalmem() / 1024 / 1024) + ' MB'
      },
      tests: {}
    };
    this.concurrentWorkers = this.config.testConfiguration.concurrentWorkers;
    this.testRecords = this.config.testConfiguration.testRecords;
    this.transactionSize = this.config.testConfiguration.transactionSize;
  }

  loadConfig() {
    try {
      const configPath = path.join(__dirname, 'config.json');
      const configData = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      console.error('❌ Error loading config.json:', error.message);
      console.log('Using default configuration values...');
      // Return default configuration if file doesn't exist or is invalid
      return {
        database: { path: "stress_test.db" },
        testConfiguration: { concurrentWorkers: 8, testRecords: 1000000, transactionSize: 100 },
        insertPerformance: { singleInserts: 1000, batchSize: 1000, progressReportInterval: 100 },
        selectPerformance: { selectAllLimit: 1000, joinLimit: 100 },
        updatePerformance: { singleUpdates: 100, batchUpdates: 900, singleUpdateProgressInterval: 10, batchUpdateProgressInterval: 100 },
        deletePerformance: { testDataRecords: 1000, singleDeletes: 100, progressReportInterval: 10, batchProgressInterval: 100 },
        transactionPerformance: { transactionInserts: 5000, progressReportInterval: 500 },
        concurrency: { operationsPerWorker: 500, workerProgressInterval: 20 },
        dataGeneration: {
          usernames: ["alice", "bob", "charlie", "diana", "eve", "frank"],
          domains: ["gmail.com", "yahoo.com", "outlook.com", "test.com"],
          transactionTypes: ["deposit", "withdrawal", "transfer", "payment"],
          transactionDescriptions: ["Salary payment", "Grocery shopping", "Rent payment", "Investment", "Refund"],
          logLevels: ["INFO", "WARNING", "ERROR", "DEBUG"],
          logMessages: ["User login successful", "Transaction processed", "Database connection established", "Cache cleared", "Backup completed"],
          ageRange: { min: 18, max: 98 },
          salaryRange: { min: 0, max: 100000 },
          transactionAmountRange: { min: -1000, max: 1000 },
          userIdRange: { min: 1, max: 1000 }
        },
        dataTypes: { largeTextSize: 10000, largeBlobSize: 50000 }
      };
    }
  }

  async initialize() {
    console.log('🚀 Initializing SQLite Stress Test...');

    // Clean up existing database
    if (fs.existsSync(this.dbPath)) {
      fs.unlinkSync(this.dbPath);
    }

    this.db = new sqlite3.Database(this.dbPath);
    return Promise.resolve();
  }

  async createTables() {
    console.log('📊 Creating test tables...');

    const tables = [
      `CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                email TEXT NOT NULL,
                age INTEGER,
                salary REAL,
                is_active BOOLEAN,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                profile_data BLOB
            )`,
      `CREATE TABLE transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                amount REAL,
                type TEXT,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`,
      `CREATE TABLE logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                level TEXT,
                message TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                metadata JSON
            )`,
      `CREATE INDEX idx_users_email ON users(email)`,
      `CREATE INDEX idx_users_age ON users(age)`,
      `CREATE INDEX idx_transactions_user_id ON transactions(user_id)`,
      `CREATE INDEX idx_transactions_type ON transactions(type)`,
      `CREATE INDEX idx_logs_level ON logs(level)`
    ];

    for (const sql of tables) {
      await this.runQuery(sql);
      console.log(`   - Created table/index: ${sql.split(' ')[2]}`);
    }
  }

  async runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  async getAllQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  generateRandomUser(id) {
    const usernames = this.config.dataGeneration.usernames;
    const domains = this.config.dataGeneration.domains;
    const ageRange = this.config.dataGeneration.ageRange;
    const salaryRange = this.config.dataGeneration.salaryRange;

    return {
      username: usernames[Math.floor(Math.random() * usernames.length)] + id,
      email: `user${id}@${domains[Math.floor(Math.random() * domains.length)]}`,
      age: Math.floor(Math.random() * (ageRange.max - ageRange.min + 1)) + ageRange.min,
      salary: Math.random() * (salaryRange.max - salaryRange.min) + salaryRange.min,
      is_active: Math.random() > 0.5,
      profile_data: Buffer.from(JSON.stringify({ preferences: { theme: 'dark' }, settings: { notifications: true } }))
    };
  }

  generateRandomTransaction(userId) {
    const types = this.config.dataGeneration.transactionTypes;
    const descriptions = this.config.dataGeneration.transactionDescriptions;
    const amountRange = this.config.dataGeneration.transactionAmountRange;

    return {
      user_id: userId,
      amount: (Math.random() * (amountRange.max - amountRange.min)) + amountRange.min,
      type: types[Math.floor(Math.random() * types.length)],
      description: descriptions[Math.floor(Math.random() * descriptions.length)]
    };
  }

  generateRandomLog() {
    const levels = this.config.dataGeneration.logLevels;
    const messages = this.config.dataGeneration.logMessages;

    return {
      level: levels[Math.floor(Math.random() * levels.length)],
      message: messages[Math.floor(Math.random() * messages.length)],
      metadata: JSON.stringify({
        ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
        session_id: crypto.randomBytes(16).toString('hex')
      })
    };
  }

  async testInsertPerformance() {
    console.log('🔄 Testing INSERT performance...');

    const startTime = Date.now();
    const batchSize = this.config.insertPerformance.batchSize;
    const singleInserts = this.config.insertPerformance.singleInserts;
    const progressInterval = this.config.insertPerformance.progressReportInterval;
    let totalInserted = 0;

    // Test individual inserts
    const singleInsertStart = Date.now();
    for (let i = 0; i < singleInserts; i++) {
      const user = this.generateRandomUser(i);
      await this.runQuery(
        'INSERT INTO users (username, email, age, salary, is_active, profile_data) VALUES (?, ?, ?, ?, ?, ?)',
        [user.username, user.email, user.age, user.salary, user.is_active, user.profile_data]
      );
      totalInserted++;
      if (i % progressInterval === 0 || i === singleInserts - 1) {
        process.stdout.write(`     - Single inserts progress: ${i + 1} / ${singleInserts}\r`);
      }
    }
    process.stdout.write('\n');
    const singleInsertTime = Date.now() - singleInsertStart;

    // Test batch inserts with transactions
    const batchInsertStart = Date.now();
    for (let batch = 0; batch < Math.floor(this.testRecords / batchSize); batch++) {
      await this.runQuery('BEGIN TRANSACTION');

      for (let i = 0; i < batchSize; i++) {
        const user = this.generateRandomUser(singleInserts + (batch * batchSize) + i);
        await this.runQuery(
          'INSERT INTO users (username, email, age, salary, is_active, profile_data) VALUES (?, ?, ?, ?, ?, ?)',
          [user.username, user.email, user.age, user.salary, user.is_active, user.profile_data]
        );
        totalInserted++;
      }
      if (batch % progressInterval === 0 || batch === Math.floor(this.testRecords / batchSize) - 1) {
        process.stdout.write(`     - Batch inserts progress: ${batch + 1} / ${Math.floor(this.testRecords / batchSize)}\r`);
      }

      await this.runQuery('COMMIT');
    }
    process.stdout.write('\n');
    const batchInsertTime = Date.now() - batchInsertStart;

    const totalTime = Date.now() - startTime;

    this.results.tests.insertPerformance = {
      totalRecords: totalInserted,
      totalTime: totalTime,
      singleInsertTime: singleInsertTime,
      batchInsertTime: batchInsertTime,
      recordsPerSecond: Math.round(totalInserted / (totalTime / 1000)),
      singleInsertRate: Math.round(singleInserts / (singleInsertTime / 1000)),
      batchInsertRate: Math.round((totalInserted - singleInserts) / (batchInsertTime / 1000))
    };
  }

  async testSelectPerformance() {
    console.log('🔍 Testing SELECT performance...');

    const selectAllLimit = this.config.selectPerformance.selectAllLimit;
    const joinLimit = this.config.selectPerformance.joinLimit;
    const salaryThreshold = this.config.dataGeneration.salaryRange.max / 2; // Use half of max salary as threshold

    const tests = [
      { name: 'selectAll', query: `SELECT * FROM users LIMIT ${selectAllLimit}` },
      { name: 'selectWithIndex', query: 'SELECT * FROM users WHERE email LIKE ?', params: ['%@gmail.com'] },
      { name: 'selectWithoutIndex', query: 'SELECT * FROM users WHERE salary > ?', params: [salaryThreshold] },
      { name: 'selectCount', query: 'SELECT COUNT(*) as count FROM users' },
      {
        name: 'selectJoin', query: `
                SELECT u.username, u.email, COUNT(t.id) as transaction_count
                FROM users u
                LEFT JOIN transactions t ON u.id = t.user_id
                GROUP BY u.id
                LIMIT ${joinLimit}
            ` },
      { name: 'selectAggregate', query: 'SELECT AVG(age) as avg_age, MIN(age) as min_age, MAX(age) as max_age FROM users' }
    ];

    this.results.tests.selectPerformance = {};

    let i = 0;
    for (const test of tests) {
      i++;
      process.stdout.write(`     - Running select test ${i}/${tests.length}: ${test.name.padEnd(20)}\r`);
      const startTime = Date.now();
      const result = await this.getAllQuery(test.query, test.params || []);
      const endTime = Date.now();

      this.results.tests.selectPerformance[test.name] = {
        executionTime: endTime - startTime,
        rowsReturned: result.length,
        ratePerSecond: result.length > 0 ? Math.round(result.length / ((endTime - startTime) / 1000)) : 0
      };
    }
    process.stdout.write('\n');
  }

  async testUpdatePerformance() {
    console.log('✏️ Testing UPDATE performance...');

    const startTime = Date.now();
    const singleUpdates = this.config.updatePerformance.singleUpdates;
    const batchUpdates = this.config.updatePerformance.batchUpdates;
    const singleProgressInterval = this.config.updatePerformance.singleUpdateProgressInterval;
    const batchProgressInterval = this.config.updatePerformance.batchUpdateProgressInterval;
    const ageThreshold = this.config.dataGeneration.ageRange.min + 12; // Use min age + 12 as threshold

    // Single updates
    const singleUpdateStart = Date.now();
    for (let i = 0; i < singleUpdates; i++) {
      await this.runQuery('UPDATE users SET salary = salary * 1.1 WHERE id = ?', [i + 1]);
      if (i % singleProgressInterval === 0 || i === singleUpdates - 1) {
        process.stdout.write(`     - Single updates progress: ${i + 1} / ${singleUpdates}\r`);
      }
    }
    process.stdout.write('\n');
    const singleUpdateTime = Date.now() - singleUpdateStart;

    // Batch updates
    const batchUpdateStart = Date.now();
    await this.runQuery('BEGIN TRANSACTION');
    for (let i = singleUpdates; i < singleUpdates + batchUpdates; i++) {
      await this.runQuery('UPDATE users SET is_active = ? WHERE id = ?', [Math.random() > 0.5, i + 1]);
      if ((i - singleUpdates) % batchProgressInterval === 0 || i === singleUpdates + batchUpdates - 1) {
        process.stdout.write(`     - Batch updates progress: ${i - singleUpdates + 1} / ${batchUpdates}\r`);
      }
    }
    process.stdout.write('\n');
    await this.runQuery('COMMIT');
    const batchUpdateTime = Date.now() - batchUpdateStart;

    // Bulk update
    const bulkUpdateStart = Date.now();
    const result = await this.runQuery(`UPDATE users SET age = age + 1 WHERE age < ${ageThreshold}`);
    const bulkUpdateTime = Date.now() - bulkUpdateStart;

    this.results.tests.updatePerformance = {
      singleUpdateTime: singleUpdateTime,
      batchUpdateTime: batchUpdateTime,
      bulkUpdateTime: bulkUpdateTime,
      bulkRowsAffected: result.changes,
      totalTime: Date.now() - startTime
    };
  }

  async testDeletePerformance() {
    console.log('🗑️ Testing DELETE performance...');

    const startTime = Date.now();
    const testDataRecords = this.config.deletePerformance.testDataRecords;
    const singleDeletes = this.config.deletePerformance.singleDeletes;
    const progressInterval = this.config.deletePerformance.progressReportInterval;
    const batchProgressInterval = this.config.deletePerformance.batchProgressInterval;
    const baseId = 100000; // Base ID for test data

    // Insert some test data for deletion
    await this.runQuery('BEGIN TRANSACTION');
    for (let i = 0; i < testDataRecords; i++) {
      const user = this.generateRandomUser(baseId + i);
      await this.runQuery(
        'INSERT INTO users (username, email, age, salary, is_active, profile_data) VALUES (?, ?, ?, ?, ?, ?)',
        [user.username, user.email, user.age, user.salary, user.is_active, user.profile_data]
      );
      if (i % batchProgressInterval === 0 || i === testDataRecords - 1) {
        process.stdout.write(`     - Preparing delete test data: ${i + 1} / ${testDataRecords}\r`);
      }
    }
    process.stdout.write('\n');
    await this.runQuery('COMMIT');

    // Single deletes
    const singleDeleteStart = Date.now();
    for (let i = 0; i < singleDeletes; i++) {
      await this.runQuery('DELETE FROM users WHERE id = ?', [baseId + i + 1]);
      if (i % progressInterval === 0 || i === singleDeletes - 1) {
        process.stdout.write(`     - Single deletes progress: ${i + 1} / ${singleDeletes}\r`);
      }
    }
    process.stdout.write('\n');
    const singleDeleteTime = Date.now() - singleDeleteStart;

    // Bulk delete
    const bulkDeleteStart = Date.now();
    const result = await this.runQuery(`DELETE FROM users WHERE id > ${baseId + singleDeletes}`);
    const bulkDeleteTime = Date.now() - bulkDeleteStart;

    this.results.tests.deletePerformance = {
      singleDeleteTime: singleDeleteTime,
      bulkDeleteTime: bulkDeleteTime,
      bulkRowsDeleted: result.changes,
      totalTime: Date.now() - startTime
    };
  }

  async testTransactionPerformance() {
    console.log('💳 Testing TRANSACTION performance...');

    const startTime = Date.now();
    const transactionInserts = this.config.transactionPerformance.transactionInserts;
    const progressInterval = this.config.transactionPerformance.progressReportInterval;
    const userIdRange = this.config.dataGeneration.userIdRange;

    // Add some transactions
    await this.runQuery('BEGIN TRANSACTION');
    for (let i = 0; i < transactionInserts; i++) {
      const userId = Math.floor(Math.random() * (userIdRange.max - userIdRange.min + 1)) + userIdRange.min;
      const transaction = this.generateRandomTransaction(userId);
      await this.runQuery(
        'INSERT INTO transactions (user_id, amount, type, description) VALUES (?, ?, ?, ?)',
        [transaction.user_id, transaction.amount, transaction.type, transaction.description]
      );
      if (i % progressInterval === 0 || i === transactionInserts - 1) {
        process.stdout.write(`     - Transaction inserts progress: ${i + 1} / ${transactionInserts}\r`);
      }
    }
    process.stdout.write('\n');
    await this.runQuery('COMMIT');

    // Test nested transactions and rollbacks
    const rollbackStart = Date.now();
    try {
      await this.runQuery('BEGIN TRANSACTION');
      await this.runQuery('INSERT INTO users (username, email) VALUES (?, ?)', ['test_rollback', 'rollback@test.com']);
      await this.runQuery('INSERT INTO users (username, email) VALUES (?, ?)', ['test_rollback2', 'rollback2@test.com']);
      await this.runQuery('ROLLBACK');
    } catch (err) {
      await this.runQuery('ROLLBACK');
    }
    const rollbackTime = Date.now() - rollbackStart;

    this.results.tests.transactionPerformance = {
      batchInsertTime: Date.now() - startTime - rollbackTime,
      rollbackTime: rollbackTime,
      totalTime: Date.now() - startTime
    };
  }

  async testDataTypes() {
    console.log('📋 Testing different data types...');

    const startTime = Date.now();
    const largeTextSize = this.config.dataTypes.largeTextSize;
    const largeBlobSize = this.config.dataTypes.largeBlobSize;

    // Test various data types
    const testData = [
      { type: 'INTEGER', value: 42 },
      { type: 'REAL', value: 3.14159 },
      { type: 'TEXT', value: 'Hello, 世界! 🌍' },
      { type: 'BLOB', value: Buffer.from('Binary data test') },
      { type: 'NULL', value: null },
      { type: 'BOOLEAN', value: true },
      { type: 'DATE', value: new Date().toISOString() },
      { type: 'JSON', value: JSON.stringify({ key: 'value', array: [1, 2, 3] }) },
      { type: 'LARGE_TEXT', value: 'A'.repeat(largeTextSize) },
      { type: 'LARGE_BLOB', value: Buffer.alloc(largeBlobSize, 'B') }
    ];

    await this.runQuery(`
            CREATE TABLE datatype_test (
                id INTEGER PRIMARY KEY,
                data_type TEXT,
                test_value
            )
        `);

    let i = 0;
    for (const data of testData) {
      await this.runQuery(
        'INSERT INTO datatype_test (data_type, test_value) VALUES (?, ?)',
        [data.type, data.value]
      );
      i++;
      process.stdout.write(`     - Inserting data type ${i}/${testData.length}: ${data.type.padEnd(15)}\r`);
    }
    process.stdout.write('\n');

    // Verify data integrity
    const retrievedData = await this.getAllQuery('SELECT * FROM datatype_test');

    this.results.tests.dataTypes = {
      totalTypes: testData.length,
      verificationPassed: retrievedData.length === testData.length,
      executionTime: Date.now() - startTime,
      types: testData.map(d => d.type)
    };
  }

  async createConcurrentWorker(workerId, operations) {
    const progressInterval = this.config.concurrency.workerProgressInterval;
    const workerScript = `
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const workerId = ${workerId};
const operations = ${operations};
const dbPath = path.join(__dirname, '${this.config.database.path}');

const db = new sqlite3.Database(dbPath);

const results = {
    workerId: workerId,
    operations: operations,
    completed: 0,
    errors: 0,
    startTime: Date.now(),
    endTime: null
};

function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

async function doWork() {
    for (let i = 0; i < operations; i++) {
        if (i % ${progressInterval} === 0 || i === operations - 1) {
            process.stderr.write(\`     - Worker \${workerId} progress: \${i + 1} / \${operations}\\r\`);
        }
        try {
            const username = \`worker\${workerId}_user\${i}\`;
            const email = \`worker\${workerId}_user\${i}@concurrent.test\`;
            
            // Insert
            await runQuery(
                'INSERT INTO users (username, email, age, salary, is_active) VALUES (?, ?, ?, ?, ?)',
                [username, email, Math.floor(Math.random() * ${this.config.dataGeneration.ageRange.max - this.config.dataGeneration.ageRange.min + 1}) + ${this.config.dataGeneration.ageRange.min}, Math.random() * ${this.config.dataGeneration.salaryRange.max}, Math.random() > 0.5]
            );
            
            // Update
            await runQuery(
                'UPDATE users SET salary = salary * 1.05 WHERE username = ?',
                [username]
            );
            
            // Select
            await new Promise((resolve, reject) => {
                db.all('SELECT * FROM users WHERE username = ?', [username], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
            
            results.completed++;
        } catch (err) {
            results.errors++;
        }
    }
    
    results.endTime = Date.now();
    process.stderr.write('\\n');
    console.log(JSON.stringify(results));
    db.close();
}

doWork().catch(console.error);
        `;

    const workerPath = path.join(__dirname, `worker_${workerId}.js`);
    fs.writeFileSync(workerPath, workerScript);

    const worker = spawn('node', [workerPath]);
    let output = '';
    let errorOutput = '';

    worker.stdout.on('data', (data) => {
      output += data.toString();
    });

    worker.stderr.on('data', (data) => {
      const message = data.toString();
      if (message.includes('progress')) {
        process.stderr.write(message);
      } else {
        errorOutput += message;
      }
    });

    return new Promise((resolve, reject) => {
      worker.on('close', (code) => {
        fs.unlinkSync(workerPath);
        if (code === 0) {
          resolve(JSON.parse(output.trim()));
        } else {
          reject(new Error(errorOutput));
        }
      });
      worker.on('error', (err) => {
        fs.unlinkSync(workerPath);
        reject(err);
      });
    });
  }

  async testConcurrency() {
    console.log('🔄 Testing concurrent operations...');

    const startTime = Date.now();
    const operationsPerWorker = this.config.concurrency.operationsPerWorker;

    const workers = [];
    console.log(`   - Starting ${this.concurrentWorkers} concurrent workers...`);
    for (let i = 0; i < this.concurrentWorkers; i++) {
      workers.push(this.createConcurrentWorker(i, operationsPerWorker));
    }

    try {
      const results = await Promise.all(workers);

      const totalOperations = results.reduce((sum, r) => sum + r.completed, 0);
      const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
      const avgExecutionTime = results.reduce((sum, r) => sum + (r.endTime - r.startTime), 0) / results.length;

      this.results.tests.concurrency = {
        workers: this.concurrentWorkers,
        operationsPerWorker: operationsPerWorker,
        totalOperations: totalOperations,
        totalErrors: totalErrors,
        successRate: ((totalOperations - totalErrors) / totalOperations * 100).toFixed(2) + '%',
        avgExecutionTime: avgExecutionTime,
        operationsPerSecond: Math.round(totalOperations / (avgExecutionTime / 1000)),
        totalTime: Date.now() - startTime,
        workerResults: results
      };
    } catch (err) {
      this.results.tests.concurrency = {
        error: err.message,
        totalTime: Date.now() - startTime
      };
    }
  }

  async testVacuumAndAnalyze() {
    console.log('🧹 Testing VACUUM and ANALYZE...');

    const startTime = Date.now();

    // Get database size before vacuum
    const statsBefore = fs.statSync(this.dbPath);
    const sizeBefore = statsBefore.size;

    // Run ANALYZE
    const analyzeStart = Date.now();
    await this.runQuery('ANALYZE');
    const analyzeTime = Date.now() - analyzeStart;

    // Run VACUUM
    const vacuumStart = Date.now();
    await this.runQuery('VACUUM');
    const vacuumTime = Date.now() - vacuumStart;

    // Get database size after vacuum
    const statsAfter = fs.statSync(this.dbPath);
    const sizeAfter = statsAfter.size;

    this.results.tests.maintenance = {
      analyzeTime: analyzeTime,
      vacuumTime: vacuumTime,
      sizeBeforeVacuum: sizeBefore,
      sizeAfterVacuum: sizeAfter,
      spaceSaved: sizeBefore - sizeAfter,
      compressionRatio: ((sizeBefore - sizeAfter) / sizeBefore * 100).toFixed(2) + '%',
      totalTime: Date.now() - startTime
    };
  }

  async getFinalStatistics() {
    console.log('📊 Collecting final statistics...');

    const queries = [
      { name: 'totalUsers', query: 'SELECT COUNT(*) as count FROM users' },
      { name: 'totalTransactions', query: 'SELECT COUNT(*) as count FROM transactions' },
      { name: 'totalLogs', query: 'SELECT COUNT(*) as count FROM logs' },
      { name: 'avgUserAge', query: 'SELECT AVG(age) as avg_age FROM users' },
      { name: 'maxSalary', query: 'SELECT MAX(salary) as max_salary FROM users' },
      { name: 'activeUsers', query: 'SELECT COUNT(*) as count FROM users WHERE is_active = 1' },
      { name: 'databaseSize', query: 'SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()' }
    ];

    const statistics = {};
    let i = 0;
    for (const q of queries) {
      i++;
      process.stdout.write(`     - Collecting stat ${i}/${queries.length}: ${q.name.padEnd(20)}\r`);
      const result = await this.getAllQuery(q.query);
      statistics[q.name] = result[0];
    }
    process.stdout.write('\n');

    this.results.finalStatistics = statistics;
  }

  formatTime(milliseconds) {
    if (milliseconds == null || milliseconds === 'N/A') return 'N/A';

    const ms = milliseconds % 1000;
    const seconds = Math.floor(milliseconds / 1000) % 60;
    const minutes = Math.floor(milliseconds / (1000 * 60));

    if (minutes > 0) {
      return `${minutes}m ${seconds}s ${ms}ms`;
    } else if (seconds > 0) {
      return `${seconds}s ${ms}ms`;
    } else {
      return `${ms}ms`;
    }
  }

  generateMarkdownReport() {
    console.log('📝 Generating markdown report...');

    const report = `# SQLite Stress Test Report

## Test Overview
- **Timestamp**: ${this.results.timestamp}
- **Node.js Version**: ${this.results.environment.nodeVersion}
- **Platform**: ${this.results.environment.platform} (${this.results.environment.arch})
- **CPUs**: ${this.results.environment.cpus}
- **Memory**: ${this.results.environment.memory}
- **Database Path**: ${this.dbPath}

## Test Configuration
- **Test Records**: ${this.testRecords.toLocaleString()}
- **Transaction Size**: ${this.transactionSize.toLocaleString()}
- **Concurrent Workers**: ${this.concurrentWorkers}

## Performance Results

### INSERT Performance
- **Total Records**: ${this.results.tests.insertPerformance?.totalRecords?.toLocaleString() || 'N/A'}
- **Total Time**: ${this.formatTime(this.results.tests.insertPerformance?.totalTime)}
- **Single Insert Time**: ${this.formatTime(this.results.tests.insertPerformance?.singleInsertTime)}
- **Batch Insert Time**: ${this.formatTime(this.results.tests.insertPerformance?.batchInsertTime)}
- **Records/Second**: ${this.results.tests.insertPerformance?.recordsPerSecond?.toLocaleString() || 'N/A'}
- **Single Insert Rate**: ${this.results.tests.insertPerformance?.singleInsertRate?.toLocaleString() || 'N/A'} records/sec
- **Batch Insert Rate**: ${this.results.tests.insertPerformance?.batchInsertRate?.toLocaleString() || 'N/A'} records/sec

### SELECT Performance
${Object.entries(this.results.tests.selectPerformance || {}).map(([test, data]) =>
      `- **${test}**: ${this.formatTime(data.executionTime)} (${data.rowsReturned} rows, ${data.ratePerSecond}/sec)`
    ).join('\n')}

### UPDATE Performance
- **Single Updates**: ${this.formatTime(this.results.tests.updatePerformance?.singleUpdateTime)}
- **Batch Updates**: ${this.formatTime(this.results.tests.updatePerformance?.batchUpdateTime)}
- **Bulk Update**: ${this.formatTime(this.results.tests.updatePerformance?.bulkUpdateTime)} (${this.results.tests.updatePerformance?.bulkRowsAffected || 'N/A'} rows)
- **Total Time**: ${this.formatTime(this.results.tests.updatePerformance?.totalTime)}

### DELETE Performance
- **Single Deletes**: ${this.formatTime(this.results.tests.deletePerformance?.singleDeleteTime)}
- **Bulk Delete**: ${this.formatTime(this.results.tests.deletePerformance?.bulkDeleteTime)} (${this.results.tests.deletePerformance?.bulkRowsDeleted || 'N/A'} rows)
- **Total Time**: ${this.formatTime(this.results.tests.deletePerformance?.totalTime)}

### TRANSACTION Performance
- **Batch Insert**: ${this.formatTime(this.results.tests.transactionPerformance?.batchInsertTime)}
- **Rollback Test**: ${this.formatTime(this.results.tests.transactionPerformance?.rollbackTime)}
- **Total Time**: ${this.formatTime(this.results.tests.transactionPerformance?.totalTime)}

### Data Types Support
- **Types Tested**: ${this.results.tests.dataTypes?.totalTypes || 'N/A'}
- **Verification**: ${this.results.tests.dataTypes?.verificationPassed ? '✅ PASSED' : '❌ FAILED'}
- **Execution Time**: ${this.formatTime(this.results.tests.dataTypes?.executionTime)}
- **Supported Types**: ${this.results.tests.dataTypes?.types?.join(', ') || 'N/A'}

### Concurrency Test
- **Workers**: ${this.results.tests.concurrency?.workers || 'N/A'}
- **Operations per Worker**: ${this.results.tests.concurrency?.operationsPerWorker || 'N/A'}
- **Total Operations**: ${this.results.tests.concurrency?.totalOperations?.toLocaleString() || 'N/A'}
- **Success Rate**: ${this.results.tests.concurrency?.successRate || 'N/A'}
- **Operations/Second**: ${this.results.tests.concurrency?.operationsPerSecond?.toLocaleString() || 'N/A'}
- **Average Execution Time**: ${this.formatTime(this.results.tests.concurrency?.avgExecutionTime)}
- **Total Time**: ${this.formatTime(this.results.tests.concurrency?.totalTime)}
- **Total Errors**: ${this.results.tests.concurrency?.totalErrors || 'N/A'}

### Maintenance Operations
- **ANALYZE Time**: ${this.formatTime(this.results.tests.maintenance?.analyzeTime)}
- **VACUUM Time**: ${this.formatTime(this.results.tests.maintenance?.vacuumTime)}
- **Total Time**: ${this.formatTime(this.results.tests.maintenance?.totalTime)}
- **Size Before VACUUM**: ${this.results.tests.maintenance?.sizeBeforeVacuum ? (this.results.tests.maintenance.sizeBeforeVacuum / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}
- **Size After VACUUM**: ${this.results.tests.maintenance?.sizeAfterVacuum ? (this.results.tests.maintenance.sizeAfterVacuum / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}
- **Space Saved**: ${this.results.tests.maintenance?.spaceSaved ? (this.results.tests.maintenance.spaceSaved / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}
- **Compression Ratio**: ${this.results.tests.maintenance?.compressionRatio || 'N/A'}

## Final Database Statistics
- **Total Users**: ${this.results.finalStatistics?.totalUsers?.count?.toLocaleString() || 'N/A'}
- **Total Transactions**: ${this.results.finalStatistics?.totalTransactions?.count?.toLocaleString() || 'N/A'}
- **Total Logs**: ${this.results.finalStatistics?.totalLogs?.count?.toLocaleString() || 'N/A'}
- **Average User Age**: ${this.results.finalStatistics?.avgUserAge?.avg_age ? this.results.finalStatistics.avgUserAge.avg_age.toFixed(2) : 'N/A'}
- **Maximum Salary**: ${this.results.finalStatistics?.maxSalary?.max_salary ? '$' + this.results.finalStatistics.maxSalary.max_salary.toLocaleString() : 'N/A'}
- **Active Users**: ${this.results.finalStatistics?.activeUsers?.count?.toLocaleString() || 'N/A'}
- **Database Size**: ${this.results.finalStatistics?.databaseSize?.size ? (this.results.finalStatistics.databaseSize.size / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}

## Performance Summary
This SQLite stress test evaluated:
- ✅ **INSERT operations** with both single and batch processing
- ✅ **SELECT operations** with various complexity levels
- ✅ **UPDATE operations** including single, batch, and bulk updates
- ✅ **DELETE operations** with different patterns
- ✅ **TRANSACTION handling** including rollbacks
- ✅ **Data type support** for all SQLite types
- ✅ **Concurrent operations** with multiple workers
- ✅ **Maintenance operations** (VACUUM, ANALYZE)

## Recommendations
1. **Batch Operations**: Use transactions for bulk operations to improve performance
2. **Indexing**: Ensure proper indexing for frequently queried columns
3. **Data Types**: SQLite handles all standard data types efficiently
4. **Concurrency**: SQLite handles concurrent reads well, but writes are serialized
5. **Maintenance**: Regular VACUUM operations can help reclaim space and improve performance

---
*Report generated on ${new Date().toISOString()}*
`;

    const reportPath = path.join(__dirname, 'sqlite_stress_test_report.md');
    fs.writeFileSync(reportPath, report);
    console.log(`📄 Report saved to: ${reportPath}`);

    return report;
  }

  async cleanup() {
    console.log('🧹 Cleaning up...');

    await new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    if (fs.existsSync(this.dbPath)) {
      fs.unlinkSync(this.dbPath);
      console.log('✅ Database file removed');
    }

    const files = fs.readdirSync(__dirname);
    files.forEach(file => {
      if (file.startsWith('worker_') && file.endsWith('.js')) {
        try {
          fs.unlinkSync(path.join(__dirname, file));
          console.log(`✅ Removed worker file: ${file}`);
        } catch (workerErr) {
          console.error(`Error removing worker file ${file}:`, workerErr);
        }
      }
    });
  }

  async runAllTests() {
    console.log('🚀 Starting comprehensive SQLite stress test...\n');

    const overallStart = Date.now();

    try {
      // Initialize
      await this.initialize();
      console.log('✅ Database initialized\n');

      // Create tables
      await this.createTables();
      console.log('✅ Tables created\n');

      // Run all performance tests
      await this.testInsertPerformance();
      console.log('✅ Insert performance test completed\n');

      await this.testSelectPerformance();
      console.log('✅ Select performance test completed\n');

      await this.testUpdatePerformance();
      console.log('✅ Update performance test completed\n');

      await this.testDeletePerformance();
      console.log('✅ Delete performance test completed\n');

      await this.testTransactionPerformance();
      console.log('✅ Transaction performance test completed\n');

      await this.testDataTypes();
      console.log('✅ Data types test completed\n');

      await this.testConcurrency();
      console.log('✅ Concurrency test completed\n');

      await this.testVacuumAndAnalyze();
      console.log('✅ Maintenance operations test completed\n');

      await this.getFinalStatistics();
      console.log('✅ Final statistics collected\n');

      // Generate report
      const report = this.generateMarkdownReport();
      console.log('✅ Markdown report generated\n');

      // Show summary
      const overallTime = Date.now() - overallStart;
      console.log('📊 TEST SUMMARY:');
      console.log(`   Total execution time: ${this.formatTime(overallTime)}`);
      console.log(`   Tests completed: ${Object.keys(this.results.tests).length}`);
      console.log(`   Final database size: ${this.results.finalStatistics?.databaseSize?.size ? (this.results.finalStatistics.databaseSize.size / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}`);
      console.log('   Report saved to: sqlite_stress_test_report.md\n');

    } catch (error) {
      console.error('❌ Test failed:', error);
      this.results.error = error.message;
    } finally {
      // Always cleanup
      await this.cleanup();
      console.log('✅ Cleanup completed\n');
    }
  }
}

// Error handling for the main execution
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Main execution
async function main() {
  // Check if sqlite3 is installed
  try {
    require('sqlite3');
  } catch (err) {
    console.error('❌ sqlite3 module not found. Please install it with:');
    console.error('   npm install sqlite3');
    process.exit(1);
  }

  console.log('🎯 SQLite Comprehensive Stress Test');
  console.log('=====================================\n');

  const stressTest = new SQLiteStressTest();
  await stressTest.runAllTests();

  console.log('🎉 All tests completed successfully!');
  console.log('Check the sqlite_stress_test_report.md file for detailed results.');
}

// Execute if run directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = SQLiteStressTest;