import mongoose from "mongoose";

const interviewDetailsSchema = new mongoose.Schema({
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Company",
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Owner",
        required: true
    },
    launguage: { type: String, default: "English" },
    // recruiter: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: "Recruiter",
    //     required: true
    // },
    candidateSheetId: { type: String, required: true },
    jobPosition: { type: String, required: true },
    jobDescription: { type: String, required: true },
    duration: { type: String, required: true },
    useremail: {
        type: [String],
        required: true,
    },
    expiryDate: {
        type: Date,
        required: true
    },
    interviewUrl: {
        type: String,
        unique: true
    },
    roleofai: {
        type: String,
        default: "You are a helpful assistant",
    },
    // description: {
    //     type: String,
    //     required: true,
    // },

    usercompleteintreviewemailandid: [{
        email: {
            type: String,
            required: true,
        },
        intreviewid: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Intreview',
            required: true,
        }
    }],

    duration: {
        type: String,
        required: true
    },
    minimumQualification: {
        type: String,
        // required: true
    },
    questions: {
        type: [String],
        default: []
    },
    // jobtitle: {
    //     type: String,
    //     required: true,
    // },
    // level: {
    //   type: String,
    //   required: true,
    // },
    minimumSkills: {
        type: String,
        // required: true
    },
    status: {//separate_resume_urls_and_save
        type: String,
        enum: ["initial", "sheet_data_structure", "sheet_data_extract_json", "separate_resume_urls_and_save", "extract_text_from_resumeurl", "sort_resume_as_job_description", "waiting_for_recruiter", "send_email_to_candidates", "interview_successfully_processed"],
        default: "initial",
    },
    logs: [
        {
            message: String,
            level: { type: String, enum: ["info", "error", "success"], default: "info" },
            timestamp: { type: Date, default: Date.now },
        },
    ],
},
    { timestamps: true }
);

export const Interview = mongoose.model(
    "Interview",
    interviewDetailsSchema
);


