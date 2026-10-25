import { useId } from "react";

export type AssistantCharacterState =
  "idle" | "listening" | "thinking" | "speaking";

/** Original little space companion; visual state is also announced by its caller. */
export default function AssistantCharacter({
  state = "idle",
  compact = false,
}: {
  state?: AssistantCharacterState;
  compact?: boolean;
}) {
  const id = useId().replace(/[^A-Za-z0-9_-]/g, "");
  return (
    <div
      className={`orbit-character character-${state}${compact ? " character-compact" : ""}`}
      aria-hidden="true"
    >
      <svg className="character-svg" viewBox="0 0 320 260" fill="none">
        <defs>
          <radialGradient id={`${id}-body`} cx=".33" cy=".15" r=".9">
            <stop stopColor="#C8D6FF" />
            <stop offset=".46" stopColor="#8B9DD7" />
            <stop offset="1" stopColor="#455384" />
          </radialGradient>
          <linearGradient
            id={`${id}-visor`}
            x1="105"
            y1="89"
            x2="214"
            y2="154"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#1C2A4A" />
            <stop offset="1" stopColor="#0A1224" />
          </linearGradient>
          <radialGradient id={`${id}-halo`}>
            <stop stopColor="#8FA9FF" stopOpacity=".17" />
            <stop offset="1" stopColor="#8FA9FF" stopOpacity="0" />
          </radialGradient>
          <linearGradient
            id={`${id}-ring`}
            x1="46"
            y1="162"
            x2="278"
            y2="90"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#A4BAEF" stopOpacity=".1" />
            <stop offset=".5" stopColor="#B9CAFF" stopOpacity=".8" />
            <stop offset="1" stopColor="#A4BAEF" stopOpacity=".1" />
          </linearGradient>
        </defs>
        <ellipse
          cx="160"
          cy="223"
          rx="66"
          ry="8"
          fill="#030A19"
          opacity=".45"
          className="character-shadow"
        />
        <circle cx="160" cy="127" r="118" fill={`url(#${id}-halo)`} />
        <g className="character-float">
          <g className="character-antenna">
            <path
              d="M160 64V43"
              stroke="#ACBEEB"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <circle cx="160" cy="37" r="7" fill="#C7ECA7" />
            <circle cx="158" cy="35" r="2" fill="#F0FFE2" />
          </g>
          <path
            d="M83 137C67 130 62 111 72 103C80 96 87 103 93 111"
            fill="#8096CC"
            stroke="#B5C8F2"
            strokeWidth="1.5"
            className="character-ear character-ear-left"
          />
          <path
            d="M237 137C253 130 258 111 248 103C240 96 233 103 227 111"
            fill="#8096CC"
            stroke="#B5C8F2"
            strokeWidth="1.5"
            className="character-ear character-ear-right"
          />
          <ellipse
            cx="160"
            cy="128"
            rx="78"
            ry="72"
            fill={`url(#${id}-body)`}
            stroke="#D0DDFF"
            strokeOpacity=".45"
            strokeWidth="1.5"
          />
          <path
            d="M104 86C115 73 134 66 154 66"
            stroke="#ECF1FF"
            strokeOpacity=".6"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <rect
            x="104"
            y="91"
            width="112"
            height="69"
            rx="28"
            fill={`url(#${id}-visor)`}
            stroke="#394F7B"
            strokeWidth="2"
          />
          <path
            d="M121 103H155"
            stroke="#6079AC"
            strokeOpacity=".24"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <g className="character-eyes">
            <rect
              x="126"
              y="113"
              width="11"
              height="20"
              rx="5.5"
              fill="#CDDDFE"
              className="character-eye character-eye-left"
            />
            <rect
              x="183"
              y="113"
              width="11"
              height="20"
              rx="5.5"
              fill="#CDDDFE"
              className="character-eye character-eye-right"
            />
          </g>
          <g className="character-cheeks" opacity=".65">
            <ellipse cx="120" cy="140" rx="8" ry="3" fill="#849BDB" />
            <ellipse cx="200" cy="140" rx="8" ry="3" fill="#849BDB" />
          </g>
          <path
            d="M148 138Q160 149 172 138"
            stroke="#C6E6B1"
            strokeWidth="3.5"
            strokeLinecap="round"
            className="character-smile"
          />
          <g
            className="character-voice"
            stroke="#D4E8C8"
            strokeWidth="3"
            strokeLinecap="round"
          >
            <path d="M148 138V143" />
            <path d="M156 135V147" />
            <path d="M164 133V149" />
            <path d="M172 137V144" />
          </g>
          <path
            d="M142 181H178"
            stroke="#CAD7F7"
            strokeOpacity=".35"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="160" cy="179" r="3" fill="#D3EABC" />
          <ellipse
            cx="160"
            cy="132"
            rx="122"
            ry="27"
            transform="rotate(-17 160 132)"
            stroke={`url(#${id}-ring)`}
            strokeWidth="2"
          />
          <circle
            cx="270"
            cy="99"
            r="5"
            fill="#D2E8B8"
            className="character-satellite"
          />
        </g>
        <g
          stroke="#9AB2EA"
          strokeLinecap="round"
          opacity=".65"
          className="character-sparkles"
        >
          <path d="M56 68V77M51.5 72.5H60.5" />
          <path d="M265 173V184M259.5 178.5H270.5" />
          <path d="M234 45V50M231.5 47.5H236.5" />
        </g>
        <circle cx="62" cy="183" r="2" fill="#B9CEAA" opacity=".7" />
        <circle cx="281" cy="66" r="1.5" fill="#9BB1E3" opacity=".7" />
      </svg>
    </div>
  );
}
