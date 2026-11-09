import {
  CheckCircle2,
  Download,
  FileText,
  Globe2,
  Shield,
  Users,
} from "lucide-react";
import SupportMessageForm from "@/components/SupportMessageForm";

const setupSteps = [
  {
    title: "Play on Ionia",
    text: "ECL plays on the China server 艾欧尼亚, also known as Ionia. When choosing a server in WeGame, select that one.",
  },
  {
    title: "Install WeGame",
    text: "Use WeGame as your launcher. It handles launching League, server selection by Chinese server name, and can also act as a ping booster.",
  },
  {
    title: "Fix launch issues",
    text: "If League does not launch after the TenProtect window, check your Windows non-Unicode language setting. It may need to be set to Chinese Mandarin.",
  },
  {
    title: "Join ECL",
    text: "Once the client opens correctly, join the KOOK, introduce yourself, and start playing ranked inhouse lobbies with the community.",
  },
];

const languageSteps = [
  "Close League, Riot Client, and WeGame before editing anything.",
  "Find LeagueClientSettings, RiotClientSettings, and system YAML files. Common WeGame paths start with C:\\Program Files (x86)\\WeGameApps\\lol\\.",
  "Open the files with Notepad++ as administrator, otherwise your changes may not save.",
  "Find the locale lines and change zh_CN to en_US. In system, check available_locales, default_locale, and locale.",
  "Save the file, launch the game, and check whether the client opens in English.",
];

const languageFiles = [
  {
    name: "LeagueClientSettings",
    path: "C:\\Program Files (x86)\\WeGameApps\\lol\\LeagueClient\\Config",
  },
  {
    name: "RiotClientSettings",
    path: "C:\\Program Files (x86)\\WeGameApps\\lol\\Riot Client",
  },
  {
    name: "system",
    path: "C:\\Program Files (x86)\\WeGameApps\\lol\\LeagueClient",
  },
  {
    name: "RiotClientSettings",
    path: "C:\\Program Files (x86)\\WeGameApps\\rail_apps\\天甲",
  },
];

export default function DownloadLolChinaPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <section className="relative isolate overflow-hidden border-b border-[#1f1f1f] bg-[#050505]">
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(177,18,38,0.18),transparent_34%),radial-gradient(circle_at_72%_18%,rgba(209,26,42,0.18),transparent_26%)]" />
        <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(90deg,#fff_1px,transparent_1px),linear-gradient(#fff_1px,transparent_1px)] [background-size:76px_76px]" />

        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-[#b11226]">
            New player setup
          </p>
          <h1 className="mt-5 max-w-4xl text-[clamp(4rem,9vw,8rem)] font-black uppercase leading-[0.82] text-white [font-family:Anton,Impact,Arial_Black,Arial,sans-serif]">
            How to Play
            <span className="block text-[#b11226]">in China</span>
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[#9ca3af]">
            A practical setup guide for getting onto the China League client,
            choosing Ionia, fixing common launch issues, and joining ECL
            inhouses.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a
              href="https://www.wegame.com.cn/home/download"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-[#b11226] px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:bg-[#d11a2a] [clip-path:polygon(0_0,94%_0,100%_28%,100%_100%,6%_100%,0_72%)]"
            >
              Download WeGame
              <Download size={18} />
            </a>
            <a
              href="https://kook.vip/zBbRVQ"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 border border-[#24c766]/40 bg-[#16a34a] px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:border-[#34d577] hover:bg-[#22c55e]"
            >
              Download KOOK
              <Users size={18} />
            </a>
          </div>
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] bg-[#080808]">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-16 sm:px-6 md:grid-cols-2">
          {setupSteps.map((step, index) => (
            <div
              key={step.title}
              className="relative overflow-hidden border border-[#1f1f1f] bg-[#0d0d0d] p-6"
            >
              <div className="absolute right-0 top-0 h-full w-20 bg-[#b11226]/10 [clip-path:polygon(45%_0,100%_0,100%_100%,0_100%)]" />
              <div className="relative flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#b11226] text-sm font-black">
                  {index + 1}
                </div>
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-normal text-white">
                    {step.title}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-[#9ca3af]">
                    {step.text}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] bg-[#050505]">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-16 sm:px-6 lg:grid-cols-[0.52fr_0.48fr]">
          <div className="border border-[#1f1f1f] bg-[#0d0d0d] p-6">
            <Globe2 className="text-[#b11226]" size={30} />
            <h2 className="mt-5 text-3xl font-black uppercase tracking-normal text-white">
              Changing the client language
            </h2>
            <p className="mt-4 text-sm leading-6 text-[#9ca3af]">
              This is the community workaround for switching the China client
              from Chinese to English. Do it carefully and keep a backup of any
              file you edit.
            </p>

            <div className="mt-6 grid gap-3">
              {languageFiles.map((file) => (
                <div
                  key={`${file.name}-${file.path}`}
                  className="border border-[#1f1f1f] bg-black/35 p-4"
                >
                  <p className="text-sm font-black uppercase text-white">
                    {file.name}
                  </p>
                  <p className="mt-2 break-words text-xs leading-5 text-[#9ca3af]">
                    {file.path}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-3">
              {languageSteps.map((step, index) => (
                <div
                  key={step}
                  className="grid grid-cols-[2rem_1fr] gap-3 border border-[#1f1f1f] bg-black/35 p-4"
                >
                  <span className="font-black text-[#b11226]">{index + 1}</span>
                  <p className="text-sm leading-6 text-[#d1d5db]">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div className="border border-[#1f1f1f] bg-[#0d0d0d] p-6">
              <FileText className="text-[#b11226]" size={30} />
              <h2 className="mt-5 text-3xl font-black uppercase tracking-normal text-white">
                If it keeps resetting
              </h2>
              <p className="mt-4 text-sm leading-6 text-[#9ca3af]">
                Some players report that they only need to edit
                LeagueClientSettings.yaml and system.yaml. You may also need to
                mark the changed file as read-only so the client does not
                overwrite it.
              </p>
            </div>

            <div className="border border-[#1f1f1f] bg-[#0d0d0d] p-6">
              <Shield className="text-[#b11226]" size={30} />
              <h2 className="mt-5 text-3xl font-black uppercase tracking-normal text-white">
                Troubleshooting notes
              </h2>
              <div className="mt-4 space-y-3 text-sm leading-6 text-[#9ca3af]">
                <p>
                  If you cannot find the settings files, search Windows for
                  <span className="mx-1 font-bold text-white">.yaml</span>
                  files inside your League, Riot, or WeGame folders.
                </p>
                <p>
                  If the language change still does not work, Windows version or
                  client updates may be part of the issue. The KOOK community
                  can help compare working setups.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#050505]">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-16 sm:px-6 lg:grid-cols-3">
          {[
            {
              icon: CheckCircle2,
              title: "Server",
              text: "ECL games are played on 艾欧尼亚 / Ionia.",
            },
            {
              icon: Users,
              title: "Ask in KOOK",
              text: "If setup gets weird, ask in KOOK. Someone has probably hit the same issue before.",
            },
            {
              icon: Shield,
              title: "Admin mode",
              text: "When editing client settings, open your editor as administrator so changes actually save.",
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="border border-[#1f1f1f] bg-[#0d0d0d] p-6"
              >
                <Icon className="text-[#b11226]" size={28} />
                <h2 className="mt-5 text-2xl font-black uppercase tracking-normal text-white">
                  {item.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-[#9ca3af]">
                  {item.text}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="border-t border-[#1f1f1f] bg-[#080808]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[0.45fr_0.55fr] lg:items-start">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-[#b11226]">
              Still stuck?
            </p>
            <h2 className="mt-4 text-5xl font-black uppercase leading-none text-white [font-family:Anton,Impact,Arial_Black,Arial,sans-serif]">
              Leave a
              <span className="block text-[#b11226]">message.</span>
            </h2>
            <p className="mt-5 text-base leading-7 text-[#9ca3af]">
              Send a setup question and include a WeChat ID or email so an ECL
              admin can reply. Messages are routed to the ECL admin inbox.
            </p>
          </div>

          <div className="border border-[#1f1f1f] bg-[#0d0d0d] p-6">
            <SupportMessageForm />
          </div>
        </div>
      </section>
    </main>
  );
}
