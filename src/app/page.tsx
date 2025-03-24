'use client'

import { Avatar } from '@/components/avatar'
import { Button } from '@/components/button'
import { Divider } from '@/components/divider'
import { Heading, Subheading } from '@/components/heading'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/table'
import { Text } from '@/components/text'
import { getEvents, getRecentOrders } from '@/data'
import { CloudArrowUpIcon } from '@heroicons/react/20/solid'
import { ArrowPathIcon, ExclamationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react'
import { supabaseClient } from '@/utils/supabase/client'
import { Container } from '@/components/container'
import { Label } from '@/components/label'
import { Textarea } from '@/components/textarea'
import { useRouter } from 'next/navigation'

// Define interfaces for our data
interface Order {
  id: number;
  url: string;
  date: string;
  amount: {
    usd: string;
    cad: string;
    fee: string;
    net: string;
  };
  payment: {
    transactionId: string;
    card: {
      number: string;
      type: string;
      expiry: string;
    };
  };
  customer: any;
  event: any;
}

interface Generation {
  id: number;
  name: string;
  url: string;
  date: string;
  time: string;
  location: string;
  totalRevenue: string;
  totalRevenueChange: string;
  ticketsAvailable: number;
  ticketsSold: number;
  ticketsSoldChange: string;
  status: string;
  imgUrl: string;
  thumbUrl: string;
}

export default function Home() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [recentGenerations, setRecentGenerations] = useState<Generation[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [resultImageUrl, setResultImageUrl] = useState('');
  const [promptText, setPromptText] = useState('');
  const [logoDescription, setLogoDescription] = useState('');
  const [validationErrors, setValidationErrors] = useState<{
    logoFile?: string;
    logoDescription?: string;
    promptText?: string;
  }>({});
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [creditInfo, setCreditInfo] = useState<{
    current: number;
    required: number;
  }>({ current: 0, required: 2 });
  const router = useRouter();
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const ordersData = await getRecentOrders();
        setOrders(ordersData);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    
    fetchData();
  }, []);
  
  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setLogoFile(file);
    if (file) {
      const preview = URL.createObjectURL(file);
      setLogoPreview(preview);
      
      // Clear validation error when file is uploaded
      setValidationErrors(prev => ({ ...prev, logoFile: undefined }));
    }
  };

  const validateForm = () => {
    const errors: {
      logoFile?: string;
      logoDescription?: string;
      promptText?: string;
    } = {};
    
    if (!logoFile) {
      errors.logoFile = "Please select a logo image";
    }
    
    if (!logoDescription.trim()) {
      errors.logoDescription = "Please describe your logo";
    }
    
    if (!promptText.trim()) {
      errors.promptText = "Please enter a destination prompt";
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleGenerate = async () => {
    if (!validateForm()) {
      return;
    }
    
    try {
      setIsUploading(true);
      
      // Get current Supabase session
      const { data: { session } } = await supabaseClient.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }
      
      // Check remaining credits BEFORE uploading anything
      const { data: userData, error: creditsError } = await supabaseClient
        .from('profiles')
        .select('remaining_credits')
        .eq('id', session.user.id)
        .single();
        
      if (creditsError) {
        console.error('Error checking credits:', creditsError);
        alert('Could not verify your available credits. Please try again.');
        return;
      }
      
      // Check if user has enough credits
      const requiredCredits = 2;
      if (!userData || userData.remaining_credits < requiredCredits) {
        // Show credits modal instead of alert
        setCreditInfo({
          current: userData?.remaining_credits || 0,
          required: requiredCredits
        });
        setShowCreditsModal(true);
        setIsUploading(false);
        return;
      }
      
      // Only upload logo if user has enough credits
      const logoFormData = new FormData();
      logoFormData.append('file', logoFile!);
      logoFormData.append('imageType', 'logo');
      
      const logoUploadResponse = await fetch('/api/upload-images', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: logoFormData,
        credentials: 'include',
      });
      
      const logoResult = await logoUploadResponse.json();
      
      if (!logoResult.success) {
        throw new Error(logoResult.error || 'Failed to upload logo image');
      }
      
      // Call the logo-to-anything API
      const generateResponse = await fetch('/api/put-logo-to-anything', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          logoUrl: logoResult.imageUrl,
          logoDescription: logoDescription,
          destinationPrompt: promptText
        }),
        credentials: 'include',
      });
      
      const generateResult = await generateResponse.json();
      
      if (!generateResult.success) {
        throw new Error(generateResult.error || 'Failed to generate image');
      }
      
      console.log('Image generated successfully:', generateResult.imageUrl);
      setResultImageUrl(generateResult.imageUrl);
      
    } catch (error) {
      console.error('Error during generation process:', error);
      alert('Failed to generate. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };
  
  return (
    <>
      {/* Main Content Section */}
      <Container className="pt-2 sm:pt-4">
        <div className="py-2 sm:py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Logo Upload Section */}
            <div className="flex flex-col space-y-3">
              <Heading className="mb-2">Drop your logo here</Heading>
              
              <div className="flex flex-col space-y-3">
                <label
                  htmlFor="logo-upload"
                  className={`relative flex h-64 cursor-pointer flex-col items-center justify-center rounded-lg border-2 ${validationErrors.logoFile ? 'border-red-300 bg-red-50' : 'border-dashed border-zinc-300 bg-zinc-50'} hover:bg-zinc-100 group`}
                >
                  {logoPreview ? (
                    <div className="relative w-full h-full">
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="h-full w-full object-contain p-2"
                      />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 bg-white/10 backdrop-blur-sm transition-all duration-200 group-hover:opacity-100">
                        <button 
                          className="bg-white/90 text-zinc-800 px-4 py-2 rounded-md font-medium shadow-sm hover:bg-white transition-all"
                          onClick={(e) => {
                            e.preventDefault();
                            const fileInput = document.getElementById('logo-upload') as HTMLInputElement;
                            if (fileInput) fileInput.click();
                          }}
                        >
                          Change Logo
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col items-center justify-center pb-4 pt-4">
                        <svg
                          className={`mb-2 h-8 w-8 ${validationErrors.logoFile ? 'text-red-500' : 'text-zinc-500'}`}
                          aria-hidden="true"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 20 16"
                        >
                          <path
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
                          />
                        </svg>
                        <p className={`mb-1 text-sm ${validationErrors.logoFile ? 'text-red-500 font-medium' : 'text-zinc-500'}`}>
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className={`text-xs ${validationErrors.logoFile ? 'text-red-500' : 'text-zinc-500'}`}>PNG, JPG or GIF (MAX. 5MB)</p>
                        
                        {validationErrors.logoFile && (
                          <div className="flex items-center mt-2 text-sm text-red-500">
                            <ExclamationCircleIcon className="h-4 w-4 mr-1" />
                            {validationErrors.logoFile}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                </label>
                
                <div className="mt-1">
                  <div className="flex justify-between">
                    <Label htmlFor="logo-description">Describe your logo</Label>
                    {validationErrors.logoDescription && (
                      <span className="text-xs text-red-500 flex items-center">
                        <ExclamationCircleIcon className="h-4 w-4 mr-1" />
                        {validationErrors.logoDescription}
                      </span>
                    )}
                  </div>
                  <Textarea
                    id="logo-description"
                    placeholder="Describe your logo (e.g. 'a minimalist white logo on a black background')"
                    rows={3}
                    value={logoDescription}
                    onChange={(e) => {
                      setLogoDescription(e.target.value);
                      if (e.target.value.trim()) {
                        setValidationErrors(prev => ({ ...prev, logoDescription: undefined }));
                      }
                    }}
                    className={`mt-1 ${validationErrors.logoDescription ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                  />
                </div>
                
                <div className="mt-1">
                  <div className="flex justify-between">
                    <Label htmlFor="destination-prompt">Destination prompt</Label>
                    {validationErrors.promptText && (
                      <span className="text-xs text-red-500 flex items-center">
                        <ExclamationCircleIcon className="h-4 w-4 mr-1" />
                        {validationErrors.promptText}
                      </span>
                    )}
                  </div>
                  <Textarea
                    id="destination-prompt"
                    placeholder="Describe where you want to see your logo (e.g. 'a coffee mug', 'a billboard in times square', 'a rainbow tie dye hat')"
                    rows={3}
                    value={promptText}
                    onChange={(e) => {
                      setPromptText(e.target.value);
                      if (e.target.value.trim()) {
                        setValidationErrors(prev => ({ ...prev, promptText: undefined }));
                      }
                    }}
                    className={`mt-1 ${validationErrors.promptText ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                  />
                </div>
              </div>
            </div>

            {/* Results Section */}
            <div className="flex flex-col space-y-3">
              <Heading className="mb-2">Results</Heading>
              
              <div className="flex h-[400px] w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50">
                {isUploading ? (
                  <div className="flex flex-col items-center justify-center text-center p-4">
                    <svg className="animate-spin h-12 w-12 text-blue-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-lg font-medium text-zinc-700">Generating your image...</p>
                    <p className="text-sm text-zinc-500 mt-2">This may take 15-30 seconds</p>
                  </div>
                ) : resultImageUrl ? (
                  <img
                    src={resultImageUrl}
                    alt="Generated result"
                    className="h-full w-full object-contain p-2"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-zinc-500 p-4 text-center">
                    <svg className="h-16 w-16 text-zinc-300 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-lg font-medium text-zinc-700 mb-1">No result yet</p>
                    <p className="text-sm text-zinc-500">Upload a logo, enter a description and destination to generate a result</p>
                  </div>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-2">
                {resultImageUrl && (
                  <a 
                    href={resultImageUrl}
                    download="generated-logo-result.png"
                    className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 text-base font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2"
                  >
                    Download image
                  </a>
                )}
                
                <button
                  className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 text-base font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-md shadow-sm hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  onClick={handleGenerate}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating...
                    </>
                  ) : (
                    'Generate Image'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Container>

      {/* Credits Warning Modal */}
      {showCreditsModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-sm overflow-hidden">
            <div className="p-5">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Insufficient Credits</h3>
              
              <p className="text-sm text-gray-600 mb-5">
                You have <span className="font-medium text-gray-900">{creditInfo.current}</span> credits remaining. This operation requires <span className="font-medium text-gray-900">{creditInfo.required}</span> credits.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    router.push('/pricing');
                    setShowCreditsModal(false);
                  }}
                  className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white font-medium py-2 px-4 rounded-md text-sm shadow-sm transition-colors"
                >
                  Upgrade Now
                </button>
                
                <button
                  onClick={() => setShowCreditsModal(false)}
                  className="flex-1 bg-white hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded-md border border-gray-300 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
