import { Handler } from "@netlify/functions";
import { GoogleGenAI, Type } from "@google/genai";
import sharp from "sharp";

const OCR_PROMPT = `
Extract data from this technical table image.
The image contains a table with columns: date, address, length, +r, r-, bow, Δ bow, Δ length, go-no go, and an empty notes/extra column.
Also, find the "Pin Number" or "Element Number" which identifies the specific fuel element.

Rules:
1. Identify the Pin Number/Element Number.
2. Extract every row from the table accurately.
3. If a value is missing or unreadable, use an empty string.
4. "Δ" is represented as delta in the schema.
5. In the 'outliers' field, note any visual defects, stains, or weird markings mentioned in the notes column or seen on the page.
Do not guess or infer values.
`;

const RESPONSE_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        elementNumber: { type: Type.STRING },
        rows: {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
            date: { type: Type.STRING },
            address: { type: Type.STRING },
            length: { type: Type.STRING },
            plus_r: { type: Type.STRING },
            minus_r: { type: Type.STRING },
            bow: { type: Type.STRING },
            delta_bow: { type: Type.STRING },
            delta_length: { type: Type.STRING },
            go_no_go: { type: Type.STRING },
            notes: { type: Type.STRING },
            },
            required: [
            "date",
            "address",
            "length",
            "plus_r",
            "minus_r",
            "bow",
            "delta_bow",
            "delta_length",
            "go_no_go",
            "notes",
            ],
        },
        },
        outliers: { type: Type.STRING },
    },
    required: ["elementNumber", "rows", "outliers"],
    };

    export const handler: Handler = async (event) => {
    console.log("PARSE FUNCTION HIT");

    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    const body = JSON.parse(event.body || "{}");
    const imageUrl = body.imageUrl || body.image_url;

    if (!imageUrl) {
        return { statusCode: 400, body: "Missing imageUrl" };
    }

    /**
     * 1️⃣ Fetch original image
     */
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) {
        return { statusCode: 400, body: "Failed to fetch image" };
    }

    const originalBuffer = Buffer.from(await imageRes.arrayBuffer());

    /**
     * 2️⃣ OCR-safe resize + compression
     *    - Dramatically reduces Gemini latency
     *    - Improves text contrast
     */
    const optimizedBuffer = await sharp(originalBuffer)
        .resize({ width: 1500, withoutEnlargement: true })
        .grayscale()
        .normalize()
        .sharpen()
        .jpeg({ quality: 80 })
        .toBuffer();

    const base64Image = optimizedBuffer.toString("base64");

    /**
     * 3️⃣ Gemini OCR call
     */
    const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY!,
    });

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
        {
            parts: [
            { text: OCR_PROMPT },
            {
                inlineData: {
                data: base64Image,
                mimeType: "image/jpeg",
                },
            },
            ],
        },
        ],
        config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        },
    });

    if (!response.text) {
        throw new Error("Empty Gemini response");
    }

    const parsed = JSON.parse(response.text);

    return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
    };
};
