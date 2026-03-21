'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function DashboardRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const repo = searchParams.get('repo')

  useEffect(() => {
    const destination = repo
      ? `/dashboard/discovery?repo=${encodeURIComponent(repo)}`
      : '/dashboard/discovery'
    router.replace(destination)
  }, [repo, router])

  return null
}

export default function DashboardIndex() {
  return (
    <Suspense fallback={null}>
      <DashboardRedirect />
    </Suspense>
  )
}
