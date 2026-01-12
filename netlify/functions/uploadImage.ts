import { supabase } from './_supabase';

export const handler = async (event: any) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { fileName, base64Image, contentType } = body;

        if (!base64Image || !fileName) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing fileName or base64Image' })
            };
        }

        // 1. Clean the base64 string
        const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');

        // 2. Convert to Uint8Array (More compatible with Supabase Storage SDK)
        const buffer = Buffer.from(base64Data, 'base64');
        const fileArrayBuffer = Uint8Array.from(buffer);

        // 3. Create a unique file path
        const filePath = `${Date.now()}_${fileName}`;

        // 4. Upload to Supabase
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('fuel-images')
            .upload(filePath, fileArrayBuffer, {
                contentType: contentType || 'image/jpeg', // Fallback to jpeg
                upsert: false
            });

        if (uploadError) {
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Upload failed', details: uploadError })
            };
        }

        // 5. Get the Public URL
        const { data: urlData } = supabase.storage
            .from('fuel-images')
            .getPublicUrl(filePath);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                imageUrl: urlData.publicUrl,
                path: filePath
            }),
        };
    } catch (err: any) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message }),
        };
    }
};