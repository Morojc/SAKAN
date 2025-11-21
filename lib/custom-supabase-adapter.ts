import { createClient } from "@supabase/supabase-js";
import { isDate, type Adapter } from "@auth/core/adapters";

export function format<T>(obj: Record<string, any>): T {
    for (const [key, value] of Object.entries(obj)) {
        if (value === null) {
            delete obj[key];
        }
        if (isDate(value)) {
            obj[key] = new Date(value);
        }
    }
    return obj as T;
}

export interface CustomSupabaseAdapterOptions {
    url: string;
    secret: string;
    schema?: string;
}

export function CustomSupabaseAdapter(options: CustomSupabaseAdapterOptions): Adapter {
    const { url, secret, schema = "next_auth" } = options;
    const supabase = createClient(url, secret, {
        db: { schema },
        global: { headers: { "X-Client-Info": "@auth/supabase-adapter" } },
        auth: { persistSession: false },
    });

    // Helper function to log and throw errors with context
    const handleError = (operation: string, error: any, context?: any) => {
        console.error(`[Supabase Adapter] Error in ${operation}:`, {
            error: error?.message || error,
            code: error?.code,
            details: error?.details,
            hint: error?.hint,
            context,
            schema,
        });
        throw error;
    };

    return {
        async createUser(user) {
            const { data, error } = await supabase
                .from("users")
                .insert({
                    ...user,
                    emailVerified: user.emailVerified?.toISOString(),
                })
                .select()
                .single();
            if (error) handleError("createUser", error, { userEmail: user.email });
            return format(data);
        },
        async getUser(id) {
            const { data, error } = await supabase
                .from("users")
                .select()
                .eq("id", id)
                .maybeSingle();
            if (error) handleError("getUser", error, { userId: id });
            if (!data) return null;
            return format(data);
        },
        async getUserByEmail(email) {
            const { data, error } = await supabase
                .from("users")
                .select()
                .eq("email", email)
                .maybeSingle();
            if (error) handleError("getUserByEmail", error, { email });
            if (!data) return null;
            return format(data);
        },
        async getUserByAccount({ providerAccountId, provider }) {
            const { data, error } = await supabase
                .from("accounts")
                .select("users (*)")
                .match({ provider, providerAccountId })
                .maybeSingle();
            if (error) handleError("getUserByAccount", error, { provider, providerAccountId });
            if (!data || !data.users) return null;
            return format(data.users);
        },
        async updateUser(user) {
            const { data, error } = await supabase
                .from("users")
                .update({
                    ...user,
                    emailVerified: user.emailVerified?.toISOString(),
                })
                .eq("id", user.id)
                .select()
                .single();
            if (error) handleError("updateUser", error, { userId: user.id });
            return format(data);
        },
        async deleteUser(userId) {
            const { error } = await supabase.from("users").delete().eq("id", userId);
            if (error) handleError("deleteUser", error, { userId });
        },
        async linkAccount(account) {
            // Convert expiresAt from milliseconds to seconds if present (database expects BIGINT in seconds)
            const accountData = {
                ...account,
                expiresAt: account.expiresAt && typeof account.expiresAt === 'number' 
                    ? Math.floor(account.expiresAt / 1000) 
                    : account.expiresAt,
            };
            const { error } = await supabase
                .from("accounts")
                .insert(accountData);
            if (error) handleError("linkAccount", error, { 
                provider: account.provider, 
                userId: account.userId,
                accountData: Object.keys(accountData)
            });
        },
        async unlinkAccount({ providerAccountId, provider }) {
            const { error } = await supabase
                .from("accounts")
                .delete()
                .match({ provider, providerAccountId });
            if (error) handleError("unlinkAccount", error, { provider, providerAccountId });
        },
        async createSession({ sessionToken, userId, expires }) {
            const { data, error } = await supabase
                .from("sessions")
                .insert({ sessionToken, userId, expires: expires.toISOString() })
                .select()
                .single();
            if (error) handleError("createSession", error, { userId, sessionToken });
            return format(data);
        },
        async getSessionAndUser(sessionToken) {
            const { data, error } = await supabase
                .from("sessions")
                .select("*, users(*)")
                .eq("sessionToken", sessionToken)
                .maybeSingle();
            if (error) handleError("getSessionAndUser", error, { sessionToken });
            if (!data) return null;
            const { users: user, ...session } = data;
            return {
                user: format(user),
                session: format(session),
            };
        },
        async updateSession(session) {
            const { data, error } = await supabase
                .from("sessions")
                .update({
                    ...session,
                    expires: session.expires?.toISOString(),
                })
                .eq("sessionToken", session.sessionToken)
                .select()
                .single();
            if (error) handleError("updateSession", error, { sessionToken: session.sessionToken });
            return format(data);
        },
        async deleteSession(sessionToken) {
            const { error } = await supabase
                .from("sessions")
                .delete()
                .eq("sessionToken", sessionToken);
            if (error) handleError("deleteSession", error, { sessionToken });
        },
        async createVerificationToken(token) {
            const { data, error } = await supabase
                .from("verification_tokens")
                .insert({
                    ...token,
                    expires: token.expires.toISOString(),
                })
                .select()
                .single();
            if (error) handleError("createVerificationToken", error, { identifier: token.identifier });
            const { id, ...verificationToken } = data;
            return format(verificationToken);
        },
        async useVerificationToken({ identifier, token }) {
            const { data, error } = await supabase
                .from("verification_tokens")
                .delete()
                .match({ identifier, token })
                .select()
                .maybeSingle();
            if (error) handleError("useVerificationToken", error, { identifier, token });
            if (!data) return null;
            const { id, ...verificationToken } = data;
            return format(verificationToken);
        },
    };
}

