import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaWhatsapp } from "react-icons/fa";
import { whatsApp } from '@/public/consts/whatsApp';

const WhatsAppButton = () => {
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowButton(window.scrollY > 150);
    };
    
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const linkWhatsApp = `https://wa.me/${whatsApp.telefone}?text=${encodeURIComponent(whatsApp.mensagem)}`;

  return (
    <AnimatePresence>
      {showButton && (
        <motion.a
          href={linkWhatsApp}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 40 }}
          className="fixed bottom-6 right-6 z-50 bg-green-500 text-white w-16 h-16 rounded-full flex items-center justify-center shadow-lg cursor-pointer"
        >
          <FaWhatsapp className="text-3xl" />
        </motion.a>
      )}
    </AnimatePresence>
  );
};

export default WhatsAppButton;
