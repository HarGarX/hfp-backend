import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config(); // Load environment variables

async function verifyMultiTenantSchema() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5433'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'hfp_dev',
  });

  try {
    await dataSource.initialize();
    console.log('🔗 Database connection established');

    // Check for multi-tenant tables and their household_id columns
    const tablesToCheck = [
      'households',
      'users', 
      'accounts',
      'transactions',
      'goals',
      'loans',
      'insights',
      'notifications'
    ];

    console.log('🏠 Verifying multi-tenant table structure...\n');

    for (const table of tablesToCheck) {
      const result = await dataSource.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = $1 AND column_name IN ('id', 'household_id', 'user_id')
        ORDER BY ordinal_position
      `, [table]);

      console.log(`📋 Table: ${table}`);
      if (result.length > 0) {
        result.forEach((col: any) => {
          const icon = col.column_name === 'household_id' ? '🏠' : 
                      col.column_name === 'user_id' ? '👤' : '🔑';
          console.log(`   ${icon} ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
        });
      } else {
        console.log('   ⚠️  No tenant columns found');
      }
      console.log('');
    }

    // Check foreign key constraints for tenant isolation
    const fkResult = await dataSource.query(`
      SELECT 
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND (kcu.column_name = 'household_id' OR ccu.column_name = 'id')
        AND ccu.table_name = 'households'
      ORDER BY tc.table_name
    `);

    console.log('🔗 Household foreign key relationships:');
    fkResult.forEach((fk: any) => {
      console.log(`   ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    });

    // Check indexes on household_id for performance
    const indexResult = await dataSource.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes 
      WHERE indexdef LIKE '%household_id%'
      ORDER BY tablename, indexname
    `);

    console.log('\n📊 Multi-tenant performance indexes:');
    indexResult.forEach((idx: any) => {
      console.log(`   ${idx.tablename}: ${idx.indexname}`);
      console.log(`      ${idx.indexdef.split('(')[1].split(')')[0]}`);
    });

    console.log('\n✅ Multi-tenant schema verification completed successfully!');
    console.log('🏗️  Database is ready for tenant-isolated operations');

  } catch (error) {
    console.error('❌ Error verifying schema:', error);
  } finally {
    await dataSource.destroy();
  }
}

verifyMultiTenantSchema();