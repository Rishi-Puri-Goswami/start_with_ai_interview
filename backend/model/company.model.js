/**
 * company name
 * some company details like [{location, website, size, industry}]
 * owner
 * recruiters [{each recruiters _id form recruiter collection}]
 * interviews [{each interview _id form interview collection}]
 * 
 */

import mongoose from "mongoose";
const companySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    details: [{
        location: {
            type: String,
            required: true
        },
        website: {
            type: String,
            required: true
        },
        size: {
            type: String,
            required: true
        },
        industry: {
            type: String,
            required: true
        }
    }],
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Owner",
        required: true
    },
    recruiters: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Recruiter"
    }],
    interviews: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Interview"
    }]
}, { timestamps: true });

const Company = mongoose.model("Company", companySchema);

export default Company;


// name, details [location, website, size, industry], owner, recruiters