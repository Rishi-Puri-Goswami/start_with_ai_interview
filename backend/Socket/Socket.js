import { Server } from 'socket.io';
import cookie from 'cookie';``
import jwt from 'jsonwebtoken';
import WebSocket from 'ws';
import { Interview } from '../model/intreview.js';
import { client } from '../redis/redis.js';
import { IntreviewResult } from '../model/intreviewResult.js';
import mongoose from 'mongoose';
import {Candidate} from '../model/usermodel.js';
import { json } from 'express';


export function initSocket(server, opts = {}) {
  const JWT_SECRET = process.env.JWT_SERECT_KEY;
  console.log('🔑 JWT_SECRET loaded:', JWT_SECRET ? 'Yes' : 'No');
  const io = new Server(server, {
    cors: {
      origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:5174" , "https://start-with-ai-interview.vercel.app" , "https://interview.startwith.live"], 
      methods: ['GET', 'POST'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cookie']
    },
    allowEIO3: true, 
    ...opts,
  });


  io.use(async (socket , next) => {
    try {
      const { headers } = socket.request;
      let token;

      console.log('🔍 Socket auth debug - Headers cookie:', headers?.cookie);
      console.log('🔍 Socket auth debug - Handshake auth:', socket.handshake?.auth);

      // First try cookies
      if (headers && headers.cookie) {
        const parsed = cookie.parse(headers.cookie || '');
        token = parsed.usertoken;
        console.log('🍪 Token from cookie:', token ? 'Found' : 'Not found');
      }



      // Fallback to handshake auth (for browser ws usage)
      if (!token && socket.handshake && socket.handshake.auth) {
        token = socket.handshake.auth.token || socket.handshake.auth.usertoken;
        console.log('🤝 Token from handshake:', token ? 'Found' : 'Not found');
      }


console.log(token);


      // Allow connection without token for initial setup, but mark as unauthenticated
      if (!token) {
        console.log('❌ Socket connecting without token - will require authentication for operations');
        socket.user = null;
        return next();
      }

      try {
        console.log('🔐 Attempting to verify token...');
        const payload = jwt.verify(token, JWT_SECRET);

        console.log(payload);


        console.log('✅ Token verified, payload:', { _id: payload._id });
        
        // Lazy import of user model to avoid ESM/CJS import mismatch in other files
        const { Candidate } = await import('../model/usermodel.js');
        
        // console.log('🔍 Searching for user with ID:', payload._id);
        // console.log('🔍 ID type:', typeof payload._id);
        // console.log('🔍 ID value:', payload._id);
        
        const user = await Candidate.findById(payload._id);
        console.log("🔍 Database query result:", user);
        // console.log("🔍 Candidate found?", !!user);
        
        if (!user) {
          console.log('❌ Token provided but user not found in database');
          // console.log('🔍 Let\'s try to find any users in the database...');
          const allCandidates = await Candidate.find({}).limit(5).select('_id email name');
          // console.log('🔍 Sample users in database:', allCandidates);
          socket.user = null;
        } else {
          console.log('✅ Candidate found and authenticated:', user._id);
          socket.user = user;
        }
        



        console.log(socket.user ? `✅ Socket authenticated as user ${socket.user._id}` : '❌ Socket authentication failed - no user');



        next();

      } catch (tokenError) {
        console.log('❌ Invalid token provided:', tokenError.message);
        socket.user = null;
        next();
      }

    } catch (err) {
      console.error('Socket auth middleware error', err.message || err);
      socket.user = null;
      next();
    }
  });


  



  io.on('connection', (socket) => {
    console.log('✅ Socket connected:', socket.id, 'Candidate:', socket.user?._id , socket.user?.email);
    console.log('🚀 Transport type:', socket.conn.transport.name);



    if (socket.user && socket.user._id) {
      socket.join(String(socket.user._id));
    }







    // ---------- Sarvam realtime STT integration ----------
let sarvamWS = null;
let sarvamAccumulatedTranscript = ''; // accumulate confirmed/returned text
let sarvamSessionOpen = false;
let sarvamFlushPending = false;
let sarvamCloseTimeout = null;

const SARVAM_KEY = "sk_2udpa4kp_LHM7SG4tvNt8BN1lUxxrX0Cd";
if (!SARVAM_KEY) {
  console.warn('⚠️ SARVAM_API_KEY not set in environment. Set process.env.SARVAM_API_KEY');
}

// Helper to safe-emit back to socket
function emitToClient(event, payload) {
  try {
    socket.emit(event, payload);
  } catch (e) {
    console.warn('emitToClient failed', e);
  }
}

// Start a new Sarvam STT session for this socket
socket.on('start-sarvam-stt', (opts = {}) => {
  // if already opened, ignore / reuse existing
  if (sarvamWS && sarvamWS.readyState === WebSocket.OPEN) {
    console.log('Sarvam WS already open for this socket');
    return;
  }

  // Build query params per Sarvam asyncAPI
  const languageCode = (opts.languageCode || 'en-IN');
  const model = (opts.model || 'saarika:v2.5');
  const input_audio_codec = (opts.input_audio_codec || 'pcm_s16le'); // we send pcm_s16le
  const sample_rate = (opts.sample_rate || '16000');
  const vad_signals = (opts.vad_signals === undefined) ? 'false' : String(opts.vad_signals);
  const high_vad_sensitivity = (opts.high_vad_sensitivity === undefined) ? 'false' : String(opts.high_vad_sensitivity);
  const flush_signal = 'true'; // allow flush signal

  const qs = `?language-code=${encodeURIComponent(languageCode)}&model=${encodeURIComponent(model)}&input_audio_codec=${encodeURIComponent(input_audio_codec)}&sample_rate=${encodeURIComponent(sample_rate)}&vad_signals=${encodeURIComponent(vad_signals)}&high_vad_sensitivity=${encodeURIComponent(high_vad_sensitivity)}&flush_signal=${encodeURIComponent(flush_signal)}`;

  const sarvamUrl = `wss://api.sarvam.ai/speech-to-text/ws${qs}`;

  console.log('🌐 Opening Sarvam WS', sarvamUrl);

  // Create new websocket to Sarvam with Api-Subscription-Key header (per doc)
  sarvamWS = new WebSocket(sarvamUrl, {
    headers: {
      'Api-Subscription-Key': SARVAM_KEY
    }
  });

  sarvamAccumulatedTranscript = '';
  sarvamSessionOpen = false;
  sarvamFlushPending = false;

  sarvamWS.on('open', () => {
    console.log('✅ Sarvam STT websocket opened for socket', socket.id);
    sarvamSessionOpen = true;
    emitToClient('sarvam-ready', { ok: true });
  });

  sarvamWS.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (err) {
      // If Sarvam ever sends raw text or binary, just log it
      console.warn('Non-JSON message from Sarvam:', raw.toString());
      return;
    }

    // According to your AsyncAPI: message object has "type" and "data"
    // type: 'data' | 'error' | 'events'
    // data: either transcription data (with transcript) or error or events (START_SPEECH/END_SPEECH)
    const msgType = msg.type;
    const data = msg.data;

    if (!msgType || !data) {
      // If the provider returns a different schema, we try to be robust
      // Try to detect a direct transcript field
      if (msg.transcript) {
        // fallback: emit as interim
        emitToClient('sarvam-transcript-interim', { text: msg.transcript });
      }
      return;
    }

    if (msgType === 'error') {
      console.error('Sarvam error:', data);
      emitToClient('sarvam-error', data);
      return;
    }

    if (msgType === 'events') {
      // events have event_type, timestamp, signal_type, occured_at
      // signal_type could be START_SPEECH or END_SPEECH
      emitToClient('sarvam-event', data);

      if (data.signal_type === 'END_SPEECH') {
        // When Sarvam signals END_SPEECH, treat accumulated transcript as final for this segment
        const finalText = sarvamAccumulatedTranscript.trim();
        if (finalText) {
          emitToClient('sarvam-transcript-final', { text: finalText });
        }
        // Reset accumulation for next speech
        sarvamAccumulatedTranscript = '';
        // If we previously sent a flush and are waiting to close, close now
        if (sarvamFlushPending) {
          try {
            sarvamWS.close();
          } catch {}
        }
      }

      return;
    }

    if (msgType === 'data') {
      // Data should be a transcription object (SpeechToTextTranscriptionData)
      // it contains request_id, transcript, metrics, maybe timestamps/diarized_transcript
      // Append transcript to accumulator and emit interim
      const transcriptText = (data && data.transcript) ? String(data.transcript).trim() : '';
      if (transcriptText) {
        // append with space to maintain readability
        sarvamAccumulatedTranscript = (sarvamAccumulatedTranscript + ' ' + transcriptText).trim();

        // Emit interim so UI can show streaming text
        emitToClient('sarvam-transcript-interim', {
          text: transcriptText,
          request_id: data.request_id || null,
          metrics: data.metrics || null
        });
      } else {
        // Might be other data shape; pass upstream
        emitToClient('sarvam-data', data);
      }
      return;
    }

    // Unknown type, pass upstream
    emitToClient('sarvam-raw', msg);
  });

  sarvamWS.on('close', (code, reason) => {
    console.log('⛔ Sarvam WS closed', code, reason && reason.toString());
    sarvamSessionOpen = false;
    // When server closes, try to emit any remaining accumulated transcript as final
    const finalText = sarvamAccumulatedTranscript.trim();
    if (finalText) {
      emitToClient('sarvam-transcript-final', { text: finalText });
      sarvamAccumulatedTranscript = '';
    }
    emitToClient('sarvam-closed', { code, reason: reason && reason.toString() });
    // cleanup
    if (sarvamCloseTimeout) {
      clearTimeout(sarvamCloseTimeout);
      sarvamCloseTimeout = null;
    }
  });

  sarvamWS.on('error', (err) => {
    console.error('Sarvam WS error:', err && (err.message || err));
    emitToClient('sarvam-error', { error: err && err.message ? err.message : String(err) });
  });
});

// Receive audio chunk from frontend and forward to Sarvam
socket.on('audio-chunk', (chunk) => {
  // chunk can be Buffer, Uint8Array or ArrayBuffer or object depending on client
  if (!sarvamWS || sarvamWS.readyState !== WebSocket.OPEN) {
    console.warn('audio-chunk received but sarvamWS not open');
    return;
  }

  // Normalize to Buffer
  let buf;
  try {
    if (Buffer.isBuffer(chunk)) buf = chunk;
    else if (chunk instanceof ArrayBuffer) buf = Buffer.from(chunk);
    else if (ArrayBuffer.isView(chunk)) buf = Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    else if (typeof chunk === 'object' && chunk.data) {
      // sometimes socket.io wraps binary in { data: ... }
      const incoming = chunk.data;
      if (Buffer.isBuffer(incoming)) buf = incoming;
      else if (incoming instanceof ArrayBuffer) buf = Buffer.from(incoming);
      else if (ArrayBuffer.isView(incoming)) buf = Buffer.from(incoming.buffer, incoming.byteOffset, incoming.byteLength);
      else buf = Buffer.from(incoming);
    } else {
      // fallback: try Buffer.from
      buf = Buffer.from(chunk);
    }
  } catch (err) {
    console.error('Failed to normalize audio chunk to Buffer', err);
    return;
  }

  // Convert to base64 (Sarvam expects base64 inside JSON audio.data)
  const base64 = buf.toString('base64');

  // Build the audio message per Sarvam AsyncAPI schema
  const audioMessage = {
    audio: {
      data: base64,
      sample_rate: '16000',
      encoding: 'audio/wav',         // keeping audio/wav per schema; Sarvam accepts pcm_s16le as input_audio_codec
      input_audio_codec: 'pcm_s16le' // we send raw PCM signed 16-bit little-endian
    }
  };

  try {
    sarvamWS.send(JSON.stringify(audioMessage));
  } catch (err) {
    console.error('Failed to send audio chunk to Sarvam WS', err);
  }
});

// Stop / flush the Sarvam session and request final transcript
socket.on('stop-sarvam-stt', () => {
  if (!sarvamWS || sarvamWS.readyState !== WebSocket.OPEN) {
    console.log('stop-sarvam-stt but sarvamWS not open');
    // still emit final if any accumulated
    const finalText = (sarvamAccumulatedTranscript || '').trim();
    if (finalText) emitToClient('sarvam-transcript-final', { text: finalText });
    sarvamAccumulatedTranscript = '';
    return;
  }

  // Send flush signal as described in the AsyncAPI (type: 'flush')
  try {
    sarvamFlushPending = true;
    sarvamWS.send(JSON.stringify({ type: 'flush' }));
    // After sending flush, give Sarvam a short window (e.g. 3s) to respond with final events/data
    if (sarvamCloseTimeout) clearTimeout(sarvamCloseTimeout);
    sarvamCloseTimeout = setTimeout(() => {
      try {
        if (sarvamWS && sarvamWS.readyState === WebSocket.OPEN) {
          sarvamWS.close();
        }
      } catch {}
    }, 3000); // adjust if you want to wait longer
  } catch (err) {
    console.error('Failed to send flush to Sarvam WS', err);
    // fallback: close connection
    try { sarvamWS.close(); } catch {}
  }
});

// Cleanup on disconnect
socket.on('disconnect', () => {
  if (sarvamWS && sarvamWS.readyState === WebSocket.OPEN) {
    try { sarvamWS.close(); } catch (e) {}
  }
  if (sarvamCloseTimeout) {
    clearTimeout(sarvamCloseTimeout);
    sarvamCloseTimeout = null;
  }
});







  socket.on("user-message", async (data) => {

    try {
    
      const userid = socket.user?._id;
      const useremail = socket.user?.email;

      console.log(userid, useremail);
      if(!userid || !useremail){
        console.log("❌ Candidate not authenticated for user-message event");
        return socket.emit("error", { message: "Candidate not authenticated. Please log in first." });
      }



console.log("📩 Candidate message received:", { data});

    const { sessionId, messageContent } = data;


console.log("📩 Candidate message received:", { sessionId , messageContent });

    if (!messageContent || !messageContent.trim()) {
      return socket.emit("error", { message: "No message content provided." });
    }



      if (!userid) {
        console.log("❌ Candidate not authenticated for user-message event");
        return socket.emit("error", { message: "Candidate not authenticated. Please log in first." });
      }

      console.log("✅ Processing message from authenticated user:", userid.toString());

      if (!sessionId) {
        return socket.emit("error", "sessionId not found");
      }

      const key = `interview:${userid}`;

      console.log("Redis key for interview data:", key);

      const userintreview = await client.get(key);


      if (!userintreview) {
        return socket.emit("error", "Candidate interview not found. Please upload your resume first.");
      }


      const interviewData = JSON.parse(userintreview);
      const resumetext = interviewData.resumeText || interviewData.resume || '';



      if (!resumetext) {
        return socket.emit("error", "Resume text not found");
      }



      // Initialize or get existing transcript
      interviewData.transcript = interviewData.transcript || [];
      interviewData.transcript.push({ role: 'user', content: messageContent });

   
      // Try to get saved interview details from Redis or create default
      const detailsKey = `interviewdetails:${sessionId}:${userid}`;


      let savedDetails = await client.get(detailsKey);


      // If cached in Redis, parse JSON into an object
      if (savedDetails) {
        try {
          savedDetails = JSON.parse(savedDetails);
        } catch (parseErr) {
          console.warn('Saved details from Redis could not be parsed, will re-fetch from DB', parseErr.message || parseErr);
          savedDetails = null;
        }
      }

      if (!savedDetails) {

        savedDetails = await Interview.findById(sessionId);
        if (!savedDetails) {
          return socket.emit("error", "Interview details not found");
        }


        await client.set(detailsKey, JSON.stringify(savedDetails.toObject ? savedDetails.toObject() : savedDetails));
      }




      // Build AI history: system + transcript messages
      const history = [];

      for (const turn of interviewData.transcript) {
        const role = turn.role === 'user' ? 'user' : 'model';
        history.push({ role, parts: [{ text: turn.content }] });
      }

      // Call AI
      const { getAiResponse } = await import('../aiservice/aiservice.js');

      console.log("history  ", history);
      console.log("resumetext", resumetext);
      console.log("interviewDetails  skdnnsdnsndosndosdosnd sodnosdosdoooans0ajkaoad ", savedDetails);

let key2 = `interviewtime:${sessionId}:${userid}`;

// Always await Redis get
let time = await client.get(key2);

if (!time) {
  const duration = parseInt(savedDetails.duration || "10");

  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + duration * 60000);

  const formattedStartTime = startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formattedEndTime = endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const timeObj = {
    startTime: formattedStartTime,
    endTime: formattedEndTime
  };

  await client.set(key2, JSON.stringify(timeObj), "EX", 3600);

  console.log("Interview ends at:", formattedEndTime);
  time = JSON.stringify(timeObj);
}

// Parse it once you have the string
const { startTime, endTime  } = JSON.parse(time);

const currenttime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
console.log("Interview time info: ijijijiji nijijjjjiji iijijijiijijji ", { startTime, endTime, currenttime });



      // console.log( savedDetails);

      const aiText = await getAiResponse(history, resumetext, savedDetails ,  endTime ,  startTime , currenttime);
      

      console.log('AI Response received:', { 
        aiText, 
        type: typeof aiText, 
        length: aiText?.length,
        isString: typeof aiText === 'string',
        isUndefined: aiText === undefined,
        isNull: aiText === null
      });


      interviewData.transcript.push({ role: 'ai', content: aiText });

      await client.set(key, JSON.stringify(interviewData));

      console.log('About to emit ai-response with:', { response: aiText });
      console.log('Socket ID:', socket.id);
      console.log('Candidate ID:', userid);
      
      socket.emit('ai-response', { 
        response: aiText
      });
      
      console.log('✅ AI response emitted successfully to client:', aiText?.substring(0, 100) + '...');

    } catch (err) {
      console.error('socket user-message error', err);
      socket.emit('error', 'Failed to process your message. Please try again.');
    }
  });




  socket.on("end-interview", async (data) => {
    try {
      const userid = socket.user?._id;
      const useremail = socket.user?.email;

      const { sessionId , videoUrl } = data;


      if(!videoUrl || !sessionId){

        console.log("❌ videoUrl or sessionId missing in end-interview event");
        return socket.emit("error", "videoUrl or sessionId missing");
      }

      console.log("from the end interview" , { sessionId , videoUrl });
      

console.log("from the end interview" , { sessionId , videoUrl });

      if (!userid || !useremail) {
        return socket.emit("error", "user not authenticated");
      }

      if (!sessionId) {
        return socket.emit("error", "sessionId not found");
      }

      const key = `interview:${userid}`;

      const userintreview = await client.get(key);
      
      
      if (!userintreview) {
        return socket.emit("error", "Candidate interview not found");
      }

      const interviewData = JSON.parse(userintreview);
      const resumeText = interviewData.resumeText || interviewData.resume || '';
      const transcript = interviewData.transcript || [];
      
      if (transcript.length === 0) {
        return socket.emit("error", "transcript is empty");
      }

      console.log("transcript", transcript);
      console.log("resumeText", resumeText);

      const { generateFinalFeedback } = await import('../aiservice/aiservice.js');
      const feedback = await generateFinalFeedback(resumeText, transcript);

      const intreviewid = interviewData._id;

      if (!intreviewid) {
        return socket.emit("error", "intreviewid not found");
      }

      console.log(" feedback from the ai service ",feedback);
      
      // Update the interview record with final feedback

console.log("updating interview", intreviewid);



      const updated = await IntreviewResult.findByIdAndUpdate(
        intreviewid,
        { 
          feedback, 
          videoUrl: videoUrl, 
          iscompleted: true,
          transcript: transcript // Save transcript to MongoDB
        },
        { new: true }
      );


      console.log("updated interview", updated);


      if (!updated) {
        return socket.emit("error", "Failed to update interview with feedback");
      }



      // Push a new completion record into the details document. Cast intreviewid to ObjectId.
      let updatedDetails = null;
      try {
        const completionObj = {
          email: useremail,
          intreviewid: new mongoose.Types.ObjectId(intreviewid)
        };

        updatedDetails = await Interview.findByIdAndUpdate(
          sessionId,
          { $push: { usercompleteintreviewemailandid: completionObj } },
          { new: true }
        );
        
      } catch (updErr) {
        console.error('end-interview: failed to update InterviewDetails', updErr);
        return socket.emit('error', { message: 'Failed to update interview details' });
      }

      if (!updatedDetails) {
        return socket.emit("error", "Failed to update interview details");
      }


      const user = await Candidate.findByIdAndUpdate(userid , { $inc: { numberofattempt: 1 } }, { new: true } );


      console.log("final feedback", feedback);
      console.log("videoUrl", videoUrl);

      socket.emit("final-feedback", feedback , updatedDetails );

      // Clear interview data from Redis
      await client.del(key);
      const detailsKey = `interviewdetails:${sessionId}:${userid}`;
      await client.del(detailsKey);

    } catch (err) {
      console.error('socket end-interview error', err);
      socket.emit('error', 'Failed to end interview. Please try again.');
    }
  });

  

    socket.on('disconnect', (reason) => {
      console.log('socket disconnected', socket.id, reason);


    });
  });

  return io;
}


export default initSocket;



