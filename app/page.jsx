"use client";
import { useEffect } from "react";
import Head from 'next/head';
import Hero from "../components/Hero";
import Services from "../components/Services";
import About from "../components/About";
import Work from "../components/Work/Work";
import Contact from "../components/Contact";
import FixedMenu from "../components/FixedMenu";
import Testimonial from "../components/Testimonial";
import Footer from "../components/Footer";
import Palestra from "../components/Palestra";

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
      <Head>
        <title>Consultoria de Estilo - Millena Barreto</title>
        <meta name="description" content="Consultoria de imagem e estilo para mulheres que querem se vestir com confiança." />
        <meta name="keywords" content="consultoria de estilo, moda, imagem pessoal, coloração pessoal" />
        <meta name="author" content="Millena Barreto" />
        <meta name="robots" content="index, follow" />
      </Head>
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
