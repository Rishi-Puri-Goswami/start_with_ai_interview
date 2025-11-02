import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
// const pdfParse = require('pdf-parse');
import { Candidate } from "../model/usermodel.js";
import jwt from "jsonwebtoken";
import { client } from "../redis/redis.js";
import { IntreviewResult } from "../model/intreviewResult.js";
import { getResumeAnalysis } from '../aiservice/aiservice.js';
import { Interview } from '../model/intreview.js';


const loginusergoogle = async (req, res) => {
    try {
        const { email, name, photourl, isverify } = req.body;
        if (!email || !name || !photourl || !isverify) {
            return res.status(404).json({ message: "all field are required " });
        }

        

        const { id } = req.params;
        if (!id) {
            return res.status(404).json({ message: "interview id is required", status: 400 });
        }

        console.log("email", email);
        console.log("interview id", id);
        // console.log("find_candidate", find_candidate);

        const find_candidate = await Candidate.findOne({ email , interview: id });
        console.log("find_candidate", find_candidate);

        if (!find_candidate) {
            return res.status(403).json({ message: "you are not authorized for this interview", status: 403 });
        }



        const finddetailsofintreview = await Interview.findById(id);


        if (!finddetailsofintreview) {
            return res.status(404).json({ message: "interview not found", status: 404 });
        }

        
        // if (!finddetailsofintreview.useremail.includes(email)) {
        //     return res.status(403).json({ message: "you are not authorized for this interview", status: 403 });
        // }



        // check the user is valid or not 



        

        const createintreview = await IntreviewResult.create({
            userid : find_candidate._id,
            resumeText: find_candidate.resumeSummary || "",
        });





        if (!createintreview) {
            return res.status(400).json({ message: "error on create intreview" });
        }




        const key = `interview:${find_candidate._id}`;

        await client.set(key, JSON.stringify(createintreview.toObject ? createintreview.toObject() : createintreview));




        


        // const finduser = await Candidate.findOne({ email });

        if (find_candidate) {


            if (find_candidate.numberofattempt >= 1) {
                return res.status(403).json({ message: "you have exceeded the number of attempts", status: 403 });
            }


            find_candidate.numberofattempt += 1;

            find_candidate.save();
            const token = jwt.sign({ _id: find_candidate._id }, process.env.JWT_SERECT_KEY, { expiresIn: '1d' })


            if (!token) {
                return res.status(400).json({ message: "error on generate token" })
            }

            res.cookie("usertoken", token, {
                httpOnly: true,
                maxAge: 1 * 24 * 60 * 60 * 1000,
                sameSite: "none",
                secure: true
            });

            return res.status(200).json({ message: "login successfull", status: 200, token , finddetailsofintreview })
            

        }






        // else {

        //     const create = await Candidate.create({

        //         name,
        //         email,
        //         photourl,
        //         isverify,
        //         numberofattempt: 1

        //     })


        //     if (!create) {
        //         return res.json({ message: "error in create user" });
        //     }






        //     const token = jwt.sign({ _id: create._id }, process.env.JWT_SERECT_KEY, { expiresIn: '1d' })


        //     if (!token) {
        //         return res.status(400).json({ message: "error on generate token" })
        //     }


        //     res.cookie("usertoken", token, {
        //         httpOnly: true,
        //         maxAge: 1 * 24 * 60 * 60 * 1000,
        //         sameSite: "none",
        //         secure: true
        //     });





        //     return res.status(200).json({ message: "user successfull login", token, status: 200 });
        // }

    } catch (error) {
        console.log("error on loging user", error);
    }


}








const extractstext = async (req, res) => {

    try {
        console.log('📄 Starting PDF extraction...');

        const userid = req.user._id;
        // Prefer uploaded file via multer; fallback to base64 string in body
        const fileBuffer = req.file?.buffer;
        const resumeBase64 = req.body?.resume;

        console.log('📄 File buffer length:', fileBuffer?.length);
        console.log('📄 Base64 length:', resumeBase64?.length);

        if (!fileBuffer && !resumeBase64) {
            return res.status(400).json({ message: "resume file is required (multipart file or base64 string)" });
        }

        const pdfBuffer = fileBuffer || Buffer.from(resumeBase64, 'base64');
        console.log('📄 About to parse PDF buffer of size:', pdfBuffer.length);
        // Use PDFParse class for pdf-parse v2+
        const parser = new pdfParse.PDFParse({ data: pdfBuffer });
        const result = await parser.getText();
        const text = result.text;
        await parser.destroy();
        console.log("extracted text", text);

        const aianalysis = await getResumeAnalysis(text);

        console.log("AI analysis result", aianalysis);

        if (!aianalysis) {
            return res.status(500).json({ message: "error in ai analysis" });
        }



        const createintreview = await Intreview.create({
            userid,
            resumeText: aianalysis
        });




        if (!createintreview) {
            return res.status(400).json({ message: "error on create intreview" });
        }




        const key = `interview:${userid}`;

        await client.set(key, JSON.stringify(createintreview.toObject ? createintreview.toObject() : createintreview));


        await client.get(key).then((data) => {
            if (data) {
                console.log("data from redis", JSON.parse(data));
            }
        });




        return res.status(200).json({
            message: "text extracted successfully",
            status: 200,
            interviewId: createintreview._id,
            aiAnalysis: aianalysis
        });




    } catch (error) {
        console.log("error on extract text from pdf", error);
    }




}

// Check if user has uploaded resume for specific interview
const checkResumeStatus = async (req, res) => {
    try {
        const userid = req.user._id;
        const { interviewId } = req.params;

        console.log('📋 Checking resume status for user:', userid, 'interview:', interviewId);

        // Check Redis first
        const key = `interview:${userid}`;
        const redisData = await client.get(key);

        if (redisData) {
            const interviewData = JSON.parse(redisData);
            return res.status(200).json({
                message: "Resume found in session",
                status: 200,
                hasResume: true,
                canStartInterview: true,
                interviewData: {
                    id: interviewData._id,
                    resumeText: interviewData.resumeText ? 'Present' : 'Missing'
                }
            });
        }

        // Check if interview exists in database
        const interview = await Intreview.findOne({
            userid,
            _id: interviewId
        });

        if (!interview) {
            return res.status(404).json({
                message: "Interview not found",
                status: 404,
                hasResume: false,
                canStartInterview: false
            });
        }

        // Check if interview has resume text
        if (!interview.resumeText) {
            return res.status(200).json({
                message: "Resume not uploaded for this interview",
                status: 200,
                hasResume: false,
                canStartInterview: false
            });
        }

        // Resume exists, restore to Redis for session continuation
        await client.set(key, JSON.stringify(interview.toObject ? interview.toObject() : interview));

        return res.status(200).json({
            message: "Resume found and session restored",
            status: 200,
            hasResume: true,
            canStartInterview: true,
            interviewData: {
                id: interview._id,
                resumeText: 'Present',
                isCompleted: interview.iscompleted
            }
        });

    } catch (error) {
        console.error("Error checking resume status:", error);
        return res.status(500).json({
            message: "Error checking resume status",
            status: 500,
            hasResume: false,
            canStartInterview: false
        });
    }
};

export { loginusergoogle, extractstext, checkResumeStatus };


