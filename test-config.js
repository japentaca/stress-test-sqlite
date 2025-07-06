#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Test the configuration loading
function loadConfig() {
  try {
    const configPath = path.join(__dirname, 'config.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.error('❌ Error loading config.json:', error.message);
    return null;
  }
}

console.log('🧪 Testing configuration loading...\n');

const config = loadConfig();

if (config) {
  console.log('✅ Configuration loaded successfully!');
  console.log('\n📊 Configuration Summary:');
  console.log(`   Database Path: ${config.database.path}`);
  console.log(`   Concurrent Workers: ${config.testConfiguration.concurrentWorkers}`);
  console.log(`   Test Records: ${config.testConfiguration.testRecords.toLocaleString()}`);
  console.log(`   Transaction Size: ${config.testConfiguration.transactionSize}`);
  console.log(`   Single Inserts: ${config.insertPerformance.singleInserts}`);
  console.log(`   Batch Size: ${config.insertPerformance.batchSize}`);
  console.log(`   Age Range: ${config.dataGeneration.ageRange.min}-${config.dataGeneration.ageRange.max}`);
  console.log(`   Salary Range: $${config.dataGeneration.salaryRange.min.toLocaleString()}-$${config.dataGeneration.salaryRange.max.toLocaleString()}`);
  console.log(`   Transaction Amount Range: $${config.dataGeneration.transactionAmountRange.min}-$${config.dataGeneration.transactionAmountRange.max}`);
  console.log(`   Operations per Worker: ${config.concurrency.operationsPerWorker}`);
  console.log(`   Large Text Size: ${config.dataTypes.largeTextSize.toLocaleString()} characters`);
  console.log(`   Large Blob Size: ${config.dataTypes.largeBlobSize.toLocaleString()} bytes`);

  console.log('\n🎯 Data Generation Arrays:');
  console.log(`   Usernames: [${config.dataGeneration.usernames.join(', ')}]`);
  console.log(`   Domains: [${config.dataGeneration.domains.join(', ')}]`);
  console.log(`   Transaction Types: [${config.dataGeneration.transactionTypes.join(', ')}]`);
  console.log(`   Log Levels: [${config.dataGeneration.logLevels.join(', ')}]`);

  console.log('\n✅ All configuration values are accessible and properly formatted!');
} else {
  console.log('❌ Failed to load configuration');
}