import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Credit cost for this generation type
const REQUIRED_CREDITS = 2;

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Create a Supabase client with the access token
    const token = authHeader.split(' ')[1];
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );
    
    // Get the user data directly with the token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }
    
    // Get request body (JSON)
    const body = await request.json();
    const { logoUrl, logoDescription, destinationPrompt } = body;
    
    if (!logoUrl || !logoDescription || !destinationPrompt) {
      return NextResponse.json({ 
        error: 'Missing required fields: logoUrl, logoDescription, and destinationPrompt are required' 
      }, { status: 400 });
    }
    
    // Check user's remaining credits
    const { data: userData, error: userDataError } = await supabase
      .from('profiles')
      .select('remaining_credits')
      .eq('id', user.id)
      .single();
      
    if (userDataError) {
      console.error('Error fetching user credits:', userDataError);
      return NextResponse.json({ error: 'Failed to verify credit balance' }, { status: 500 });
    }
    
    if (!userData || userData.remaining_credits < REQUIRED_CREDITS) {
      return NextResponse.json({ 
        error: 'Insufficient credits',
        message: 'You need to buy more credits to continue',
        requiredCredits: REQUIRED_CREDITS,
        currentCredits: userData?.remaining_credits || 0
      }, { status: 403 });
    }
    
    // Pre-emptively deduct credits from the user
    const { error: creditUpdateError } = await supabase
      .from('profiles')
      .update({ 
        remaining_credits: userData.remaining_credits - REQUIRED_CREDITS 
      })
      .eq('id', user.id);
      
    if (creditUpdateError) {
      console.error('Error updating user credits:', creditUpdateError);
      return NextResponse.json({ error: 'Failed to process credit deduction' }, { status: 500 });
    }
    
    try {
      // Call Replicate API
      const replicateResponse = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: "703f38c44b9c2820b79b54f96ef5f6554240b3ec4035a0cf80ba04e1f87ae307", // flux-in-context model
          input: {
            logo_image: logoUrl,
            logo_description: logoDescription,
            destination_prompt: destinationPrompt,
          },
        }),
      });
      
      if (!replicateResponse.ok) {
        // If Replicate API fails, refund the credits
        await supabase
          .from('profiles')
          .update({ 
            remaining_credits: userData.remaining_credits 
          })
          .eq('id', user.id);
          
        const errorData = await replicateResponse.json();
        console.error('Replicate API error:', errorData);
        return NextResponse.json({ error: 'Failed to generate image with Replicate' }, { status: 500 });
      }
      
      // Get the prediction ID from the response
      const replicateData = await replicateResponse.json();
      const predictionId = replicateData.id;
      
      // Poll for completion
      let generatedImageUrl = null;
      let attempt = 0;
      const maxAttempts = 60; // Maximum number of polling attempts
      
      while (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between polls
        
        const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
          headers: {
            'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
          },
        });
        
        if (!statusResponse.ok) {
          continue;
        }
        
        const statusData = await statusResponse.json();
        
        if (statusData.status === 'succeeded') {
          generatedImageUrl = statusData.output;
          break;
        } else if (statusData.status === 'failed') {
          // If generation fails, refund the credits
          await supabase
            .from('profiles')
            .update({ 
              remaining_credits: userData.remaining_credits 
            })
            .eq('id', user.id);
            
          return NextResponse.json({ error: 'Image generation failed' }, { status: 500 });
        }
        
        attempt++;
      }
      
      if (!generatedImageUrl) {
        // If timeout, refund the credits
        await supabase
          .from('profiles')
          .update({ 
            remaining_credits: userData.remaining_credits 
          })
          .eq('id', user.id);
          
        return NextResponse.json({ error: 'Timed out waiting for image generation' }, { status: 504 });
      }
      
      // Download the generated image
      const imageResponse = await fetch(generatedImageUrl);
      if (!imageResponse.ok) {
        // If download fails, refund the credits
        await supabase
          .from('profiles')
          .update({ 
            remaining_credits: userData.remaining_credits 
          })
          .eq('id', user.id);
          
        return NextResponse.json({ error: 'Failed to download generated image' }, { status: 500 });
      }
      
      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      
      // Upload to S3 - Only reached if all previous steps succeeded
      const timestamp = Date.now();
      const filename = `generated-${timestamp}.png`;
      const s3Key = `results/${user.id}/${filename}`;
      
      const uploadParams = {
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: s3Key,
        Body: imageBuffer,
        ContentType: 'image/png',
      };
      
      await s3Client.send(new PutObjectCommand(uploadParams));
      
      // Construct the S3 URL
      const s3Url = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
      
      // Save to database
      // Get client IP and user agent for analytics
      const headers = Object.fromEntries(request.headers);
      const ipAddress = headers['x-forwarded-for'] || 'unknown';
      const userAgent = headers['user-agent'] || 'unknown';
      
      const { data: generationData, error: dbError } = await supabase
        .from('generations')
        .insert({
          user_id: user.id,
          logo_url: logoUrl,
          logo_description: logoDescription,
          destination_prompt: destinationPrompt,
          result_url: s3Url,
          result_file_name: filename,
          status: 'completed',
          prompt: destinationPrompt,
          credit_cost: REQUIRED_CREDITS,
          width: 0,
          height: 0,
          ip_address: ipAddress,
          user_agent: userAgent,
          metadata: { 
            model: "flux-in-context",
            generation_type: "logo-to-anything"
          },
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (dbError) {
        console.error('Database error:', dbError);
        // Still return success but log the database error
      }
      
      return NextResponse.json({
        success: true,
        imageUrl: s3Url,
        generationId: generationData?.id || null,
      });
    } catch (processingError) {
      // If any error occurs during processing, attempt to refund credits
      console.error('Processing error:', processingError);
      
      try {
        await supabase
          .from('profiles')
          .update({ 
            remaining_credits: userData.remaining_credits 
          })
          .eq('id', user.id);
      } catch (refundError) {
        console.error('Failed to refund credits after error:', refundError);
      }
      
      throw processingError; // Re-throw to be caught by outer catch
    }
    
  } catch (error) {
    console.error('Error in put-logo-to-anything API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 