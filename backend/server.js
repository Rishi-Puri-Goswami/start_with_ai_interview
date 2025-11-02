import dotenv from "dotenv";
dotenv.config();
import app from "./app.js";
import initSocketServer from "./Socket/Socket.js"
import http from "http";
import dbconnect from "./db/db.connect.js";
import {connect} from "./redis/redis.js";


const httpServer = http.createServer(app);

initSocketServer(httpServer);



connect().then(()=>{


console.log("connected to redis" , process.env.REDIS_URL || 'redis://127.0.0.1:6379');



}).catch((error)=>{
    console.log("error on connect to redis" , error)
});



dbconnect().then( ()=>{

app.on( "error" , (error)=>{
    console.log("error on talk to data base" , error)
})


const PORT = process.env.PORT || 8001;

httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})


}





).catch((error)=>{
    console.log("error on connect data base on app.js file ::>" , error);
})



