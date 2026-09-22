import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
async function main() {
 const { queryDatabase }=await import('../src/lib/db/query');
 const { dbPool }=await import('../src/lib/db/pool');
 try {
 const { buildMemoryInstructions }=await import('../src/server/ai/context/buildConversationContext');
 const user=(await queryDatabase<{id:string}>("SELECT user_id AS id FROM external_identities WHERE subject=$1",['josh-test@atlasbodha.local'])).rows[0];
 if(!user) throw Error('Test user absent');
 const consent=(await queryDatabase<{granted:boolean}>("SELECT granted FROM consent_records WHERE user_id=$1 AND consent_type='memory' ORDER BY recorded_at DESC,id DESC LIMIT 1",[user.id])).rows[0];
 const count=(await queryDatabase<{count:string}>('SELECT count(*) FROM memories WHERE user_id=$1',[user.id])).rows[0].count;
 const instructions=await buildMemoryInstructions(user.id);
 if(process.argv.includes('--off')) {
 if(consent?.granted!==false || instructions!=='') throw Error('Off context check failed');
 console.log(`PASS memory off: built memory instructions empty; saved rows retained=${count}`);
 } else {
 if(count!=='0'||instructions!=='') throw Error('Deletion check failed');
 console.log('PASS permanent deletion: DB memories=0; built memory instructions empty');
 }
 } finally { await dbPool.end(); }
}
main().catch(()=>{console.error('Memory context verification FAILED');process.exitCode=1;});
