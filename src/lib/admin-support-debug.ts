import { supabase } from './supabase-client';

export async function debugAdminSupport() {
  
  try {
    // Test 1: Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
 console.error(' Auth error:', authError);
      return;
    }
    
    if (!user) {
 console.error(' No authenticated user');
      return;
    }
    
    
    // Test 2: Try to get count of all messages
    const { count, error: countError } = await supabase
      .from('support_messages')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
 console.error(' Count error:', countError);
    } else {
    }
    
    // Test 3: Try to get messages with different approaches
    
    // Approach 1: Simple select all
    const { data: allData, error: allError } = await supabase
      .from('support_messages')
      .select('*');
    
    if (allError) {
 console.error(' Simple select error:', allError);
    } else {
    }
    
    // Approach 2: Select with specific columns
    const { data: specificData, error: specificError } = await supabase
      .from('support_messages')
      .select('id, subject, user_name, user_email, status, created_at');
    
    if (specificError) {
 console.error(' Specific select error:', specificError);
    } else {
    }
    
    // Approach 3: Try with RLS bypass (if service role is available)
    const { data: policyData, error: policyError } = await supabase
      .rpc('get_support_messages_admin'); // This won't exist, just testing
    
    if (policyError) {
    }
    
    // Test 4: Check user's own messages
    const { data: userMessages, error: userError } = await supabase
      .from('support_messages')
      .select('*')
      .eq('user_id', user.id);
    
    if (userError) {
 console.error(' User messages error:', userError);
    } else {
      if (userMessages && userMessages.length > 0) {
      }
    }
    
    // Test 5: Try to create a test message to see if that works
    const testMessage = {
      user_id: user.id,
      user_name: 'Admin Test',
      user_email: user.email || 'admin@test.com',
      subject: 'Admin Test Message',
      message: 'This is a test message from admin debug',
      category: 'general',
      priority: 'low',
      status: 'pending'
    };
    
    const { data: createData, error: createError } = await supabase
      .from('support_messages')
      .insert([testMessage])
      .select()
      .single();
    
    if (createError) {
 console.error(' Create test message error:', createError);
    } else {
      
      // Clean up test message
      await supabase
        .from('support_messages')
        .delete()
        .eq('id', createData.id);
      
    }
    
    
  } catch (error) {
 console.error(' Unexpected error in admin debug:', error);
  }
}

// Make it available globally for testing
if (typeof window !== 'undefined') {
  (window as any).debugAdminSupport = debugAdminSupport;
}
