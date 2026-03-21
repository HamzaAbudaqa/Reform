import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import HeroSection from '@/components/landing/HeroSection'
import HowItWorks from '@/components/landing/HowItWorks'
import FeatureHighlights from '@/components/landing/FeatureHighlights'

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden" style={{ background: '#13111c' }}>
      <Navbar />
      <HeroSection />
      <HowItWorks />
      <FeatureHighlights />
      <Footer />
    </main>
  )
}
