import { execFileSync } from 'node:child_process';

const target=process.env.SUPABASE_TEST_TARGET || 'linked';
if (!['linked','local'].includes(target)) throw new Error('Target pengujian tidak valid.');
const output=execFileSync('supabase',['db','query',`--${target}`,'--file','tests/integration/rls.sql'],{ encoding:'utf8',maxBuffer:4*1024*1024 });
const data=JSON.parse(output);
if (!data.rows?.[0]?.report?.passed) throw new Error('Tidak ada hasil pengujian keamanan.');
console.log(JSON.stringify(data.rows[0].report,null,2));
