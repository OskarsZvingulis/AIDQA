"use client";

export function GameButton() {
  return (
    <a
      href="/aidqa-drift-game.html"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed top-[76px] right-0 z-40 flex items-center justify-center w-28 h-28 group"
      aria-label="Play the game"
    >
      <img
        src="/aidqa_elements.svg"
        alt=""
        className="absolute inset-0 w-full h-full transition-transform duration-200 group-hover:scale-105"
      />
      <span className="relative z-10 text-white font-bold text-sm text-center leading-snug">
        Play<br />the game
      </span>
    </a>
  );
}
