import { requireCurrentUser } from '@/server/auth/requireCurrentUser';
import { hasValidRequestOrigin } from '@/server/auth/origin';
import { proposeMemories } from '@/server/memory/proposals';
export async function POST(request:Request) {
 if(!hasValidRequestOrigin(request)) return Response.json({error:'Invalid origin'},{status:403});
 const user=await requireCurrentUser();
 try {
 const body=await request.json();
 if(typeof body.sourceMessageId!=='string') throw Error();
 return Response.json(await proposeMemories(user.id,body.sourceMessageId),{headers:{'Cache-Control':'no-store'}});
 } catch {return Response.json({consent:false,proposals:[]});}
}
