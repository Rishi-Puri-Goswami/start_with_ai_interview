// // basic  routes for owner
// import express from "express";
// import { LoginOwner, RegisterOwner, CreateCompany, getProfile, CreateRecruiter, CreateInterview, getInterviews } from "../controler/owner.controller.js";
// import { ownerTokenAuth } from "../middleware/ownerTokenAuth.middleware.js";

// const router = express.Router();

// // POST /api/owners/register
// router.post("/owner/register", RegisterOwner);
// router.post("/owner/login", LoginOwner);
// //owner/profile
// router.get("/owner/profile", ownerTokenAuth, getProfile);


// // router.post("/owner/create/company", ownerTokenAuth, CreateCompany);

// router.post("/owner/add/company", ownerTokenAuth, CreateCompany);
// router.post("/owner/add/recruiter", ownerTokenAuth, CreateRecruiter);


// router.post("/owner/create/interview", ownerTokenAuth, CreateInterview);

// // owner/interviews
// router.get("/owner/interviews", ownerTokenAuth, getInterviews);

// export default router;


