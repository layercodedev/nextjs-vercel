// app/api/authorize/route.ts
//
// Purpose
// -------
// Session authorization endpoint. Obtains a voice session token from Layercode
// while keeping your API key secure on the server.
//
// Responsibilities
// ----------------
// • Receive session requests from the browser.
// • Proxy the request to Layercode's authorize_session endpoint.
// • Return the session token for WebSocket connection.
// • Handle errors (missing API key, insufficient balance, etc.).
//
// Lifecycle Position
// ------------------
// 1. Browser calls this route BEFORE connecting to voice.
// 2. This route obtains a session token from Layercode.
// 3. Browser uses the token to establish WebSocket connection.
// 4. Voice events then flow to /api/agent (see that route).
//
// Extension Points
// ----------------
// • Add user authentication checks before calling Layercode.
// • Log session initiation for analytics (user ID, timestamp).
// • Implement rate limiting per user or organization.
// • Add session metadata for tracking (source, device type).
//
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

export const POST = async (request: Request) => {
  // EXTENSION POINT: Add user authentication checks here
  // Example: Verify JWT, check user permissions, validate subscription status
  const endpoint = "https://api.layercode.com/v1/agents/web/authorize_session";
  const apiKey = process.env.LAYERCODE_API_KEY;
  if (!apiKey) {
    throw new Error("LAYERCODE_API_KEY is not set.");
  }
  const requestBody = await request.json();
  if (!requestBody || !requestBody.agent_id) {
    throw new Error("Missing agent_id in request body.");
  }
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || response.statusText);
    }
    return NextResponse.json(await response.json());
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log("Layercode authorize session response error:", errorMessage);

    // Check if the error is an insufficient balance error
    if (errorMessage.includes('insufficient_balance')) {
      return NextResponse.json(
        { error: 'insufficient_balance' },
        { status: 402, statusText: 'insufficient_balance' }
      );
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
};
