import React from 'react';
import { FaInstagram } from "react-icons/fa";
import { instagram } from '@/public/consts/instagram';

const ButtonInstagram = () => {
  const linkInstagram = `https://www.instagram.com/${instagram.conta}`;

  return (
    <a
      href={linkInstagram}
      target="_blank"
      className="inline-flex items-center gap-2 bg-violet-300 text-white font-bold text-lg px-3 py-3 rounded-full shadow-lg hover:bg-violet-400 transition-all"
    >
      <FaInstagram className="text-2xl" />
      siga no Instagram
    </a>
  );
};

export default ButtonInstagram;
