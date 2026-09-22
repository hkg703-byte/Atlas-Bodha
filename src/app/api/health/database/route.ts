import { NextResponse } from "next/server";
import { queryDatabase } from "@/lib/db/query";
export async function GET() {
try {
const result = await queryDatabase<{ database_time: Date }>(
"SELECT NOW() AS database_time;",
);
return NextResponse.json({
status: "ok",
database: "connected",
databaseTime: result.rows[0].database_time,
});
} catch {
console.error("Database health check failed.");
return NextResponse.json(
{
status: "error",
database: "unavailable",
},
{
status: 503,
},
);
}
}
