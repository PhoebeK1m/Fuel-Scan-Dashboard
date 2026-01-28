import { supabase } from "./_supabase";
import { Handler } from "@netlify/functions";

const MAX_ATTEMPTS = 3;

export const handler: Handler = async () => {
    /**
     * 1️⃣ Atomically claim ONE job
     */
    const { data: jobs, error } = await supabase
        .from("fuel_jobs")
        .update({ status: "PROCESSING" })
        .in("status", ["QUEUED", "FAILED"])
        .lt("attempts", MAX_ATTEMPTS)
        .lte(
        "next_run_at",
        process.env.NODE_ENV === "development"
            ? new Date(0).toISOString()
            : new Date().toISOString()
        )
        .order("created_at")
        .limit(1)
        .select("*");

    if (error) {
        console.error("Failed to claim job:", error);
        return { statusCode: 500, body: "Failed to claim job" };
    }

    if (!jobs || jobs.length === 0) {
        return { statusCode: 200, body: "No jobs" };
    }

    const job = jobs[0];

    /**
     * 2️⃣ Dispatch OCR (fire-and-forget)
     */
    await fetch(`${process.env.URL}/.netlify/functions/parseFuelImage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        jobId: job.id,
        imageUrl: job.image_url,
        fileName: job.file_name,
        }),
    });

    return { statusCode: 200, body: "Job dispatched" };
};


// import { supabase } from './_supabase';
// import { Handler } from "@netlify/functions";
// const MAX_JOBS_PER_RUN = 1;

// export const handler: Handler = async () => {
//     const { data: jobs } = await supabase
//         .from("fuel_jobs")
//         .select("*")
//         .in("status", ["QUEUED", "FAILED"])
//         .lt("attempts", 3)
//         .order("created_at")
//         .limit(MAX_JOBS_PER_RUN);


//     if (!jobs || jobs.length === 0) {
//         return { statusCode: 200, body: "No jobs" };
//     }

//     const job = jobs[0];

//     try {
//         await supabase
//             .from("fuel_jobs")
//             .update({ status: "PROCESSING" })
//             .eq("id", job.id);

//         const ocrRes = await fetch(
//             `${process.env.URL}/.netlify/functions/parseFuelImage`,
//             {
//                 method: "POST",
//                 headers: { "Content-Type": "application/json" },
//                 body: JSON.stringify({
//                     imageUrl: job.image_url,
//                     }),
//             }
//         );

//         if (!ocrRes.ok) {
//             throw new Error("OCR failed");
//         }

//         const result = await ocrRes.json();

//         const { error } = await supabase.from("parsed_files").upsert({
//             id: job.id,
//             file_name: job.file_name,
//             image_url: job.image_url,
//             element_number: result.elementNumber,
//             rows: result.rows,
//             notes: result.outliers,
//             status: "COMPLETED",
//         },{ onConflict: "id" });

//         if (error) {
//             throw error;
//             }

//         await supabase
//             .from("fuel_jobs")
//             .update({ status: "COMPLETED" })
//             .eq("id", job.id);

//     } catch (err) {
//         await supabase
//             .from("fuel_jobs")
//             .update({
//                 status: "FAILED",
//                 attempts: (job.attempts ?? 0) + 1,
//             })
//             .eq("id", job.id);
//     }

//     return { statusCode: 200, body: "Processed 1 job" };
// };
