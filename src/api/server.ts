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
      background: #0a0a0a;
      color: #00ff00;
      font-family: 'Courier New', Monaco, monospace;
      font-size: 13px;
      line-height: 1.4;
    }
    .header {
      background: #1a1a1a;
      border-bottom: 2px solid #00ff00;
      padding: 20px;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    h1 {
      color: #00ff00;
      font-size: 24px;
      margin-bottom: 10px;
      text-shadow: 0 0 10px #00ff00;
    }
    .subtitle {
      color: #666;
      font-size: 14px;
    }
    .stats {
      background: #0f0f0f;
      padding: 15px 20px;
      margin: 0;
      border-bottom: 1px solid #333;
      display: flex;
      gap: 30px;
      flex-wrap: wrap;
      align-items: center;
    }
    .stat-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .stat-label {
      color: #666;
      font-size: 11px;
      text-transform: uppercase;
    }
    .stat-value {
      color: #00ff00;
      font-weight: bold;
      font-size: 16px;
    }
    .refresh {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 10px 20px;
      background: #00ff00;
      color: #000;
      border: none;
      cursor: pointer;
      font-family: 'Courier New', monospace;
      font-weight: bold;
      font-size: 14px;
      border-radius: 4px;
      z-index: 101;
      transition: all 0.2s;
    }
    .refresh:hover {
      background: #00cc00;
      transform: scale(1.05);
    }
    .logs-container {
      padding: 20px;
    }
    .log-entry {
      padding: 12px;
      margin: 6px 0;
      border-left: 4px solid;
      background: #0a0a0a;
      border-radius: 2px;
      transition: background 0.2s;
    }
    .log-entry:hover {
      background: #151515;
    }
    .log-entry.info { border-left-color: #00ff00; }
    .log-entry.success { border-left-color: #00ffff; }
    .log-entry.error { 
      border-left-color: #ff0000; 
      background: #1a0000;
    }
    .log-entry.debug { 
      border-left-color: #888; 
      color: #888;
    }
    .log-header {
      display: flex;
      gap: 15px;
      margin-bottom: 6px;
      flex-wrap: wrap;
    }
    .timestamp {
      color: #666;
      font-size: 11px;
    }
    .level {
      font-weight: bold;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 3px;
      text-transform: uppercase;
    }
    .level.info { background: #003300; color: #00ff00; }
    .level.success { background: #003333; color: #00ffff; }
    .level.error { background: #330000; color: #ff6b6b; }
    .level.debug { background: #1a1a1a; color: #888; }
    .agent {
      background: #1a1a1a;
      color: #ffaa00;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 11px;
    }
    .ref {
      background: #1a1a1a;
      color: #00aaff;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 11px;
    }
    .message {
      color: #00ff00;
      margin-top: 4px;
      font-size: 13px;
    }
    .log-entry.error .message {
      color: #ff6b6b;
    }
    .log-entry.debug .message {
      color: #888;
    }
    .data {
      margin-top: 8px;
      padding: 10px;
      background: #000;
      border: 1px solid #222;
      border-radius: 3px;
      font-size: 11px;
      color: #666;
      overflow-x: auto;
    }
    .data pre {
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
  </style>
  <script>
    setTimeout(() => location.reload(), 5000);
    window.addEventListener('load', () => {
      window.scrollTo(0, document.body.scrollHeight);
    });
  </script>
</head>
<body>
  <button class="refresh" onclick="location.reload()">↻ Refresh Now</button>
  
  <div class="header">
    <h1>🌾 AgroTrack-Lite System Logs</h1>
    <div class="subtitle">Real-time monitoring • Auto-refresh: 5s</div>
  </div>
  
  <div class="stats">
    <div class="stat-item">
      <span class="stat-label">Total:</span>
      <span class="stat-value">${stats.total}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Info:</span>
      <span class="stat-value" style="color: #00ff00">${stats.byLevel.info}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Success:</span>
      <span class="stat-value" style="color: #00ffff">${stats.byLevel.success}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Errors:</span>
      <span class="stat-value" style="color: #ff6b6b">${stats.byLevel.error}</span>
    </div>
  </div>
  
  <div class="logs-container">
    ${recentLogs.map(logEntry => `
      <div class="log-entry ${logEntry.level}">
        <div class="log-header">
          <span class="timestamp">${logEntry.timestamp}</span>
          <span class="level ${logEntry.level}">${logEntry.level}</span>
          ${logEntry.agent ? `<span class="agent">${logEntry.agent}</span>` : ''}
          ${logEntry.ref ? `<span class="ref">${logEntry.ref}</span>` : ''}
        </div>
        <div class="message">${logEntry.message}</div>
        ${logEntry.data ? `<div class="data"><pre>${JSON.stringify(logEntry.data, null, 2)}</pre></div>` : ''}
      </div>
    `).join('')}
  </div>
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
