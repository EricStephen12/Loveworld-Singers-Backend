
import { createClient } from '@supabase/supabase-js';
import type { HistoryEntry } from '@/types/supabase';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// History Operations

export async function getHistoryBySongId(songId: number): Promise<HistoryEntry[]> {
    try {

        const { data, error } = await supabase
            .from('song_history')
            .select('*')
            .eq('song_id', songId)
            .order('created_at', { ascending: false });

        if (error) {
 console.error(' Supabase error fetching history:', error);
            throw error;
        }


        const historyEntries = (data || []).map(entry => ({
            id: entry.id,
            type: entry.type,
            title: entry.title,
            description: entry.description,
            old_value: entry.old_value,
            new_value: entry.new_value,
            created_by: entry.created_by,
            date: entry.created_at,
            version: entry.title // Use title as version since we don't have a separate version field
        }));

        return historyEntries;
    } catch (error) {
 console.error('Error fetching history:', error);
        return [];
    }
}

export async function createHistoryEntry(entry: any): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('song_history')
            .insert(entry);

        if (error) throw error;
        return true;
    } catch (error) {
 console.error('Error creating history entry:', error);
        return false;
    }
}
