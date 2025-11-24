import NextAuth from "next-auth"
import authConfig from "@/lib/auth.config"


// Extend the Session type to include supabaseAccessToken
declare module 'next-auth' {
	interface Session {
		supabaseAccessToken?: string
	}
}

const handler = NextAuth({
	...authConfig,
})

export const { auth, signIn, signOut } = handler
export const { GET, POST } = handler.handlers