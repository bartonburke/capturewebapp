/**
 * Neo4j connection utility with singleton pattern
 * Provides connection management and query helpers for serverless environment
 */

import neo4j, { Driver, Session, ManagedTransaction, QueryResult, Integer } from 'neo4j-driver';

// Singleton driver instance
let driver: Driver | null = null;

/**
 * Get or create the Neo4j driver singleton
 * Validates environment variables and creates connection
 */
export function getDriver(): Driver {
  if (driver) {
    return driver;
  }

  const uri = process.env.NEO4J_URI;
  const user = process.env.NEO4J_USER;
  const password = process.env.NEO4J_PASSWORD;

  if (!uri || !user || !password) {
    throw new Error(
      '[Neo4j] Connection not configured. Set NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD environment variables.'
    );
  }

  console.log('[Neo4j] Creating driver connection...');

  driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
    maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
    maxConnectionPoolSize: 50,
    connectionAcquisitionTimeout: 2 * 60 * 1000, // 2 minutes
  });

  return driver;
}

/**
 * Get a new session for running queries
 * Caller is responsible for closing the session
 */
export function getSession(): Session {
  return getDriver().session();
}

/**
 * Close the driver connection (for cleanup)
 * Call on process shutdown if needed
 */
export async function closeDriver(): Promise<void> {
  if (driver) {
    console.log('[Neo4j] Closing driver connection...');
    await driver.close();
    driver = null;
  }
}

/**
 * Execute a single Cypher query with parameters
 * Handles session lifecycle automatically
 */
export async function runQuery<T extends Record<string, unknown> = Record<string, unknown>>(
  cypher: string,
  params?: Record<string, unknown>
): Promise<QueryResult<T>> {
  const session = getSession();
  try {
    const result = await session.run<T>(cypher, params || {});
    return result;
  } catch (error) {
    console.error('[Neo4j] Query failed:', cypher.slice(0, 100));
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * Execute multiple queries in a single write transaction
 * All queries succeed or all fail together
 */
export async function runWriteTransaction<T>(
  work: (tx: ManagedTransaction) => Promise<T>
): Promise<T> {
  const session = getSession();
  try {
    return await session.executeWrite(work);
  } finally {
    await session.close();
  }
}

/**
 * Execute multiple queries in a single read transaction
 */
export async function runReadTransaction<T>(
  work: (tx: ManagedTransaction) => Promise<T>
): Promise<T> {
  const session = getSession();
  try {
    return await session.executeRead(work);
  } finally {
    await session.close();
  }
}

/**
 * Verify connection is working
 * Returns true if database is reachable
 */
export async function verifyConnection(): Promise<boolean> {
  try {
    const result = await runQuery('RETURN 1 as value');
    const value = result.records[0]?.get('value');
    console.log('[Neo4j] Connection verified successfully');
    // Neo4j returns integers as Integer objects
    if (Integer.isInteger(value)) {
      return (value as Integer).toInt() === 1;
    }
    return value === 1;
  } catch (error) {
    console.error('[Neo4j] Connection verification failed:', error);
    return false;
  }
}

/**
 * Get server info for debugging
 */
export async function getServerInfo(): Promise<{
  address: string;
  agent: string;
  protocolVersion: number;
}> {
  const d = getDriver();
  const serverInfo = await d.getServerInfo();
  return {
    address: serverInfo.address ?? 'unknown',
    agent: serverInfo.agent ?? 'unknown',
    protocolVersion: typeof serverInfo.protocolVersion === 'number' ? serverInfo.protocolVersion : 0,
  };
}
