import { supabase } from "./_supabase";
import { Handler } from "@netlify/functions";

const OCR_DELAY_MS = 3000;       // throttle OCR calls
const OCR_TIMEOUT_MS = 25000;
const MAX_ATTEMPTS = 3;

const sleep = (ms: number) =>
    new Promise(resolve => setTimeout(resolve, ms));

export const handler: Handler = async () => {
    /**
     * 1️⃣ Atomically claim ONE job
     */
    const { data: jobs, error: claimError } = await supabase
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

    if (claimError) {
        console.error("Failed to claim job:", claimError);
        return { statusCode: 500, body: "Failed to claim job" };
    }

    if (!jobs || jobs.length === 0) {
        return { statusCode: 200, body: "No jobs" };
    }

    const job = jobs[0];

    /**
     * 2️⃣ Throttle OCR requests
     */
    await sleep(OCR_DELAY_MS);

    /**
     * 3️⃣ OCR with timeout protection
     */
    try {
        const controller = new AbortController();
        const timeout = setTimeout(
        () => controller.abort(),
        OCR_TIMEOUT_MS
        );

        const ocrRes = await fetch(
        `${process.env.URL}/.netlify/functions/parseFuelImage`,
        {
            method: "POST",
            signal: controller.signal,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                imageUrl: job.image_url,
            }),
        }
        );

        clearTimeout(timeout);

        if (!ocrRes.ok) {
        throw new Error(`OCR failed with ${ocrRes.status}`);
        }

        const result = await ocrRes.json();

        /**
         * 4️⃣ Save parsed result
         */
        const { error: upsertError } = await supabase
        .from("parsed_files")
        .upsert(
            {
            id: job.id,
            file_name: job.file_name,
            image_url: job.image_url,
            element_number: result.elementNumber,
            rows: result.rows,
            notes: result.outliers,
            status: "COMPLETED",
            },
            { onConflict: "id" }
        );

        if (upsertError) throw upsertError;

        /**
         * 5️⃣ Mark job completed
         */
        await supabase
        .from("fuel_jobs")
        .update({ status: "COMPLETED" })
        .eq("id", job.id);

        return { statusCode: 200, body: "Processed 1 job" };

    } catch (err: any) {
        console.error("Job failed:", err);

        /**
         * 6️⃣ Exponential backoff on failure
         */
        const attempts = (job.attempts ?? 0) + 1;
        const delayMinutes =
            process.env.NODE_ENV === "development" ? 0 : Math.pow(2, attempts);


        await supabase.from("fuel_jobs").update({
        status: "FAILED",
        attempts,
        next_run_at: new Date(
            Date.now() + delayMinutes * 60_000
        ).toISOString(),
        }).eq("id", job.id);

        return { statusCode: 200, body: "Job failed, will retry" };
    }
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
