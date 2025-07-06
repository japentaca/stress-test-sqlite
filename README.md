# SQLite Stress Test with Configurable Parameters

This SQLite stress test application now supports loading all loop counts, quantities, and data generation parameters from a JSON configuration file.

## Configuration File

The application loads configuration from `config.json`. If the file doesn't exist or is invalid, the application will fall back to default values and continue running.

### Configuration Structure

```json
{
  "database": {
    "path": "stress_test.db"
  },
  "testConfiguration": {
    "concurrentWorkers": 8,
    "testRecords": 1000000,
    "transactionSize": 100
  },
  "insertPerformance": {
    "singleInserts": 1000,
    "batchSize": 1000,
    "progressReportInterval": 100
  },
  "selectPerformance": {
    "selectAllLimit": 1000,
    "joinLimit": 100
  },
  "updatePerformance": {
    "singleUpdates": 100,
    "batchUpdates": 900,
    "singleUpdateProgressInterval": 10,
    "batchUpdateProgressInterval": 100
  },
  "deletePerformance": {
    "testDataRecords": 1000,
    "singleDeletes": 100,
    "progressReportInterval": 10,
    "batchProgressInterval": 100
  },
  "transactionPerformance": {
    "transactionInserts": 5000,
    "progressReportInterval": 500
  },
  "concurrency": {
    "operationsPerWorker": 500,
    "workerProgressInterval": 20
  },
  "dataGeneration": {
    "usernames": ["alice", "bob", "charlie", "diana", "eve", "frank"],
    "domains": ["gmail.com", "yahoo.com", "outlook.com", "test.com"],
    "transactionTypes": ["deposit", "withdrawal", "transfer", "payment"],
    "transactionDescriptions": ["Salary payment", "Grocery shopping", "Rent payment", "Investment", "Refund"],
    "logLevels": ["INFO", "WARNING", "ERROR", "DEBUG"],
    "logMessages": [
      "User login successful",
      "Transaction processed", 
      "Database connection established",
      "Cache cleared",
      "Backup completed"
    ],
    "ageRange": {
      "min": 18,
      "max": 98
    },
    "salaryRange": {
      "min": 0,
      "max": 100000
    },
    "transactionAmountRange": {
      "min": -1000,
      "max": 1000
    },
    "userIdRange": {
      "min": 1,
      "max": 1000
    }
  },
  "dataTypes": {
    "largeTextSize": 10000,
    "largeBlobSize": 50000
  }
}
```

## Configurable Parameters

### Database Configuration
- `database.path`: Path to the SQLite database file

### Test Configuration
- `testConfiguration.concurrentWorkers`: Number of concurrent workers for concurrency tests
- `testConfiguration.testRecords`: Total number of records to insert in batch operations
- `testConfiguration.transactionSize`: Size of transaction batches

### Insert Performance Test
- `insertPerformance.singleInserts`: Number of individual insert operations
- `insertPerformance.batchSize`: Size of each batch for batch insert operations
- `insertPerformance.progressReportInterval`: How often to report progress

### Select Performance Test
- `selectPerformance.selectAllLimit`: LIMIT for SELECT * queries
- `selectPerformance.joinLimit`: LIMIT for JOIN queries

### Update Performance Test
- `updatePerformance.singleUpdates`: Number of individual update operations
- `updatePerformance.batchUpdates`: Number of batch update operations
- `updatePerformance.singleUpdateProgressInterval`: Progress reporting interval for single updates
- `updatePerformance.batchUpdateProgressInterval`: Progress reporting interval for batch updates

### Delete Performance Test
- `deletePerformance.testDataRecords`: Number of test records to create for deletion
- `deletePerformance.singleDeletes`: Number of individual delete operations
- `deletePerformance.progressReportInterval`: Progress reporting interval for single deletes
- `deletePerformance.batchProgressInterval`: Progress reporting interval for batch operations

### Transaction Performance Test
- `transactionPerformance.transactionInserts`: Number of transaction records to insert
- `transactionPerformance.progressReportInterval`: Progress reporting interval

### Concurrency Test
- `concurrency.operationsPerWorker`: Number of operations each worker should perform
- `concurrency.workerProgressInterval`: How often workers report progress

### Data Generation
- `dataGeneration.usernames`: Array of usernames to use for random user generation
- `dataGeneration.domains`: Array of email domains to use
- `dataGeneration.transactionTypes`: Array of transaction types
- `dataGeneration.transactionDescriptions`: Array of transaction descriptions
- `dataGeneration.logLevels`: Array of log levels
- `dataGeneration.logMessages`: Array of log messages
- `dataGeneration.ageRange`: Min and max age for random user generation
- `dataGeneration.salaryRange`: Min and max salary for random user generation
- `dataGeneration.transactionAmountRange`: Min and max transaction amounts
- `dataGeneration.userIdRange`: Min and max user IDs for transaction generation

### Data Types Test
- `dataTypes.largeTextSize`: Size of large text data for testing
- `dataTypes.largeBlobSize`: Size of large blob data for testing

## Usage

1. **Run with default configuration:**
   ```bash
   node index.js
   ```

2. **Test configuration loading:**
   ```bash
   node test-config.js
   ```

3. **Customize configuration:**
   - Edit `config.json` to adjust any parameters
   - The application will automatically load your custom values
   - If `config.json` is missing or invalid, default values will be used

## Benefits of Configuration-Based Approach

- **Flexibility**: Easily adjust test parameters without modifying code
- **Reproducibility**: Save different configurations for different test scenarios
- **Scalability**: Quickly scale tests up or down by adjusting quantities
- **Customization**: Tailor data generation to match your specific use cases
- **Fallback Safety**: Application continues with defaults if configuration is missing

## Example Configurations

### Light Testing (for development)
```json
{
  "testConfiguration": {
    "concurrentWorkers": 2,
    "testRecords": 1000,
    "transactionSize": 50
  },
  "insertPerformance": {
    "singleInserts": 100,
    "batchSize": 100
  }
}
```

### Heavy Testing (for performance benchmarking)
```json
{
  "testConfiguration": {
    "concurrentWorkers": 16,
    "testRecords": 10000000,
    "transactionSize": 1000
  },
  "insertPerformance": {
    "singleInserts": 10000,
    "batchSize": 5000
  }
}