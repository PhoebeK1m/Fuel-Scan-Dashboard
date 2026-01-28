import { Handler } from '@netlify/functions'
import { supabase } from './_supabase'

export const handler: Handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return {
        statusCode: 405,
        body: 'Method Not Allowed',
        }
    }

    try {
        const body = JSON.parse(event.body || '{}')
        const { file_name, image_url } = body

        if (!file_name || !image_url) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing file_name or image_url' }),
            }
        }

        // check fuel jobs
        const { data: existing } = await supabase
            .from('fuel_jobs')
            .select('id, status')
            .eq('file_name', file_name)
            .limit(1);

        if (existing?.length) {
            // fetch(`${process.env.URL}/.netlify/functions/processQueue`);
            return {
                statusCode: 409,
                body: JSON.stringify({
                error: 'File already exists',
                existingJobId: existing[0].id,
                status: existing[0].status
                })
            };
        }

        // check parsed_files
        const { data: parsed } = await supabase
            .from('parsed_files')
            .select('id')
            .eq('file_name', file_name)
            .maybeSingle();

        if (parsed) {
            return {
                statusCode: 409,
                body: JSON.stringify({
                reason: 'ALREADY_PARSED',
                parsedFileId: parsed.id
                })
            };
        }

        // Insert queued job
        const { data, error } = await supabase
        .from('fuel_jobs')
        .insert({
            file_name,
            image_url,
            status: 'QUEUED',
            attempts: 0,
        })
        .select()
        .single()

        if (error) {
            console.error('Supabase insert error:', error)
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Database insert failed' }),
            }
        }

        // fetch(`${process.env.URL}/.netlify/functions/processQueue`);

        return {
        statusCode: 200,
        body: JSON.stringify({
            id: data.id,
            status: data.status,
        }),
        }

    } catch (error) {
        console.error('enqueueJob error:', error)

        return {
        statusCode: 500,
        body: JSON.stringify({
            error: 'Failed to enqueue job',
        }),
        }
    }
}
