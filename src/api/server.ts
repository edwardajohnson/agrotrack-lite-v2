import express, { Request, Response } from "express";
import cors from "cors";
import { AgentOrchestrator } from "../orchestrator/workflow";
import { getTopicMessages } from "../hedera/mirror";
import { getCurrentTopicId } from "../hedera/hcs";
import { getLogs, getLogStats, log } from "../utils/logger";

const app = express();
const orchestrator = new AgentOrchestrator();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (_req: Request, res: Response) => {
  log("Health check requested", "info");
  res.json({
    status: "ok",
    service: "AgroTrack-Lite v2.0",
    topicId: getCurrentTopicId(),
  });
});

// Live logs viewer (HTML)
app.get("/logs", (_req: Request, res: Response) => {
  const lines = parseInt(_req.query.lines as string) || 200;
  const recentLogs = getLogs(lines);
  const stats = getLogStats();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>AgroTrack-Lite System Logs</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0d1117;
      color: #c9d1d9;
      font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Courier New', monospace;
      font-size: 14px;
      line-height: 1.5;
    }
    .header {
      background: #161b22;
      border-bottom: 2px solid #30363d;
      padding: 24px;
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    h1 {
      color: #e6edf3;
      font-size: 28px;
      margin-bottom: 8px;
      font-weight: 600;
    }
    .subtitle {
      color: #8b949e;
      font-size: 15px;
    }
    .stats {
      background: #161b22;
      padding: 16px 24px;
      margin: 0;
      border-bottom: 1px solid #21262d;
      display: flex;
      gap: 32px;
      flex-wrap: wrap;
      align-items: center;
    }
    .stat-item {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .stat-label {
      color: #8b949e;
      font-size: 12px;
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .stat-value {
      color: #e6edf3;
      font-weight: 700;
      font-size: 18px;
    }
    .refresh {
      position: fixed;
      top: 24px;
      right: 24px;
      padding: 12px 24px;
      background: #238636;
      color: #ffffff;
      border: none;
      cursor: pointer;
      font-family: inherit;
      font-weight: 600;
      font-size: 14px;
      border-radius: 6px;
      z-index: 101;
      transition: all 0.2s;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    .refresh:hover {
      background: #2ea043;
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.3);
    }
    .logs-container {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }
    .log-entry {
      padding: 16px;
      margin: 8px 0;
      border-left: 4px solid;
      background: #0d1117;
      border-radius: 6px;
      transition: all 0.2s;
      border: 1px solid #21262d;
    }
    .log-entry:hover {
      background: #161b22;
      border-color: #30363d;
      transform: translateX(2px);
    }
    
    /* Log level colors - colorblind friendly */
    .log-entry.info { 
      border-left-color: #58a6ff;
    }
    .log-entry.success { 
      border-left-color: #3fb950;
    }
    .log-entry.error { 
      border-left-color: #f85149;
      background: #1c1011;
      border-color: #da3633;
    }
    .log-entry.error:hover {
      background: #2d1214;
    }
    .log-entry.debug { 
      border-left-color: #6e7681;
      opacity: 0.7;
    }
    
    .log-header {
      display: flex;
      gap: 12px;
      margin-bottom: 10px;
      flex-wrap: wrap;
      align-items: center;
    }
    .timestamp {
      color: #6e7681;
      font-size: 12px;
      font-family: 'SF Mono', monospace;
    }
    .level {
      font-weight: 700;
      font-size: 11px;
      padding: 4px 10px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .level.info { 
      background: #1f2937;
      color: #58a6ff;
    }
    .level.success { 
      background: #0d2818;
      color: #3fb950;
    }
    .level.error { 
      background: #2d1214;
      color: #f85149;
    }
    .level.debug { 
      background: #21262d;
      color: #6e7681;
    }
    .agent {
      background: #21262d;
      color: #ffa657;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }
    .ref {
      background: #21262d;
      color: #79c0ff;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }
    .message {
      color: #e6edf3;
      font-size: 14px;
      line-height: 1.6;
      font-weight: 400;
    }
    .log-entry.error .message {
      color: #ffa198;
      font-weight: 500;
    }
    .log-entry.debug .message {
      color: #8b949e;
    }
    .data {
      margin-top: 12px;
      padding: 12px;
      background: #010409;
      border: 1px solid #21262d;
      border-radius: 4px;
      font-size: 12px;
      color: #8b949e;
      overflow-x: auto;
    }
    .data pre {
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
      font-family: 'SF Mono', monospace;
    }
    
    /* Enhanced stats colors */
    .stat-value[style*="00ff00"] { color: #3fb950 !important; }
    .stat-value[style*="00ffff"] { color: #79c0ff !important; }
    .stat-value[style*="ff6b6b"] { color: #f85149 !important; }
    .stat-value[style*="888"] { color: #6e7681 !important; }
    
    @media (max-width: 768px) {
      .header { padding: 16px; }
      h1 { font-size: 22px; }
      .stats { padding: 12px 16px; gap: 16px; }
      .logs-container { padding: 12px; }
      .refresh { 
        top: 12px; 
        right: 12px; 
        padding: 10px 16px; 
        font-size: 13px; 
      }
      .log-entry { padding: 12px; }
    }
    
    /* Smooth scroll */
    html { scroll-behavior: smooth; }
    
    /* Selection color */
    ::selection {
      background: #58a6ff;
      color: #ffffff;
    }
  </style>
  <script>
    setTimeout(() => location.reload(), 5000);
    window.addEventListener('load', () => {
      window.scrollTo(0, document.body.scrollHeight);
    });
  </script>
</head>
</body>
</html>
  `;

  res.send(html);
});

// JSON API endpoint for logs
app.get("/api/logs", (_req: Request, res: Response) => {
  const lines = parseInt(_req.query.lines as string) || 100;
  res.json({
    total: getLogs().length,
    stats: getLogStats(),
    logs: getLogs(lines),
  });
});

// SMS webhook
app.post("/webhook/sms", async (req: Request, res: Response) => {
  const from = req.body.from || req.body.From;
  const text = req.body.text || req.body.Body;

  if (!from || !text) {
    log("SMS webhook received invalid data", "error", { body: req.body });
    res.status(400).json({ error: "Missing 'from' or 'text'" });
    return;
  }

  log(`SMS received from ${from}`, "info", { from, text });

  orchestrator.handleSms(from, text).catch((err) => {
    log("Orchestrator error", "error", { error: err.message });
  });

  res.status(200).json({ status: "received" });
});

// Proof API
app.get("/api/proof/:ref", async (req: Request, res: Response) => {
  const { ref } = req.params;
  const topicId = getCurrentTopicId();

  if (!topicId) {
    res.status(500).json({ error: "Topic not initialized" });
    return;
  }

  const messages = await getTopicMessages(topicId, 500);
  const refEvents = messages.filter(
    (m) => m.ref === ref || m.data?.ref === ref
  );

  res.json({
    ref,
    events: refEvents,
    timeline: refEvents.map((e) => ({
      timestamp: e.consensus_timestamp,
      agent: e.agent,
      event: e.event,
      data: e.data,
    })),
  });
});

// Get all recent messages
app.get("/api/messages", async (_req: Request, res: Response) => {
  const topicId = getCurrentTopicId();
  if (!topicId) {
    res.status(500).json({ error: "Topic not initialized" });
    return;
  }

  const messages = await getTopicMessages(topicId, 100);
  res.json({ messages });
});

export default app;
