import { PGlite } from '../../frontend/node_modules/@electric-sql/pglite/dist/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  console.log('====================================================');
  console.log(' Axos Relatórios — Validação de Banco PostgreSQL');
  console.log('====================================================');
  
  const db = new PGlite();
  await db.waitReady;

  console.log('\n[1/3] Aplicando bootstrap.sql (Mocks de ambiente Supabase)...');
  const bootstrapPath = path.resolve(__dirname, 'bootstrap.sql');
  const bootstrapSql = fs.readFileSync(bootstrapPath, 'utf8');
  await db.exec(bootstrapSql);
  console.log('      Bootstrap aplicado com sucesso.');

  console.log('\n[2/3] Aplicando migração 0001_initial_schema.sql...');
  const schemaPath = path.resolve(__dirname, '../migrations/0001_initial_schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  await db.exec(schemaSql);
  console.log('      0001_initial_schema.sql executado sem erros estruturais.');

  console.log('\n[3/3] Executando suite de testes de isolamento e regras de negócio...');
  const testsPath = path.resolve(__dirname, '01_isolation_and_rules.test.sql');
  const testsSql = fs.readFileSync(testsPath, 'utf8');
  await db.exec(testsSql);
  console.log('      TESTES VERDES: Todas as regras e isolamentos foram validados! [OK]');

  await db.close();
  console.log('\n====================================================');
  console.log(' Sucesso: Banco e regras íntegros e validados.');
  console.log('====================================================');
}

run().catch(err => {
  console.error('\n[ERRO CRÍTICO NA EXECUÇÃO DOS TESTES SQL]:');
  console.error('Mensagem:', err.message);
  if (err.detail) console.error('Detalhe:', err.detail);
  if (err.hint) console.error('Dica:', err.hint);
  if (err.where) console.error('Onde:', err.where);
  process.exit(1);
});
