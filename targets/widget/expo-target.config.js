/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = config => ({
  type: "widget",
  icon: "../../assets/logo.png",
  entitlements: {
    "com.apple.security.application-groups": ["group.com.mrcodeiq.dinar"],
  },
  info: {
    UIAppFonts: [
      "din-next-lt-w23-regular-1.ttf",
      "din-next-lt-w23-medium.ttf",
      "din-next-lt-w23-ultra-light-1.ttf"
    ]
  },
  assets: [
    "../../assets/fonts/din-next-lt-w23-regular-1.ttf",
    "../../assets/fonts/din-next-lt-w23-medium.ttf",
    "../../assets/fonts/din-next-lt-w23-ultra-light-1.ttf"
  ]
});