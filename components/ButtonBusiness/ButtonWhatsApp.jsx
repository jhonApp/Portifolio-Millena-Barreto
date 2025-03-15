import React from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import { whatsApp } from '@/public/consts/whatsApp';

const ButtonWhatsApp = () => {
  const linkWhatsApp = `https://wa.me/${whatsApp.telefone}?text=${encodeURIComponent(whatsApp.mensagem)}`;

  return (
    <a
      href={linkWhatsApp}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 bg-green-500 text-white font-bold text-lg px-3 py-3 rounded-full shadow-lg hover:bg-green-600 transition-all"
    >
      <FaWhatsapp className="text-2xl" />
      Entre em contato comigo
    </a>
  );
};

export default ButtonWhatsApp;
