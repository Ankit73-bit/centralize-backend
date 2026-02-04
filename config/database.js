require('dotenv').config(); // Load environment variables FIRST

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

// Verify DATABASE_URL exists
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined in .env file');
}

// Parse DATABASE_URL manually to avoid encoding issues
const dbUrl = new URL(process.env.DATABASE_URL);

// Create PostgreSQL connection pool with explicit config
const pool = new Pool({
  host: dbUrl.hostname,
  port: parseInt(dbUrl.port) || 5432,
  database: dbUrl.pathname.slice(1), // Remove leading /
  user: dbUrl.username,
  password: dbUrl.password, // This will be plain text, not encoded
});

// Create Prisma adapter
const adapter = new PrismaPg(pool);

// Create Prisma Client instance with adapter
const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error'],
});

// Handle Prisma connection errors
prisma.$connect()
  .then(() => {
    console.log('✅ Database connected successfully');
  })
  .catch((error) => {
    console.error('❌ Database connection failed:', error.message);
  });

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
  await pool.end();
  console.log('🔌 Database disconnected');
});

module.exports = prisma;
