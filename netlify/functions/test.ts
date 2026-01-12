import { supabase } from './_supabase';

export const handler = async () => {
  const testRow = {
    // ⚠️ adjust keys ONLY if your table requires different names
    file_name: 'test',
    element_number: 'hello world',
    notes: 'netlify-test'
  };

  const { data, error } = await supabase
    .from('parsed_files')
    .insert(testRow)
    .select()
    .single();

  return {
    statusCode: error ? 400 : 200,
    body: JSON.stringify({ data, error })
  };
};
