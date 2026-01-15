import { NextResponse } from "next/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // TEMP: log to verify it hits the server
    console.log("UTM Stitcher collect:", body);

    // TODO: insert into Supabase here
    // await supabase.from("events").insert(...)

    return NextResponse.json(
      { ok: true },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400, headers: CORS_HEADERS }
    );
  }
}
