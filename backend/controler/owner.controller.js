// import Owner from "../model/owner.model.js";
// import bcrypt from "bcrypt";
// import jwt from "jsonwebtoken";
// import Company from "../model/company.model.js";
// import Recruiter from "../model/recruiter.model.js";
// import Interview from "../model/interview.model.js";
// // import { IntreviewDetails } from "../model/intreviewDetails.js";


// export const RegisterOwner = async (req, res) => {
//     try {
//         const { name, email, phone, password, secretKey } = req.body

//         // console.log(secretKey, process.env.SECRET_KEY_OWNER)
//         if (!secretKey == process.env.SECRET_KEY_OWNER) return res.status(401).json({ message: "secret key not matched" })

//         const newOwnerExists = await Owner.findOne({ email });
//         if (newOwnerExists) {
//             return res.status(400).json({ message: "Owner with this email already exists" });
//         }

//         const hashedPassword = await bcrypt.hash(password, 10);

//         const newowner = new Owner({ name, email, phone, password: hashedPassword, secretKey });
//         await newowner.save();

//         const token = jwt.sign({ id: newowner._id }, process.env.JWT_SERECT_KEY, { expiresIn: '1d' });
//         res.cookie("otoken", token, {
//             httpOnly: true,
//             secure: process.env.NODE_ENV === "production",
//             // use 'lax' in development so cross-site requests from localhost can receive/send the cookie
//             sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
//             maxAge: 24 * 60 * 60 * 1000
//         });

//         res.status(201).json({ message: "Owner created successfully", owner: newowner });
//     } catch (error) {
//         console.log(error)
//         res.status(500).json({ message: "Error creating owner", error });
//     }
// };


// export const LoginOwner = async (req, res) => {
//     try {
//         const { email, password, secretKey } = req.body;

//         // console.log("ok", req.body)
//         if (!secretKey == process.env.SECRET_KEY_OWNER) return res.status(401).json({ message: "secret key not matched" })

//         const owner = await Owner.findOne({ email });
//         if (!owner) {
//             return res.status(400).json({ message: "Owner with this email does not exist" });
//         }

//         const isPasswordValid = await bcrypt.compare(password, owner.password);
//         if (!isPasswordValid) {
//             return res.status(400).json({ message: "Invalid password" });
//         }

//         // console.log(process.env.NODE_ENV)
//         const token = jwt.sign({ id: owner._id }, process.env.JWT_SERECT_KEY, { expiresIn: '1d' });
//         res.cookie("otoken", token, {
//             httpOnly: true,
//             // secure: process.env.NODE_ENV === "production",
//             secure: true,
//             // sameSite: process.env.NODE_ENV === "production" ? "none" : "none",
//             sameSite: 'none',
//             maxAge: 24 * 60 * 60 * 1000
//         });

//         console.log("owner login successful", owner)
//         console.log("owner login token", token)
//         res.status(200).json({ message: "Login successful", owner });
//     } catch (error) {
//         console.log(error)
//         res.status(500).json({ message: "Error logging in", error });
//     }
// }

// export const getProfile = async (req, res) => {
//     try {
//         const ownerid = req.user;

//         const owner = await Owner.findById(ownerid);
//         if (!owner) {
//             return res.status(404).json({ message: "Owner not found" });
//         }

//         const companies = [];
//         if (owner.company && Array.isArray(owner.company)) {
//             for (const companyId of owner.company) {
//                 const company = await Company.findById(companyId);
//                 // console.log("new company", company)

//                 if (company) {
//                     companies.push(company);
//                 }
//             }
//         }
//         owner.company = companies;

//         const recruiters = [];
//         if (owner.recrutier && Array.isArray(owner.recrutier)) {
//             for (const recrutierId of owner.recrutier) {
//                 let recruiterObjectId = recrutierId;
//                 if (typeof recrutierId === 'object' && recrutierId.$oid) {
//                     recruiterObjectId = recrutierId.$oid;
//                 }
//                 const recruiter = await Recruiter.findById(recruiterObjectId);
//                 if (recruiter) {
//                     recruiters.push(recruiter);
//                 }
//             }
//         }
//         owner.recrutier = recruiters;
//         const plainOwner = owner.toObject();
//         plainOwner.recrutier = recruiters;
//         res.status(200).json({ message: "Profile fetched successfully", owner: plainOwner });
//     } catch (error) {
//         console.log(error)
//         res.status(500).json({ message: "get profile error" })
//     }
// }

// export const CreateCompany = async (req, res) => {
//     try {
//         const { name, location, website, size, industry, recruiters } = req.body

//         // console.log('req..user is company owner:-', req.user)

//         console.log(name, location, website, size, industry, recruiters)

//         const company_data = {
//             name,
//             details: [{
//                 location, website, size, industry
//             }],
//             owner: req.user,
//             recruiters,
//             interviews: []
//         }

//         const new_company = new Company(company_data)
//         await new_company.save();

//         const owner = await Owner.findById(req.user);
//         owner.company.push(new_company._id)
//         await owner.save()

//         res.status(201).json({ message: "Company created successfully", data: new_company })
//     } catch (error) {
//         console.log(error)
//         res.status(500).json({ message: "create company error" })
//     }
// }

// export const CreateRecruiter = async (req, res) => {
//     try {
//         const { name, email, phone, company, position } = req.body;


//         console.log("this is req body: ", req.body)
//         const ownerid = req.user;
//         const owner = await Owner.findById(ownerid);
//         if (!owner) {
//             return res.status(404).json({ message: "Owner not found" });
//         }

//         // Check if the company belongs to the owner
//         if (!owner.company.includes(company)) {
//             return res.status(403).json({ message: "You do not have permission to add recruiters to this company" });
//         }


//         // add the recrutier in  the Recrutier schema
//         const new_recrutier_data = {
//             name,
//             email,
//             phone,
//             company,
//             position
//         }
//         const new_recrutier = new Recruiter(new_recrutier_data)
//         await new_recrutier.save()

//         owner.recrutier.push(new_recrutier._id)
//         const company_search = await Company.findById(company)
//         company_search.recruiters.push(new_recrutier._id)
//         await company_search.save()
//         await owner.save()


//         res.status(200).json({ message: "recruiter added successfully", data: new_recrutier_data })
//     } catch (error) {
//         console.log(error)
//         res.status(500).json({ message: "add recruiter error" })
//     }
// }


// export const CreateInterview = async (req, res) => {
//     try {
//         const { company, recruiter, allowedCandidates, expiryDate, questions, jobPosition, jobDescription, duration, minimumQualification, minimumSkillsRequired } = req.body;

//         const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173"
//         // console.log("this is req body: ", req.body);


//         const company_search = await Company.findById(company);
//         if (!company_search) {
//             return res.status(404).json({ message: "Company not found" });
//         }
//         const recruiter_search = await Recruiter.findById(recruiter);
//         if (!recruiter_search) {
//             return res.status(404).json({ message: "Recruiter not found" });
//         }

//         console.log("thsi is allowed candiditted", allowedCandidates)
//         console.log("----------------------------------------------------------")
//         const payload = {
//             company,
//             owner: req.user,
//             recruiter,
//             useremail: allowedCandidates,
//             expiryDate,
//             interviewUrl: null,
//             candidatesJoined: [],
//             jobtitle: jobPosition,
//             description: jobDescription,
//             duration,
//             minimumQualification,
//             questions,
//             minimumSkills: minimumSkillsRequired
//         }

//         // console.log("this is payload: ", payload)

//         const new_interview = new IntreviewDetails(payload);

//         await new_interview.save();
//         // const url = "http://localhost:5000/" + new_interview._id + "/login";
//         const url = `${FRONTEND_URL}${new_interview._id}/login`;
//         console.log("this is url: ", url)

//         new_interview.interviewUrl = url;

//         await new_interview.save();
//         company_search.interviews.push(new_interview._id);
//         await company_search.save();

//         res.status(200).json({ message: "interview created successfully", data: url })
//     } catch (error) {
//         console.log("create interview error", error)
//         res.status(500).json({ message: "create interview error" })
//     }
// }


// export const getInterviews = async (req, res) => {
//     try {
//         const ownerid = req.user;

//         const interviews = await IntreviewDetails.find({ owner: ownerid })
//             .populate('company', 'name') // Populate company field with only the name
//             .populate('recruiter', 'name email phone position') // Populate recruiter field with name and email
//             .exec();

//         res.status(200).json({ message: "Interviews fetched successfully", interviews });
//     } catch (error) {
//         console.log("get interview error", error)
//         res.status(500).json({ message: "get interview error" })
//     }
// }