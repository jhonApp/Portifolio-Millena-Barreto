"use client";
import Script from "next/script";
import Hero from "@/components/Hero";
import Services from "@/components/Services";
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
      {/* Google Analytics - GA4 */}
      <Script
        strategy="afterInteractive"
        src="https://www.googletagmanager.com/gtag/js?id=G-3NYKM6Q9VQ"
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-3NYKM6Q9VQ');
          `,
        }}
      />
      <Hero />
      <FixedMenu />
      <Services />
      <About />
      <Work />
      <Testimonial />
      <Palestra />
      <Contact />
      <Footer />
    </>
  );
};

export default Home;
