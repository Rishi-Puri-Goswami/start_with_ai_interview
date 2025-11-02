import mongoose, { Schema } from "mongoose";

const userSchema = new Schema({

    // name : {
    //     type : String , 
    //     required : true
    // },

    email: {
        type: String,
        required: true
    },
    // password : {
    //     type : String ,  
    // },
    photourl: {
        type: String,
        default: ""
    },
    isverify: {
        type: Boolean,
        default: false
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Owner",
        required: true,
    },
    numberofattempt: {
        type: Number,
        default: 0
    },

    interview: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Interview",
        required: true,
    },
    resumeUrl: {
        type: String,
        required: true,
        trim: true,
    },
    resumeSummary: {
        type: String,
        default: "",
    },
    isResumeScanned: {
        type: Boolean,
        default: false,
    },
    matchLevel: {
        type: String,
        enum: ["High Match", "Medium Match", "Low Match", "Unqualified", ""],
        default: "",
    },
    matchScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
    },
    dynamicData: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },


},
    {
        timestamps: true,
    });

export const Candidate = mongoose.model("Candidate", userSchema);


