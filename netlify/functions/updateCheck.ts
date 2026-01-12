import { supabase } from './_supabase';

export const handler = async (event: any) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method not allowed' };
    }

    try {
        const body = JSON.parse(event.body);
        const { id, checked_by_phoebe, checked_by_jay } = body;

        const { error } = await supabase
        .from('parsed_files')
        .update({
            checked_by_phoebe,
            checked_by_jay
        })
        .eq('id', id);

        if (error) throw error;

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true }),
        };
    } catch (err: any) {
        return {
        statusCode: 500,
        body: JSON.stringify({ error: err.message }),
        };
    }
};
