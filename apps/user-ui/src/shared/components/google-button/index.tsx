import * as React from "react";

const GoogleButton = () => {
  return (
    <div className="w-full flex justify-center">
      <div className="h-[46px] cursor-pointer border border-blue-100 flex items-center gap-2 px-3 rounded-[4px] my-2 bg-[rgba(210,227,252,0.3)]">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          x="0px"
          y="0px"
          width="30"
          height="30"
          viewBox="0 0 48 48"
        >
          <path
            fill="#fbc02d"
            d="M43.6 20.5H42V20H24v8h11.3C33.8 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12S17.4 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c10.5 0 19.5-7.6 19.5-20 0-1.3-.1-2.3-.4-3.5z"
          ></path>
          <path
            fill="#e53935"
            d="M6.3 14.7l6.6 4.8C14.6 16 19 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.1 29.3 4 24 4c-7.7 0-14.3 4.3-17.7 10.7z"
          ></path>
          <path
            fill="#4caf50"
            d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.2C29.3 35.5 26.8 36 24 36c-5.3 0-9.8-3.3-11.3-8l-6.6 5.1C9.6 39.5 16.2 44 24 44z"
          ></path>
          <path
            fill="#1565c0"
            d="M43.6 20.5H42V20H24v8h11.3c-1 3-3.6 5.5-7.3 6.6l6.3 5.2C39.7 36.1 44 30.8 44 24c0-1.3-.1-2.3-.4-3.5z"
          ></path>
        </svg>

        <span className="text-[16px] opacity-[.8] font-Poppins">
          Sign in with Google
        </span>
      </div>
    </div>
  );
};

export default GoogleButton;