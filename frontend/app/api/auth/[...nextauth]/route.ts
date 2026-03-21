import NextAuth from 'next-auth'
import GithubProvider from 'next-auth/providers/github'

const handler = NextAuth({
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
      authorization: {
        params: {
          // Request repo scope so we can list and create repos
          scope: 'read:user user:email repo',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Persist the GitHub access token so we can call the API
      if (account?.access_token) {
        token.accessToken = account.access_token
      }
      return token
    },
    async session({ session, token }) {
      // Make the access token available client-side via useSession()
      session.accessToken = token.accessToken as string
      return session
    },
  },
  pages: {
    signIn: '/new',
  },
})

export { handler as GET, handler as POST }
