import { Button } from '@/components/button';
import Link from 'next/link';

interface PageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function AuthCodeErrorPage({ searchParams }: PageProps) {
  const errorMessage = searchParams.error as string | undefined;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 dark:bg-zinc-900">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-800/70">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Authentication Error
          </h1>
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            There was a problem processing your sign-in request. This could happen for a few reasons:
          </p>
          <ul className="mt-4 text-left text-sm text-zinc-600 dark:text-zinc-400 space-y-2">
            <li>• The authentication link expired</li>
            <li>• The URL was modified or incomplete</li>
            <li>• There was a temporary server issue</li>
          </ul>
          
          {errorMessage && (
            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-md text-left dark:bg-red-900/20 dark:border-red-900/30">
              <p className="text-sm font-medium text-red-700 dark:text-red-400">Error details:</p>
              <p className="text-sm text-red-600 dark:text-red-300 break-words">{errorMessage}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-4 pt-4">
          <Link href="/login" className="w-full">
            <Button className="w-full h-12 bg-blue-600 border border-blue-700 text-white font-semibold hover:bg-blue-700 dark:bg-blue-600 dark:border-blue-700 dark:text-white dark:hover:bg-blue-700">
              Try Again
            </Button>
          </Link>
          <Link href="/" className="text-sm text-blue-600 hover:text-blue-500 hover:underline dark:text-blue-400">
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
} 