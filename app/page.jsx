"use client";
import { useEffect } from "react";
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
  useEffect(() => {
    const loadLocomotiveScroll = async () => {
      const LocomotiveScroll = (await import("locomotive-scroll")).default;
      new LocomotiveScroll();
    };
    loadLocomotiveScroll();
  }, []);

  return (
    <>
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
