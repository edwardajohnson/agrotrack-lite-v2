import express, { Request, Response } from "express";

import cors from "cors";

import { AgentOrchestrator } from "../orchestrator/workflow";

import { getTopicMessages } from "../hedera/mirror";

import { getCurrentTopicId } from "../hedera/hcs";



const app = express();

const orchestrator = new AgentOrchestrator();



app.use(cors());

app.use(express.json());

app.use(express.urlencoded({ extended: true }));



// Health check

app.get("/health", (_req: Request, res: Response) => {

  res.json({

    status: "ok",

    service: "AgroTrack-Lite v2.0",

    topicId: getCurrentTopicId(),

  });

});



// SMS webhook

app.post("/webhook/sms", async (req: Request, res: Response) => {

  const from = req.body.from || req.body.From;

  const text = req.body.text || req.body.Body;



  if (!from || !text) {

    res.status(400).json({ error: "Missing 'from' or 'text'" });

    return;

  }



  console.log(`\n📩 SMS received from ${from}: ${text}`);



  // Process asynchronously

  orchestrator.handleSms(from, text).catch((err) => {

    console.error("Orchestrator error:", err);

  });



  res.status(200).json({ status: "received" });

});



// Proof API - get all events for a ref

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
