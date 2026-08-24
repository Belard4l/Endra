import * as React from 'react';
const CartIcon = (props: any) => (
    <svg
        width={30}
        height={30}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
    >
        <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M6 6H4C3.44772 6 3 6.44772 3 7C3 7.55228 3.44772 8 4 8H5.21429L7.85714 14.1429C8.05054 14.5062 8.42311 14.75 8.83333 14.75H16.1667C16.5769 14.75 16.9495 14.5062 17.1429 14.1429L19.2857 9.85714C19.3791 9.64566 19.4476 9.41421 19.4882 9.17157C19.5287 8.92893 19.5408 8.67861 19.5241 8.42857H7.60526L7.10263 6.85714H18C18.5523 6.85714 19 6.40942 19 5.85714C19 5.30486 18.5523 4.85714 18 4.85714H6Z"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
        />  
        <circle
            cx={9}
            cy={20} 
            r={1}
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);
export default CartIcon;