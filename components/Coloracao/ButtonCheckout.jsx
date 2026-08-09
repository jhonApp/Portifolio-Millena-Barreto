import { checkout } from "@/public/consts/checkout";

const ButtonCheckout = ({ label }) => {
  return (
    <a
      href={checkout.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center bg-accent text-white font-bold text-xl px-8 py-4 rounded-full shadow-lg hover:brightness-110 transition-all"
    >
      {label}
    </a>
  );
};

export default ButtonCheckout;
