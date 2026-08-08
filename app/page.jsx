"use client";
import Hero from "@/components/Hero";
import Services from "@/components/Services";
import FaixaColoracao from "@/components/Coloracao/FaixaColoracao";
import About from "@/components/About";
import Work from "@/components/Work/Work";
import Contact from "@/components/Contact";
import FixedMenu from "@/components/FixedMenu";
import Testimonial from "@/components/Testimonial";
import Footer from "@/components/Footer";
import Palestra from "@/components/Palestra";

const Home = () => {
  return (
    <>
      <main id="inicio">
        <Hero />
        <FixedMenu />
        <Services />
        <FaixaColoracao />
        <About />
        <Work />
        <Testimonial />
        <Palestra />
        <Contact />
      </main>
      <Footer />
    </>
  );
};

export default Home;
