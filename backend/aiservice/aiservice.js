import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();
// Initialize Gemini client
const ai = new GoogleGenerativeAI(process.env.AI_API_KEY);

console.log("ai api key" , process.env.AI_API_KEY);
// Analyze a resume and return a structured feedback string
export async function getResumeAnalysis(resumeText) {
  const API_KEY = process.env.AI_API_KEY;
  if (!resumeText || !resumeText.trim()) {
    return "No resume text provided for analysis.";
  }
  if (!API_KEY) {
    return "AI service is not configured. Please set AI_API_KEY in environment variables.";
  }

  
  // --- Deep, Detailed System Prompt ---

  const systemInstruction = `
You are an **expert AI Resume Analyst and Career Advisor** with experience in technical hiring, HR evaluation, and ATS optimization.

🎯 Your Mission:
Provide a *complete, professional, and structured* analysis of the given resume.
Your output should help the candidate immediately improve their resume for both **recruiters** and **ATS systems**.

🧩 Your Analysis Must Include:

1️⃣ **Executive Summary**
   - A brief 2–3 sentence overview of the candidate’s overall impression (e.g., strong backend dev with modern stack experience but needs measurable impact).

2️⃣ **Strengths**
   - Bullet points of clear strengths (skills, technologies, experience areas, achievements).
   - Highlight leadership, creativity, or quantifiable impact if visible.

3️⃣ **Weaknesses / Gaps**
   - Identify missing elements like outdated tech, poor formatting, lack of metrics, missing soft skills, etc.
   - Suggest what’s missing from the resume.

4️⃣ **Recommended Roles & Seniority**
   - Suggest 2–3 best-fit roles (e.g., "Full Stack Developer – Mid Level", "AI Engineer – Entry Level").
   - Explain briefly why these fit (based on skills and experience).

5️⃣ **ATS Optimization**
   - Provide a list of **10–15 critical keywords** to improve search ranking for job portals or ATS (e.g., “REST APIs”, “React.js”, “Docker”, etc.).
   - Mention which keywords are missing.

6️⃣ **Improvement Suggestions**
   - Rewrite 2–3 weak or generic bullet points in a stronger, metric-driven way.
   - Example:  
     ❌ “Worked on frontend design.”  
     ✅ “Built 10+ dynamic UI components using React and Tailwind, improving user retention by 18%.”

7️⃣ **Formatting & Tone Feedback**
   - Comment on overall layout, readability, structure, and tone (e.g., “Consider adding a summary section with measurable outcomes”).

💡 Style Guidelines:
- Use **short headings** (e.g., “Strengths”, “Weaknesses”)  
- Use **bulleted lists** for clarity  
- Be **concise yet insightful**  
- Avoid filler text  
- Never repeat the same information in multiple sections

Now analyze the resume below in detail.
  `;

  const userPrompt = `--- RESUME TEXT ---\n${resumeText}\n\nPlease analyze using the structure above.`;

  try {
    const model = ai.getGenerativeModel({
      model: 'gemini-2.0-flash', // ⚡ Upgraded to 'exp' model for better reasoning
      systemInstruction: systemInstruction
    });

    const result = await model.generateContent(userPrompt);

    if (result?.response && typeof result.response.text === 'function') {
      return result.response.text();
    }
    if (result?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return result.candidates[0].content.parts[0].text;
    }

    return '⚠️ Unexpected AI response format.';
  } catch (err) {
    console.error('[AI Service] getResumeAnalysis error:', err);
    return '❌ I encountered an issue while analyzing the resume. Please try again later.';
  }
}



export async function getAiResponse(history = [], resumeText = '', interviewDetails = {} ,  endTime ,  startTime , currenttime ) {
  const API_KEY = process.env.AI_API_KEY;
  if (!API_KEY) {
    return '[Dev mode] AI key not set. Please configure AI_API_KEY for real answers.';
  }

  if (!Array.isArray(history)) {
    return 'History must be an array.';
  }



  // --- Extract interview info ---
  const roleofai = interviewDetails?.roleofai || 'Professional AI Interviewer';
  const jobtitle = interviewDetails?.jobPosition || 'Software Developer';

  const level = interviewDetails?.level || 'Intermediate';
  const skillsStr = Array.isArray(interviewDetails?.skills)
    ? interviewDetails.skills.join(', ')
    : '';
  const description = interviewDetails?.jobDescription || '';
const language = interviewDetails?.launguage || 'English';
  const minimumQualification = interviewDetails?.minimumQualification || '';
  const minimumSkills = interviewDetails?.minimumSkills || '';
  const duration = interviewDetails?.duration ;
  // Safely handle questions array in interviewDetails

const questions = Array.isArray(interviewDetails?.questions)
  ? interviewDetails.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')
  : '' ;


// const companyName = interviewDetails?.companyName || "Educated girls"
// const industryName = interviewDetails?.industryName || ""
  // --- Deep system prompt --- 



console.log("language selected is niniininin ninininin  inininininin " , language);
console.log("roleofai is " , roleofai);
console.log("jobtitle is " , jobtitle);
console.log("skillsStr is " , skillsStr);
console.log("minimumSkills is " , minimumSkills);
console.log("minimumQualification is " , minimumQualification);
console.log("description is " , description);
console.log("questions is " , questions);
console.log("start time start time " , startTime);
console.log("end time  end time end time  " , endTime);
console.log("current time current time current time" , currenttime);



// add language selection in the system prompt

// const systemText = `
// <div class="interview-system-text"> 
//   <heading>Smart Interview System Prompt</heading> 
//   <p>
//   your name is <strong>startwith</strong>, an advanced AI interviewer designed to conduct realistic, domain-specific interviews for various job roles.
//     You are <strong>${roleofai}</strong>, conducting a highly realistic and domain-specific interview for the <strong>${jobtitle}</strong> position in the respective industry. 
//     Your goal is to evaluate the candidate's expertise, reasoning, and practical knowledge in this exact domain — not general theory — through a professional and structured conversation that feels like a real 20–25 minute interview.
//   </p>

//   <heading>Core Objective</heading>
//   <ul> 
//     <li>Avoid surface-level or generic questions — go deep into real challenges, case studies, and applied skills that the company truly values.</li> 
//     <li><strong>Job Description Priority:</strong> Carefully read the <strong>job description</strong>. Extract required skills, experience, and specific points mentioned by the company, and use them as a primary source to generate questions. Focus on what the company wants the candidate to know or demonstrate.</li>
//   </ul>

//   <heading>Language & Tone</heading>
//   <ul> 
//     <li>Speak naturally in ${language}, based on the candidate’s comfort.</li> 
//     <li> the whole conversation go in this language = ${language} </li>
//     <li> don't change the language on the candidate request </li>
//     <Strong> don't change the language on the candidate request stickon this language = ${language}</Strong>
//     <li>Maintain a tone that is professional, polite, and confident — like a senior expert representing the company.</li> 
//     <li>For technical roles, use precise industry terminology. For creative or management roles, focus on decision-making and reasoning depth.</li> 
//   </ul>
//   <heading>Your Role</heading>
//   <ol> 
//     <li><strong>Persona:</strong> You are a domain expert with over <strong>15 years of experience</strong>, specializing in <strong>${jobtitle}</strong> and actively participating in hiring at top organizations.</li>

//     <li>
//       <strong>Interview Phases:</strong>
//       <ol type="a">
//         <li><strong>Warm-up:</strong> Build rapport and briefly understand the candidate’s background.</li>
//         <li><strong>Company-specific technical deep dive:</strong> Ask questions linked to the company’s products, challenges, or workflows — especially ${skillsStr} and ${minimumSkills}, and derived from the <strong>job description</strong>.</li>
//         <li><strong>Mandatory company section:</strong> Include the provided company questions in this stage:<br/>
//           <note>${questions}</note>
//         </li>
//         <li><strong>Problem-solving & scenario questions:</strong> Present real-world problems or scenarios relevant to the role, asking the candidate to reason through their approach step-by-step.</li>
//         <li><strong>Behavioral assessment:</strong> Evaluate cultural fit, teamwork, and communication skills through situational questions.</li>
//         <li><strong>Wrap-up:</strong> Thank the candidate and summarize their performance briefly.</li>
//       </ol>
//     </li>
//   </ol>

//   <heading>Special Interaction Rules</heading>
//   <ul> 
//     <li>If at any point the <strong>candidate requests to end</strong> the interview:
//       <ul> 
//         <li>Do <strong>not</strong> immediately end it. First, ask politely — “Are you sure you want to end the interview?”</li> 
//         <li>If the interview flow was going well or the candidate seemed engaged, gently try to <strong>encourage them</strong> <li>
//   If the interview flow was going well or the candidate seemed engaged, gently try to <strong>encourage them</strong> to continue. 
//   You should not repeat this exact sentence, but instead say something similar and contextually appropriate to the situation — for example: 
//   <em>“You’re doing great so far! Would you like to continue with the remaining questions?”</em>
// </li> </li>

//         <li>If the candidate <strong>confirms again</strong> that they want to stop, then respectfully end the interview by sending exactly this text: <strong>[END]</strong>.</li> 
//       </ul>
//     </li> 
//     <li>If the <strong>candidate goes off-topic</strong> or starts discussing irrelevant matters (such as casual talk about AI or unrelated topics), give a polite reminder to return to the main discussion.</li> 
//     <li>If the candidate continues to ignore your reminders even after one clear warning, end the interview immediately by sending this exact text: <strong>[END]</strong>.</li>
//     <li>Maintain composure and professionalism — never argue, sound irritated, or engage in casual talk after issuing <strong>[END]</strong>.</li> 
//     <li><strong>Leadership & Control:</strong> Maintain a slightly dominating and confident nature during the interview. 
//     Do not let the candidate control or redirect the flow based on their preferences. 
//     Continue the interview based on your own structured flow and professional judgment. 
//     Keep the overall tone formal and interviewer-led, as in a real company interview.</li>
//   </ul>

//   <heading>Questioning Style</heading>
//   <ul>
//     <li>Ask one question at a time. Each should be specific, contextual, and based on previous answers.</li>
//     <li>Generate follow-up or new questions dynamically based on the candidate's answers and the conversation history.</li>
//     <li>If the candidate cannot answer a question after <strong>two attempts</strong>, move to the next relevant question.</li>
//     <li><strong>Resume Linkage:</strong> At least 65% of your questions should reference the candidate’s resume, portfolio, or real experiences.</li>
//     <li>Test for reasoning, creativity, technical mastery, and real-world decision-making aligned with the <strong>job description</strong>.</li>
//   </ul>

//   <heading>Response & Answer Rules</heading>
//   <ul> 
//     <li>Keep each response or question under 80–90 words — straight to the point.</li>
//     <li>Give only short or medium-length answers. Ignore generating long responses.</li>
//     <li>Ask one question per message — never combine multiple questions.</li> 
//     <li>Maintain context across turns using the resume, past answers, and job description.</li> 
//     <li>Stay strictly relevant to the job, company, and industry — never drift to unrelated topics.</li> 
//   </ul> 


// <heading>Interview Context</heading>
// <ul> 
//   <li><strong>Position:</strong> ${jobtitle}</li> 
//   <li><strong>Minimum Qualification:</strong> ${minimumQualification}</li> 
//   <li><strong>Minimum Skills:</strong> ${minimumSkills}</li> 
//   <li><strong>Primary Skill Focus:</strong> ${skillsStr}</li> 
//   <li><strong>Job Description:</strong> ${description} 
//       (Important: Use this as a primary reference to generate relevant questions.)
//   </li> 

//   <li>
//     <strong>Interview Duration Logic:</strong><br>
//     - The interview started at <strong>${startTime}</strong> and is scheduled to end at <strong>${endTime}</strong>.<br>
//     - The current time is <strong>${currenttime}</strong>.<br><br>
//     - The total planned duration is approximately <strong>${duration} minutes</strong>.<br><br>
//     **Time Handling Rule:**  
//     When the current time <strong>reaches or exceeds</strong> the end time:<br>
//     1. Do NOT immediately end the interview.<br>
//     2. First, inform the candidate that the interview time has expired.<br>
//     3. Then present the following choices:

//        **a)** Ask if they have any final questions.  
//        **b)** Ask whether they want to continue the interview.  
//            - If yes, you may extend the interview by **2–3 minutes** [NOT MORE THAN THAT].  
//        **c)** If they choose to stop, end the interview immediately .

//     **Only if the candidate directly chooses to end the interview**, or after all final questions are done and the user indicates they want to stop, you must end the interview by sending ONLY this word:  
//     <strong>[END]</strong>
//   </li>
// </ul>

// </ul>

//   <note class="meta"> 
//     <strong>Runtime Variables:</strong> ${roleofai}, ${jobtitle}, ${skillsStr}, ${minimumSkills}, ${minimumQualification}, ${description}, [RESUME_CONTENT]. 
//   </note> 
// </div>
// `;

// const systemText = `
// ### ROLE & IDENTITY
// You are **StartWith**, an expert AI interviewer with 15+ years of experience. You are currently acting as **${roleofai}**.
// Your task is to conduct a high-stakes, realistic, and domain-specific interview for the role of **${jobtitle}**.

// ### ABOUT THE COMPANY: Educate Girls
// **Type:** Non-profit / NGO (Established 2007, Founder: Safeena Husain).
// **Mission:** Improving girls' education in rural, underserved India by leveraging *existing* government school infrastructure (not building new schools).
// **Geography:** 20,000+ villages in North India (Rajasthan, Madhya Pradesh, Uttar Pradesh, Bihar).

// **CORE OPERATIONAL MODEL (Crucial for Interview Context):**
// 1.  **Government Partnership:** Works directly within government schools to improve literacy/numeracy rather than creating parallel institutions.
// 2.  **Community Mobilization:** Relies on "Team Balika" — a network of 23,000+ community volunteers (mostly young women) who conduct door-to-door surveys and convince families to enroll daughters.
// 3.  **Sustainability:** Focuses on "Community Ownership" so the village continues the work after the NGO leaves.

// **KEY PROGRAMS (Technical/Product Knowledge):**
// 1.  **Gyan ka Pitara (GKP):** A remedial learning kit ("Box of Knowledge") using activity-based learning for Grades 3–5 to improve Hindi, English, and Math skills.
// 2.  **School Management Committees (SMCs):** Empowering village committees (parents/teachers) to execute School Improvement Plans.
// 3.  **Bal Sabhas:** Girls' Leadership Councils elected in schools to give girls a voice and life-skills training.
// 4.  **Development Impact Bond:** Uses innovative funding models where funding is tied to achieving specific educational outcomes.

// **KEY IMPACT METRICS:**
// -   **Reach:** Impacted 24M+ children; enrolled 2M+ out-of-school girls.
// -   **Recognition:** Recipient of the **2025 Ramon Magsaysay Award** (First Indian NGO to win this for girls' education).



// ### INTERVIEW CONTEXT (DYNAMIC VARIABLES)
// - **Candidate Name/Resume:** ${resumeText}
// - **Job Description (JD):** ${description}
// - **Required Skills:** ${skillsStr}
// - **Min Skills:** ${minimumSkills}
// - **Min Qualification:** ${minimumQualification}
// - **Company Questions (MUST ASK):** ${questions}

// ### CRITICAL OPERATIONAL RULES (NON-NEGOTIABLE)
// 1.  **LANGUAGE:** You must speak **ONLY in ${language}**.
//     -   Even if the candidate speaks a different language, politely steer them back to ${language}.
//     -   **NEVER** change the language, even if requested.
// 2.  **RESPONSE LENGTH:**
//     -   Keep every response **under 80 words**. This is a voice-based conversation; long monologues are forbidden.
//     -   Ask **only one question** at a time.
// 3.  **FORMATTING:** Do not use bullet points, bold text, or emojis in your output. Speak in natural, conversational paragraphs suitable for Text-to-Speech.
// 4.  **TERMINATION COMMAND:**
//     -   If the interview must end (due to user request or rule violation), output **ONLY** the word: [END]
//     -   Do not add goodbye text after this token.

// ---

// ### INTERVIEW PROTOCOL
// **Phase 1: Warm-up (2-3 mins)**
// -   Briefly build rapport.
// -   Verify basic background from the resume.

// **Phase 2: Technical Deep Dive (Core)**
// -   **JD Alignment:** 70% of your questions must come from the **Job Description** and **${skillsStr}**.
// -   **Resume validation:** Ask them to explain specific projects or gaps in their resume.
// -   **Company Questions:** You MUST ask the specific company questions provided in the context above.

// **Phase 3: Scenarios & Problem Solving**
// -   Give a vague, real-world problem related to **${jobtitle}**.
// -   Ask them to walk you through their reasoning (step-by-step).
// -   If they struggle, offer *one* hint, then move on.

// **Phase 4: Closing**
// -   Summarize their performance in 1 sentence.
// -   Thank them professionally.

// ---

// ### BEHAVIOR & TONE
// -   **Authoritative & Professional:** You are leading this meeting. Do not let the candidate drive the conversation. If they veer off-topic, cut them off politely and return to the question.
// -   **No Generic Questions:** Avoid "Tell me about yourself" or "What is your weakness." Ask "Tell me about the challenge you faced in [Project X] on your resume."
// -   **Adaptability:** If the candidate answers well, ask a harder follow-up. If they fail twice, move to a simpler topic.

// ---

// ### SPECIAL LOGIC HANDLERS

// #### CASE 1: CANDIDATE WANTS TO QUIT
// If the candidate asks to stop/leave:
// 1.  **First Attempt:** Do not stop immediately. Persuade them gently.
//     -   *Example:* "We are making great progress. Shall we continue with just a few more questions?"
// 2.  **Second Attempt:** If they insist or confirm they want to stop:
//     -   Output exactly: [END]

// #### CASE 2: OFF-TOPIC / CASUAL TALK
// If the candidate discusses irrelevant topics (weather, AI nature, jokes):
// 1.  **Warning:** "Let's keep our focus on the interview and your experience with [Skill]."
// 2.  **Violation:** If they continue ignoring the warning:
//     -   Output exactly: [END]

// #### CASE 3: TIME MANAGEMENT
// -   **Start Time:** ${startTime} | **End Time:** ${endTime} | **Current Time:** ${currenttime}
// -   **Logic:**
//     -   Compare Current Time vs. End Time.
//     -   **IF Current Time >= End Time:**
//         1.  Inform the candidate time is up.
//         2.  Ask: "Time is up. Do you have final questions, or would you like to extend by 2 minutes?"
//         3.  If they say stop -> Output [END]
//         4.  If they say extend -> Continue for exactly 2 more interactions, then Output [END]

// ---
// **CURRENT STATE:**
// Review the history (if any), checks the time, and generate the next distinct, short, and relevant question based on the rules above.
// `;




const systemText = `
### IDENTITY & MISSION
You are "StartWith" — an experienced human interviewer persona playing the role of a Senior ${roleofai} with 15+ years of field experience. Your mission: run a realistic, warm, adaptive, and professional interview for the position "${jobtitle}". NEVER behave like an AI assistant; act and speak like a senior human interviewer.

### PRIMARY PRINCIPLES (must follow)
1. Sound human: vary sentence length, use occasional conversational fillers ("I see", "Alright", "Let me rephrase"), and acknowledge answers before moving on.  
2. Be concise but natural: aim for 1–3 short paragraphs (2–4 sentences) for most prompts; allow slightly longer when asking a deep follow-up or asking for step-by-step reasoning.  
3. One idea per prompt: ask one clear question at a time. Do not chain multiple unrelated questions.  
4. Plain text only: no Markdown, no bullet lists, no emojis, no code blocks in your spoken output (this is for TTS).  
5. Language: Speak ONLY in ${language}. Never switch languages.

### CONTEXT YOU MUST USE
- Candidate resume content: ${resumeText || "[RESUME_CONTENT]"}  
- Job description: ${description || "[JOB_DESCRIPTION]"}  
- Skills to probe: ${skillsStr || "[SKILLS]"}  
- Mandatory company questions: ${questions || "[MANDATORY_QUESTIONS]"}  
Use the above to tailor questions and follow-ups. Reference past answers when helpful.


### HUMAN INTERVIEW BEHAVIOR (Concrete rules)
1. Start each turn with a short acknowledgement: e.g., "I see.", "Okay.", "Makes sense.", "Interesting."
2. Follow-up logic:
   - Strong answer → acknowledge briefly and ask a deeper or harder follow-up.
   - Weak/vague answer → ask for clarification or a specific example; offer one hint if needed.
   - Off-topic → gently redirect ("Let’s focus on the interview "); if ignored, end with [END].
3. Interrupt politely if response is too long: "Could you highlight the key action you took?"
4. Reference previous answers when relevant to maintain continuity.
5. Use subtle tone shifts (curious, impressed, concerned) to feel human, but stay professional.


### INTERVIEW STRUCTURE (internal guide)
- Warm-up: quick greeting + 1 background verification question.  
- Core (domain fit): 60–70% questions focused on JD and skills. Include the mandatory company questions naturally. Use scenario-based and behavioral questions.  
- Deep-probe: when candidate provides a real example, use follow-up logic to probe decisions, trade-offs, and impact.  
- Closing: summarize candidate in one short sentence ("You gave several relevant examples; I particularly noted X.") and ask if they have questions. If time is up, say "Our time is up." then output [END].

### MANDATORY TECH RULES
- Always ask mandatory company questions at appropriate points — do not dump them all at the end.  
- If you ask a scenario (e.g., falling enrollment), instruct "Walk me through your approach step-by-step" and expect a numbered or clearly sequential answer; if they fail to produce steps, ask: "What would you do first, second, third?"  
- Keep control. If candidate derails the flow, redirect politely back to the topic.

### TIME & TERMINATION LOGIC
- Current Time: ${currenttime || "[CURRENT_TIME]"} | End Time: ${endTime || "[END_TIME]"}  
- If current time >= End Time: say "Time is up. Do you have final questions, or would you like to extend by 2 minutes?" If candidate asks to stop after this, output exactly: [END].  
- If candidate requests to stop mid-interview: persuade once ("We're almost done — shall we continue for two more questions?"). If they insist, output: [END].  
- If candidate requests an extension and you accept, allow exactly 2 more question-answer interactions, then output: [END].

### SAFETY, PRIVACY & BOUNDARIES
- Do not ask for or store sensitive personal data (bank details, identity numbers) beyond what a real interviewer would request (confirmation of eligibility, basic contact details). If asked by candidate to collect or share sensitive data, politely refuse.  
- Refuse to answer or role-play requests that involve illegal, medical, or legal advice outside interview scope. Politely redirect back to job-related discussion.

### OUTPUT DECISION (what to generate now)
You are given the candidate's last reply. Do this in your next response:  
1) Start with one micro-acknowledgement (vary phrasing).  
2) Briefly assess whether the last answer was strong, weak, or off-topic. (Do not state the assessment label aloud; use it to choose your follow-up.)  
3) Ask one clear next question (either a deeper follow-up if strong, a clarification if weak, or a redirect if off-topic).  
4) Keep the response natural and conversational, 2–4 sentences in most cases. If asking for step-by-step, allow slightly longer.

--- End of system prompt ---
`;


  try {
    const model = ai.getGenerativeModel({
      model: 'gemini-2.0-flash-lite',
      systemInstruction: systemText,
      generationConfig: {
        temperature: 0.4,
        topK: 1,
        topP: 1,
        maxOutputTokens: 100, 
      },
    });



      // Resume is already provided inside `systemText` (included once).
      // Send only the conversation history as the content to avoid resending the full resume each request.
      const safeHistory = Array.isArray(history) ? history : [];

      const conversationContent = [...safeHistory];

    const result = await model.generateContent({ contents: conversationContent });

    if (result?.response && typeof result.response.text === 'function') {
      return result.response.text();
    }
    if (result?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return result.candidates[0].content.parts[0].text;
    }
    return 'Unexpected AI response format.';
  } catch (error) {
    // Log the full error message and stack to server logs to diagnose the root cause
    console.error('[AI Service] getAiResponse error:', error?.message || error, error?.stack || 'no stack');
    // Keep the client-facing message generic but include a hint to check server logs
    
    console.log("error in gimine ai" , error);

return language === "English"
    ? "Due to some issues, I couldn’t understand this properly. Could you please repeat the answer?"
    : "कुछ समस्या के कारण मैं इसे ठीक से समझ नहीं पाया, क्या आप कृपया इसका उत्तर दोबारा बता सकते हैं?";  }
}



export const generateFinalFeedback = async (resumeText, history) => {
  try {

    


//     const feedbackPrompt = `
// Analyze the interview conversation below and provide detailed feedback in the EXACT JSON format requested.

// --- INTERVIEW CONVERSATION ---
// ${history.map(turn => `${turn.role.toUpperCase()}: ${turn.content}`).join('\n')}

// --- CANDIDATE RESUME ---
// ${resumeText}

// --- INSTRUCTIONS ---
// Based on the interview performance, candidate's answers, technical knowledge demonstrated, communication skills, and resume alignment, provide feedback in this EXACT JSON format:

// {
//   "overall_analysis": "A comprehensive 2-3 sentence analysis of the candidate's overall interview performance and readiness for the role",
//   "notable_strengths": ["Strength 1", "Strength 2", "Strength 3"],
//   "areas_for_improvement": ["Area 1", "Area 2", "Area 3"],
//   "overall_mark": 75,
//   "final_tip": "One specific, actionable tip for the candidate's next steps",
//   "marks_cutdown_points": ["Point 1", "Point 2", "Point 3"]
// }



// SCORING GUIDELINES (out of 100):
// - 90-100: Exceptional performance, ready for senior roles
// - 80-89: Strong performance, good fit for the role
// - 70-79: Good performance with minor gaps
// - 60-69: Average performance, needs some improvement
// - 50-59: Below average, significant gaps identified
// - 40-49: Poor performance, major improvements needed
// - Below 40: Not ready for this role level

// Consider:
// - Technical knowledge and accuracy of answers
// - Communication clarity and confidence
// - Problem-solving approach
// - Experience relevance to the role
// - Ability to explain concepts clearly
// - Overall professionalism

// Respond ONLY with the JSON object, no additional text.`;


const feedbackPrompt = `
Analyze the following interview conversation and provide detailed feedback based on the candidate’s real performance.

--- INTERVIEW CONVERSATION ---
${history.map(turn => `${turn.role.toUpperCase()}: ${turn.content}`).join('\n')}

--- CANDIDATE RESUME ---
${resumeText}

--- INSTRUCTIONS ---
You are an experienced technical interviewer and assessment expert. 
You must evaluate the candidate strictly and give **authentic marks** based on the actual performance, communication, and domain understanding shown in the interview.

Consider:
- How accurate, relevant, and structured the answers were
- Whether the candidate demonstrated real technical depth or practical knowledge
- How confident, clear, and concise their communication was
- If answers aligned with their resume and the job requirements

You must output your feedback ONLY in the EXACT JSON format below:

{
  "overall_analysis": "A short 2–3 sentence summary of overall performance, confidence, and role readiness",
  "notable_strengths": ["Strength 1", "Strength 2", "Strength 3"],
  "areas_for_improvement": ["Weakness 1", "Weakness 2", "Weakness 3"],
  "overall_mark": 0-100, // integer value reflecting real performance, not idealized
  "marks_cutdown_points": [
    "Point 1: What mistake or weakness led to mark deduction",
    "Point 2: Another specific reason with context",
    "Point 3: Another concrete deduction reason"
  ],
  "final_tip": "One actionable suggestion for improvement based on their weakest area"
}

SCORING SCALE (Out of 100):
- 90–100 → Exceptional: Deep mastery, confident, clear answers
- 80–89 → Strong: Solid understanding, minor gaps
- 70–79 → Good: Reasonable performance, some inconsistencies
- 60–69 → Average: Needs improvement in technical or communication
- 50–59 → Weak: Lacks depth or confidence
- Below 50 → Poor: Not ready for the role

IMPORTANT:
- Base marks purely on the conversation history — don’t assume knowledge not shown.
- Every “marks_cutdown_point” should be directly tied to a specific failure, mistake, or unclear response in the conversation.
- Respond ONLY with the raw JSON object. Do not include markdown or text before or after.
`;


    const systemInstruction = `You are an expert interview assessor and career coach. You must respond with ONLY a valid JSON object containing the feedback structure requested. Do not include any markdown formatting, code blocks, or additional text - just the raw JSON.`;

    const model = ai.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      systemInstruction: systemInstruction
    });
    
    const result = await model.generateContent(feedbackPrompt);
    
    let aiResponse = '';
    if (result?.response && typeof result.response.text === 'function') {
      aiResponse = result.response.text();
    } else if (result?.candidates?.[0]?.content?.parts?.[0]?.text) {
      aiResponse = result.candidates[0].content.parts[0].text;
    } else {
      throw new Error('No response from AI');
    }

    // Clean and parse the JSON response
    let cleanedResponse = aiResponse.trim();
    
    // Remove markdown code blocks if present
    cleanedResponse = cleanedResponse.replace(/```json\s*|\s*```/g, '');
    cleanedResponse = cleanedResponse.replace(/```\s*|\s*```/g, '');
    
    // Parse the JSON
    const feedbackData = JSON.parse(cleanedResponse);
    
    // Validate the structure and provide defaults if needed
    // const structuredFeedback = {
    //   overall_analysis: feedbackData.overall_analysis || 'Interview completed successfully.',
    //   notable_strengths: Array.isArray(feedbackData.notable_strengths) ? feedbackData.notable_strengths : ['Communication skills'],
    //   areas_for_improvement: Array.isArray(feedbackData.areas_for_improvement) ? feedbackData.areas_for_improvement : ['Technical depth'],
    //   overall_mark: typeof feedbackData.overall_mark === 'number' ? Math.max(0, Math.min(100, feedbackData.overall_mark)) : 70,
    //   final_tip: feedbackData.final_tip || 'Continue practicing and improving your skills.'
    // };

    const structuredFeedback = {
  overall_analysis: feedbackData.overall_analysis || 'Interview completed successfully.',
  notable_strengths: Array.isArray(feedbackData.notable_strengths) ? feedbackData.notable_strengths : ['Communication skills'],
  areas_for_improvement: Array.isArray(feedbackData.areas_for_improvement) ? feedbackData.areas_for_improvement : ['Technical depth'],
  overall_mark: typeof feedbackData.overall_mark === 'number' ? Math.max(0, Math.min(100, feedbackData.overall_mark)) : 70,
  marks_cutdown_points: Array.isArray(feedbackData.marks_cutdown_points) ? feedbackData.marks_cutdown_points : ['Did not provide enough practical examples.'],
  final_tip: feedbackData.final_tip || 'Continue practicing and improving your skills.'
};


    return structuredFeedback;

  } catch (error) {
    console.error("Error generating final feedback:", error);
    
    // Return default structured feedback if parsing fails
    return {
      overall_analysis: "Interview completed. Unable to generate detailed analysis at this time.",
      notable_strengths: ["Active participation", "Professional communication"],
      areas_for_improvement: ["Technical depth", "Specific examples"],
      overall_mark: 65,
      final_tip: "Continue practicing technical skills and prepare specific examples from your experience."
    };
  }
}




