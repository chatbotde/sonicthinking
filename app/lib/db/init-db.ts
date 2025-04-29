import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Checks if required database tables exist in Supabase
 * @param supabase The Supabase client instance
 * @returns Promise<boolean> indicating if all required tables exist
 */
export async function ensureTablesExist(supabase: SupabaseClient): Promise<boolean> {
  try {
    // Check for the existence of tables by directly trying to access them
    const requiredTables = ['chats', 'messages', 'ai_models', 'votes'];
    
    for (const table of requiredTables) {
      // Just query for a single row to verify table access works
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.error(`Error accessing table ${table}:`, error);
        // Not returning false immediately to check all tables
        if (error.code === '42P01') { // Table doesn't exist
          return false;
        }
      }
    }
    
    console.log('All required tables are accessible');
    return true;
  } catch (err) {
    console.error('Database check failed:', err);
    return false;
  }
}

/**
 * Checks if a user is authenticated in Supabase
 * @param supabase The Supabase client instance
 * @returns Promise<boolean> indicating if a user is authenticated
 */
export async function checkUserAuth(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('Auth check failed:', error);
      return false;
    }
    
    if (!user) {
      console.log('No authenticated user found');
      return false;
    }
    
    console.log('Authenticated as user:', user.id);
    return true;
  } catch (err) {
    console.error('Auth check failed:', err);
    return false;
  }
}
