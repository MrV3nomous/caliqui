import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Check your .env file.');
}

// Single instance for database and edge function interactions
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

/**
 * Uploads an asset (Blob/File) to the Supabase 'user-assets' storage bucket.
 * Automatically generates a unique filename based on the user's ID.
 */
export async function uploadAssetToStorage(
  file: Blob | File,
  userId: string,
): Promise<string | null> {
  if (!userId) return null;

  try {
    // Generate a secure, unique path: {userId}/{uuid}.webp
    const fileExt = file.type.includes('webp') ? 'webp' : 'png';
    const fileName = `${userId}/${crypto.randomUUID()}.${fileExt}`;

    const { data, error } = await supabase.storage.from('user-assets').upload(fileName, file, {
      cacheControl: '31536000',
      upsert: false,
      contentType: file.type || 'image/webp',
    });

    if (error) {
      console.error('Storage Upload Error:', error.message);
      return null;
    }

    // Retrieve the public URL for the newly uploaded asset
    const { data: publicUrlData } = supabase.storage.from('user-assets').getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Unexpected error during asset upload:', error);
    return null;
  }
}
