import { supabase } from './_supabase';

export const handler = async (event: any) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method not allowed' };
    }

    try {
        const body = JSON.parse(event.body);

        const { data, error } = await supabase
        .from('parsed_files')
        .insert([body])
        .select()
        .single();

        return {
            statusCode: 200,
            body: JSON.stringify({ id: data.id }),
        };
    } catch (err: any) {
        return {
        statusCode: 500,
        body: JSON.stringify({ error: err.message }),
        };
    }
};
