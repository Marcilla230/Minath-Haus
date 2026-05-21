export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        song: [
          "Songti SC",
          "STSong",
          "SimSun",
          "Noto Serif CJK SC",
          "serif",
        ],
        fangsong: [
          "FangSong",
          "STFangsong",
          "Songti SC",
          "Noto Serif CJK SC",
          "serif",
        ],
      },
      colors: {
        ink: "#020817",
        gold: "#7dd3fc",
        cinnabar: "#fb7185",
      },
    },
  },
  plugins: [],
};
