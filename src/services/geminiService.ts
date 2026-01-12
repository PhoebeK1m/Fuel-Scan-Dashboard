
import { GoogleGenAI, Type } from "@google/genai";
import { OCRResult, FuelRow } from "../types";

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
`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    elementNumber: {
      type: Type.STRING,
      description: "The Pin Number or Element Number found on the document.",
    },
    rows: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          date: { type: Type.STRING },
          address: { type: Type.STRING },
          length: { type: Type.STRING },
          plus_r: { type: Type.STRING, description: "The +r value" },
          minus_r: { type: Type.STRING, description: "The r- value" },
          bow: { type: Type.STRING },
          delta_bow: { type: Type.STRING },
          delta_length: { type: Type.STRING },
          go_no_go: { type: Type.STRING },
          notes: { type: Type.STRING, description: "Notes from the extra column in the table" },
        },
        required: ["date", "address", "length", "plus_r", "minus_r", "bow", "delta_bow", "delta_length", "go_no_go", "notes"],
      },
    },
    outliers: {
      type: Type.STRING,
      description: "Summary of any outliers or unusual data points detected.",
    },
  },
  required: ["elementNumber", "rows", "outliers"],
};

export async function parseFuelImage(base64Image: string, mimeType: string): Promise<OCRResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        parts: [
          { text: OCR_PROMPT },
          {
            inlineData: {
              data: base64Image.split(",")[1], // Remove prefix if present
              mimeType: mimeType,
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

  try {
    const data = JSON.parse(response.text);
    return data as OCRResult;
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    throw new Error("Failed to extract structured data from image.");
  }
}
