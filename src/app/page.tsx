import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import FeaturesSection from "@/components/FeaturesSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import StatsSection from "@/components/StatsSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import PricingSection from "@/components/PricingSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";

// Feature flags pour la landing page
const SHOW_STATS = false; // Stats actuellement fictives — à basculer vers vrai compteur backend
const SHOW_TESTIMONIALS = false; // Témoignages fictifs hors-Guinée — à remplacer par vrais utilisateurs

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        {SHOW_STATS && <StatsSection />}
        {SHOW_TESTIMONIALS && <TestimonialsSection />}
        <PricingSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
