import { supabase } from './_supabase';

function canonicalFileName(original: string) {
    return original.includes('_')
        ? original.split('_').slice(1).join('_')
        : original;
}

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

        // Normalize filename (remove timestamp prefix)
        const canonicalName = canonicalFileName(fileName);

        // Deterministic storage path
        const filePath = `fuel/${canonicalName}`;

        // Check storage for existing file (duplicate guard)
        const { data: existing, error: listError } = await supabase.storage
        .from('fuel-images')
        .list('fuel', { search: canonicalName });

        if (listError) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Storage lookup failed', details: listError }),
        };
        }

        if (existing && existing.length > 0) {
        return {
            statusCode: 409,
            body: JSON.stringify({ error: 'Duplicate image already exists' }),
        };
        }

        // Clean base64 string
        const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');

        // Convert to Uint8Array
        const buffer = Buffer.from(base64Data, 'base64');
        const fileArrayBuffer = Uint8Array.from(buffer);

        // Upload (NO upsert)
        const { error: uploadError } = await supabase.storage
        .from('fuel-images')
        .upload(filePath, fileArrayBuffer, {
            contentType: contentType || 'image/jpeg',
            upsert: false,
        });

        if (uploadError) {
        // Handles race conditions safely
        if (uploadError.message?.includes('already exists')) {
            return {
            statusCode: 409,
            body: JSON.stringify({ error: 'Duplicate image already exists' }),
            };
        }

        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Upload failed', details: uploadError }),
        };
        }

        // Get public URL
        const { data: urlData } = supabase.storage
        .from('fuel-images')
        .getPublicUrl(filePath);

        return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            imageUrl: urlData.publicUrl,
            path: filePath,
            fileName: canonicalName,
        }),
        };
    } catch (err: any) {
        return {
        statusCode: 500,
        body: JSON.stringify({ error: err.message }),
        };
    }
};
