cask "chatgpt" do
   version "1.0.0"
   sha256 "afe420f2a7297671389aae0080d67a9ed0bf69793d63d9f7f459e9d6082235dc"

  url "https://github.com/SpellboundScents/ChatGPT/releases/download/v#{version}/ChatGPT_#{version}_x64.dmg"
  name "ChatGPT"
  desc "Desktop wrapper for OpenAI ChatGPT"
  homepage "https://github.com/SpellboundScents/ChatGPT#readme"

  app "ChatGPT.app"

  uninstall quit: "com.chirv.chatgpt"

  zap trash: [
    "~/.chatgpt",
    "~/Library/Caches/com.chirv.chatgpt",
    "~/Library/HTTPStorages/com.chirv.chatgpt.binarycookies",
    "~/Library/Preferences/com.chirv.chatgpt.plist",
    "~/Library/Saved Application State/com.chirv.chatgpt.savedState",
    "~/Library/WebKit/com.chirv.chatgpt",
  ]
end
