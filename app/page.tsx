import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import HeroSection from '@/components/landing/HeroSection'
import HowItWorks from '@/components/landing/HowItWorks'
import FeatureHighlights from '@/components/landing/FeatureHighlights'
import DemoWorkspace from '@/components/demo/DemoWorkspace'

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <DemoWorkspace />
      <HowItWorks />
      <FeatureHighlights />
      <Footer />
    </main>
  )
}
