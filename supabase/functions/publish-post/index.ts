import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScheduleRecord {
  id: string;
  org_id: string;
  platform: string;
  asset_id: string;
  scheduled_at: string;
  status: string;
  retries: number;
}

// Publish to Instagram via Graph API
async function publishToInstagram(accessToken: string, content: string, imageUrl?: string): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    // Get Instagram Business Account ID
    const accountsResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`
    );
    const accountsData = await accountsResponse.json();
    
    if (!accountsData.data?.[0]?.id) {
      return { success: false, error: 'No Facebook page found' };
    }

    const pageId = accountsData.data[0].id;
    const pageAccessToken = accountsData.data[0].access_token;

    // Get Instagram Business Account
    const igAccountResponse = await fetch(
      `https://graph.facebook.com/v18.0/${pageId}?fields=instagram_business_account&access_token=${pageAccessToken}`
    );
    const igAccountData = await igAccountResponse.json();
    
    if (!igAccountData.instagram_business_account?.id) {
      return { success: false, error: 'No Instagram Business account linked' };
    }

    const igAccountId = igAccountData.instagram_business_account.id;

    if (imageUrl) {
      // Create media container for image post
      const createMediaResponse = await fetch(
        `https://graph.facebook.com/v18.0/${igAccountId}/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_url: imageUrl,
            caption: content,
            access_token: pageAccessToken,
          }),
        }
      );
      
      const mediaData = await createMediaResponse.json();
      if (mediaData.error) {
        return { success: false, error: mediaData.error.message };
      }

      // Publish the media container
      const publishResponse = await fetch(
        `https://graph.facebook.com/v18.0/${igAccountId}/media_publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creation_id: mediaData.id,
            access_token: pageAccessToken,
          }),
        }
      );

      const publishData = await publishResponse.json();
      return publishData.id
        ? { success: true, postId: publishData.id }
        : { success: false, error: publishData.error?.message || 'Publish failed' };
    }

    return { success: false, error: 'Instagram requires an image' };
  } catch (error) {
    console.error('Instagram publish error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Publish to Twitter/X via v2 API
async function publishToTwitter(accessToken: string, content: string): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    const response = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: content }),
    });

    const data = await response.json();
    
    if (data.data?.id) {
      return { success: true, postId: data.data.id };
    }
    
    return { success: false, error: data.detail || data.title || 'Tweet failed' };
  } catch (error) {
    console.error('Twitter publish error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Publish to LinkedIn via v2 API
async function publishToLinkedIn(accessToken: string, content: string): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    // Get user profile URN
    const profileResponse = await fetch('https://api.linkedin.com/v2/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    const profileData = await profileResponse.json();
    const authorUrn = `urn:li:person:${profileData.id}`;

    // Create share
    const shareResponse = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        author: authorUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text: content },
            shareMediaCategory: 'NONE',
          },
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
      }),
    });

    const shareData = await shareResponse.json();
    
    if (shareData.id) {
      return { success: true, postId: shareData.id };
    }
    
    return { success: false, error: shareData.message || 'LinkedIn share failed' };
  } catch (error) {
    console.error('LinkedIn publish error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('🚀 Publish-post function triggered');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get pending schedules that are due
    const now = new Date().toISOString();
    const { data: pendingSchedules, error: fetchError } = await supabase
      .from('schedules')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .lt('retries', 3)
      .order('scheduled_at', { ascending: true })
      .limit(10);

    if (fetchError) {
      console.error('Failed to fetch schedules:', fetchError);
      throw fetchError;
    }

    if (!pendingSchedules?.length) {
      console.log('No pending schedules to process');
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing ${pendingSchedules.length} scheduled posts`);

    const results = [];
    const keyringToken = Deno.env.get('KEYRING_TOKEN');

    for (const schedule of pendingSchedules as ScheduleRecord[]) {
      try {
        // Get integration for this org and platform
        const { data: integration, error: integrationError } = await supabase
          .from('integrations')
          .select('id, access_token_encrypted')
          .eq('org_id', schedule.org_id)
          .eq('provider', schedule.platform)
          .eq('status', 'connected')
          .single();

        if (integrationError || !integration) {
          console.error(`No integration found for ${schedule.platform}:`, integrationError);
          await supabase
            .from('schedules')
            .update({
              status: 'failed',
              error_message: `No ${schedule.platform} integration found`,
              retries: schedule.retries + 1,
            })
            .eq('id', schedule.id);
          continue;
        }

        // Decrypt access token
        const { data: decryptedToken, error: decryptError } = await supabase.rpc(
          'decrypt_integration_token',
          {
            p_integration_id: integration.id,
            p_encryption_key: keyringToken,
            p_token_type: 'access',
          }
        );

        if (decryptError || !decryptedToken) {
          console.error('Failed to decrypt token:', decryptError);
          await supabase
            .from('schedules')
            .update({
              status: 'failed',
              error_message: 'Token decryption failed',
              retries: schedule.retries + 1,
            })
            .eq('id', schedule.id);
          continue;
        }

        // Get asset content
        const { data: asset, error: assetError } = await supabase
          .from('assets')
          .select('content_data, content_url, name, type')
          .eq('id', schedule.asset_id)
          .single();

        if (assetError || !asset) {
          console.error('Asset not found:', assetError);
          await supabase
            .from('schedules')
            .update({
              status: 'failed',
              error_message: 'Asset not found',
              retries: schedule.retries + 1,
            })
            .eq('id', schedule.id);
          continue;
        }

        const content = typeof asset.content_data === 'object' && asset.content_data !== null
          ? (asset.content_data as { text?: string }).text || asset.name
          : asset.name;
        const imageUrl = asset.content_url;

        let result: { success: boolean; postId?: string; error?: string };

        switch (schedule.platform) {
          case 'instagram':
            result = await publishToInstagram(decryptedToken, content, imageUrl);
            break;
          case 'twitter':
            result = await publishToTwitter(decryptedToken, content);
            break;
          case 'linkedin':
            result = await publishToLinkedIn(decryptedToken, content);
            break;
          default:
            result = { success: false, error: `Unsupported platform: ${schedule.platform}` };
        }

        if (result.success) {
          await supabase
            .from('schedules')
            .update({
              status: 'published',
              posted_url: result.postId,
              result: result,
            })
            .eq('id', schedule.id);

          console.log(`✅ Published to ${schedule.platform}: ${result.postId}`);
        } else {
          const newRetries = schedule.retries + 1;
          await supabase
            .from('schedules')
            .update({
              status: newRetries >= 3 ? 'failed' : 'pending',
              error_message: result.error,
              retries: newRetries,
            })
            .eq('id', schedule.id);

          console.log(`❌ Failed to publish to ${schedule.platform}: ${result.error}`);
        }

        results.push({ scheduleId: schedule.id, ...result });
      } catch (error) {
        console.error(`Error processing schedule ${schedule.id}:`, error);
        await supabase
          .from('schedules')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            retries: schedule.retries + 1,
          })
          .eq('id', schedule.id);
      }
    }

    return new Response(
      JSON.stringify({ processed: results.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Publish-post error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
