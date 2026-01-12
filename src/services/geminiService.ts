export async function parseFuelImage(
  base64Image: string,
  mimeType: string
) {
  const res = await fetch("/.netlify/functions/parseFuelImage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64Image, mimeType }),
  });

  if (!res.ok) {
    throw new Error("OCR request failed");
  }

  return res.json();
}
