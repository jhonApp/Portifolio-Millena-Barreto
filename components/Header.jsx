"use client";
import Logo from "./Logo";

const Header = () => {
  return (
    <header className="w-full absolute py-8 xl:py-[48px] z-50">
      <div className="container mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-4 lg:justify-between">
          {/* logo */}
          <Logo />
        </div>
      </div>
    </header>
  );
};

export default Header;
