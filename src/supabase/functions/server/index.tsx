import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-cd835c22/health", (c) => {
  return c.json({ status: "ok" });
});

// Get user's grading history
app.get("/make-server-cd835c22/history/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const key = `history:${userId}`;
    const history = await kv.get(key);
    
    return c.json({ 
      success: true, 
      data: history || [] 
    });
  } catch (error) {
    console.error("Failed to fetch history:", error);
    return c.json({ 
      success: false, 
      error: "Failed to fetch history" 
    }, 500);
  }
});

// Add grading result to history
app.post("/make-server-cd835c22/history/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const key = `history:${userId}`;
    const result = await c.req.json();
    
    // Get existing history
    const history = await kv.get(key) || [];
    
    // Calculate round number
    const sameYearSubject = history.filter(
      (h: any) => h.year === result.year && h.subject === result.subject
    );
    const maxRound = sameYearSubject.length > 0
      ? Math.max(...sameYearSubject.map((h: any) => h.round || 1))
      : 0;
    
    const resultWithRound = {
      ...result,
      round: maxRound + 1,
      timestamp: Date.now()
    };
    
    // Add new result
    const updatedHistory = [...history, resultWithRound];
    await kv.set(key, updatedHistory);
    
    return c.json({ 
      success: true, 
      data: resultWithRound 
    });
  } catch (error) {
    console.error("Failed to add history:", error);
    return c.json({ 
      success: false, 
      error: "Failed to add history" 
    }, 500);
  }
});

// Clear user's history
app.delete("/make-server-cd835c22/history/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const key = `history:${userId}`;
    
    await kv.set(key, []);
    
    return c.json({ 
      success: true 
    });
  } catch (error) {
    console.error("Failed to clear history:", error);
    return c.json({ 
      success: false, 
      error: "Failed to clear history" 
    }, 500);
  }
});

// Delete specific record from history
app.delete("/make-server-cd835c22/history/:userId/:timestamp", async (c) => {
  try {
    const userId = c.req.param("userId");
    const timestamp = parseInt(c.req.param("timestamp"));
    const key = `history:${userId}`;
    
    // Get current history
    const history = await kv.get(key) || [];
    
    // Filter out the record with matching timestamp
    const updatedHistory = history.filter((record: any) => record.timestamp !== timestamp);
    
    // Save updated history
    await kv.set(key, updatedHistory);
    
    return c.json({ 
      success: true 
    });
  } catch (error) {
    console.error("Failed to delete record:", error);
    return c.json({ 
      success: false, 
      error: "Failed to delete record" 
    }, 500);
  }
});

Deno.serve(app.fetch);