import Link from "next/link";
import { FaWhatsapp } from "react-icons/fa";
import { RiInstagramFill } from "react-icons/ri";
import { instagram } from "@/public/consts/instagram";
import { whatsApp } from "@/public/consts/whatsApp";

const linkWhatsApp = `https://wa.me/${whatsApp.telefone}?text=${encodeURIComponent(whatsApp.mensagem)}`;
const linkInstagram = `https://www.instagram.com/${instagram.conta}`;

const socials = [
  {
    icon: <RiInstagramFill />,
    path: linkInstagram,
  },
  {
    icon: <FaWhatsapp />,
    path: linkWhatsApp,
  },
];

const Socials = ({ containerStyles, iconStyles }) => {
  return (
    <div className={containerStyles}>
      {socials.map((item, index) => (
        <Link href={item.path} key={index} className={iconStyles} target="_blank" rel="noopener noreferrer">
          <span>{item.icon}</span>
        </Link>
      ))}
    </div>
  );
};

export default Socials;
