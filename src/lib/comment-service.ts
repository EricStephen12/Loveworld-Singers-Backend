
import { createClient } from '@supabase/supabase-js';
import type { Comment } from '@/types/supabase';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Comments Operations

export async function getCommentsBySongId(songId: number): Promise<Comment[]> {
    try {
        const { data, error } = await supabase
            .from('comments')
            .select('*')
            .eq('songid', songId)
            .order('createdat', { ascending: false });

        if (error) throw error;

        return (data || []).map(comment => ({
            id: comment.id,
            text: comment.text,
            date: comment.date,
            author: comment.author
        }));
    } catch (error) {
 console.error('Error fetching comments:', error);
        return [];
    }
}

export async function createComment(commentData: Omit<Comment, 'id'> & { songId: number }): Promise<Comment | null> {
    try {
        const { data, error } = await supabase
            .from('comments')
            .insert({
                id: `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                songid: commentData.songId,
                text: commentData.text,
                date: commentData.date,
                author: commentData.author
            })
            .select()
            .single();

        if (error) throw error;

        return {
            id: data.id,
            text: data.text,
            date: data.date,
            author: data.author
        };
    } catch (error) {
 console.error('Error creating comment:', error);
        return null;
    }
}
