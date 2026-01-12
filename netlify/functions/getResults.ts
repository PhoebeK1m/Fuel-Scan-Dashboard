import { supabase } from './_supabase';

export const handler = async () => {
    const { data, error } = await supabase
        .from('parsed_files')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        return { statusCode: 500, body: error.message };
    }

    return {
        statusCode: 200,
        body: JSON.stringify(data),
    };
};
