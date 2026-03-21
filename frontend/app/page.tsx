import { Suspense } from 'react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import HeroSection from '@/components/landing/HeroSection'
import HowItWorks from '@/components/landing/HowItWorks'
import FeatureHighlights from '@/components/landing/FeatureHighlights'
import InteractiveBackground from '@/components/landing/InteractiveBackground'
import DemoWorkspace from '@/components/demo/DemoWorkspace'

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden" style={{ background: '#13111c' }}>
      <InteractiveBackground />
      <div className="relative" style={{ zIndex: 1 }}>
        <Navbar />
        <HeroSection />
        <Suspense fallback={null}>
          <DemoWorkspace />
        </Suspense>
        <HowItWorks />
        <FeatureHighlights />
        <Footer />
      </div>
    </main>
  )
}
