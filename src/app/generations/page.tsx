'use client'

import { Button } from '@/components/button'
import { Divider } from '@/components/divider'
import { Heading } from '@/components/heading'
import { Input, InputGroup } from '@/components/input'
import { Badge } from '@/components/badge'
import { Select } from '@/components/select'
import Link from 'next/link'
import { supabaseClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/dialog'
import { formatDistanceToNow } from 'date-fns'

interface Generation {
  id: string
  result_url: string
  logo_url: string
  logo_description: string
  destination_prompt: string
  created_at: string
  status: string
  user_id: string
}

export default function Generations() {
  const [generations, setGenerations] = useState<Generation[]>([])
  const [filteredGenerations, setFilteredGenerations] = useState<Generation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGeneration, setSelectedGeneration] = useState<Generation | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('date')

  useEffect(() => {
    async function fetchGenerations() {
      try {
        setLoading(true)
        
        // Get the current session
        const { data: { session } } = await supabaseClient.auth.getSession()
        
        if (!session) {
          console.error('No session found - user must be logged in')
          return
        }
        
        // Fetch generations for the current user only
        const { data, error } = await supabaseClient
          .from('generations')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
        
        if (error) {
          console.error('Error fetching generations:', error)
          return
        }
        
        setGenerations(data || [])
        setFilteredGenerations(data || [])
      } catch (error) {
        console.error('Error in fetchGenerations:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchGenerations()
  }, [])

  // Apply search and sort whenever generations, searchQuery or sortBy changes
  useEffect(() => {
    let result = [...generations]
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(gen => 
        (gen.destination_prompt && gen.destination_prompt.toLowerCase().includes(query)) ||
        (gen.logo_description && gen.logo_description.toLowerCase().includes(query))
      )
    }
    
    // Apply sorting
    switch (sortBy) {
      case 'date':
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        break
      case 'name':
        result.sort((a, b) => {
          const nameA = a.destination_prompt || ''
          const nameB = b.destination_prompt || ''
          return nameA.localeCompare(nameB)
        })
        break
      case 'status':
        result.sort((a, b) => {
          const statusA = a.status || ''
          const statusB = b.status || ''
          return statusA.localeCompare(statusB)
        })
        break
    }
    
    setFilteredGenerations(result)
  }, [generations, searchQuery, sortBy])

  const handleGenerationClick = (generation: Generation) => {
    setSelectedGeneration(generation)
    setIsModalOpen(true)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit'
    })
  }

  const getRelativeTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true })
    } catch (e) {
      return 'some time ago'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'green'
      case 'processing':
        return 'blue'
      case 'failed':
        return 'red'
      default:
        return 'zinc'
    }
  }

  return (
    <>
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4 sm:gap-0">
          <div>
            <Heading>Your Generations</Heading>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              View and manage all your logo generations
            </p>
          </div>
          <div className="flex items-center gap-4 self-stretch sm:self-auto">
            <div className="flex flex-col sm:flex-row gap-4 self-stretch sm:self-auto">
              <div>
                <InputGroup>
                  <Input 
                    name="search" 
                    placeholder="Search generations..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </InputGroup>
              </div>
              <div>
                <Select 
                  name="sort_by"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="date">Sort by date</option>
                  <option value="name">Sort by name</option>
                  <option value="status">Sort by status</option>
                </Select>
              </div>
            </div>
          </div>
          <Link href="/">
            <Button>Generate new</Button>
          </Link>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center min-h-[200px]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : filteredGenerations.length === 0 ? (
          <div className="mt-10 text-center p-10 border border-dashed border-zinc-300 rounded-lg dark:border-zinc-700">
            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">No generations found</h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {searchQuery ? "Try adjusting your search query" : "Create your first logo generation to see it here"}
            </p>
            <div className="mt-6">
              <Link href="/">
                <Button>Create your first generation</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGenerations.map((generation) => (
              <div 
                key={generation.id} 
                className="group relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleGenerationClick(generation)}
              >
                <div className="aspect-[4/3] bg-zinc-100 dark:bg-zinc-800 relative">
                  <img 
                    src={generation.result_url} 
                    alt="Generated result" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="max-w-[70%]"> {/* Limit width to prevent overlap */}
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                        {generation.destination_prompt || "Generated Image"}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 truncate">
                        {getRelativeTime(generation.created_at)}
                      </p>
                    </div>
                    <div className="min-w-fit"> {/* Prevent badge from shrinking */}
                      <Badge color={getStatusColor(generation.status)}>
                        {generation.status || "Completed"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Detail Modal */}
      {selectedGeneration && (
        <Dialog size="4xl" open={isModalOpen} onClose={() => setIsModalOpen(false)}>
          <DialogTitle>Generation Details</DialogTitle>
          <DialogDescription>
            Created {formatDate(selectedGeneration.created_at)} at {formatTime(selectedGeneration.created_at)}
          </DialogDescription>
          
          <DialogBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Original Logo</h3>
                <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-800 shadow-sm">
                  <img 
                    src={selectedGeneration.logo_url} 
                    alt="Original logo" 
                    className="w-full h-auto max-h-96 object-contain p-2"
                  />
                </div>
                <div className="mt-3">
                  <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Logo Description</h4>
                  <p className="text-sm mt-1 text-zinc-700 dark:text-zinc-300">
                    {selectedGeneration.logo_description || "No description provided"}
                  </p>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Generated Result</h3>
                <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-800 shadow-sm">
                  <img 
                    src={selectedGeneration.result_url} 
                    alt="Generated result" 
                    className="w-full h-auto max-h-96 object-contain p-2"
                  />
                </div>
                <div className="mt-3">
                  <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Destination Prompt</h4>
                  <p className="text-sm mt-1 text-zinc-700 dark:text-zinc-300">
                    {selectedGeneration.destination_prompt || "No prompt provided"}
                  </p>
                </div>
              </div>
            </div>
          </DialogBody>
          
          <DialogActions className="flex-wrap justify-between sm:flex-nowrap">
            <Button
              onClick={() => {
                const link = document.createElement('a');
                link.href = selectedGeneration.result_url;
                link.download = 'generated-result.png';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="w-full sm:w-auto order-1 sm:order-none mb-3 sm:mb-0"
            >
              Download Result
            </Button>
            <Button
              onClick={() => setIsModalOpen(false)}
              className="w-full sm:w-auto order-2 sm:order-none"
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  )
} 