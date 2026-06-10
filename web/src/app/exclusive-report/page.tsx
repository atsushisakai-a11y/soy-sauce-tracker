export default function ExclusiveReportPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      {/* Hero */}
      <div className="text-center mb-12">
        <div className="text-5xl mb-4">🫙📊</div>
        <h1 className="text-3xl font-bold text-stone-900 mb-3">
          Exclusive Soy Sauce Market Report
        </h1>
        <p className="text-stone-500 text-lg max-w-xl mx-auto">
          Deep-dive analysis of European soy sauce pricing trends — delivered
          straight to your inbox by <span className="font-semibold text-amber-700">Soy Bot</span>.
        </p>
      </div>

      {/* What's inside */}
      <section className="bg-amber-50 border border-amber-200 rounded-2xl p-8 mb-8">
        <h2 className="text-xl font-bold text-stone-800 mb-5">What you get</h2>
        <ul className="space-y-3">
          {[
            "📈 Monthly price trend analysis across 10+ European shops",
            "🏷️ Brand-level comparison: Kikkoman, Pearl River Bridge, Lee Kum Kee & more",
            "💡 AI-powered insight summaries written in plain English",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-stone-700">
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* CTA */}
      <section className="bg-white border border-stone-200 rounded-2xl p-8 mb-8 text-center shadow-sm">
        <h2 className="text-xl font-bold text-stone-800 mb-2">
          Sign up via Telegram
        </h2>
        <p className="text-stone-500 mb-6 text-sm">
          Chat with <strong>Soy Bot</strong> on Telegram to register. It only
          takes 2 minutes — the bot will ask a quick question and collect your
          email for the report.
        </p>

        <a
          href="https://t.me/soy_sauce_tracker_bot"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-[#229ED9] hover:bg-[#1a8cbf] text-white font-semibold px-7 py-3 rounded-xl transition-colors text-base"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden>
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
          </svg>
          Open Soy Bot on Telegram
        </a>

        <div className="mt-4 inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 text-xs font-medium px-3 py-1.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse inline-block"></span>
          Beta — currently available for testing
        </div>
      </section>

      {/* How it works */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-stone-800 mb-5">How it works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              step: "1",
              title: "Start the bot",
              desc: 'Open Telegram and tap "Start" on Soy Bot.',
            },
            {
              step: "2",
              title: "Answer one question",
              desc: "Tell Soy Bot why you're interested. It'll respond with something surprisingly funny.",
            },
            {
              step: "3",
              title: "Leave your email",
              desc: "The bot saves your details and you'll receive the next report by email.",
            },
          ].map(({ step, title, desc }) => (
            <div
              key={step}
              className="bg-stone-100 rounded-xl p-5 flex flex-col gap-2"
            >
              <span className="w-8 h-8 rounded-full bg-amber-600 text-white text-sm font-bold flex items-center justify-center">
                {step}
              </span>
              <h3 className="font-semibold text-stone-800">{title}</h3>
              <p className="text-stone-500 text-sm">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Privacy note */}
      <p className="text-center text-xs text-stone-400">
        Your data is stored securely and only used to send you the report.
        You can delete your registration at any time by typing{" "}
        <code className="font-mono bg-stone-100 px-1 rounded">/delete</code>{" "}
        in Soy Bot.
      </p>
    </main>
  );
}
