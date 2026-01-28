import { Handler } from '@netlify/functions';
import { supabase } from './_supabase';

export const handler: Handler = async (event) => {
    try {
        if (!event.body) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Missing body' }),
        };
        }

        const body = JSON.parse(event.body);
        const { id, ...incoming } = body;

        if (!id) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Missing id' }),
        };
        }

        // ✅ Explicit whitelist of allowed DB fields
        const update: any = {};

        if (typeof incoming.notes === 'string') {
        update.notes = incoming.notes;
        }

        if (typeof incoming.element_number === 'string') {
        update.element_number = incoming.element_number;
        }

        if (Array.isArray(incoming.rows)) {
        update.rows = incoming.rows;
        }

        // 🚨 Nothing valid to update
        if (Object.keys(update).length === 0) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'No valid fields to update' }),
        };
        }

        console.log('Updating result:', { id, update });

        const { error } = await supabase
        .from('parsed_files')
        .update(update)
        .eq('id', id);

        if (error) {
        console.error('Supabase update error:', error);
        throw error;
        }

        return {
        statusCode: 200,
        body: JSON.stringify({ success: true }),
        };

    } catch (err: any) {
        console.error('updateResult failed:', err);

        return {
        statusCode: 500,
        body: JSON.stringify({
            error: err.message || 'Unknown server error',
        }),
        };
    }
};
