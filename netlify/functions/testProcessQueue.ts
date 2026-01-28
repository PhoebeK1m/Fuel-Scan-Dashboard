import { Handler } from "@netlify/functions";

const RUNS_PER_CALL = 5; // how many times to invoke processQueue

export const handler: Handler = async () => {
  console.log("🧪 Starting processQueue tester");

  const results: any[] = [];

  for (let i = 0; i < RUNS_PER_CALL; i++) {
    try {
      console.log(`▶️ Invoking processQueue (run ${i + 1})`);

      const res = await fetch(
        `${process.env.URL}/.netlify/functions/processQueue`,
        { method: "GET" }
      );

      const text = await res.text();

      results.push({
        run: i + 1,
        status: res.status,
        response: text,
      });

      // stop early if queue is empty
      if (text.includes("No jobs")) {
        console.log("ℹ️ Queue empty, stopping early");
        break;
      }
    } catch (err: any) {
      console.error("❌ processQueue invocation failed", err.message);
      results.push({
        run: i + 1,
        error: err.message,
      });
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        invoked: results.length,
        results,
      },
      null,
      2
    ),
  };
};
