import express from "express";
import dotenv from "dotenv";
import cookieparser from "cookie-parser"
import cors from "cors";
import userrouter from "./route/route.js";
import deepgramTTSRouter from "./route/deepgramTTS.js";
// import UserRoute from "./Route/userRoute.js";
// import ownerRoutes from "../backend/route/owner.routes.js"


const app = express();
app.use(express.json({ limit: '50mb' })); // Increase payload limit for audio files
app.use(express.urlencoded({ limit: '50mb', extended: true })); // For form data
app.use(cookieparser());
app.use(cors({
    origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000", "http://127.0.0.1:5173" , "https://start-with-ai-interview.vercel.app"], // Specific origins when using credentials
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin", "Cookie"],
    optionsSuccessStatus: 200 // Some legacy browsers choke on 204
}))

dotenv.config({
    path : "../.env"
})

// Handle preflight requests for all routes including Socket.IO
app.use((req, res, next) => {
    const allowedOrigins = ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000", "http://127.0.0.1:5173" , "https://start-with-ai-interview.vercel.app"];
    const origin = req.headers.origin;
    
    // Only set origin header if it's in our allowed list
    if (allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
    }
    
    // Handle Socket.IO specific routes
    if (req.url.startsWith('/socket.io/')) {
        res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cookie');
        res.header('Access-Control-Allow-Credentials', 'true');
        if (req.method === 'OPTIONS') {
            return res.sendStatus(200);
        }
    }
    
    if (req.method === 'OPTIONS') {
        res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cookie');
        res.header('Access-Control-Allow-Credentials', 'true');
        return res.sendStatus(200);
    }
    next();
});


app.use("/api/user", userrouter); // Match the frontend API calls
app.use("/api/deepgram-tts", deepgramTTSRouter); // Deepgram TTS API routes
// app.use('/api', ownerRoutes );

// http://localhost:8001/api/owner/login

app.get("/", (req, res) => {
    res.send("hello from ai");
})

export default app ;




