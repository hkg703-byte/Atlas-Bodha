import { requireCurrentUser } from '@/server/auth/requireCurrentUser';
import { hasValidRequestOrigin } from '@/server/auth/origin';
import { listMemories,memoryConsent,memoryTransaction,validMemoryContent } from '@/server/memory/repository';
import { consumePending,forgetPending,getPending } from '@/server/memory/proposals';
export async function GET() {
 const user=await requireCurrentUser();
 return Response.json({consent:await memoryConsent(user.id),memories:await listMemories(user.id)},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request) {
 if(!hasValidRequestOrigin(request)) return Response.json({error:'Invalid origin'},{status:403});
 const user=await requireCurrentUser();
 try {
 const body=await request.json();
 await memoryTransaction(user.id,async client=>{
 switch(body.action) {
 case 'consent':
 if(typeof body.granted!=='boolean') throw Error();
 await client.query("INSERT INTO consent_records(user_id,consent_type,granted) VALUES($1,'memory',$2)",[user.id,body.granted]);
 if(!body.granted) forgetPending(user.id);
 break;
 case 'save': {
 const entry=getPending(body.token,user.id);
 if(!entry || await memoryConsent(user.id,client)!==true) throw Error();
 await client.query('INSERT INTO memories(user_id,content,origin,confidence,source_message_id) VALUES($1,$2,$3,$4,$5)',[user.id,entry.proposal.content,entry.proposal.origin,entry.proposal.confidence,entry.sourceMessageId]);
 consumePending(body.token);break;
 }
 case 'dismiss':
 if(getPending(body.token,user.id)) consumePending(body.token);
 break;
 case 'edit':
 if(!validMemoryContent(body.content)) throw Error();
 await client.query("UPDATE memories SET content=$1,confidence='stated',updated_at=NOW() WHERE id=$2 AND user_id=$3",[body.content.trim(),body.id,user.id]);break;
 case 'delete': await client.query('DELETE FROM memories WHERE id=$1 AND user_id=$2',[body.id,user.id]);forgetPending(user.id);break;
 case 'deleteAll': await client.query('DELETE FROM memories WHERE user_id=$1',[user.id]);forgetPending(user.id);break;
 default: throw Error();
 }
 });
 return Response.json({consent:await memoryConsent(user.id),memories:await listMemories(user.id)});
 } catch {return Response.json({error:'Memory could not be updated. Please refresh and try again.'},{status:400});}
}
