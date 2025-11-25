import NextAuth, { DefaultSession } from "next-auth"
import authConfig from "@/lib/auth.config"


// Extend the Session type to include supabaseAccessToken and user.id
declare module 'next-auth' {
	interface Session {
		supabaseAccessToken?: string
		user: {
			id: string
		} & DefaultSession["user"]
	}
}

const handler = NextAuth({
	...authConfig,
})

export const { auth, signIn, signOut } = handler
export const { GET, POST } = handler.handlers