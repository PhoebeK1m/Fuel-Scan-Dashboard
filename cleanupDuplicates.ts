// import { createClient } from '@supabase/supabase-js';

// const supabase = createClient(
//   process.env.SUPABASE_URL!,
//   process.env.SUPABASE_SERVICE_KEY! // MUST be service role
// );

// const BUCKET = 'fuel-images';
// const FOLDER = ''; // set if files live in a subfolder

// async function cleanupStorageDuplicates() {
//   // 1. List files in bucket
//   const { data: files, error } = await supabase
//     .storage
//     .from(BUCKET)
//     .list(FOLDER, { limit: 1000 });

//   if (error) {
//     throw error;
//   }

//   // 2. Group by suffix after first underscore
//   const groups = new Map<string, string[]>();

//   for (const file of files!) {
//     if (!file.name.includes('_')) continue;

//     const suffix = file.name.split('_').slice(1).join('_');

//     if (!groups.has(suffix)) {
//       groups.set(suffix, []);
//     }
//     groups.get(suffix)!.push(file.name);
//   }

//   let deleted = 0;

//   // 3. Delete duplicates (keep first)
//   for (const [suffix, names] of groups.entries()) {
//     if (names.length <= 1) continue;

//     // sort by timestamp (prefix)
//     const sorted = names.sort((a, b) => {
//       const ta = Number(a.split('_')[0]);
//       const tb = Number(b.split('_')[0]);
//       return ta - tb; // keep oldest
//     });

//     const toDelete = sorted.slice(1);

//     for (const name of toDelete) {
//       console.log('Deleting duplicate:', name);
//       await supabase.storage.from(BUCKET).remove([
//         FOLDER ? `${FOLDER}/${name}` : name
//       ]);
//       deleted++;
//     }
//   }

//   console.log(`✅ Cleanup complete. Deleted ${deleted} duplicate files.`);
// }

// cleanupStorageDuplicates().catch(console.error);
