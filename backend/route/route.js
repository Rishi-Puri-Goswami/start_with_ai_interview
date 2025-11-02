import express from "express";
import { upload } from "../middleware/multter.js";
import validuser from "../middleware/auth.js";
import { loginusergoogle, extractstext, checkResumeStatus } from "../controler/userControler.js";
import { imageendpoint } from "../imagekit/imagekit.js";
const userrouter = express.Router();

 userrouter.route("/loginusergoogle/:id").post(loginusergoogle);
 userrouter.route("/extractstext").post(upload.single("resume"), validuser, extractstext); // Match frontend field name
 userrouter.route("/check-resume/:interviewId").get(validuser, checkResumeStatus); // New API for checking resume status
userrouter.route("/imagekit-auth").get( imageendpoint);

export default userrouter;

