// server.js
import dotenv from "dotenv";
import ImageKit from "imagekit";

dotenv.config();


console.log("ImageKit keys:", 
  process.env.IMAGEKIT_PUBLIC_KEY ,
  process.env.IMAGEKIT_PRIVATE_KEY ,
 process.env.IMAGEKIT_URL_ENDPOINT 
);

 const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// Generate auth signature for frontend

export const imageendpoint = ( req , res  ) =>{

    const result = imagekit.getAuthenticationParameters();
    res.json({
      ...result,
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY ,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
    });

}


