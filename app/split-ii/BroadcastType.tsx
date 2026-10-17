// Original condensed lettering for the broadcast lockup, with chamfered corners.
// Inline vectors keep the headline consistent without an external font request.
const glyphs: Record<string, string> = {
  E: "M10 0H60V25H24V66H54V92H24V135H60V160H10L0 150V10Z",
  C: "M10 0H50L60 10V47H36V25H24V135H36V113H60V150L50 160H10L0 150V10Z",
  L: "M0 0H24V135H60V160H0Z",
  S: "M10 0H50L60 10V47H36V25H24V66H50L60 76V150L50 160H10L0 150V113H24V135H36V92H10L0 82V10Z",
  I: "M0 0H24V160H0Z",
  G: "M10 0H50L60 10V47H36V25H24V135H36V97H30V73H60V150L50 160H10L0 150V10Z",
  N: "M0 0H22L38 77V0H60V160H38L22 83V160H0Z",
  U: "M0 0H24V135H36V0H60V150L50 160H10L0 150Z",
  P: "M0 0H50L60 10V85L50 95H24V160H0ZM24 25V70H36V25Z",
  T: "M0 0H60V25H42V160H18V25H0Z",
  D: "M0 0H42L60 18V142L42 160H0ZM24 25V135H36V25Z",
  R: "M0 0H50L60 10V85L47 98L60 160H36L24 95V160H0ZM24 25V70H36V25Z",
  A: "M0 160V10L10 0H50L60 10V160H36V96H24V160ZM24 25V71H36V25Z",
  F: "M0 0H60V25H24V66H54V92H24V160H0Z",
  "2": "M10 0H50L60 10V77L24 113V135H60V160H0V103L36 67V25H24V47H0V10Z",
  "0": "M10 0H50L60 10V150L50 160H10L0 150V10ZM24 25V135H36V25Z",
  "6": "M10 0H50L60 10V47H36V25H24V66H50L60 76V150L50 160H10L0 150V10ZM24 92V135H36V92Z",
};

export default function BroadcastType({ text, className }: { text: string; className?: string }) {
  let offset = 0;
  const letters = Array.from(text).map((letter, index) => {
    const x = offset;
    offset += letter === " " ? 27 : letter === "I" ? 34 : 70;
    return letter === " " ? null : <path key={index} d={glyphs[letter]} transform={`translate(${x} 0)`} />;
  });

  return (
    <svg className={className} viewBox={`0 0 ${offset - 10} 160`} role="img" aria-label={text} fill="currentColor" fillRule="evenodd">
      {letters}
    </svg>
  );
}
