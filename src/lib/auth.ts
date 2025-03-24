import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

/**
 * Helper function to get the session on the server side
 */
export async function getSession() {
  return await getServerSession();
}

/**
 * Helper function to check if the user is authenticated on the server side
 * Useful for server components that need to check authentication
 */
export async function getCurrentUser() {
  const session = await getSession();
  return session?.user;
}

/**
 * Helper function to protect server routes
 * Redirects to login page if not authenticated
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect("/login");
  }

  return user;
}

/**
 * Helper function for pages that should only be accessible when logged out
 * Redirects to home page if already authenticated
 */
export async function requireNoAuth() {
  const user = await getCurrentUser();
  
  if (user) {
    redirect("/");
  }
} 