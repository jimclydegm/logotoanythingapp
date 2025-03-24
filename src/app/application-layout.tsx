'use client'

import { Avatar } from '@/components/avatar'
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
} from '@/components/dropdown'
import { Navbar, NavbarItem, NavbarSection, NavbarSpacer } from '@/components/navbar'
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/dialog'
import {
  Sidebar,
  SidebarBody,
  SidebarFooter,
  SidebarHeader,
  SidebarHeading,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
  SidebarSpacer,
} from '@/components/sidebar'
import { SidebarLayout } from '@/components/sidebar-layout'
import {
  ArrowRightStartOnRectangleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Cog8ToothIcon,
  LightBulbIcon,
  PlusIcon,
  ShieldCheckIcon,
  UserCircleIcon,
} from '@heroicons/react/16/solid'
import {
  Cog6ToothIcon,
  HomeIcon,
  QuestionMarkCircleIcon,
  SparklesIcon,
  Square2StackIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/20/solid'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/button'
import Link from 'next/link'
import { useEffect, useState, useContext } from 'react'
import { supabaseClient } from '@/utils/supabase/client'
import { Session } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { SidebarContext } from '@/components/sidebar-layout'

function AccountDropdownMenu({ anchor, onSignOut }: { anchor: 'top start' | 'bottom end', onSignOut: () => void }) {
  return (
    <DropdownMenu className="min-w-64" anchor={anchor}>
      <DropdownItem href="/profile">
        <UserCircleIcon />
        <DropdownLabel>My account</DropdownLabel>
      </DropdownItem>
      <DropdownDivider />
      <DropdownItem href="#">
        <ShieldCheckIcon />
        <DropdownLabel>Privacy policy</DropdownLabel>
      </DropdownItem>
      <DropdownItem href="#">
        <LightBulbIcon />
        <DropdownLabel>Share feedback</DropdownLabel>
      </DropdownItem>
      <DropdownDivider />
      <DropdownItem onClick={onSignOut}>
        <ArrowRightStartOnRectangleIcon />
        <DropdownLabel>Sign out</DropdownLabel>
      </DropdownItem>
    </DropdownMenu>
  )
}

interface Generation {
  id: string;
  destination_prompt: string;
  result_url: string;
  logo_url: string;
  logo_description: string;
  created_at: string;
}

export function ApplicationLayout({
  children,
  events,
}: {
  children: React.ReactNode
  events: {
    id: number;
    name: string;
    url: string;
    date: string;
    time: string;
    location: string;
    totalRevenue: string;
    totalRevenueChange: string;
    ticketsAvailable: number;
    thumbUrl: string;
  }[];
}) {
  const pathname = usePathname()
  const [remainingCredits, setRemainingCredits] = useState<number | null>(null)
  const [userIsAuthenticated, setUserIsAuthenticated] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [recentGenerations, setRecentGenerations] = useState<Generation[]>([])
  const [selectedGeneration, setSelectedGeneration] = useState<Generation | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const router = useRouter()
  const { setShowSidebar } = useContext(SidebarContext)

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabaseClient.auth.getSession()
      setSession(session)
      const isAuthenticated = !!session
      setUserIsAuthenticated(isAuthenticated)

      if (isAuthenticated) {
        // Fetch remaining credits
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('remaining_credits')
          .eq('id', session.user.id)
          .single()
        
        if (profile) {
          setRemainingCredits(profile.remaining_credits)
        }

        // Set up real-time subscription for profile changes
        const profileSubscription = supabaseClient
          .channel('profile_changes')
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'profiles',
              filter: `id=eq.${session.user.id}`
            },
            (payload) => {
              if (payload.new.remaining_credits !== undefined) {
                setRemainingCredits(payload.new.remaining_credits)
              }
            }
          )
          .subscribe()

        // Fetch recent generations with additional fields
        const { data: generations, error } = await supabaseClient
          .from('generations')
          .select('id, destination_prompt, result_url, logo_url, logo_description, created_at')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(8)

        if (!error && generations) {
          setRecentGenerations(generations)
        }

        return () => {
          profileSubscription.unsubscribe()
        }
      }

      // Set up auth state listener
      const {
        data: { subscription },
      } = supabaseClient.auth.onAuthStateChange((_event, newSession) => {
        setSession(newSession)
        const isAuthenticated = !!newSession
        setUserIsAuthenticated(isAuthenticated)
        
        // Refetch generations when auth state changes
        if (isAuthenticated) {
          supabaseClient
            .from('generations')
            .select('id, destination_prompt, result_url, logo_url, logo_description, created_at')
            .eq('user_id', newSession.user.id)
            .order('created_at', { ascending: false })
            .limit(8)
            .then(({ data: generations, error }) => {
              if (!error && generations) {
                setRecentGenerations(generations)
              }
            })
        } else {
          setRecentGenerations([])
        }
      })

      return () => {
        subscription.unsubscribe()
      }
    }

    fetchSession()
  }, [])

  const handleSignOut = async () => {
    await supabaseClient.auth.signOut()
    window.location.href = '/'
  }

  const handleSignIn = () => {
    setShowSidebar(false)
    router.push('/login')
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

  return (
    <SidebarLayout
      navbar={
        <Navbar>
          <NavbarSpacer />
          <NavbarSection>
            {userIsAuthenticated && session ? (
              <Dropdown>
                <DropdownButton as={NavbarItem}>
                  <Avatar
                    src={session.user?.user_metadata?.avatar_url || null}
                    square
                    initials={session.user?.email?.[0]?.toUpperCase() || 'U'}
                  />
                </DropdownButton>
                <AccountDropdownMenu anchor="bottom end" onSignOut={handleSignOut} />
              </Dropdown>
            ) : null}
          </NavbarSection>
        </Navbar>
      }
      sidebar={
        <Sidebar>
          <SidebarHeader>
            <SidebarItem href="/">
              <Avatar src="/teams/catalyst.svg" />
              <SidebarLabel>LogoToAnything</SidebarLabel>
            </SidebarItem>
          </SidebarHeader>

          <SidebarBody>
            <SidebarSection>
              <SidebarItem href="/" current={pathname === '/'}>
                <HomeIcon />
                <SidebarLabel>Home</SidebarLabel>
              </SidebarItem>
              
              {/* Only show these items if user is authenticated */}
              {userIsAuthenticated && (
                <>
                  <SidebarItem href="/generations" current={pathname.startsWith('/generations')}>
                    <Square2StackIcon />
                    <SidebarLabel>Generations</SidebarLabel>
                  </SidebarItem>
                  <SidebarItem href="/credits" current={pathname.startsWith('/credits')}>
                    <SparklesIcon />
                    <SidebarLabel>Credits {remainingCredits !== null && `(${remainingCredits})`}</SidebarLabel>
                  </SidebarItem>
                  {/* Settings temporarily disabled
                  <SidebarItem href="/settings" current={pathname.startsWith('/settings')} disabled>
                    <Cog6ToothIcon />
                    <SidebarLabel>Settings</SidebarLabel>
                  </SidebarItem>
                  */}
                </>
              )}
              
              {/* Show pricing for everyone */}
              <SidebarItem href="/pricing" current={pathname.startsWith('/pricing')}>
                <CurrencyDollarIcon />
                <SidebarLabel>Pricing</SidebarLabel>
              </SidebarItem>
            </SidebarSection>

            {/* Only show recent generations if authenticated */}
            {userIsAuthenticated && (
              <SidebarSection className="max-lg:hidden">
                <SidebarHeading>Recent Generations</SidebarHeading>
                {recentGenerations.map((generation) => (
                  <SidebarItem 
                    key={generation.id} 
                    onClick={() => {
                      setSelectedGeneration(generation)
                      setIsModalOpen(true)
                    }}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <div className="relative h-8 w-8 flex-shrink-0">
                      <img
                        src={generation.result_url}
                        alt="Generation preview"
                        className="h-8 w-8 rounded-full object-cover ring-1 ring-zinc-200 dark:ring-zinc-800"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        {generation.destination_prompt || "Generated Image"}
                      </p>
                    </div>
                  </SidebarItem>
                ))}
                {recentGenerations.length === 0 && (
                  <div className="text-sm text-zinc-500 dark:text-zinc-400 px-2 py-1">
                    No recent generations
                  </div>
                )}
              </SidebarSection>
            )}

            <SidebarSpacer />

            <SidebarSection>
              <SidebarItem href="#">
                <QuestionMarkCircleIcon />
                <SidebarLabel>Help (Coming soon)</SidebarLabel>
              </SidebarItem>
            </SidebarSection>
          </SidebarBody>

          <SidebarFooter>
            {userIsAuthenticated && session ? (
              <Dropdown>
                <DropdownButton as={SidebarItem}>
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar 
                      src={session?.user?.user_metadata?.avatar_url || null}
                      className="size-10" 
                      square 
                      alt="" 
                      initials={session?.user?.email?.[0]?.toUpperCase() || 'U'}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm/5 font-medium text-zinc-950 dark:text-white">
                        {session?.user?.user_metadata?.full_name || session?.user?.email || 'User'}
                      </span>
                      <span className="block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400">
                        {session?.user?.email || ''}
                      </span>
                    </span>
                  </span>
                  <ChevronUpIcon />
                </DropdownButton>
                <AccountDropdownMenu anchor="top start" onSignOut={handleSignOut} />
              </Dropdown>
            ) : (
              <SidebarItem href="/login">
                <UserCircleIcon />
                <SidebarLabel>Sign In</SidebarLabel>
              </SidebarItem>
            )}
          </SidebarFooter>
        </Sidebar>
      }
    >
      {children}

      {/* Generation Preview Modal */}
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
          
          <DialogActions>
            <Button
              onClick={() => {
                const link = document.createElement('a');
                link.href = selectedGeneration.result_url;
                link.download = 'generated-result.png';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
            >
              Download Result
            </Button>
            <Button onClick={() => setIsModalOpen(false)}>
              Close
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </SidebarLayout>
  )
}
