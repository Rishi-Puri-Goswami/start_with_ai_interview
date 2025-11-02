
import mongoose from "mongoose";
const recruiterSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    phone: {
        type: String,
        required: true
    },
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Company",
        required: true
    },
    position: {
        type: String,
        required: true
    }
}, { timestamps: true });

const Recruiter = mongoose.model("Recruiter", recruiterSchema);

export default Recruiter;



// name, email, phone, company, position





/**
 * company
 * owner
 * 
 * recrutiors {}
 * 
 * interview
 * 
 * 
 */
