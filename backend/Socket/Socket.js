import { Server } from 'socket.io';
import cookie from 'cookie';
import jwt from 'jsonwebtoken';
import { Interview } from '../model/intreview.js';
import { client } from '../redis/redis.js';
import { IntreviewResult } from '../model/intreviewResult.js';
import mongoose from 'mongoose';
import {Candidate} from '../model/usermodel.js';




export function initSocket(server, opts = {}) {
  const JWT_SECRET = process.env.JWT_SERECT_KEY;
  console.log('🔑 JWT_SECRET loaded:', JWT_SECRET ? 'Yes' : 'No');
  const io = new Server(server, {
    cors: {
      origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:5174" , "https://start-with-ai-interview.vercel.app"], 
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


      // console.log( savedDetails);


      const aiText = await getAiResponse(history, resumetext, savedDetails);
      

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



