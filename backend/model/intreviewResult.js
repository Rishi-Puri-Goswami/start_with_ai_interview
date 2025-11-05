import mongoose, { Schema } from "mongoose";

const IntreviewSchema = new Schema({

    userid :{
        type : mongoose.Schema.Types.ObjectId,
        ref : "User"
    },

    
//     jobid : {
//       type : mongoose.Schema.Types.ObjectId,
//       ref : "Manager"
//     }
// ,


     resumeText: {
    type: String,
    required: true,
  },

  
  transcript : [
    {
      role: {
        type: String,
        enum: ['ai', 'user'],
      },
      content: String,
    },
  ],


    feedback: {
    overall_analysis: String,
    notable_strengths: [String],
    areas_for_improvement: [String],
    overall_mark: Number,
    marks_cutdown_points : [String] ,
    final_tip: String,

  },


  
  videoUrl: {
    type: String, 
  },


  iscompleted : {
    type : Boolean,
    default : false
  }


},{timestamps : true});


export const IntreviewResult = mongoose.model("IntreviewResult" , IntreviewSchema);



