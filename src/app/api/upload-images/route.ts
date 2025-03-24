import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

// Helper function to create a response with CORS headers
function corsResponse(body: any, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// Handle preflight requests
export async function OPTIONS() {
  return corsResponse({});
}

export async function POST(request: Request) {
  try {
    // Get access token from Authorization header
    const authHeader = request.headers.get('Authorization') || '';
    const accessToken = authHeader.replace('Bearer ', '');
    
    if (!accessToken) {
      console.log('No access token provided in Authorization header');
      return corsResponse({ error: 'Unauthorized - Please sign in' }, 401);
    }
    
    // Create a Supabase client with the access token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      }
    );
    
    // Get the user data directly with the token
    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
    
    // Debug auth info
    console.log('Auth check:', { 
      hasToken: !!accessToken,
      hasUser: !!user,
      userId: user?.id,
      error: userError?.message
    });
    
    if (userError || !user) {
      console.error('Invalid token or user not found:', userError?.message);
      return corsResponse({ error: 'Unauthorized - Invalid credentials' }, 401);
    }
    
    const userId = user.id;

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const promptText = formData.get('promptText') as string || '';
    
    if (!file) {
      return corsResponse({ error: 'No file provided' }, 400);
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Generate a unique filename
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const imageType = formData.get('imageType') as string || 'image';
    const fileName = `${imageType}_${timestamp}.${fileExtension}`;
    
    const bucketName = process.env.S3_BUCKET_NAME;
    if (!bucketName) {
      throw new Error('S3_BUCKET_NAME is not defined in environment variables');
    }

    // Add the proper prefix to the fileName based on image type
    const s3Key = `logos/${user.id}/${fileName}`;

    const uploadParams = {
      Bucket: bucketName,
      Key: s3Key,
      Body: buffer,
      ContentType: file.type,
    };

    await s3Client.send(new PutObjectCommand(uploadParams));

    const imageUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

    // Skip inserting into the database - this will now only happen in the put-logo-to-anything endpoint
    // Just return the image URL so it can be used by the next step
    
    console.log('Image uploaded successfully:', imageUrl);
    return corsResponse({ 
      success: true, 
      imageUrl
    });

  } catch (error) {
    console.error('Error uploading image to S3:', error);
    return corsResponse({ 
      success: false, 
      error: 'Failed to upload image to S3',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
} 