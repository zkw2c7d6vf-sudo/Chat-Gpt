// Explicit crowded layout for exercising every optional window in regression tests.
const ids = [
  "upnext",
  "priorities",
  "focus",
  "spotify",
  "weather",
  "email",
  "continue",
  "notes",
  "calendar",
  "ambient",
  "files",
];
const geometry = {
  upnext: [0, 0, 330, 190],
  priorities: [0, 210, 330, 390],
  focus: [355, 0, 340, 330],
  spotify: [355, 350, 340, 260],
  weather: [720, 0, 350, 325],
  email: [720, 345, 350, 360],
  continue: [0, 620, 330, 250],
  notes: [355, 630, 340, 265],
  calendar: [720, 725, 350, 350],
  ambient: [0, 890, 330, 220],
  files: [355, 915, 340, 240],
};
export const allWidgetLayout = {
  version: 1,
  space: "Today",
  scene: {
    id: "preset-nightfall",
    title: "Nightfall",
    category: "Space",
    background: "linear-gradient(#091329,#0a1021)",
  },
  spaces: {
    Today: Object.fromEntries(
      ids.map((id, index) => {
        const [x, y, width, height] = geometry[id];
        return [
          id,
          {
            x,
            y,
            width,
            height,
            z: index + 1,
            closed: false,
            minimized: false,
            expanded: false,
          },
        ];
      }),
    ),
  },
};
