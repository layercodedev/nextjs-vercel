/**
 * VOICE SESSION AUTHORIZATION ROUTE
 * ==================================
 * This route is the entry point for initiating a voice session.
 *
 * LIFECYCLE POSITION:
 * 1. Client requests authorization here BEFORE connecting to voice
 * 2. This route validates the user and obtains a session token from Layercode
 * 3. Client uses the returned token to establish a WebSocket voice connection
 * 4. Voice events then flow to /api/agent (see that route for event handling)
 *
 * DEVELOPER EXTENSION POINTS:
 * - Add user authentication/authorization checks before calling Layercode
 * - Log session initiation for analytics (user ID, timestamp, agent ID)
 * - Implement rate limiting per user or organization
 * - Add session metadata for tracking (e.g., source, device type)
 */
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
  } catch (error: any) {
    console.log("Layercode authorize session response error:", error.message);

    // Check if the error is an insufficient balance error
    if (error.message && error.message.includes('insufficient_balance')) {
      return NextResponse.json(
        { error: 'insufficient_balance' },
        { status: 402, statusText: 'insufficient_balance' }
      );
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
};
